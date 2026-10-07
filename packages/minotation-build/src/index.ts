/**
 * Общий каркас плагинов сборщиков: накопитель токенов и обход файлов.
 *
 * Сканер уже был общим (`createScanner`), но всё остальное продолжало
 * дублироваться между `minotation-vite`, `-rollup`, `-esbuild`, `-webpack`:
 * учёт токенов по файлам, снятие файла с учёта, создание mn-инстанса,
 * применение пресетов, генерация CSS, кеш и проброс предупреждений. Три
 * реализации `walkFiles` совпадали побайтово.
 *
 * Цена дублирования известна по опыту: механизм, доработанный в одном плагине,
 * в остальных молча отсутствует (`classVarSuffixes` жил только в vite до
 * 2026-09-25), а баг, исправленный в одном, остаётся в четырёх.
 *
 * Отдельный пакет, а не подпуть ядра: здесь `node:fs`, а `minotation` работает
 * и в браузере — тащить туда файловую систему нельзя. Подпуть (`minotation/build`)
 * пробовался первым и уперся в инструменты: ts-jest подменяет `module` на
 * CommonJS, связка с `moduleResolution: Node16` распадается, TS откатывается на
 * классический резолвер и полей `exports` не читает. Обычный пакет резолвится
 * везде одинаково и не требует настроек в каждом потребителе.
 *
 * @module minotation-build
 */
import {
  readdirSync, statSync,
} from 'node:fs';
import {
  createHash,
} from 'node:crypto';
import {
  basename, join, relative,
} from 'node:path';
import {
  CORE_OPTIONS_SCHEMA, checkOptions, createScanner, isBoolean, isBooleanOrString,
  isFunction, isFunctionArray, isString, isStringArray, minotationProvider, optionsOf,
} from 'minotation';
import type {
  MnInstance, MnOptions, MnWarning, OptionCheck, OptionSchema, ScannerOptions,
} from 'minotation';

/** Пресет — функция, донастраивающая mn-инстанс. */
export type MnPreset = (mn: MnInstance) => void;

/**
 * Какие атрибуты сканировать и во что разворачивать их селекторы (D-025, как в v1).
 *
 * Ключ — атрибут в разметке, значение — атрибут, в который компилируется селектор:
 * `class` → `.ws`, любой другой → `[name~="ws"]`. Имя без `:` разворачивается в себя.
 *
 * - строка: `'class, className:class'` (разделители — пробел, `|`, `,`, `;`);
 * - массив: `['class', 'className:class']`;
 * - объект: `{ class: 'class', className: 'class' }`.
 *
 * `attrs: ['class', 'className']` даёт `.ws` и `[className~="ws"]` — чтобы React-
 * `className` давал классы, его нужно развернуть в `class`: `'className:class'`.
 */
export type MnAttrs = string | string[] | Record<string, string>;

const REGEXP_ATTRS_SPLIT = /[\s|,;]+/;

/**
 * Разбирает {@link MnAttrs} в карту «сканируемый атрибут → целевой».
 *
 * @param attrs — опция `attrs`; пусто — `{ class: 'class' }`
 * @returns непустая карта
 * @throws если после разбора не осталось ни одного атрибута — иначе сборка
 *   молча не нашла бы ни одного токена
 *
 * @example
 * parseAttrs('class, className:class')   // → { class: 'class', className: 'class' }
 * parseAttrs(['m', 'm-n'])               // → { m: 'm', 'm-n': 'm-n' }
 */
export function parseAttrs(attrs?: MnAttrs): Record<string, string> {
  if (attrs === undefined || attrs === null) {
    return {
      class: 'class', 
    };
  }
  const out: Record<string, string> = {};
  let found = 0;
  if (typeof attrs === 'string' || Array.isArray(attrs)) {
    const items = typeof attrs === 'string' ? attrs.split(REGEXP_ATTRS_SPLIT) : attrs;
    let at: number;
    let from: string;
    let to: string;
    for (const item of items) {
      at = item.indexOf(':');
      from = (at > -1 ? item.slice(0, at) : item).trim();
      to = (at > -1 ? item.slice(at + 1) : item).trim();
      from && to && (out[from] = to, found++);
    }
  } else {
    let to: unknown;
    for (const from of Object.keys(attrs)) {
      to = attrs[from];
      from && typeof to === 'string' && to && (out[from] = to, found++);
    }
  }
  if (!found) {
    throw new Error('[minotation] attrs is empty: ' + JSON.stringify(attrs)
      + '. Expected e.g. "class", "class, className:class" or { className: "class" }');
  }
  return out;
}

/** Поля ядра, которые в опциях плагина лежат плоско, как в v1 (D-034). */
export const CORE_OPTION_KEYS = [
  'selectorPrefix',
  'altColor',
  'warningMode',
  'media',
  'maxDepth',
  'maxDepthMode',
  'onWarning',
  'onError',
] as const;

/** Опции ядра в опциях плагина — на верхнем уровне, без вложенного `mn` (D-034). */
export type MnCoreOptions = Pick<MnOptions, typeof CORE_OPTION_KEYS[number]>;

