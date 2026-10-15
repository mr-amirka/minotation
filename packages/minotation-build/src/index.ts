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
  readFileSync, readdirSync, statSync,
} from 'node:fs';
import {
  CONFIG_FILE_NAMES as CONFIG_FILE_NAMES_IMPL, TOOL_OPTION_KEYS as TOOL_OPTION_KEYS_IMPL,
  clearConfigFileCache as clearConfigFileCacheImpl, loadConfigFile as loadConfigFileImpl,
  withConfigFile as withConfigFileImpl,
} from './config';
import {
  createScopeResolver as createScopeResolverImpl, globToRegExp as globToRegExpImpl,
  isScopeRules as isScopeRulesImpl,
} from './scopes';
import type {
  MnScopeRule,
} from './scopes';
import {
  createHash,
} from 'node:crypto';
import {
  basename, join, relative,
} from 'node:path';
import {
  clearPackageDirectiveCache as clearPackageDirectiveCacheImpl,
  readFileNotation as readFileNotationImpl,
  readNotationDirective as readNotationDirectiveImpl,
  readPackageDirective as readPackageDirectiveImpl,
  readPackageName as readPackageNameImpl,
  STRICTNESS_KEYS,
} from './directives';
import type {
  MnNotationDirective,
} from './directives';

export type {
  MnNotationDirective,
} from './directives';
// Константы, а не `export { … } from`: та форма компилируется в геттеры, которых не видит
// cjs-module-lexer (импорт из ESM падал — см. шапку `index.ts` ядра).
/** Директива `@minotation` в начале файла (D-045 этап 3). */
export const readNotationDirective = readNotationDirectiveImpl;
/** Поле `"minotation"` ближайшего `package.json`. */
export const readPackageDirective = readPackageDirectiveImpl;
/** Имя пакета файла — `"name"` ближайшего `package.json` (`scopes[].match`, D-081). */
export const readPackageName = readPackageNameImpl;
/** Сброс кеша `package.json`. */
export const clearPackageDirectiveCache = clearPackageDirectiveCacheImpl;
/** Режим и требования файла по старшинству: файл → пакет. */
export const readFileNotation = readFileNotationImpl;
/** Имена файла настроек по порядку поиска (D-081). */
export const CONFIG_FILE_NAMES = CONFIG_FILE_NAMES_IMPL;
/** Ключи отдельных инструментов в общем файле настроек. */
export const TOOL_OPTION_KEYS = TOOL_OPTION_KEYS_IMPL;
/** Сброс кеша файлов настроек. */
export const clearConfigFileCache = clearConfigFileCacheImpl;
/** Чтение `minotation.config.*`. */
export const loadConfigFile = loadConfigFileImpl;
/** Опции инструмента из файла настроек, поверх — из кода. */
export const withConfigFile = withConfigFileImpl;
/** Правила `scopes` поверх декларации файла (D-082). */
export const createScopeResolver = createScopeResolverImpl;
/** Шаблон пути → RegExp. */
export const globToRegExp = globToRegExpImpl;
/** Проверка опции `scopes`. */
export const isScopeRules = isScopeRulesImpl;
export type {
  MnScopeMatch, MnScopeRule,
} from './scopes';
export type {
  LoadedConfig,
} from './config';
import {
  CORE_OPTIONS_SCHEMA, MnForbiddenTokenError, MnWarningError, checkOptions, createScanner, createScopeClassWriter, isBoolean,
  isBooleanOrString,
  isFunction, isPresetArray, isString, isStringArray, minotationProvider, oneOf, optionsOf, parseSettingsKey,
} from 'minotation';
import type {
  MnNotationMode, MnOptions, MnParseSettings, MnPreset as MnCorePreset, MnWarning, OptionCheck, OptionSchema,
  ScannerOptions,
} from 'minotation';

/** Пресет — функция, донастраивающая mn-инстанс. */
/** Пресет: функция или пресет-объект `{ name, requires, setup }` (D-045). */
export type MnPreset = MnCorePreset;

/**
 * Экспорт файла динамического пресета (`import './app.mn'`) как пресет: функция или
 * пресет-объект с `setup` (D-045). Иное — `null`: файл не пресет.
 *
 * @param value — `default`-экспорт модуля (или сам модуль)
 * @returns пресет или `null`
 * @example
 * asPreset((mn) => mn('x', h));                     // функция
 * asPreset({ name: 'presetApp', setup(mn) {} });    // объект
 * asPreset({ default: 1 });                         // null
 */
export function asPreset(value: unknown): MnPreset | null {
  return typeof value === 'function'
    || value !== null && typeof value === 'object' && typeof (value as { setup?: unknown }).setup === 'function'
    ? value as MnPreset
    : null;
}

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

function fail(message: string): never {
  throw new Error('[minotation] ' + message);
}

