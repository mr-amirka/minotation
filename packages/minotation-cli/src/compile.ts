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
} from 'minotation';
import type {
  MnInstance, MnOptions, MnWarning,
} from 'minotation';
import {
  createAttrsScanner, createBuildCollector, createFileFilter, createMatcher, flatSafelist,
} from 'minotation-build';
import type {
  BuildOutput, MnAttrs, MnEntryOptions, MnFileMatcher,
} from 'minotation-build';

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

/** Настройки сборки — то, что CLI собирает из аргументов и конфига. */
export interface CompileSettings {
  /** Файл или директория для сканирования. */
  input: string;
  /**
   * Какие атрибуты сканировать и во что разворачивать — как в v1 (D-025):
   * `'class, className:class'`, массив или объект. По умолчанию `'class'`.
   */
  attrs?: MnAttrs;
  /** Префикс селекторов. */
  prefix?: string;
  /** Запасное непрозрачное объявление рядом с `rgba`. */
  altColor?: boolean;
  /** Прерывать работу на первом битом токене. */
  strict?: boolean;
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
  /**
   * Собирать статистику употребления токенов (см. {@link Metrics}).
   *
   * Отдельный флаг, а не всегда: счётчики по файлам держат в памяти запись на
   * каждый файл, а нужны они в разовых разборах — «что в проекте вообще
   * используется», «какие токены остались от удалённого компонента».
   */
  metrics?: boolean;
  /** Остальные опции ядра. */
  mn?: MnOptions;
  /** Несколько CSS из одного прохода (D-030); `--output` тогда содержит `[name]`. */
  entry?: Record<string, MnEntryOptions>;
}

/** Сколько раз встретился токен. */
export interface TokenCount {
  /** Сам токен. */
  name: string;
  /** Сколько раз встретился — во всех файлах или в одном, по месту. */
  count: number;
}

/**
 * Статистика употребления токенов — то, что пишет `--metrics`.
 *
 * Формат перенесён из v1 (`old/minimalist-notation/node/index.js`): список
 * `{name, count}` по убыванию частоты. Разбивка по файлам лежит рядом, в
 * `files`, а не в отдельном отчёте: в v1 это были две опции (`--metrics` и
 * `--metricsFiles`), писавшие два файла с пересекающимся содержимым.
 */
export interface Metrics {
  /** Всего просканировано файлов. */
  filesScanned: number;
  /**
   * Уникальных токенов, попавших в CSS, — включая `safelist`, которого в
   * файлах не было. Счётчики в {@link Metrics.tokens} считают только
   * встреченное в файлах, поэтому числа могут расходиться.
   */
  tokensTotal: number;
  /** Сколько раз токены встретились суммарно, с повторами. */
  occurrences: number;
  /** Токены по убыванию частоты. */
  tokens: TokenCount[];
  /** Токены по файлам: путь → список, тоже по убыванию частоты. */
  files: Record<string, TokenCount[]>;
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
  /** Статистика употребления — собирается только при `metrics: true`. */
  metrics?: Metrics;
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
 * вызывающий — у CLI это зависит от `--strict`.
 */
export function compile(settings: CompileSettings): CompileResult {
  const files = collectFiles(
    settings.input, settings, settings.ignore,
  );
  // Тот же сканер с разворачиванием атрибутов, что у плагинов сборщиков:
  // записи `'<целевой атрибут> <токен>'`.
  // Настройки целиком: устаревший `attr` из конфига — ошибка с подсказкой,
  // а не молчаливая потеря токенов (D-025).
  const scan = createAttrsScanner({
    ...('attr' in settings ? {
      attr: (settings as { attr?: unknown }).attr, 
    } : {}),
    attrs: settings.attrs,
    syntax: settings.syntax,
  });
  const tokens = new Set<string>(flatSafelist(settings.safelist).map((token) => 'class ' + token));
  // Счётчики заводятся только под `--metrics`: на каждый файл это лишняя
  // запись в памяти, а обычной сборке они не нужны.
  const counts: Record<string, number> | 0 = settings.metrics ? {} : 0;
  const byFile: Record<string, Record<string, number>> | 0 = settings.metrics ? {} : 0;
  const l = files.length;
  let i = 0;
  let found: string[];
  let j: number;
  let n: number;
  let fileCounts: Record<string, number>;
  let token: string;
  for (; i < l; i++) {
    found = scan(readFileSync(files[i], 'utf8'), files[i]);
    n = found.length;
    if (counts) {
      fileCounts = (byFile as Record<string, Record<string, number>>)[files[i]] = {};
      for (j = 0; j < n; j++) {
        tokens.add(found[j]);
        token = metricKey(found[j]);
        counts[token] = (counts[token] || 0) + 1;
        fileCounts[token] = (fileCounts[token] || 0) + 1;
      }
      continue;
    }
    for (j = 0; j < n; j++) {
      tokens.add(found[j]);
    }
  }
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
    mn: {
      ...settings.mn,
      selectorPrefix: settings.prefix,
      altColor: settings.altColor,
      strict: settings.strict,
    },
  }, resolve(settings.input));
  for (i = 0; i < l; i++) {
    build.add(files[i], readFileSync(files[i], 'utf8'));
  }
  const outputs = build.outputs();
  return {
    css: outputs.map((output) => output.css).filter(Boolean).join('\n'),
    outputs,
    files: l,
    tokens: tokens.size,
    warnings: build.takeWarnings(),
    metrics: counts
      ? buildMetrics(
        l, tokens.size, counts, byFile as Record<string, Record<string, number>>,
      )
      : undefined,
  };
}

/**
 * Ключ статистики для записи сканера: у класса — сам токен, у другого
 * целевого атрибута — `атрибут:токен` (`m:p10`), чтобы они не смешивались.
 */
function metricKey(entry: string): string {
  const at = entry.indexOf(' ');
  const target = entry.slice(0, at);
  return target === 'class' ? entry.slice(at + 1) : target + ':' + entry.slice(at + 1);
}

/** Раскладывает счётчики в отчёт: списки по убыванию частоты. */
function buildMetrics(
  filesScanned: number,
  tokensTotal: number,
  counts: Record<string, number>,
  byFile: Record<string, Record<string, number>>,
): Metrics {
  const tokens = sortedCounts(counts);
  const files: Record<string, TokenCount[]> = {};
  let occurrences = 0;
  const l = tokens.length;
  let i = 0;
  for (; i < l; i++) {
    occurrences += tokens[i].count;
  }
  // §6.2: переменная тела цикла объявляется один раз, до него.
  let list: TokenCount[];
  for (const path in byFile) {
    // Файл без единого токена в отчёт не попадает: пустых записей в проекте
    // больше, чем содержательных, и они только мешают читать.
    list = sortedCounts(byFile[path]);
    list.length && (files[path] = list);
  }
  return {
    filesScanned,
    tokensTotal,
    occurrences,
    tokens,
    files,
  };
}

/** `{ токен: счётчик }` → список по убыванию частоты, при равенстве — по имени. */
function sortedCounts(counts: Record<string, number>): TokenCount[] {
  const out: TokenCount[] = [];
  for (const name in counts) {
    out.push({
      name,
      count: counts[name],
    });
  }
  // Имя вторым ключом — чтобы отчёт не менялся от прогона к прогону: иначе
  // токены с одинаковой частотой шли бы в случайном порядке, и сравнивать две
  // выгрузки было бы нечем.
  return out.sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : 1));
}