/** Опции ядра из опций плагина — только заданные. */
function coreOptionsOf(options: MnCoreOptions): MnCoreOptions {
  const out: Record<string, unknown> = {};
  for (const key of CORE_OPTION_KEYS) {
    options[key] === undefined || (out[key] = options[key]);
  }
  return out as MnCoreOptions;
}

/** Сканер с разворачиванием атрибутов: записи `'<целевой атрибут> <токен>'`. */
export type AttrsScanner = (source: string, fileName?: string) => string[];

/**
 * Сканер файла по опции `attrs`: токен помечается атрибутом, в который он
 * разворачивается.
 *
 * Сканируемые атрибуты группируются по целевому, и на группу — один проход
 * обычного сканера (`attr` списком имён). Обычно цель одна (`class`), и проход
 * тоже один. Токены из переменных `*Class` и вызовов `mne`/`mnClass` — это
 * значения классов, поэтому они идут в группу `class`, а если её нет — в первую.
 *
 * Запись — `'<цель> <токен>'`: в токене пробела не бывает, так что разбор
 * однозначен, а набор записей можно класть в `Set` как обычные строки.
 *
 * @param options — опции сканера и `attrs`
 */
export function createAttrsScanner(options: Omit<ScannerOptions, 'attr' | 'onWarning'> & {
  attrs?: MnAttrs;
  onScannerWarning?: (message: string) => void;
}): AttrsScanner {
  const map = parseAttrs(options.attrs);
  const byTarget: Record<string, string[]> = {};
  for (const from of Object.keys(map)) {
    (byTarget[map[from]] || (byTarget[map[from]] = [])).push(from);
  }
  const targets = Object.keys(byTarget);
  const classTarget = byTarget.class ? 'class' : targets[0];
  const scanners = targets.map((target) => createScanner({
    syntax: options.syntax,
    comments: options.comments,
    // У сканера свой `onWarning` — о недоступном парсере. В опциях плагина это
    // имя занято предупреждениями компиляции (D-034), поэтому колбэк сканера
    // приходит как `onScannerWarning`.
    onWarning: options.onScannerWarning,
    attr: byTarget[target],
    // Переменные и вызовы сканируются один раз — в группе классов.
    classVarSuffixes: target === classTarget ? options.classVarSuffixes : [],
    mergeFnNames: target === classTarget ? options.mergeFnNames : [],
  }));
  const l = targets.length;
  return (source: string, fileName?: string): string[] => {
    const out: string[] = [];
    let i = 0;
    let prefix: string;
    for (; i < l; i++) {
      prefix = targets[i] + ' ';
      for (const token of scanners[i](source, fileName)) {
        out.push(prefix + token);
      }
    }
    return out;
  };
}

/**
 * Компилирует записи {@link AttrsScanner} в инстансе: каждый токен — своим
 * `getCompiler(цель)`.
 *
 * @param mn — инстанс с применёнными пресетами
 * @param entries — записи `'<цель> <токен>'`
 */
export function compileEntries(mn: Pick<ReturnType<typeof minotationProvider>, 'getCompiler'>, entries: Iterable<string>): void {
  const compilers: Record<string, (value: string) => void> = {};
  let at: number;
  let target: string;
  for (const entry of entries) {
    at = entry.indexOf(' ');
    target = entry.slice(0, at);
    (compilers[target] || (compilers[target] = mn.getCompiler(target)))(entry.slice(at + 1));
  }
}

/** Опции {@link createTokenCollector}. */
export interface TokenCollectorOptions extends Omit<ScannerOptions, 'attr' | 'onWarning'>, MnCoreOptions {
  /** Какие атрибуты сканировать и во что разворачивать — {@link MnAttrs}. По умолчанию `'class'`. */
  attrs?: MnAttrs;
  /**
   * Токены, которые нужны всегда, даже если в файлах не встретились;
   * компилируются как классы. Элемент может содержать несколько токенов через
   * пробел: `['crP taL vaT']`.
   */
  safelist?: string[];
  /** Статические пресеты; их набор задаёт потребитель. */
  presets?: MnPreset[];
  /**
   * Колбэк сканера: `syntax: true`, а пакета `typescript` нет. Отдельное имя —
   * `onWarning` занят предупреждениями компиляции (D-034).
   */
  onScannerWarning?: (message: string) => void;
}

/**
 * Отбор файлов, как в v1: регулярка, путь, функция или массив из них.
 *
 * Строка — путь к файлу: сравнивается и с абсолютным путём, и с путём от корня
 * (`./` в начале не важен). Массив срабатывает, если сработал хотя бы один элемент.
 */
export type MnFileMatcher = RegExp | string | ((path: string) => boolean) | MnFileMatcher[];

/**
 * Эталонный набор опций всех плагинов сборщиков и CLI (D-026).
 *
 * Объявлен один раз здесь: пока каждый плагин объявлял свои опции, наборы
 * разошлись, и часть опций v1 пропала (сверка — RESEARCH 09). Плагин принимает
 * `MnBuildOptions` и добавляет только то, что есть лишь у его сборщика.
 */