/** Поля ядра, которые в опциях плагина лежат плоско, как в v1 (D-034). */
export const CORE_OPTION_KEYS = [
  'altColor',
  'warningMode',
  'media',
  'maxDepth',
  'maxDepthMode',
  'specificityMode',
  'importantMode',
  'childSelectorMode',
  'unknownMediaMode',
  'suspectClassMode',
  'handlerConflictMode',
  'presetConflictMode',
  'groupSuspectMode',
  'groupMode',
  'notationMode',
  'contextWhere',
  'mediaNesting',
  'onWarning',
  'onError',
] as const;

/**
 * Предупреждения токенов со своим режимом в ядре (D-039) → опция режима. Их сборка судит по файлу
 * (D-081): токен из «строгого» файла — ошибка, тот же токен только из «мягкого» пакета — нет.
 */
const RAISE_OPTIONS: Partial<Record<MnWarning['type'], keyof MnNotationDirective>> = {
  'raised-specificity': 'specificityMode',
  important: 'importantMode',
  'max-depth-exceeded': 'maxDepthMode',
  'child-selector': 'childSelectorMode',
  'unknown-media': 'unknownMediaMode',
  'suspect-class': 'suspectClassMode',
  'group-suspect': 'groupSuspectMode',
};

/** Предупреждения подключения пресетов — без токена: их режим проектный, ядро его уже применило. */
const PRESET_WARNINGS: Partial<Record<MnWarning['type'], 1>> = {
  'handler-conflict': 1,
  'preset-conflict': 1,
};

/** Вес режима: файл со «строжайшим» решает за токен. */
const MODE_WEIGHT: Record<string, number> = {
  silent: 0,
  warn: 1,
  log: 1,
  strict: 2,
  error: 2,
};

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
  let tag: number;
  let target: string;
  let key: string;
  for (const entry of entries) {
    // `настройки\0цель токен` — запись из файла со своими настройками разбора (D-045 этап 3,
    // D-081); `настройки` — ключ `parseSettingsKey`.
    tag = entry.indexOf('\0');
    at = entry.indexOf(' ', tag + 1);
    target = entry.slice(tag + 1, at);
    key = tag < 0 ? target : entry.slice(0, at);
    (compilers[key] || (compilers[key] = tag < 0
      ? mn.getCompiler(target)
      : mn.getCompiler(target, settingsOf(entry.slice(0, tag)))))(entry.slice(at + 1));
  }
}

/** Ключ `parseSettingsKey` (`'tw4-compatible,css,1'`) → настройки разбора. */
function settingsOf(key: string): MnParseSettings {
  const parts = key.split(',');
  const out: MnParseSettings = {};
  parts[0] && (out.notationMode = parts[0] as MnNotationMode);
  parts[1] && (out.groupMode = parts[1] as 'groups' | 'css');
  parts[2] && (out.contextWhere = parts[2] === '1');
  return out;
}

/**
 * Настройки разбора словами — для сообщений: `tw4-compatible`, `groupMode: css`. Ключ не пустой:
 * пустой у записи без тега, и её описывает режим проекта.
 */
function describeSettings(key: string): string {
  const settings = settingsOf(key);
  const words: string[] = [];
  settings.notationMode && words.push(settings.notationMode);
  settings.groupMode && words.push('groupMode: ' + settings.groupMode);
  settings.contextWhere === undefined || words.push('contextWhere: ' + settings.contextWhere);
  return words.join(' + ');
}

/** Итог суда над предупреждениями: в отчёт, запрещённые токены (`strict`), ошибки (`error`). */
type Verdict = [report: MnWarning[], forbidden: MnWarning[], failing: MnWarning[], strict: MnWarning[]];

function failWith(error: Error): never {
  throw error;
}

/** Итог переписывания файла под класс области: новый код (если изменился) и предупреждения. */
export interface ScopeRewrite {
  /** Код с классом области; `undefined` — менять нечего. */
  code?: string;
  /** Недостижимые классы (`unreachableClassMode: 'warn'`) — с файлом и строкой. */
  warnings: string[];
}

/**
 * Переписывание файлов изолированных областей (D-075, D-076): класс области — в каждый атрибут
 * класса. Плагин зовёт его после `add`: класс берётся у накопителя (`scopeClassOf`).
 *
 * @param options — опции плагина: `attrs` (какие атрибуты — классы), `syntax`, `unreachableClassMode`
 * @returns `(накопитель, файл, исходник) → ScopeRewrite` или `undefined`, если файл не изолируется
 *
 * @example
 * const rewrite = createScopeRewriter(options);
 * collector.add(id, source);
 * const result = rewrite(collector, id, source);   // { code: '<b className="_l p-4" />', warnings: [] }
 */
