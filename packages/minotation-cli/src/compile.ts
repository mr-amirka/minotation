/**
 * Сбор токенов из файлов и компиляция в CSS.
 *
 * Сканирование берётся из ядра (`createScanner`), а не пишется здесь заново:
 * свой разбор в плагине уже приводил к тому, что возможность работала в одном
 * сборщике и молча отсутствовала в остальных (`classVarSuffixes` был только в
 * vite до 2026-09-25). Выбор между текстовым и синтаксическим разбором тоже
 * делает ядро — отсюда только имя файла.
 *
 * @module compile
 */
import {
  readdirSync, readFileSync, statSync,
} from 'node:fs';
import {
  join, resolve,
} from 'node:path';
import {
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
  checkOptions,
  isString,
  isStringArray,
} from 'minotation';
import type {
  MnInstance, MnWarning, OptionSchema,
} from 'minotation';
import {
  BUILD_OPTIONS_SCHEMA, CORE_OPTION_KEYS, createBuildCollector, createFileFilter, createMatcher,
} from 'minotation-build';
import type {
  BuildOutput, Metrics, MnAttrs, MnCoreOptions, MnEntryOptions, MnFileMatcher,
} from 'minotation-build';

/**
 * Допустимые поля конфига `mn.config.js` и настроек {@link compile} (D-038):
 * общий набор плагинов, кроме того, что у CLI задаётся иначе (`output` вместо
 * `fileName`, корень — `input`), плюс свои поля CLI.
 */
export const CONFIG_SCHEMA: OptionSchema = {
  ...pick(BUILD_OPTIONS_SCHEMA, [
    ...CORE_OPTION_KEYS,
    'presets',
    'attrs',
    'syntax',
    'include',
    'exclude',
    'skipPartials',
    'safelist',
    'entry',
    'manifest',
    'metrics',
  ]),
  input: isString,
  output: isString,
  ignore: isStringArray,
};

/** Подмножество схемы по списку ключей. */
function pick(schema: OptionSchema, keys: readonly string[]): OptionSchema {
  const out: OptionSchema = {};
  for (const key of keys) {
    out[key] = schema[key];
  }
  return out;
}

/** Расширения, которые сканируются, если не задано иное. */
const DEFAULT_EXTENSIONS = [
  '.html',
  '.htm',
  '.php',
  '.vue',
  '.svelte',
  '.astro',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
];

/** Что не сканируется никогда. */
const DEFAULT_EXCLUDE = /[\\/](?:node_modules|\.git|dist|build)[\\/]/;

/**
 * Настройки сборки — то, что CLI собирает из аргументов и конфига. Поля ядра
 * (`selectorPrefix`, `altColor`, `warningMode`, `media`, `maxDepth`, `onWarning`,
 * `onError`) — плоско, как в опциях плагинов и в v1 (D-034).
 */
export interface CompileSettings extends MnCoreOptions {
  /** Файл или директория для сканирования. */
  input: string;
  /**
   * Какие атрибуты сканировать и во что разворачивать — как в v1 (D-025):
   * `'class, className:class'`, массив или объект. По умолчанию `'class'`.
   */
  attrs?: MnAttrs;
  /**
   * Разбирать ли `.js/.jsx/.ts/.tsx` парсером вместо текстового поиска.
   *
   * По умолчанию — автоматически: есть `typescript` — разбором, нет — текстом.
   * Разбор снимает ложные токены из примеров разметки в JSDoc, из
   * закомментированного кода, из строк с кавычкой внутри регулярного литерала.
   * `false` выключает его совсем (флаг `--no-syntax`). Остальные форматы
   * (`.html`, `.vue`, …) сканируются текстом при любом значении.
   */
  syntax?: boolean;
  /**
   * Какие файлы брать — RegExp, путь, функция или массив, как в v1
   * (`MnFileMatcher` из `minotation-build`). По умолчанию — по расширениям.
   */
  include?: MnFileMatcher;
  /**
   * Какие файлы и каталоги пропускать — в тех же формах. Заменяет умолчание
   * (`node_modules`, `.git`, `dist`, `build`).
   */
  exclude?: MnFileMatcher;
  /** Пропускать файлы-партиалы `_*` (D-027). По умолчанию сканируются. */
  skipPartials?: boolean;
  /**
   * Пути, которые не сканируются, как бы ни были настроены фильтры.
   *
   * Сюда попадает файл конфигурации: он лежит в корне проекта, подходит под
   * расширение `.js` и иначе сканировался бы как исходник.
   */
  ignore?: string[];
  /** Пресеты; по умолчанию стандартный набор. */
  presets?: Array<(mn: MnInstance) => void>;
  /** Токены, которые нужны всегда, даже если их нет в файлах; группы через пробел. */
  safelist?: string[];
  /** Несколько CSS из одного прохода (D-030); `--output` тогда содержит `[name]`. */
  entry?: Record<string, MnEntryOptions>;
}