export interface MnBuildOptions extends TokenCollectorOptions {
  /**
   * Корень, от которого обходятся файлы при первичном скане (в v1 — `path`).
   * У каждого плагина своё умолчание (vite — `<root>/src`, rollup и esbuild —
   * рабочая директория).
   */
  root?: string;
  /**
   * Расширения сканируемых файлов, если не задан `include`.
   * @default ['.html', '.jsx', '.tsx', '.vue', '.svelte'] (у astro ещё `.astro`)
   */
  extensions?: string[];
  /** Какие файлы сканировать — вместо `extensions` ({@link MnFileMatcher}). */
  include?: MnFileMatcher;
  /** Какие файлы пропускать, даже если подходят под `include`/`extensions`. */
  exclude?: MnFileMatcher;
  /**
   * Пропускать файлы-партиалы — те, чьё имя начинается с `_` (`_header.html`),
   * как у Sass, Jekyll и 11ty. Выключено: такие файлы обычно попадают на
   * страницы целиком, и их классы нужны (D-027).
   * @default false
   */
  skipPartials?: boolean;
  /**
   * Расширения файлов, считающихся динамическими MN-пресетами.
   *
   * Файлы с такими расширениями можно импортировать прямо в коде приложения
   * как обычные side-effect импорты (аналог `import 'style.scss'`).
   * Плагин перехватывает их, выполняет на внутреннем mn-инстансе
   * и возвращает в бандл пустой ES-модуль (`export {};`).
   * В dev-режиме при изменении пресет-файла CSS обновляется без перезагрузки.
   *
   * @default ['.mn.ts', '.mn.js', '.mn.tsx']
   *
   * @example
   * // src/mn/preset.mn.ts
   * import type { MnInstance, MnWarning } from 'minotation';
   * export function presetApp(mn: MnInstance): void {
   *   mn('card', () => ({ style: { borderRadius: '8px' } }));
   * }
   *
   * // src/main.tsx
   * import './mn/preset.mn';  // ← подключается как side-effect
   */
  presetExtensions?: string[];
  /**
   * Токены, которые нужно скомпилировать всегда, даже если они не встретились
   * в литеральном атрибуте `class="…"`.
   *
   * Плагин извлекает токены **статически**: из значений `class`/`className`
   * в исходниках. Классы, собранные в переменных или выражениях
   * (`const th = 'py12 px14'`, `clsx(...)`, вычисляемые строки), при таком
   * разборе не видны, и соответствующий CSS в сборку не попадает. Для таких
   * случаев — перечислить токены здесь.
   *
   * @default []
   *
   * @example
   * mnVite({ safelist: ['py12 px14 r8', 'crP', 'taL'] })
   */
  safelist?: string[];
  /**
   * Суффиксы имён переменных, значения которых считаются списком MN-токенов.
   *
   * Дополняет статическое извлечение из `class="…"`: классы, собранные в
   * переменной, плагин иначе не видит (он разбирает исходник текстом, а не
   * исполняет его). Достаточно назвать переменную с суффиксом — и токены
   * из её строкового значения попадут в CSS:
   *
   * ```ts
   * const thClass = 'py12 px14 bb1 bsS';   // ← извлекается
   * const th = 'py12 px14';                // ← не извлекается
   * ```
   *
   * Распознаются присваивание (`=`) и свойство объекта (`:`), строки в любых
   * кавычках, включая шаблонные; подстановки `${…}` пропускаются, статические
   * части вокруг них — берутся. Сравнение суффикса регистрозависимое.
   *
   * Пустой массив отключает механизм; всегда доступен запасной путь — {@link safelist}.
   *
   * @default ['Class']
   *
   * @example
   * mnVite({ classVarSuffixes: ['Class', 'Cls', 'Styles'] })
   */
  classVarSuffixes?: string[];
  /**
   * Имена функций слияния токенов, у которых строковые аргументы сканируются.
   *
   * `mne('pt26 pb6', props.class)` — токены `pt26` и `pb6` записаны прямо в вызове,
   * а не в `class="…"` и не в переменной с суффиксом из {@link classVarSuffixes}.
   * Без этой опции они не попадали в CSS: сборка проходила зелёной, а стили молча
   * отсутствовали.
   *
   * Берутся все строковые литералы внутри вызова, на любой глубине вложенности;
   * подстановки `${…}` пропускаются, идентификаторы-аргументы игнорируются
   * (их значения приходят из своих объявлений — их подхватит `classVarSuffixes`).
   *
   * Пустой массив отключает механизм.
   *
   * @default ['mne', 'mnClass']
   *
   * @example
   * mnVite({ mergeFnNames: ['mne', 'mnClass', 'cx'] })
   */
  mergeFnNames?: string[];
  /**
   * Разбирать ли `.js/.jsx/.ts/.tsx` парсером вместо текстового поиска.
   *
   * По умолчанию — автоматически: если `typescript` доступен, файлы
   * JS-семейства идут через него, иначе текстом и молча. Точный разбор
   * снимает ложные токены из мест, которые текстовый сканер не отличает от
   * кода: примеры разметки в JSDoc, закомментированный код, строки с кавычкой
   * внутри регулярного литерала.
   *
   * `true` — то же самое, но отсутствие парсера становится предупреждением.
   * `false` — всегда текстовый разбор.
   *
   * Файлы прочих форматов (`.html`, `.vue`, `.svelte`, `.astro`) сканируются
   * текстом при любом значении.
   */
  syntax?: boolean;
  /**
   * Несколько выходных CSS из одной сборки (D-030): имя записи → её опции.
   * Файлы сканируются один раз, CSS компилируется на каждую запись. Без `entry` —
   * одна запись `mn` с опциями верхнего уровня.
   *
   * @example
   * entry: {
   *   site: { include: /src\/site\// },
   *   admin: { include: /src\/admin\//, presets: [presetStandard] },
   * }
   */
  entry?: Record<string, MnEntryOptions>;
  /**
   * Имя выходного файла: `[name]` — имя записи, `[hash]` — хеш содержимого (D-031).
   * Нужен там, где файл пишет сам плагин (CLI, gulp). Плагины сборщиков отдают CSS
   * в граф ассетов, и имя с хешем назначает сборщик по своим правилам.
   * @default '[name].css'
   */
  fileName?: string;
  /**
   * Манифест «логическое имя → фактическое» (`{ "mn.css": "mn.3f9a1c2e.css" }`) —
   * для серверных шаблонов, которым нужно знать имя файла с хешем. `true` — рядом с
   * CSS под именем `mn-manifest.json`, строка — свой путь, `false` — не писать (D-031).
   * @default true
   */
  manifest?: boolean | string;
  /**
   * Статистика употребления токенов (D-032) — какие токены и сколько раз
   * встречаются в проекте, общим списком и по файлам. `true` — файл
   * `mn-metrics.json` рядом с CSS, строка — свой путь, `false` — не писать.
   * В dev-режиме сборщиков не пишется: отчёт нужен по итогам сборки.
   * @default true
   */
  metrics?: boolean | string;
}