export function createScopeRewriter(options: Pick<MnBuildOptions, 'attrs' | 'syntax' | 'unreachableClassMode'>): (collector: Pick<TokenCollector, 'scopeClassOf'>, id: string, source: string) => ScopeRewrite | undefined {
  const attrs = parseAttrs(options.attrs);
  const writer = createScopeClassWriter({
    attr: Object.keys(attrs).filter((name) => attrs[name] === 'class'),
    syntax: options.syntax,
  });
  const mode = options.unreachableClassMode || 'warn';
  return (
    collector, id, source,
  ) => {
    const className = collector.scopeClassOf(id);
    if (!className) {
      return undefined;
    }
    const result = writer(
      source, id, className,
    );
    const warnings = mode === 'silent' ? [] : result.unreachable.map((item) => relative(process.cwd(), id) + ':'
      + item[0] + ': class set from JS ("' + item[1] + '") — the element gets no scope class "' + className
      + '", the scope\'s rules don\'t reach it. Set the class in markup, or unreachableClassMode: \'silent\'.');
    mode === 'strict' && warnings.length && fail(warnings.join('\n'));
    return {
      code: result.code === source ? undefined : result.code,
      warnings,
    };
  };
}

/** Семейство → класс области; класс → семейство (D-076). Общие на процесс: записи `entry` согласны. */
const scopeClassByFamily = new Map<string, string>();
const familyByScopeClass = new Map<string, string>();

/**
 * Класс области семейства пресетов (D-076): `_` и хеш семейства в base36 — от одного символа, длиннее
 * только при совпадении с классом другого семейства. Выданный класс не меняется.
 *
 * @param family — ключ семейства (отсортированный `requires`)
 * @example scopeClassName('presetTw4') // → '_k' (пример)
 */
export function scopeClassName(family: string): string {
  const known = scopeClassByFamily.get(family);
  if (known) {
    return known;
  }
  const hash = BigInt('0x' + createHash('sha256').update(family).digest('hex')).toString(36);
  let length = 1;
  let name = '_' + hash.slice(0, length);
  while (familyByScopeClass.has(name)) {
    name = '_' + hash.slice(0, ++length);
  }
  scopeClassByFamily.set(family, name);
  familyByScopeClass.set(name, family);
  return name;
}

/** Записи области и первый (по пути) её файл — для сообщений об ошибках. */
type ScopeEntries = [entries: Set<string>, firstId: string];

/** Имена пресет-объектов (функции имени не имеют). */
function namesOf(list: MnPreset[]): string[] {
  const out: string[] = [];
  for (const preset of list) {
    typeof preset === 'function' || out.push(preset.name);
  }
  return out;
}