/** Результат сборки. */
export interface CompileResult {
  /** Готовый CSS — всех записей подряд. */
  css: string;
  /** CSS по записям `entry` (без `entry` — одна запись `mn`). */
  outputs: BuildOutput[];
  /** Сколько файлов просканировано. */
  files: number;
  /** Сколько уникальных токенов найдено. */
  tokens: number;
  /** Предупреждения ядра. */
  warnings: MnWarning[];
  /** Статистика употребления токенов (D-032) — общий отчёт `minotation-build`. */
  metrics: Metrics;
}

/**
 * Рекурсивно обходит путь и возвращает файлы, подходящие под фильтры.
 *
 * Одиночный файл тоже принимается: `mn ./index.html` — рабочий случай, и
 * заставлять указывать директорию ради одного файла незачем.
 */
export function collectFiles(
  input: string,
  options: Pick<CompileSettings, 'include' | 'exclude' | 'skipPartials'> = {},
  ignore?: string[],
): string[] {
  const out: string[] = [];
  const root = resolve(input);
  // Каталоги отсекаются тем же `exclude`, что и файлы: зайти в `node_modules`
  // и выбросить всё найденное там — лишняя работа на порядки.
  const skip = createMatcher(options.exclude, root) || ((path: string) => DEFAULT_EXCLUDE.test(path));
  const files = createFileFilter({
    extensions: DEFAULT_EXTENSIONS,
    include: options.include,
    skipPartials: options.skipPartials,
  }, root);
  const ignored = new Set<string>();
  const l = ignore ? ignore.length : 0;
  let i = 0;
  for (; i < l; i++) {
    ignored.add(resolve(ignore![i]));
  }
  walk(
    input, out, files.accepts, skip, ignored, 1,
  );
  return out;
}

/**
 * @param root — `1` для пути, указанного пользователем. Такой файл берётся без
 *   фильтра по расширению: автор уже выбрал его сам, и `mn ./page.tmpl` должен
 *   работать. Фильтр нужен только при обходе директории.
 */
function walk(
  path: string,
  out: string[],
  accepts: (path: string) => boolean,
  skip: (path: string) => boolean,
  ignored: Set<string>,
  root?: 1,
): void {
  if (skip(path) || ignored.has(resolve(path))) {
    return;
  }
  const stat = statSync(path, {
    throwIfNoEntry: false,
  });
  if (!stat) {
    return;
  }
  if (stat.isFile()) {
    (root || accepts(path)) && out.push(path);
    return;
  }
  if (!stat.isDirectory()) {
    return;
  }
  const names = readdirSync(path);
  const l = names.length;
  let i = 0;
  for (; i < l; i++) {
    walk(
      join(path, names[i]), out, accepts, skip, ignored,
    );
  }
}

/**
 * Собирает CSS из файлов по указанному пути.
 *
 * Предупреждения ядра собираются и возвращаются, а не печатаются: решение,
 * что с ними делать (вывести, посчитать, уронить сборку), принимает
 * вызывающий — у CLI это зависит от `--warning-mode`.
 */
/** Поля ядра из настроек — только заданные. */
function coreOf(settings: CompileSettings): MnCoreOptions {
  const out: Record<string, unknown> = {};
  for (const key of CORE_OPTION_KEYS) {
    settings[key] === undefined || (out[key] = settings[key]);
  }
  return out as MnCoreOptions;
}

export function compile(settings: CompileSettings): CompileResult {
  checkOptions(
    settings, CONFIG_SCHEMA, 'compile',
  );
  const files = collectFiles(
    settings.input, settings, settings.ignore,
  );
  // CSS — общим накопителем, как у плагинов: записи `entry`, их фильтры,
  // пресеты и разворачивание атрибутов (D-025, D-030).
  const build = createBuildCollector({
    attrs: settings.attrs,
    syntax: settings.syntax,
    safelist: settings.safelist,
    entry: settings.entry,
    presets: settings.presets || [
      presetStandard,
      presetSynonyms,
      presetMedias,
      presetNormalize,
      presetMain,
    ],
    ...coreOf(settings),
  }, resolve(settings.input));
  const l = files.length;
  let i = 0;
  for (; i < l; i++) {
    build.add(files[i], readFileSync(files[i], 'utf8'));
  }
  const outputs = build.outputs();
  const metrics = build.metrics();
  return {
    css: outputs.map((output) => output.css).filter(Boolean).join('\n'),
    outputs,
    files: l,
    tokens: metrics.tokensTotal,
    warnings: build.takeWarnings(),
    metrics,
  };
}