/**
 * Опции одной записи `entry` — то, что у записей бывает разным; остальное
 * наследуется от опций верхнего уровня. Поля ядра (`selectorPrefix`, `warningMode`, …)
 * — плоско, как у опций плагина (D-034).
 */
export interface MnEntryOptions extends MnCoreOptions {
  /** Какие из просканированных файлов дают токены этой записи. По умолчанию — все. */
  include?: MnFileMatcher;
  /** Какие файлы этой записи не касаются. */
  exclude?: MnFileMatcher;
  /** Пропускать партиалы `_*` для этой записи. */
  skipPartials?: boolean;
  /** Свои атрибуты. Записи с одинаковыми `attrs` сканируются одним проходом. */
  attrs?: MnAttrs;
  /** Свои пресеты вместо общих. */
  presets?: MnPreset[];
  /** Свой safelist вместо общего. */
  safelist?: string[];
  /** Своё имя файла — там, где имя назначает плагин (CLI, gulp). */
  fileName?: string;
}

/** Отбор файлов: RegExp, строка, функция или массив из них. */
const isFileMatcher: OptionCheck = (
  value, where, path,
) => {
  const ok = value instanceof RegExp || typeof value === 'string' || typeof value === 'function'
    || Array.isArray(value) && value.every((item) => !isFileMatcher(
      item, where, path,
    ));
  return ok ? undefined : 'a RegExp, a string, a function or an array of them';
};

/** `attrs`: строка, массив строк или объект «атрибут → целевой атрибут». */
const isAttrs: OptionCheck = (
  value, where, path,
) => {
  const ok = typeof value === 'string' || !isStringArray(
    value, where, path,
  )
    || Object.prototype.toString.call(value) === '[object Object]'
      && Object.keys(value as object).every((key) => typeof (value as Record<string, unknown>)[key] === 'string');
  return ok ? undefined : 'a string, an array of strings or an object of strings';
};

/** Допустимые опции записи `entry` (D-038). */
export const ENTRY_OPTIONS_SCHEMA: OptionSchema = {
  ...CORE_OPTIONS_SCHEMA,
  include: isFileMatcher,
  exclude: isFileMatcher,
  skipPartials: isBoolean,
  attrs: isAttrs,
  safelist: isStringArray,
  fileName: isString,
};

/** Допустимые опции плагина — общий набор {@link MnBuildOptions} (D-038). */
export const BUILD_OPTIONS_SCHEMA: OptionSchema = {
  ...ENTRY_OPTIONS_SCHEMA,
  presets: isFunctionArray,
  onScannerWarning: isFunction,
  classVarSuffixes: isStringArray,
  mergeFnNames: isStringArray,
  comments: isBoolean,
  syntax: isBoolean,
  root: isString,
  extensions: isStringArray,
  presetExtensions: isStringArray,
  entry: optionsOf(ENTRY_OPTIONS_SCHEMA),
  manifest: isBooleanOrString,
  metrics: isBooleanOrString,
};

/**
 * Проверяет опции плагина: неизвестный ключ и некорректное значение — ошибка с
 * подсказкой (D-038). Вызывается при создании плагина.
 *
 * @param options — опции, как их передал пользователь
 * @param where — имя плагина для сообщения (`mnVite`)
 * @param own — опции, которые есть только у этого плагина (`inject` у vite)
 *
 * @example
 * checkBuildOptions({ atrs: 'class' }, 'mnVite');
 * // Error: [minotation] mnVite: unknown option "atrs". Did you mean "attrs"?
 */
export function checkBuildOptions(
  options: unknown, where: string, own?: OptionSchema,
): void {
  checkOptions(
    options, own ? {
      ...BUILD_OPTIONS_SCHEMA,
      ...own,
    } : BUILD_OPTIONS_SCHEMA, where,
  );
}