/** Опции {@link createTokenCollector}. */
export interface TokenCollectorOptions extends Omit<ScannerOptions, 'attr' | 'onWarning'>, MnCoreOptions {
  /** Какие атрибуты сканировать и во что разворачивать — {@link MnAttrs}. По умолчанию `'class'`. */
  attrs?: MnAttrs;
  /** Статические пресеты; их набор задаёт потребитель. */
  presets?: MnPreset[];
  /**
   * Пресеты, которые могут потребовать пакеты (D-078): пакет, чей `requires` выходит за
   * `presets` приложения, собирается в своей области — своим экземпляром ядра с пресетами
   * из `requires` (по имени, из `presets` и `scopePresets`, с их зависимостями).
   *
   * @example
   * mnVite({ presets: [presetStandard, presetSynonyms, presetMedias], scopePresets: [presetTw4] })
   */
  scopePresets?: MnPreset[];
  /**
   * Правила для пакетов и путей со стороны потребителя (D-080…D-082): что принять для файлов,
   * которые сами ничего не объявили. Своя декларация пакета или файла важнее правила; аварийно —
   * `override: true`.
   *
   * @example
   * scopes: [{ match: '@acme/ui', requires: ['presetTw4'], notationMode: 'tw4-compatible' }]
   */
  scopes?: MnScopeRule[];
  /**
   * Изоляция областей пакетов (D-075…D-077): `'class'` — `.p-4._l{…}`, `'where'` — `.p-4:where(._l){…}`,
   * `'none'` — без изоляции. Область приложения не изолируется никогда; класс области (`_l`) сборка
   * назначает сама и пишет его в разметку файлов пакета.
   * @default 'none'
   */
  isolateMode?: 'none' | 'class' | 'where';
  /**
   * Класс задан из JS в файле изолированной области (`el.className = …`, `classList.add(…)`,
   * `setAttribute('class', …)`) — элемент класса области не получит, правила области к нему не
   * применятся (D-076). `'warn'` — предупреждение с файлом и строкой; `'silent'` — молча;
   * `'strict'` — ошибка сборки.
   * @default 'warn'
   */
  unreachableClassMode?: 'warn' | 'silent' | 'strict';
  /**
   * Колбэк сканера: `syntax: true`, а пакета `typescript` нет. Отдельное имя —
   * `onWarning` занят предупреждениями компиляции (D-034).
   */
  onScannerWarning?: (message: string) => void;
  /**
   * Один класс в файлах с разными режимами синтаксиса значит разное (D-045): `'warn'` —
   * предупреждение, в CSS — разбор первого по пути файла, где класс даёт CSS; `'strict'` —
   * ошибка. `'silent'` нет: такой конфликт калечит вывод. @default 'warn'
   */
  notationConflictMode?: 'warn' | 'strict';
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
   * Корень, от которого обходятся файлы при первичном скане (в v1 — `path`), или несколько
   * корней — монорепо с общим пакетом компонентов: `root: [gameSrc, componentsSrc]`. Токены и
   * пресеты (`*.mn.ts`) берутся из всех корней. У каждого плагина своё умолчание
   * (vite — `<root>/src`, rollup и esbuild — рабочая директория).
   */
  root?: string | string[];
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
   * Пустой массив отключает механизм; токены, которых сканер не видит, объявляются на месте
   * маркером `@mn` в комментарии (D-083): `{/* @mn cF00 px10 *\/}`.
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
 * наследуется от опций верхнего уровня. Поля ядра (`altColor`, `warningMode`, …)
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
  /** Свои пресеты областей вместо общих — {@link TokenCollectorOptions.scopePresets}. */
  scopePresets?: MnPreset[];
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

/**
 * Опции ядра в опциях плагина — без `isolateClass`: класс области сборка назначает сама (D-076);
 * `isolateMode` у плагина — изоляция областей пакетов.
 */
const WITHOUT_ISOLATE_CLASS: OptionSchema = (() => {
  const out: OptionSchema = {
    ...CORE_OPTIONS_SCHEMA,
  };
  delete out.isolateClass;
  return out;
})();

/** Допустимые опции записи `entry` (D-038). */
export const ENTRY_OPTIONS_SCHEMA: OptionSchema = {
  ...WITHOUT_ISOLATE_CLASS,
  include: isFileMatcher,
  exclude: isFileMatcher,
  skipPartials: isBoolean,
  attrs: isAttrs,
  fileName: isString,
  scopePresets: isPresetArray,
};

/** Строка или массив строк (`root`). */
const isStringOrStringArray: OptionCheck = (value) => (
  typeof value === 'string' || isStringArray(
    value, '', '',
  ) === undefined ? undefined
    : 'a string or an array of strings'
);

/** Допустимые опции плагина — общий набор {@link MnBuildOptions} (D-038). */
export const BUILD_OPTIONS_SCHEMA: OptionSchema = {
  ...ENTRY_OPTIONS_SCHEMA,
  presets: isPresetArray,
  onScannerWarning: isFunction,
  classVarSuffixes: isStringArray,
  mergeFnNames: isStringArray,
  comments: isBoolean,
  syntax: isBoolean,
  root: isStringOrStringArray,
  unreachableClassMode: oneOf(
    'warn', 'silent', 'strict',
  ),
  scopes: isScopeRulesImpl,
  extensions: isStringArray,
  presetExtensions: isStringArray,
  entry: optionsOf(ENTRY_OPTIONS_SCHEMA),
  manifest: isBooleanOrString,
  metrics: isBooleanOrString,
  notationConflictMode: oneOf('warn', 'strict'),
};

/**
 * Опции плагина из `minotation.config.*` рабочего каталога, под ними — опции из кода (D-081).
 *
 * @param options — опции из кода
 * @param tool — имя плагина (`mnVite`, `mnRollup`, …)
 * @param own — свои опции плагина сверх общего набора
 */
export function withBuildConfig<T extends object>(
  options: T, tool: string, own?: OptionSchema,
): T {
  return withConfigFileImpl(
    options, tool, BUILD_OPTIONS_SCHEMA, own ? {
      ...BUILD_OPTIONS_SCHEMA,
      ...own,
    } : BUILD_OPTIONS_SCHEMA,
  );
}

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
/** Корни скана списком (запрос web-games 3, 2026-10-14): `root` — строка, массив или нет его. */
export function scanRoots(root: string | string[] | undefined, fallback: string): string[] {
  return root === undefined ? [fallback] : typeof root === 'string' ? [root] : root;
}

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
  set(id: string, tokens: Iterable<string>, notation?: MnNotationDirective): boolean;
  /** Снимает файл с учёта (удалён, перестал подходить под фильтр). */
  remove(id: string): boolean;
  /** Регистрирует динамический пресет из файла (`*.mn.ts`). */
  setPreset(id: string, preset: MnPreset): void;
  /** Снимает пресет с учёта. */
  removePreset(id: string): boolean;
  /** Есть ли у файла учтённые токены. */
  has(id: string): boolean;
  /**
   * Класс области файла (D-076), если его область изолируется (`isolateMode` не `'none'`, семейство
   * пресетов не приложения); иначе `undefined`. Файл должен быть уже учтён (`add`/`set`).
   */
  scopeClassOf(id: string): string | undefined;
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
  const presets = options.presets || [];
  const scopePresets = options.scopePresets || [];
  /**
   * Предупреждения перехватываются всегда: у сборщика свой канал вывода, поэтому ядро не печатает,
   * а сборка судит каждое по строгости файлов, где встретился токен (D-081), — в отчёт, в ошибку
   * или никуда. Колбэк `onWarning` вызывается всегда, дополнительно к режиму (D-035).
   */
  const userOnWarning = options.onWarning;
  const isolateMode = options.isolateMode || 'none';
  const core = coreOptionsOf(options);
  /**
   * Опции ядра области пакета — без `media` приложения (D-084): медиа и синонимы области — только из
   * её пресетов; имя, которого они не знают, — неизвестное медиа этой области, а не чужое определение.
   */
  const packageCore: MnCoreOptions = {
    ...core,
  };
  delete packageCore.media;
  /** Опции ядра компилируемой сейчас области: приложения или пакета. */
  let scopeCore = core;
  /** Токены по файлам — ключ по файлу и снимает файл с учёта, и заменяет набор. */
  const byFile = new Map<string, Set<string>>();
  /**
   * Режим синтаксиса файла, если он отличается от режима проекта, и требуемые пресеты
   * (D-045 этап 3): директива `@minotation` в файле → `"minotation"` в `package.json`.
   */
  /** Настройки разбора файла, если отличаются от проекта (D-081): ключ `parseSettingsKey`. */
  const fileSettings = new Map<string, string>();
  /** Строгость файла, если задана (D-081): JSON ключей `STRICTNESS_KEYS`. */
  const fileStrictness = new Map<string, string>();
  /** Правила `scopes` потребителя поверх декларации файла (D-082); пути — от рабочего каталога. */
  const resolveScope = createScopeResolverImpl(options.scopes, process.cwd());
  const fileRequires = new Map<string, string[]>();
  const projectMode = options.notationMode || 'context-qualified';
  const conflictMode = options.notationConflictMode || 'warn';
  /** Динамические пресеты из файлов, по пути. */
  const dynamic = new Map<string, MnPreset>();
  /** Директива файла динамического пресета: по ней пресет попадает в свою область (D-078). */
  const dynamicNotation = new Map<string, MnNotationDirective | undefined>();
  let warnings: MnWarning[] = [];
  /** Слепок набора, на котором собран `cachedCss`; пустая строка — кеша нет. */
  let cacheKey = '';
  let cachedCss = '';

