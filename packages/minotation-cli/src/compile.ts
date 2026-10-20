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
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import {
  join,
  resolve,
} from 'node:path';
import {
  presetHints,
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
  MnWarning,
  OptionSchema,
  MnPreset,
} from 'minotation';
import {
  BUILD_OPTIONS_SCHEMA,
  CORE_OPTION_KEYS,
  createBuildCollector,
  createFileFilter,
  createMatcher,
  createScopeRewriter,
} from 'minotation-build';
import type {
  BuildOutput,
  Metrics,
  MnAttrs,
  MnCoreOptions,
  MnEntryOptions,
  MnFileMatcher,
  MnScopeRule,
  ScopeRewrite,
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
    'scopePresets',
    'scopes',
    'isolateMode',
    'unreachableClassMode',
    'attrs',
    'syntax',
    'include',
    'exclude',
    'skipPartials',
    'entry',
    'manifest',
    'metrics',
    'notationConflictMode',
  ]),
  input: isString,
  output: isString,
  ignore: isStringArray,
  isolateOut: isString,
  isolateCopy: (value) => (typeof value === 'boolean' || isCopyMatcher(value)
    ? undefined : 'true, false, a path or glob, a RegExp, a function or an array of them'),
};

/** Шаблон копирования `isolateCopy`: путь или glob, RegExp, функция — или массив из них. */
function isCopyMatcher(value: unknown): boolean {
  return typeof value === 'string' || value instanceof RegExp || typeof value === 'function'
    || Array.isArray(value) && value.length > 0 && value.every(isCopyMatcher);
}

function fail(message: string): never {
  throw new Error('[minotation] ' + message);
}

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
 * (`altColor`, `warningMode`, `media`, `maxDepth`, `onWarning`,
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
  presets?: MnPreset[];
  /** Пресеты, которые могут потребовать пакеты (D-078). */
  scopePresets?: MnPreset[];
  /** Правила для пакетов и путей (D-080…D-082). */
  scopes?: MnScopeRule[];
  /** Изоляция областей пакетов (D-075…D-077). */
  isolateMode?: 'none' | 'class' | 'where';
  /** Класс задан из JS в файле изолированной области (D-076). */
  unreachableClassMode?: 'warn' | 'silent' | 'strict';
  /**
   * Каталог для исходников с классом области (D-079): дерево `input` повторяется в нём; оригиналы
   * не трогаются. Нужен `isolateMode` не `'none'`.
   */
  isolateOut?: string;
  /**
   * Какие неизменённые файлы копировать в `isolateOut` (D-081): `true` — все (по умолчанию),
   * `false` — только изменённые, путь/glob/RegExp/функция — по шаблону.
   * @default true
   */
  isolateCopy?: boolean | MnFileMatcher;
  /** Несколько CSS из одного прохода (D-030); `--output` тогда содержит `[name]`. */
  entry?: Record<string, MnEntryOptions>;
  /** Конфликт режимов синтаксиса между файлами (D-045): `warn` или `strict`. */
  notationConflictMode?: 'warn' | 'strict';
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
  /** Файлы изолированных областей с классом области: путь → код (D-079). */
  rewritten: Record<string, string>;
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
    entry: settings.entry,
    scopePresets: settings.scopePresets,
    scopes: settings.scopes,
    isolateMode: settings.isolateMode,
    unreachableClassMode: settings.unreachableClassMode,
    notationConflictMode: settings.notationConflictMode,
    presets: settings.presets || [
      // Подсказки — первыми: любой пресет ниже перекрывает их хендлеры (D-024).
      presetHints,
      presetStandard,
      presetSynonyms,
      presetMedias,
      presetNormalize,
      presetMain,
    ],
    ...coreOf(settings),
  }, resolve(settings.input));
  settings.isolateOut && (settings.isolateMode || 'none') === 'none'
    && fail('compile: "isolateOut" needs "isolateMode" \'class\' or \'where\' — without isolation there is nothing to rewrite');
  const l = files.length;
  const sources: string[] = [];
  let i = 0;
  for (; i < l; i++) {
    build.add(files[i], sources[i] = readFileSync(files[i], 'utf8'));
  }
  // Файлы изолированных областей — с классом области в разметке (D-075, D-076, D-079).
  const rewrite = createScopeRewriter(settings);
  const rewritten: Record<string, string> = {};
  const unreachable: MnWarning[] = [];
  let scoped: ScopeRewrite | undefined;
  for (i = 0; i < l; i++) {
    scoped = rewrite(
      build, files[i], sources[i],
    );
    if (!scoped) {
      continue;
    }
    scoped.code === undefined || (rewritten[files[i]] = scoped.code);
    for (const message of scoped.warnings) {
      unreachable.push({
        type: 'unreachable-class',
        token: '',
        message,
      });
    }
  }
  const outputs = build.outputs();
  const metrics = build.metrics();
  return {
    css: outputs.map((output) => output.css).filter(Boolean).join('\n'),
    outputs,
    files: l,
    tokens: metrics.tokensTotal,
    warnings: build.takeWarnings().concat(unreachable),
    metrics,
    rewritten,
  };
}