/** Умолчание `extensions` — общее для плагинов. */
export const DEFAULT_EXTENSIONS = [
  '.html',
  '.jsx',
  '.tsx',
  '.vue',
  '.svelte',
];
/** Умолчание `presetExtensions`. */
export const DEFAULT_PRESET_EXTENSIONS = [
  '.mn.ts',
  '.mn.js',
  '.mn.tsx',
];

/** Отбор файлов по опциям {@link MnBuildOptions}. */
export interface FileFilter {
  /** Сканировать ли файл на токены. */
  accepts(path: string): boolean;
  /** Пресет ли это (`*.mn.ts`). Пресет не сканируется на токены. */
  isPreset(path: string): boolean;
  /** Расширения, по которым обходить директорию при первичном скане. */
  extensions: string[];
  /** Расширения пресетов. */
  presetExtensions: string[];
}

/**
 * Матчер v1 ({@link MnFileMatcher}) в функцию; `undefined` — матчера нет.
 *
 * @param matcher — RegExp, путь, функция или массив из них
 * @param root — корень для путей, заданных строкой
 */
export function createMatcher(matcher: MnFileMatcher | undefined, root: string): ((path: string) => boolean) | undefined {
  if (matcher === undefined || matcher === null) {
    return undefined;
  }
  if (typeof matcher === 'function') {
    return matcher;
  }
  if (matcher instanceof RegExp) {
    return (path: string) => {
      // `g`/`y` двигают `lastIndex` — без сброса второй файл проверялся бы не с начала.
      matcher.lastIndex = 0;
      return matcher.test(path);
    };
  }
  if (typeof matcher === 'string') {
    const target = matcher.replace(/^\.\//, '');
    return (path: string) => path === target || relative(root, path) === target;
  }
  const list = matcher.map((item) => createMatcher(item, root))
    .filter((item): item is (path: string) => boolean => !!item);
  return (path: string) => list.some((item) => item(path));
}

/**
 * Отбор файлов: `extensions` или `include`, затем `exclude` и `skipPartials`.
 *
 * @param options — опции плагина
 * @param root — корень для строковых матчеров (путь от корня)
 */
export function createFileFilter(options: MnBuildOptions, root: string): FileFilter {
  const extensions = options.extensions || DEFAULT_EXTENSIONS;
  const presetExtensions = options.presetExtensions || DEFAULT_PRESET_EXTENSIONS;
  const include = createMatcher(options.include, root);
  const exclude = createMatcher(options.exclude, root);
  const skipPartials = !!options.skipPartials;
  function isPreset(path: string): boolean {
    return presetExtensions.some((ext) => path.endsWith(ext));
  }
  return {
    extensions,
    presetExtensions,
    isPreset,
    accepts(path: string): boolean {
      if (isPreset(path)) {
        return false;
      }
      if (skipPartials && basename(path)[0] === '_') {
        return false;
      }
      if (exclude && exclude(path)) {
        return false;
      }
      return include ? include(path) : extensions.some((ext) => path.endsWith(ext));
    },
  };
}

/**
 * Плоский `safelist`: элемент может содержать несколько токенов через пробел
 * (`'crP taL vaT'`) — так их удобнее держать группами.
 *
 * @param safelist — опция `safelist`
 * @returns токены по одному
 */
export function flatSafelist(safelist: string[] | undefined): string[] {
  const out: string[] = [];
  for (const line of safelist || []) {
    for (const token of line.split(/\s+/)) {
      token && out.push(token);
    }
  }
  return out;
}

/** Накопитель токенов одной сборки. */
export interface TokenCollector {
  /**
   * Учитывает токены файла. Набор файла ЗАМЕНЯЕТСЯ целиком, а не дополняется:
   * иначе токен, убранный при редактировании, оставался бы в CSS до перезапуска.
   *
   * @returns изменился ли набор токенов — по этому признаку решают, нужна ли
   *   пересборка CSS
   */
  add(id: string, source: string): boolean;
  /**
   * То же, что {@link TokenCollector.add}, но записи уже готовы — в формате
   * {@link AttrsScanner} (`'<цель> <токен>'`).
   *
   * Нужен там, где сканирует не сам каркас: в webpack файл читает лоадер, а
   * CSS собирает плагин — между ними только общий стейт.
   */
  set(id: string, tokens: Iterable<string>): boolean;
  /** Снимает файл с учёта (удалён, перестал подходить под фильтр). */
  remove(id: string): boolean;
  /** Регистрирует динамический пресет из файла (`*.mn.ts`). */
  setPreset(id: string, preset: MnPreset): void;
  /** Снимает пресет с учёта. */
  removePreset(id: string): boolean;
  /** Есть ли у файла учтённые токены. */
  has(id: string): boolean;
  /**
   * Готовый CSS из всех учтённых токенов и пресетов.
   *
   * Результат кешируется по слепку набора: повторный вызов без изменений
   * ничего не пересчитывает. Сборщики зовут это на каждый цикл, а компиляция
   * всего набора — самая дорогая часть плагина.
   */
  css(): string;
  /**
   * Предупреждения последней компиляции; вызов их забирает и очищает очередь.
   * Пустой массив при `warningMode: 'silent'`.
   */
  takeWarnings(): MnWarning[];
  /** Забывает всё: и токены, и пресеты. Нужен на старте пересборки. */
  clear(): void;
}

/**
 * Создаёт накопитель токенов для плагина сборщика.
 *
 * @example
 * const collector = createTokenCollector({ attr: 'class' });
 * collector.add(id, source);        // → изменился ли набор
 * collector.remove(id);
 * const css = collector.css();      // готовый CSS, с кешем
 * for (const w of collector.takeWarnings()) ctx.warn(w.message);
 */
export function createTokenCollector(options: TokenCollectorOptions): TokenCollector {
  const scan = createAttrsScanner(options);
  const safelist = flatSafelist(options.safelist).map((token) => 'class ' + token);
  const presets = options.presets;
  /**
   * Предупреждения перехватываются всегда: ядро в режиме `'log'` пишет в
   * `console`, а у сборщика свой канал вывода — поэтому ядру режим передаётся
   * как `'silent'` (или `'error'`, чтобы сборка падала), а печатает плагин из
   * накопленного. `'silent'` у пользователя — не копим и не отдаём. Колбэк
   * `onWarning` вызывается всегда, дополнительно к режиму (D-035).
   */
  const userOnWarning = options.onWarning;
  const warningMode = options.warningMode || 'log';
  const core = coreOptionsOf(options);
  /** Токены по файлам — ключ по файлу и снимает файл с учёта, и заменяет набор. */
  const byFile = new Map<string, Set<string>>();
  /** Динамические пресеты из файлов, по пути. */
  const dynamic = new Map<string, MnPreset>();
  let warnings: MnWarning[] = [];
  /** Слепок набора, на котором собран `cachedCss`; пустая строка — кеша нет. */
  let cacheKey = '';
  let cachedCss = '';

  function add(id: string, source: string): boolean {
    return set(id, scan(source, id));
  }

  function set(id: string, tokens: Iterable<string>): boolean {
    const next = new Set<string>(tokens);
    if (!next.size) {
      return remove(id);
    }
    const previous = byFile.get(id);
    if (previous && sameTokens(previous, next)) {
      return false;
    }
    byFile.set(id, next);
    cacheKey = '';
    return true;
  }

  function remove(id: string): boolean {
    if (!byFile.delete(id)) {
      return false;
    }
    cacheKey = '';
    return true;
  }

  function collect(): string[] {
    const all = new Set<string>(safelist);
    for (const tokens of byFile.values()) {
      for (const token of tokens) {
        all.add(token);
      }
    }
    // Порядок фиксирован: иначе слепок набора менялся бы от перестановки, и
    // кеш не срабатывал бы там, где ничего не изменилось.
    return Array.from(all).sort();
  }

  return {
    add,
    set,
    remove,
    has(id: string): boolean {
      return byFile.has(id);
    },
    setPreset(id: string, preset: MnPreset): void {
      dynamic.set(id, preset);
      cacheKey = '';
    },
    removePreset(id: string): boolean {
      if (!dynamic.delete(id)) {
        return false;
      }
      cacheKey = '';
      return true;
    },
    clear(): void {
      byFile.clear();
      dynamic.clear();
      cacheKey = '';
    },
    takeWarnings(): MnWarning[] {
      const out = warnings;
      warnings = [];
      return out;
    },
    css(): string {
      const tokens = collect();
      // В слепок входят и пресеты: их набор меняет CSS не меньше токенов.
      const key = tokens.join(' ') + '\u0000' + Array.from(dynamic.keys()).join(' ');
      if (key === cacheKey) {
        return cachedCss;
      }
      const collected: MnWarning[] = [];
      const mn = minotationProvider({
        ...core,
        warningMode: warningMode === 'error' ? 'error' : 'silent',
        onWarning: (warning: MnWarning) => {
          warningMode === 'silent' || collected.push(warning);
          userOnWarning && userOnWarning(warning);
        },
      });
      presets && mn.setPresets(presets.concat(Array.from(dynamic.values())));
      presets || mn.setPresets(Array.from(dynamic.values()));
      // Каждый токен — в свой целевой атрибут (D-025). До 2026-10-05 всё шло
      // в `class`, и `m="p10"` давал `.p10` вместо `[m~="p10"]` — так в v2
      // потерялась опция `attrs` из v1.
      compileEntries(mn, tokens);
      mn.compile();
      warnings = collected;
      cachedCss = mn.styles$.getValue()
        .map((s: { content: string }) => s.content)
        .join('\n');
      cacheKey = key;
      return cachedCss;
    },
  };
}

/**
 * Подставляет в шаблон имени `[name]` и `[hash]` (8 символов SHA-256 содержимого).
 *
 * @param template — `'[name].[hash].css'`, `'mn.css'`, …
 * @param name — имя записи `entry`
 * @param css — содержимое, по которому считается хеш
 */
export function formatFileName(
  template: string, name: string, css: string,
): string {
  return template
    .replace(/\[name\]/g, name)
    .replace(/\[hash\]/g, () => createHash('sha256').update(css).digest('hex').slice(0, 8));
}

/** Сколько раз встретился токен. */
export interface TokenCount {
  /** Токен; у целевого атрибута не `class` — `атрибут:токен` (`m:p10`). */
  name: string;
  /** Сколько раз встретился — во всех файлах или в одном, по месту. */
  count: number;
}

/**
 * Статистика употребления токенов (D-032) — то, что пишется в `mn-metrics.json`.
 *
 * Формат перенесён из v1 (`old/minimalist-notation/node/index.js`): список
 * `{name, count}` по убыванию частоты. Разбивка по файлам лежит рядом, в
 * `files`, а не в отдельном отчёте: в v1 это были две опции (`metrics` и
 * `metricsFiles`), писавшие два файла с пересекающимся содержимым.
 */
export interface Metrics {
  /** Всего просканировано файлов. */
  filesScanned: number;
  /**
   * Уникальных токенов — включая `safelist`, которого в файлах не было. Счётчики
   * в {@link Metrics.tokens} считают только встреченное в файлах, поэтому числа
   * могут расходиться.
   */
  tokensTotal: number;
  /** Сколько раз токены встретились суммарно, с повторами. */
  occurrences: number;
  /** Токены по убыванию частоты. */
  tokens: TokenCount[];
  /** Токены по файлам: путь от корня → список, тоже по убыванию частоты. */
  files: Record<string, TokenCount[]>;
}

/**
 * Путь отчёта статистики по опции `metrics`; `undefined` — не писать.
 *
 * @param metrics — опция `metrics`
 */
export function metricsFileName(metrics: boolean | string | undefined): string | undefined {
  if (metrics === false) {
    return undefined;
  }
  return typeof metrics === 'string' ? metrics : 'mn-metrics.json';
}

/**
 * Ключ статистики для записи сканера: у класса — сам токен, у другого целевого
 * атрибута — `атрибут:токен` (`m:p10`), чтобы они не смешивались.
 */
function metricKey(entry: string): string {
  const at = entry.indexOf(' ');
  const target = entry.slice(0, at);
  return target === 'class' ? entry.slice(at + 1) : target + ':' + entry.slice(at + 1);
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

/** CSS одной записи `entry`. */
export interface BuildOutput {
  /** Имя записи (`mn` без `entry`). */
  name: string;
  /** Готовый CSS; пустая строка — токенов нет. */
  css: string;
}

/**
 * Накопитель сборки с записями `entry` (D-030): тот же интерфейс, что у
 * {@link TokenCollector}, но CSS — по записям.
 */
export interface BuildCollector {
  /** Сканирует файл один раз на каждый набор `attrs` и раздаёт токены записям. */
  add(id: string, source: string): boolean;
  /** Готовые записи сканера (webpack: сканирует лоадер) — раздать записям. */
  set(id: string, entries: Iterable<string>): boolean;
  remove(id: string): boolean;
  has(id: string): boolean;
  setPreset(id: string, preset: MnPreset): void;
  removePreset(id: string): boolean;
  clear(): void;
  /** Имена записей в порядке объявления. */
  names: string[];
  /** CSS каждой записи; кешируется накопителем записи. */
  outputs(): BuildOutput[];
  /** Предупреждения последней компиляции всех записей, без повторов. */
  takeWarnings(): MnWarning[];
  /** Статистика употребления токенов по учтённым файлам (D-032). */
  metrics(): Metrics;
}

/**
 * Создаёт накопитель с записями `entry`.
 *
 * Записи с одинаковым `attrs` используют один сканер, так что файл читается
 * парсером один раз, сколько бы записей его ни разделяли; `include`/`exclude`
 * записи решают только, кому из них достанутся найденные токены.
 *
 * @param options — опции плагина
 * @param root — корень для путей в `include`/`exclude` записей
 */
export function createBuildCollector(options: MnBuildOptions, root: string): BuildCollector {
  const entries = options.entry || {
    mn: {}, 
  };
  const names = Object.keys(entries);
  if (!names.length) {
    throw new Error('[minotation] entry is empty: declare at least one entry or omit the option');
  }
  const scanners: Record<string, AttrsScanner> = {};
  // Статистика считается по атрибутам верхнего уровня — тем, что видит автор
  // разметки; записи с другими `attrs` на неё не влияют.
  const metricsKey = JSON.stringify(parseAttrs(options.attrs));
  scanners[metricsKey] = createAttrsScanner(options);
  /** Счётчики по файлам: файл → `{ токен: сколько раз }`. */
  const counts = new Map<string, Record<string, number>>();
  function count(id: string, found: string[]): void {
    const own: Record<string, number> = {};
    let key: string;
    for (const entry of found) {
      key = metricKey(entry);
      own[key] = (own[key] || 0) + 1;
    }
    counts.set(id, own);
  }
  const safelist = flatSafelist(options.safelist);
  const parts = names.map((name) => {
    const own = entries[name];
    const merged: MnBuildOptions = {
      ...options,
      ...own,
    };
    const key = JSON.stringify(parseAttrs(merged.attrs));
    scanners[key] || (scanners[key] = createAttrsScanner(merged));
    return {
      key,
      collector: createTokenCollector(merged),
      // Отбор файлов плагином уже сделан; запись лишь делит найденное.
      filter: createFileFilter({
        extensions: [''],
        include: own.include,
        exclude: own.exclude,
        skipPartials: own.skipPartials,
      }, root),
    };
  });
  const l = parts.length;
  function distribute(id: string, entriesOf: (key: string) => string[]): boolean {
    let changed = false;
    let i = 0;
    for (; i < l; i++) {
      changed = (parts[i].filter.accepts(id)
        ? parts[i].collector.set(id, entriesOf(parts[i].key))
        : parts[i].collector.remove(id)) || changed;
    }
    return changed;
  }
  return {
    names,
    add(id: string, source: string): boolean {
      const scanned: Record<string, string[]> = {};
      const scan = (key: string): string[] => scanned[key] || (scanned[key] = scanners[key](source, id));
      count(id, scan(metricsKey));
      return distribute(id, scan);
    },
    set(id: string, found: Iterable<string>): boolean {
      const list = Array.from(found);
      count(id, list);
      return distribute(id, () => list);
    },
    remove(id: string): boolean {
      counts.delete(id);
      let changed = false;
      for (const part of parts) {
        changed = part.collector.remove(id) || changed;
      }
      return changed;
    },
    has(id: string): boolean {
      return parts.some((part) => part.collector.has(id));
    },
    setPreset(id: string, preset: MnPreset): void {
      for (const part of parts) {
        part.collector.setPreset(id, preset);
      }
    },
    removePreset(id: string): boolean {
      let changed = false;
      for (const part of parts) {
        changed = part.collector.removePreset(id) || changed;
      }
      return changed;
    },
    clear(): void {
      counts.clear();
      for (const part of parts) {
        part.collector.clear();
      }
    },
    metrics(): Metrics {
      const total: Record<string, number> = {};
      const files: Record<string, TokenCount[]> = {};
      let list: TokenCount[];
      for (const [id, own] of counts) {
        for (const name in own) {
          total[name] = (total[name] || 0) + own[name];
        }
        list = sortedCounts(own);
        // Файл без единого токена в отчёт не попадает: пустых записей в
        // проекте больше, чем содержательных, и они только мешают читать.
        list.length && (files[relative(root, id)] = list);
      }
      const tokens = sortedCounts(total);
      const unique: Record<string, 1> = {};
      let occurrences = 0;
      for (const item of tokens) {
        occurrences += item.count;
        unique[item.name] = 1;
      }
      for (const token of safelist) {
        unique[token] = 1;
      }
      return {
        filesScanned: counts.size,
        tokensTotal: Object.keys(unique).length,
        occurrences,
        tokens,
        files,
      };
    },
    outputs(): BuildOutput[] {
      return parts.map((part, i) => ({
        name: names[i],
        css: part.collector.css(),
      }));
    },
    takeWarnings(): MnWarning[] {
      const seen: Record<string, 1> = {};
      const out: MnWarning[] = [];
      let key: string;
      for (const part of parts) {
        for (const warning of part.collector.takeWarnings()) {
          key = warning.token + '\u0000' + warning.message;
          seen[key] || (seen[key] = 1, out.push(warning));
        }
      }
      return out;
    },
  };
}

/**
 * Манифест «логическое имя → фактическое имя файла»: `{ "mn.css": "mn.3f9a1c2e.css" }`.
 *
 * @param files — имя записи → фактическое имя файла
 */
export function manifestOf(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of Object.keys(files)) {
    out[name + '.css'] = files[name];
  }
  return out;
}

/**
 * Путь манифеста по опции `manifest`; `undefined` — не писать.
 *
 * @param manifest — опция `manifest`
 */
export function manifestFileName(manifest: boolean | string | undefined): string | undefined {
  if (manifest === false) {
    return undefined;
  }
  return typeof manifest === 'string' ? manifest : 'mn-manifest.json';
}

/** Одинаковы ли наборы токенов — чтобы не считать пересборку нужной зря. */
function sameTokens(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const token of a) {
    if (!b.has(token)) {
      return false;
    }
  }
  return true;
}