  function add(id: string, source: string): boolean {
    return set(
      id, scan(source, id), readFileNotation(source, id),
    );
  }

  /** Режим и требования файла; изменились — кеш CSS сбрасывается. */
  function setMeta(
    id: string, settings: string, requires: string[] | undefined, strictness: string,
  ): boolean {
    const changed = (fileSettings.get(id) || '') !== settings
      || (fileRequires.get(id) || []).join() !== (requires || []).join()
      || (fileStrictness.get(id) || '') !== strictness;
    settings ? fileSettings.set(id, settings) : fileSettings.delete(id);
    strictness ? fileStrictness.set(id, strictness) : fileStrictness.delete(id);
    requires && requires.length ? fileRequires.set(id, requires) : fileRequires.delete(id);
    changed && (cacheKey = '');
    return changed;
  }

  function set(
    id: string, tokens: Iterable<string>, own?: MnNotationDirective,
  ): boolean {
    const notation = resolveScope(id, own);
    const changed = setMeta(
      id, ownSettings(notation), notation && notation.requires, ownStrictness(notation),
    );
    return setTokens(id, tokens) || changed;
  }

  /**
   * Настройки разбора файла, которые отличаются от проекта, — ключом `parseSettingsKey`; совпадающие
   * не в счёт: файл с режимом проекта компилируется общим компилятором.
   */
  function ownSettings(notation: MnNotationDirective | undefined): string {
    if (!notation) {
      return '';
    }
    const settings: MnParseSettings = {};
    notation.notationMode && notation.notationMode !== projectMode && (settings.notationMode = notation.notationMode);
    notation.groupMode && notation.groupMode !== (options.groupMode || 'groups') && (settings.groupMode = notation.groupMode);
    notation.contextWhere === undefined || notation.contextWhere === !!options.contextWhere
      || (settings.contextWhere = notation.contextWhere);
    return parseSettingsKey(settings);
  }

  /** Строгость файла (D-081) — JSON заданных ключей; пустая строка — как у проекта. */
  function ownStrictness(notation: MnNotationDirective | undefined): string {
    const out: Record<string, unknown> = {};
    let any = false;
    for (const key of STRICTNESS_KEYS) {
      notation && notation[key] !== undefined && (out[key] = notation[key], any = true);
    }
    return any ? JSON.stringify(out) : '';
  }

  /**
   * Режим для предупреждения токена: строжайший среди файлов, где токен встретился (D-081) — каждый
   * файл судится своими настройками. Токен ни в одном файле — режим проекта.
   */
  function modeFor(
    key: keyof MnNotationDirective, token: string, files: Map<string, string[]>,
  ): string {
    const project = String((options as Record<string, unknown>)[key] || (key === 'warningMode' ? 'log' : 'warn'));
    const ids = filesOf(token, files);
    if (!ids.length) {
      return project;
    }
    let best = '';
    let mode: string;
    let own: Record<string, string>;
    for (const id of ids) {
      own = fileStrictness.has(id) ? JSON.parse(fileStrictness.get(id) as string) : {};
      mode = own[key] || project;
      best = best && MODE_WEIGHT[best] >= MODE_WEIGHT[mode] ? best : mode;
    }
    return best;
  }

  /**
   * Файлы токена предупреждения. У неизвестного медиа токен — имя медиа (`@zz`, одно предупреждение
   * на имя): его файлы — те, где класс с этим медиа.
   */
  function filesOf(token: string, files: Map<string, string[]>): string[] {
    const own = files.get(token);
    if (own || token[0] !== '@') {
      return own || [];
    }
    const out: string[] = [];
    for (const [name, ids] of files) {
      name.indexOf(token) > -1 && out.push(...ids);
    }
    return out;
  }

  /** Токен → файлы, где он встретился (по записям `цель токен`). */
  function filesByToken(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    let token: string;
    for (const [id, entries] of byFile) {
      for (const entry of entries) {
        token = entry.slice(entry.indexOf(' ') + 1);
        (out.get(token) || out.set(token, []).get(token) as string[]).push(id);
      }
    }
    return out;
  }

  /**
   * Судит предупреждение по строгости файлов (D-081): `silent` — нет, `warn`/`log` — в отчёт,
   * `strict`/`error` — в ошибку сборки.
   */
  function judge(
    warning: MnWarning, files: Map<string, string[]>, verdict: Verdict,
  ): void {
    if (PRESET_WARNINGS[warning.type]) {
      verdict[0].push(warning);
      return;
    }
    const raise = RAISE_OPTIONS[warning.type];
    const mode = modeFor(
      raise || 'warningMode', warning.token, files,
    );
    if (MODE_WEIGHT[mode] === 2) {
      (raise ? verdict[3] : verdict[2]).push(warning);
    } else if (MODE_WEIGHT[mode]) {
      verdict[0].push(warning);
    }
  }

  function setTokens(id: string, tokens: Iterable<string>): boolean {
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
    fileSettings.delete(id);
    fileStrictness.delete(id);
    fileRequires.delete(id);
    if (!byFile.delete(id)) {
      return false;
    }
    cacheKey = '';
    return true;
  }

  /**
   * Область файла или пресета (D-076, D-078): `''` — приложение; иначе — его семейство пресетов,
   * отсортированный `requires`. В область приложения попадает и пакет, чьи требования
   * целиком входят в `presets` приложения: другой `notationMode` сам по себе области не даёт.
   */
  function scopeOf(requires: string[] | undefined, appNames: string[]): string {
    return requires && requires.some((name) => appNames.indexOf(name) < 0) ? requires.slice().sort().join(',') : '';
  }

  /** Записи по областям; область приложения есть всегда (статика пресетов, `mn.css`). */
  function collect(appNames: string[]): Map<string, ScopeEntries> {
    const scopes = new Map<string, ScopeEntries>([['', [new Set<string>(), '']]]);
    let settings: string | undefined;
    let scope: ScopeEntries;
    let key: string;
    // Файлы — по пути: при конфликте режимов выигрывает первый (детерминированно).
    for (const id of Array.from(byFile.keys()).sort()) {
      settings = fileSettings.get(id);
      key = scopeOf(fileRequires.get(id), appNames);
      scope = scopes.get(key) || scopes.set(key, [new Set<string>(), id]).get(key) as ScopeEntries;
      for (const token of byFile.get(id) as Set<string>) {
        scope[0].add(settings ? settings + '\0' + token : token);
      }
    }
    return scopes;
  }

  /**
   * Пресеты области. Приложение — `presets` и свои динамические; область пакета — его
   * `requires` по имени из `presets` и `scopePresets` с их зависимостями, плюс динамические
   * пресеты этой области (D-078). Нужного имени нет — ошибка с именем файла.
   */
  function presetsOf(
    scope: string, firstId: string, appNames: string[],
  ): MnPreset[] {
    const own: MnPreset[] = [];
    for (const [id, preset] of dynamic) {
      scopeOf(dynamicNotation.get(id) && (dynamicNotation.get(id) as MnNotationDirective).requires, appNames) === scope
        && own.push(preset);
    }
    return scope ? familyOf(scope.split(','), firstId).concat(own) : presets.concat(own);
  }

  function familyOf(names: string[], id: string): MnPreset[] {
    const available = presets.concat(scopePresets);
    const out: MnPreset[] = [];
    const seen: Record<string, 1> = {};
    const queue = names.slice();
    let name: string | undefined;
    let preset: MnPreset | undefined;
    while ((name = queue.shift()) !== undefined) {
      if (seen[name]) {
        continue;
      }
      seen[name] = 1;
      preset = available.find((item) => typeof item !== 'function' && item.name === name);
      if (!preset) {
        // Зависимость пресета без пары — сообщит ядро («presetX requires presetY»); имя из
        // `requires` файла — ошибка здесь, с файлом.
        names.indexOf(name) < 0 || fail(relative(process.cwd(), id) + ' requires preset "' + name
          + '", which is not connected. Connected presets: ' + (namesOf(available).join(', ') || 'none'));
        continue;
      }
      out.push(preset);
      typeof preset === 'function' || queue.push(...(preset.requires || []));
    }
    return out;
  }