/** Что не обходится никогда: скрытые директории и зависимости. */
function skipDir(name: string): boolean {
  return name.charCodeAt(0) === 46 || name === 'node_modules';
}

/**
 * Рекурсивно обходит директорию и возвращает файлы с заданными расширениями.
 *
 * Нечитаемые пути пропускаются молча: битый симлинк или каталог без прав —
 * не повод ронять сборку, а сказать о них внятнее может только тот, кто их
 * создал.
 *
 * @param dir — корневая директория
 * @param extensions — расширения (`.tsx`, `.html`, …)
 * @param maxDepth — предел рекурсии; защита от циклических симлинков
 */
export function walkFiles(
  dir: string, extensions: string[], maxDepth = 10,
): string[] {
  const out: string[] = [];
  walkInto(
    dir, extensions, maxDepth, out,
  );
  return out;
}

function walkInto(
  dir: string, extensions: string[], maxDepth: number, out: string[],
): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  const l = names.length;
  const el = extensions.length;
  let i = 0;
  let j: number;
  let name: string;
  let full: string;
  let directory: boolean;
  for (; i < l; i++) {
    name = names[i];
    if (skipDir(name)) {
      continue;
    }
    full = join(dir, name);
    try {
      directory = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (directory) {
      maxDepth > 0 && walkInto(
        full, extensions, maxDepth - 1, out,
      );
      continue;
    }
    for (j = 0; j < el; j++) {
      if (name.endsWith(extensions[j])) {
        out.push(full);
        break;
      }
    }
  }
}