  /**
   * Конфликт режимов (D-045): класс встречается в файлах с разными режимами и в них даёт
   * разный CSS. `'warn'` — предупреждение и одна запись: из первого (по пути) файла, где
   * класс даёт CSS; `'strict'` — ошибка.
   */
  function resolveConflicts(
    entries: string[], all: MnPreset[], out: MnWarning[],
  ): string[] {
    const byToken = new Map<string, string[]>();
    let at: number;
    let token: string;
    for (const entry of entries) {
      at = entry.indexOf('\0');
      token = entry.slice(at + 1);
      (byToken.get(token) || byToken.set(token, []).get(token) as string[]).push(entry);
    }
    const drop = new Set<string>();
    let variants: string[];
    let outputs: string[];
    let keep: number;
    let message: string;
    for ([token, variants] of byToken) {
      if (variants.length < 2) {
        continue;
      }
      outputs = variants.map((entry) => compileAlone(entry, all));
      if (outputs.every((css) => css === outputs[0])) {
        continue;
      }
      keep = Math.max(outputs.findIndex(Boolean), 0);
      message = 'Class "' + token.slice(token.indexOf(' ') + 1) + '" means different things in different notation'
        + ' settings: ' + variants.map((entry, index) => modeOf(entry) + (outputs[index] ? '' : ' (no CSS)'))
        .join(', ') + '. Kept: ' + modeOf(variants[keep]) + '. To fail the build instead:'
        + ' notationConflictMode: \'strict\'.';
      conflictMode === 'strict' && fail(message);
      out.push({
        type: 'notation-conflict',
        token: token.slice(token.indexOf(' ') + 1),
        message,
      });
      variants.forEach((entry, index) => index === keep || drop.add(entry));
    }
    return drop.size ? entries.filter((entry) => !drop.has(entry)) : entries;
  }

  /** Настройки разбора записи словами; без тега — настройки проекта (его режим). */
  function modeOf(entry: string): string {
    const at = entry.indexOf('\0');
    return at < 0 ? projectMode : describeSettings(entry.slice(0, at));
  }

  /** Одна область — свой экземпляр ядра: реестр хендлеров не общий (D-078). */
  function compileScope(
    entries: string[], all: MnPreset[], files: Map<string, string[]>, verdict: Verdict, isolateClass?: string,
  ): string {
    const raw: MnWarning[] = [];
    // Ядро сообщает обо всём (режимы токенов — `'warn'`, без печати), судит сборка — по файлам (D-081).
    const mn = minotationProvider({
      ...scopeCore,
      warningMode: 'silent',
      specificityMode: 'warn',
      importantMode: 'warn',
      maxDepthMode: 'warn',
      childSelectorMode: 'warn',
      unknownMediaMode: 'warn',
      suspectClassMode: 'warn',
      groupSuspectMode: 'warn',
      // Область пакета — привязана к своему классу (D-075); приложение — без изоляции (D-076).
      isolateMode: isolateClass ? isolateMode : 'none',
      isolateClass,
      onWarning: (warning: MnWarning) => {
        raw.push(warning);
        userOnWarning && userOnWarning(warning);
      },
    });
    (mn as unknown as { _quietRaise: boolean })._quietRaise = true;
    mn.setPresets(all);
    // Каждый токен — в свой целевой атрибут (D-025). До 2026-10-05 всё шло
    // в `class`, и `m="p10"` давал `.p10` вместо `[m~="p10"]` — так в v2
    // потерялась опция `attrs` из v1.
    compileEntries(mn, resolveConflicts(
      entries, all, verdict[0],
    ));
    mn.compile();
    for (const warning of raw) {
      judge(
        warning, files, verdict,
      );
    }
    for (const warning of verdict[3].splice(0)) {
      verdict[1].push(...forbiddenWording(
        warning, entries, all,
      ));
    }
    return mn.styles$.getValue()
      .map((s: { content: string }) => s.content)
      .join('\n');
  }

  /**
   * Запрещённый по файлу токен — словами ядра для `'strict'` (D-081): токен компилируется заново,
   * один, со строгим режимом своего типа. Путь редкий — только когда что-то запрещено.
   */
  function forbiddenWording(
    warning: MnWarning, entries: string[], all: MnPreset[],
  ): MnWarning[] {
    const option = RAISE_OPTIONS[warning.type] as string;
    const mn = minotationProvider({
      ...scopeCore,
      warningMode: 'silent',
      onWarning: undefined,
      [option]: 'strict',
    });
    (mn as unknown as { _quietRaise: boolean })._quietRaise = true;
    mn.setPresets(all);
    compileEntries(mn, entries.filter((entry) => entry.indexOf(warning.token) > -1));
    try {
      mn.compile();
    } catch (error) {
      return (error as InstanceType<typeof MnForbiddenTokenError>).tokens.filter((item) => item.type === warning.type);
    }
    /* istanbul ignore next — тот же токен в тех же пресетах в строгом режиме бракуется всегда */
    return [warning];
  }

  /**
   * Директива файла динамического пресета: комментарий в нём → `package.json` пакета. Файла
   * нет (виртуальный модуль) — только пакет.
   */
  function presetNotation(id: string): MnNotationDirective | undefined {
    let source = '';
    try {
      source = readFileSync(id, 'utf8');
    } catch {
      // Виртуальный модуль сборщика — читать нечего.
    }
    return resolveScope(id, readFileNotation(source, id));
  }

  /**
   * CSS одного класса в своём режиме — для сравнения при конфликте. Экземпляр служебный: всё,
   * о чём он мог бы сообщить (конфликты пресетов при подключении, режимы токенов), уже сообщил
   * основной — иначе каждое предупреждение печаталось по разу на сравнение (найдено 2026-10-14).
   */
  function compileAlone(entry: string, all: MnPreset[]): string {
    const mn = minotationProvider({
      ...scopeCore,
      warningMode: 'silent',
      onWarning: undefined,
      maxDepthMode: 'silent',
      specificityMode: 'silent',
      importantMode: 'silent',
      childSelectorMode: 'silent',
      unknownMediaMode: 'silent',
      suspectClassMode: 'silent',
      handlerConflictMode: 'silent',
      presetConflictMode: 'silent',
      groupSuspectMode: 'silent',
    });
    mn.setPresets(all);
    compileEntries(mn, [entry]);
    mn.compile();
    return mn.styles$.getValue()
      .map((s: { content: string }) => s.content)
      .join('\n');
  }

  return {
    add,
    set,
    remove,
    has(id: string): boolean {
      return byFile.has(id);
    },
    scopeClassOf(id: string): string | undefined {
      const family = isolateMode === 'none' ? '' : scopeOf(fileRequires.get(id), namesOf(presets));
      return family ? scopeClassName(family) : undefined;
    },
    setPreset(id: string, preset: MnPreset): void {
      dynamic.set(id, preset);
      dynamicNotation.set(id, presetNotation(id));
      cacheKey = '';
    },
    removePreset(id: string): boolean {
      dynamicNotation.delete(id);
      if (!dynamic.delete(id)) {
        return false;
      }
      cacheKey = '';
      return true;
    },
    clear(): void {
      byFile.clear();
      fileSettings.clear();
      fileStrictness.clear();
      fileRequires.clear();
      dynamic.clear();
      dynamicNotation.clear();
      cacheKey = '';
    },
    takeWarnings(): MnWarning[] {
      const out = warnings;
      warnings = [];
      return out;
    },
    css(): string {
      const appNames = namesOf(presets);
      const scopes = collect(appNames);
      const keys = Array.from(scopes.keys()).sort();
      // В слепок входят области с их записями и пресеты: набор пресетов меняет CSS не меньше токенов.
      const key = keys.map((scope) => scope + '\u0001' + Array.from((scopes.get(scope) as ScopeEntries)[0]).sort().join(' '))
        .join('\u0002') + '\u0000' + Array.from(dynamic.keys()).join(' ');
      if (key === cacheKey) {
        return cachedCss;
      }
      // В отчёт, запрещённые токены, ошибки разбора — по строгости файлов (D-081).
      const verdict: Verdict = [
        [],
        [],
        [],
        [],
      ];
      const files = filesByToken();
      const outputs: string[] = [];
      let scope: ScopeEntries;
      let all: MnPreset[];
      // Область приложения — первой (`''` в сортировке первая), области пакетов — за ней.
      for (const name of keys) {
        scope = scopes.get(name) as ScopeEntries;
        scopeCore = name ? packageCore : core;
        all = presetsOf(
          name, scope[1], appNames,
        );
        outputs.push(compileScope(
          Array.from(scope[0]).sort(), all, files, verdict, name && isolateMode !== 'none' ? scopeClassName(name) : undefined,
        ));
      }
      warnings = verdict[0];
      verdict[1].length && failWith(new MnForbiddenTokenError(verdict[1]));
      verdict[2].length && failWith(new MnWarningError(verdict[2]));
      cachedCss = outputs.filter(Boolean).join('\n');
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
   * Уникальных токенов во всех файлах.
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
  set(id: string, entries: Iterable<string>, notation?: MnNotationDirective): boolean;
  remove(id: string): boolean;
  has(id: string): boolean;
  /** Класс области файла — {@link TokenCollector.scopeClassOf}; по первой записи, где файл учтён. */
  scopeClassOf(id: string): string | undefined;
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
  function distribute(
    id: string, entriesOf: (key: string) => string[], notation: MnNotationDirective | undefined,
  ): boolean {
    let changed = false;
    let i = 0;
    for (; i < l; i++) {
      changed = (parts[i].filter.accepts(id)
        ? parts[i].collector.set(
          id, entriesOf(parts[i].key), notation,
        )
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
      // Режим и требования файла читаются один раз на файл, а не на запись `entry`.
      return distribute(
        id, scan, readFileNotation(source, id),
      );
    },
    set(
      id: string, found: Iterable<string>, notation?: MnNotationDirective,
    ): boolean {
      const list = Array.from(found);
      count(id, list);
      return distribute(
        id, () => list, notation,
      );
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
    scopeClassOf(id: string): string | undefined {
      const part = parts.find((item) => item.collector.has(id));
      return part && part.collector.scopeClassOf(id);
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
