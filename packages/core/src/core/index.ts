/**
 * Minotation — ядро.
 *
 * ## Про `any` и присваивание внутри условия
 *
 * Оба отключённых ниже правила — осознанный стиль этого модуля, а не недосмотр.
 *
 * `no-explicit-any`: ядро принимает структуры, форма которых определяется
 * во время выполнения и статически не выражается — объекты параметров хендлера
 * (зависят от `pattern`, с которым хендлер зарегистрирован), «сырые» значения
 * пресетов до нормализации, узлы дерева неизвестного происхождения (ядро
 * работает и вне браузера). Там, где тип выразим, он указан явно — кортежи
 * эссенций (`MnEssenceResult`), опции, предупреждения.
 *
 * `no-cond-assign`: `if (m = re.exec(v))` — сквозная идиома компилятора,
 * унаследованная от v1. Разворот в две строки на горячем пути разбора токенов
 * добавил бы переменных и переходов, не прибавив ясности.
 *
 * @module core
 */
/* eslint-disable @typescript-eslint/no-explicit-any, no-cond-assign -- см. комментарий выше */

import {
  MN_ESSENCE_PAIR,
  MN_RAW_PROPERTY,
  MN_NEGATIVE,
  MN_CSS_RULE,
} from '../selectorsCompileProvider/constants';
import {
  checkOptions,
  CORE_OPTIONS_SCHEMA,
  describeValue,
  isObject as isObjectOption,
} from '../checkOptions';
import {
  mediaCondition,
} from './mediaCondition';
import {
  eachApply,
  eachTry,
  forEach,
  forIn,
  isArray,
  isDefined,
  isEmpty,
  isObject,
  isPlainObject,
  isString,
  keys,
  noop,
  push,
  values,
  extend,
  joinArrays,
  joinComma,
  joinOnly,
  reduceIn,
  repeat,
  color,
  colorGetBackground,
  cssPropertiesStringifyProvider,
  type IStringifyCss,
  withDefer,
  getBase,
  set as baseSet,
} from 'fundamentool';
import {
  selectorsCompileProvider,
  extractMedia,
} from '../selectorsCompileProvider';
import type {
  ParseComboNameFn,
} from '../selectorsCompileProvider';
import {
  isInvalidSelector,
} from '../isInvalidSelector';
import {
  suspectClassMessage,
} from '../selectorsCompileProvider/raiseMessages';
import {
  baseUtils,
  observableProvider,
  OBJECT,
  FUNCTION,
  STRING,
  MN_CONTEXT_ESSENCE_MAP,
  MN_CONTEXT_ESSENCE_SELECTORS,
  MN_CONTEXT_ESSENCE_CSS_TEXT,
  MN_CONTEXT_ESSENCE_UPDATED,
  MN_CONTEXT_ESSENCE_CONTENT,
  MN_ESSENCE_STYLE,
  MN_ESSENCE_PRIORITY,
  MN_ESSENCE_IMPORTANT,
  MN_ESSENCE_EXTS,
  MN_ESSENCE_SELECTORS,
  MN_ESSENCE_CHILDS,
  MN_ESSENCE_MEDIA,
  MN_ESSENCE_INCLUDE,
  MN_ESSENCE_CSS_TEXT,
  MN_ESSENCE_INITED,
  MN_KEYFRAMES_TOKEN,
  MN_DEFAULT_PRIORITY,
  MN_DEFAULT_CSS_PRIORITY,
  MN_DEFAULT_OTHER_CSS_PRIORITY,
  SPLIT_SELECTOR,
  SPLIT_AMP,
  REGEXP_MEDIA_PRIORITY,
  REGEXP_MATCH_VAR,
  REGEXP_MATCH_IMPORTANT,
  REGEXP_IMPORTANT,
  REGEXP_MATCH_VALUE,
  REGEXP_INVALID_CSS_VALUE,
  JOIN_AND,
  normalizeSelectors,
  normalizeComboNames,
  handlerWrap,
  __normalize,
  mergeEssenceInto,
  mergeEssenceDepth,
  priotitySort,
  priotitySortContext,
  getEessenceSelectors,
  __compileProvider,
  spaceNormalize,
  asError,
} from './utils';
import type {
  MnData,
  MnStatics,
  MnStyleEntry,
  MnCompiler,
  MnMediaEntry,
  MnContextEssence,
  MnEssenceResult,
  MnEssenceRaw,
  MnEssenceParams,
  MnOptions,
  MnPreset,
  MnPresetObject,
  MnParseSettings,
  MnRaiseMode,
  MnWarning,
} from './types';
import {
  orderPresets,
} from './presetOrder';
import {
  MnForbiddenTokenError,
  MnParseError,
  MnWarningError,
  parseSettingsKey,
} from './types';
import type {
  MnCssDeclarations,
  MnEntity,
  MnHandler,
  MnInstance,
} from '../types';

// Присваиваем utils статическому свойству (нужно для обратной совместимости)
minotationProvider.utils = baseUtils;

/** Печать предупреждения в режиме `warningMode: 'log'` (по умолчанию). */
function logWarning(warning: MnWarning): void {
  console.warn('[minotation] ' + warning.token + ': ' + warning.message);
}

/**
 * Пресет как функция `(mn) => void` — для `eachTry`. На время выполнения пресета его строки
 * разбираются в его режиме синтаксиса (D-045): у объекта — `notationMode`, у функции и
 * объекта без него — `'context-qualified'`, на котором написаны стандартные пресеты.
 */
function asPresetFunction(preset: MnPreset): (mn: MnInstance) => void {
  const presetIsFunction = typeof preset === 'function';
  const mode = presetIsFunction ? 'context-qualified' : preset.notationMode || 'context-qualified';
  const setup = presetIsFunction ? preset : preset.setup;
  return (mn) => {
    (mn as any)._presetMode = mode;
    (mn as any)._presetName = presetLabel(preset);
    try {
      setup(mn);
    } finally {
      (mn as any)._presetMode = undefined;
      (mn as any)._presetName = '';
    }
  };
}

/** Имя пресета для сообщений: имя объекта, имя функции или «безымянный пресет». */
function presetLabel(preset: MnPreset): string {
  return typeof preset === 'function' ? preset.name || 'an unnamed preset' : preset.name;
}

function fail(message: string): never {
  throw new Error('[minotation] ' + message);
}

/** Точка медиа строкой с единицей (D-069): `'48rem'`, `'40em'`, `'768px'`. */
const REGEXP_POINT_LENGTH = /^(\d+(?:\.\d+)?)(px|rem|em)$/;

/** Число — граница медиа-диапазона, с единицей или без (px): `480`, `10rem`, `30.5em`. */
const REGEXP_MEDIA_BOUND = /^([0-9]+(?:\.[0-9]+)?)(px|rem|em)?$/;

/** Начинается с цифры или дефиса — значит, задумывался диапазон (`@760x400`, `@-760`, `@-`). */
const REGEXP_MEDIA_NUMERIC_START = /^(?:-|[0-9])/;

/** Имя контейнера — идентификатор CSS. */
const REGEXP_CONTAINER_NAME = /^-?[a-zA-Z_][a-zA-Z0-9_-]*$/;

/** Условие, которое никогда не выполняется: медиа с ошибкой — правило в CSS не попадает (D-088). */
const MEDIA_NEVER = 'not all';

/** Граница медиа-диапазона: `[сторона, CSS-длина, px для порядка, точка ли]`. */
type MediaBound = [string, string, number, number];

/** Случаи со своим режимом `'warn' | 'silent' | 'strict'` (D-039). */
/**
 * Функция записи домена (D-063): готовая эссенция, `0` — CSS нет (причина сообщена), `undefined` —
 * запись не подходит (статика с хвостом), искать дальше.
 */
type MnDomainFn = (p: MnEssenceParams, value: string) => MnEssenceResult | 0 | null | false | void;

/**
 * Запись домена: префикс остатка имени (`''`, `A`, `-w`, `-w-full`), функция и пресет, который
 * её зарегистрировал (`''` — вне пресета), — для `handlerConflictMode` (D-067).
 */
type MnDomainEntry = [string, MnDomainFn, string];

/**
 * Селекторы элемента × селекторы эссенции. Обычно селектор эссенции дописывается к элементу
 * (`.x` + `>*` → `.x>*`); `&` в нём — сам элемент, и элемент встаёт на его место:
 * `:where(&>:not(:last-child))` → `:where(.x>:not(:last-child))` — нулевая специфичность, как у
 * Tailwind 4 (D-069).
 */
function joinEssenceSelectors(prefixes: Record<string, number>, suffixes: Record<string, number>): Record<string, number> {
  const dst: Record<string, number> = {};
  let prefix: string;
  let suffix: string;
  for (prefix in prefixes) { // eslint-disable-line
    for (suffix in suffixes) { // eslint-disable-line
      dst[suffix.indexOf('&') < 0 ? prefix + suffix : suffix.split('&').join(prefix)] = 1;
    }
  }
  return dst;
}

/**
 * Вложенные `@media` по записям (D-070): у каждой записи — свои условия, без уже встреченных:
 * `md` + `hover` → `['@media (width >= 48rem)', '@media (hover: hover)']`.
 */
function nestedMedia(queries: string[]): string[] {
  const seen: Record<string, 1> = {};
  const out: string[] = [];
  let query: string;
  let part: string;
  let parts: string[];
  for (query of queries) {
    parts = [];
    for (part of query.split(' and ')) {
      seen[part] || (seen[part] = 1, parts.push(part));
    }
    parts.length && out.push('@media ' + parts.join(' and '));
  }
  return out;
}

/**
 * Медиа токена и медиа селектора через `&` (D-071); приоритет `^N` — в конце (токена — важнее).
 * `('d', 'hover^3')` → `'d&hover^3'`; `('', 'dark')` → `'dark'`.
 */
function joinMedia(token?: string, selector?: string): string {
  const a = token ? REGEXP_PRIORITY_TAIL.exec(token) : null;
  const b = selector ? REGEXP_PRIORITY_TAIL.exec(selector) : null;
  const left = token ? (a ? token.slice(0, a.index) : token) : '';
  const right = selector ? (b ? selector.slice(0, b.index) : selector) : '';
  const priority = a ? a[0] : b ? b[0] : '';
  return (left && right ? left + '&' + right : left || right) + priority;
}

/** Приоритет в конце медиа-выражения: `^3`, `^-100`. */
const REGEXP_PRIORITY_TAIL = /\^-?[0-9]+$/;

/** Условия медиа без повторов: каждое — по частям `… and …`, порядок первого вхождения. */
function uniqueConditions(queries: string[]): string[] {
  const seen: Record<string, 1> = {};
  const out: string[] = [];
  let query: string;
  let part: string;
  for (query of queries) {
    for (part of query.split(' and ')) {
      seen[part] || (seen[part] = 1, out.push(part));
    }
  }
  return out;
}

/** Ключ домена — первые строчные буквы имени, остальное — префикс записи (D-063). */
const REGEXP_DOMAIN = /^([a-z]*)(.*)$/;

/** Значение объявления `mn.css`: строка или число. */
function isCssValue(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number';
}

/**
 * Подходит ли префикс записи к остатку имени. Префикс, кончающийся буквой, не режет слово
 * пополам: `-w` подходит к `-w-4` и `-w4`, но не к `-wide` (D-063, уточнение правила 3).
 */
function prefixMatches(rest: string, prefix: string): boolean {
  const l = prefix.length;
  const last = prefix[l - 1];
  const next = rest[l];
  return !l || rest.slice(0, l) === prefix && !(next >= 'a' && next <= 'z'
    && (last >= 'a' && last <= 'z' || last >= 'A' && last <= 'Z'));
}

type RaiseType = 'raised-specificity' | 'important' | 'max-depth-exceeded' | 'max-specificity' | 'child-selector'
  | 'unknown-media' | 'suspect-class' | 'handler-conflict' | 'preset-conflict' | 'media-conflict' | 'group-suspect';

/** Типы медиа CSS: известны без описания в `mn.media` (D-058). */
const CSS_MEDIA_TYPES: Record<string, number> = {
  all: 1,
  print: 1,
  screen: 1,
};

function unknownMediaMessage(name: string, strict: boolean): string {
  return strict
    ? 'Media "@' + name + '" is unknown (unknownMediaMode: \'strict\'), the token gives no CSS.'
      + ' Describe it in mn.media or allow it: unknownMediaMode: \'warn\'.'
    : 'Media "@' + name + '" is unknown — it goes to CSS as written: "@media ' + name + '". Describe it'
      + ' in mn.media; to hide this warning: unknownMediaMode: \'silent\'; to forbid such tokens:'
      + ' unknownMediaMode: \'strict\'.';
}

/** Имя свойства произвольной декларации: CSS-идентификатор или переменная. */
const REGEXP_RAW_PROPERTY = /^-{0,2}[a-zA-Z_][\w-]*$/;

function throwRawProperty(body: string): never {
  throw new MnParseError('Arbitrary property "[' + body + ']" expects "[property:value]"', {
    token: '[' + body + ']',
    handler: '',
    arg: body,
  });
}

function throwNoHandler(name: string, value: string): never {
  throw new MnParseError('Property "' + name + '" has no handler: the class gives no CSS', {
    token: value.replace(MN_ESSENCE_PAIR, ':'),
    handler: name,
    arg: '',
  });
}

/**
 * Предупреждение компиляции, а не `*N`/`-i`/`maxDepth` — только такие роняют сборку
 * при `warningMode: 'error'`: у тех трёх свои режимы (D-039).
 */
function isCompileWarning(warning: MnWarning): boolean {
  return warning.type !== 'raised-specificity' && warning.type !== 'important'
    && warning.type !== 'max-depth-exceeded' && warning.type !== 'child-selector'
    && warning.type !== 'unknown-media' && warning.type !== 'suspect-class'
    && warning.type !== 'handler-conflict' && warning.type !== 'preset-conflict' && warning.type !== 'media-conflict'
    && warning.type !== 'group-suspect';
}

/**
 * Создаёт независимый экземпляр Minotation.
 *
 * Возвращает функцию `mn`, вызываемую и как регистратор хендлеров/эссенций
 * (`mn(name, handler)`), и как объект с методами API (`mn.compile`, `mn.assign`,...) —
 * см. {@link MnInstance}. Несколько экземпляров полностью независимы: своё состояние
 * (`$$essences`, `$$root`, `$$staticsEssences` и т.д.), свои пресеты, свой `styles$`.
 *
 * @param options — `presets` (загружаются сразу), `media`, `onError`, `isolateMode`, `altColor`
 * @returns экземпляр `mn`
 *
 * @example
 * const mn = minotationProvider({ presets: [presetStandard] });
 * mn.check('w50 cF00');
 * mn.compile;
 * mn.styles$.getValue; // → скомпилированные CSS-стили
 */
function minotationProvider(options?: MnOptions) {
  checkOptions(
    options, CORE_OPTIONS_SCHEMA, 'minotationProvider',
  );
  // Отдельная переменная, а не мутация параметра: `setOptions` его
  // переприсваивает, и из-за этого компилятор не мог сузить тип внутри
  // замыканий — каждое обращение к полю требовало проверки на `undefined`,
  // хотя значение выставляется первой же строкой.
  let settings: MnOptions = options || {};
  /** Подключённые пресет-объекты по имени — для `requires` следующих вызовов (D-045). */
  const $$presetNames: Record<string, MnPresetObject> = {};
  /** Конфликты имён под `handlerConflictMode: 'strict'` за один `setPresets` (D-067). */
  let $$strictConflicts: string[] = [];
  function setPresets(presets: MnPreset[]): any {
    // Порядок по зависимостям и проверки — до выполнения хоть одного пресета.
    const ordered = orderPresets(presets, $$presetNames);
    let preset: MnPreset;
    for (preset of ordered) {
      typeof preset === 'function' || ($$presetNames[preset.name] = preset);
    }
    checkEcosystems();
    $$strictConflicts = [];
    eachTry(
      ordered.map(withOwnMedia),
      [mn],
      mn,
      // `eachTry` отдаёт перехваченное как `unknown`: бросить можно что
      // угодно, а в `error$` должен уходить именно `Error`.
      (ex: unknown) => emitError(asError(ex)),
    );
    // Конфликт имён под `'strict'` копится, пока пресеты выполняются (`eachTry` перехватил бы
    // бросок), и бросается здесь — наружу, как неподключённый `requires` (D-067).
    $$strictConflicts.length && fail($$strictConflicts.join('; '));
    return mn;
  }
  /**
   * Пресет, после которого медиа из опции `media` восстанавливаются (D-092): то же имя у пресета — его
   * определение не действует, о совпадении сообщает `mediaConflictMode`.
   */
  function withOwnMedia(preset: MnPreset): (instance: MnInstance) => void {
    const setup = asPresetFunction(preset);
    return (instance) => {
      let name: string;
      setup(instance);
      for (name in $$ownMedia) { // eslint-disable-line
        $$media[name] === $$ownMedia[name] || (
          $$media[name] = $$ownMedia[name],
          raiseConfiguration(
            'media-conflict', 'media "' + name + '" from the options overrides the one of ' + presetLabel(preset),
            'mediaConflictMode',
          )
        );
      }
    };
  }

  /**
   * Маркеры экосистем (D-067): два подключённых пресета, чьи списки `ecosystems` не пересекаются, —
   * предупреждение `presetConflictMode`. Пресет без списка нейтрален.
   */
  function checkEcosystems(): void {
    const marked = values($$presetNames).filter((preset) => preset.ecosystems);
    const l = marked.length;
    let i = 0;
    let j: number;
    let a: MnPresetObject;
    let b: MnPresetObject;
    for (; i < l; i++) {
      for (j = i + 1; j < l; j++) {
        a = marked[i];
        b = marked[j];
        (a.ecosystems as string[]).some((name) => (b.ecosystems as string[]).indexOf(name) > -1)
          || raiseConfiguration(
            'preset-conflict', a.name + ' (' + (a.ecosystems as string[]).join(', ') + ') and ' + b.name
              + ' (' + (b.ecosystems as string[]).join(', ') + ') belong to different preset ecosystems',
            'presetConflictMode',
          );
      }
    }
  }

  function styleRender(): void {
    emit(values($$stylesMap).sort(priotitySort));
  }
  /**
   * Пересчитывает производные из `options` значения ($$onError/$$logWarning/
   * $$onWarning/$$altColor/$$failOnWarnings) и публикует
   * снимок в `mn.options`.
   *
   * ПЕРЕСМОТРЕНО 2026-09-23: раньше называлась `updateOptions` и вызывалась
   * на КАЖДОМ `compile`/`recompileFrom`, перечитывая `mn.options` заново —
   * расчёт был на то, что потребитель может мутировать `mn.options` напрямую
   * между компиляциями и ожидать, что это подхватится. Проверка показала: так
   * не делает никто — ни сборочные плагины, ни runtime-адаптеры, ни playground.
   * Опции
   * теперь читаются из ЗАМЫКАНИЯ (`options`, параметр конструктора), эта
   * функция вызывается только явно: один раз при создании и из
   * {@link MnInstance.setOptions} — не на каждой компиляции. Изменить
   * конфигурацию уже созданного инстанса теперь можно только через
   * `mn.setOptions(partial)` — прямая мутация `mn.options` эффекта не имеет
   * (снимок для чтения/отладки, обновляется этой же функцией).
   */
  function applyOptions(): void {
    mn.options = extend({}, settings) as MnOptions;
    $$onError = settings.onError || noop;
    const warningMode = settings.warningMode || 'log';
    $$logWarning = warningMode === 'log' ? logWarning : noop;
    $$onWarning = settings.onWarning || noop;
    // Изоляция (D-075): режим без класса области — не к чему привязывать правила.
    (mn as any)._isolateSuffix = settings.isolateMode === 'class' ? '.' + settings.isolateClass
      : settings.isolateMode === 'where' ? ':where(.' + settings.isolateClass + ')' : '';
    (settings.isolateMode || 'none') === 'none' || settings.isolateClass || fail('minotationProvider: option "isolateMode" is \'' + settings.isolateMode + '\' but "isolateClass" is not'
        + ' set — the scope class every rule is bound to (e.g. isolateClass: \'_l\')');
    $$altColor = settings.altColor === true;
    $$failOnWarnings = warningMode === 'error';
    $$mediaNesting = settings.mediaNesting === true;
    $$mediaClassic = settings.mediaSyntax === 'classic';
    $$raiseModes = {
      'raised-specificity': settings.specificityMode || 'warn',
      important: settings.importantMode || 'warn',
      'max-depth-exceeded': settings.maxDepthMode || 'warn',
      'max-specificity': settings.maxSpecificityMode || 'warn',
      'child-selector': settings.childSelectorMode || 'warn',
      'unknown-media': settings.unknownMediaMode || 'warn',
      'suspect-class': settings.suspectClassMode || 'warn',
      'handler-conflict': settings.handlerConflictMode || 'warn',
      'media-conflict': settings.mediaConflictMode || 'warn',
      'preset-conflict': settings.presetConflictMode || 'warn',
      'group-suspect': settings.groupSuspectMode || 'warn',
    };
  }
  /**
   * Токен перебивает стили весом (`*N`, `-i`) или тянется к дальнему предку
   * (`maxDepth`) — D-039. Режим — своя опция, `warningMode` не участвует: `'warn'`
   * печатает всегда и не роняет сборку при `warningMode: 'error'`, `'strict'` копит
   * токен для {@link MnForbiddenTokenError}.
   *
   * @param token — исходный токен
   * @param type — что именно
   * @param message — текст для режима: `true` — `'strict'`, `false` — `'warn'`
   * @returns `true` — токен запрещён и не должен давать CSS
   */
  function raisedToken(
    token: string, type: RaiseType, message: (strict: boolean) => string,
  ): boolean {
    const mode = $$raiseModes[type];
    const key = type + ' ' + token;
    let warning: MnWarning;
    if (mode === 'silent' || $$raisedTokens[key]) {
      return mode === 'strict';
    }
    $$raisedTokens[key] = 1;
    warning = {
      type: type,
      token: token,
      message: message(mode === 'strict'),
    };
    if (mode === 'strict') {
      $$forbidden.push(warning);
      return true;
    }
    $$warnings = $$warnings.concat([warning]);
    // `_quietRaise` — служебный переключатель сборки (D-081): она сама решает по настройкам файлов,
    // что из этого печатать, а что считать ошибкой; в консоль ядро тогда не пишет.
    (mn as any)._quietRaise || logWarning(warning);
    $$onWarning(warning);
    emitWarnings($$warnings);
    return false;
  }
  /**
   * Собирает {@link MnWarning} (парсинг-ошибка/неизвестный хендлер/превышение
   * `maxDepth`) — не бросает, не блокирует компиляцию. Дедуп по токену (§10-error-warnings.md,
   * Q3): повторное предупреждение для уже отмеченного токена не добавляется повторно.
   * `warnings$` копится между `compile`, сбрасывается только в `__clear` (см. ниже).
   */
  function collectWarning(warning: MnWarning): void {
    if ($$warningTokens[warning.token]) {
      return;
    }
    $$warningTokens[warning.token] = 1;
    $$warnings = $$warnings.concat([warning]);
    $$logWarning(warning);
    $$onWarning(warning);
    emitWarnings($$warnings);
  }
  /**
   * Проверяет `essence.style` (CSS-значения, УЖЕ вернувшиеся из хендлера).
   * Первое найденное битое значение — весь essence отбраковывается (не
   * частично).
   *
   * Осталась одна проверка — {@link REGEXP_INVALID_CSS_VALUE}: узнаваемый
   * мусор (`undefined`/`NaN`/`Rpx`), универсально для любого свойства.
   *
   * **Грамматическая проверка по свойству убрана из рантайма 2026-09-27**
   * (Q-01). Она была таблицей `PROPERTY_VALIDATORS`, которая жила отдельно от
   * хендлеров и ничего о них не знала: хендлер учился отдавать новую форму
   * значения — таблица не в курсе, и КОРРЕКТНЫЙ CSS молча отбраковывался. Так
   * было четыре раза (`var()`, многозначные shorthand'ы, градиенты в
   * `background`, `gap:normal`), и каждый раз это находил человек, наткнувшись
   * на неработающий стиль.
   *
   * Теперь значение проверяет сам хендлер — там, где оно и формируется, и где
   * список допустимого известен точно. Замер перед снятием: на прогоне всего
   * реестра (307 хендлеров × 30 форм аргумента) валидатор не забраковал НИ
   * ОДНОГО значения — всё отсекается раньше.
   *
   * Сторожем остаётся тест `validator-vs-css-tree.test.ts`: он прогоняет те же
   * пары через `css-tree` с `mdn-data` и ловит расхождение со спецификацией.
   * Вес там не важен, в рантайм эта библиотека не попадает.
   *
   * @returns `true`, если `style` не содержит подозрительных значений (или его нет вовсе)
   */
  function isBadCssValue(v: string): boolean {
    return REGEXP_INVALID_CSS_VALUE.test(v);
  }
  function validateEssenceStyle(
    essence: MnEssenceRaw, token: string, handlerName: string,
  ): boolean {
    const style = essence.style;
    if (!style) {
      return true;
    }
    let prop: string;
    let v: string | string[];
    let bad: string | undefined;
    for (prop in style) { // eslint-disable-line
      v = style[prop];
      bad = isArray(v)
        ? (v as string[]).find(isBadCssValue)
        : (isBadCssValue(v as string) ? v as string : undefined);
      if (bad !== undefined) {
        collectWarning({
          type: 'invalid-css-value',
          token,
          handler: handlerName,
          arg: prop + ':' + bad,
          message: 'Handler "' + handlerName + '" returned what looks like a broken CSS value for "'
            + prop + '": "' + bad + '"',
        });
        return false;
      }
    }
    return true;
  }
  /**
   * Регистрирует эссенцию (хендлер/статический объект) под именем/путём —
   * или, если первый аргумент объект, пачкой (`{ [essencePath]: extendedEssence }`).
   * Возвращает сам `mn` для чейнинга. Полные перегрузки и семантика `skip` — {@link MnInstance}.
   *
   * @param essencePath — имя эссенции (`'w'`) или карта `{ имя: хендлер/эссенция }`
   * @param extendedEssence — хендлер, статическая эссенция или строка (`exts`), если `essencePath` — строка
   * @param paramsMatchPath — паттерн для {@link handlerWrap}, если хендлеру нужен собственный разбор суффикса
   * @param skip — 0/1: пропустить авто-парсинг значения из суффикса токена
   * @returns сам `mn` (чейнинг)
   */
  function mn(
    essencePath: string | Record<string, MnHandler | MnEntity | string>,
    extendedEssence?: MnHandler | MnEntity | string,
    paramsMatchPath?: string | string[],
    skip?: number,
  ): any {
    const type = typeof essencePath;
    type === OBJECT
      ? forIn(essencePath as Record<string, MnHandler | MnEntity | string>, baseSetMapIteratee)
      : (
        !essencePath || type !== STRING
          ? console.warn('MN: essencePath value must be an string', essencePath)
          : mnBaseSet(
            extendedEssence,
            essencePath as string,
            paramsMatchPath,
            skip,
          )
      );
    return mn;
  }

  function mnBaseSet(
    // `undefined` входит в тип намеренно: `mn('tag')` без второго аргумента —
    // допустимый вызов, и функция сама сообщает о нём предупреждением в
    // последней ветке, а не падает.
    extendedEssence: MnHandler | MnEntity | string | undefined,
    essencePath: string,
    paramsMatchPath?: string | string[],
    skip?: number,
  ): void {
    let v: (((p: MnEssenceParams) => MnEssenceRaw | void | 0) & { skip?: number }) | undefined;
    const type = typeof extendedEssence;
    type === FUNCTION
      ? (
        v = paramsMatchPath
          ? handlerWrap(extendedEssence as MnHandler, paramsMatchPath)
          : extendedEssence as (p: MnEssenceParams) => MnEssenceRaw | void | 0,
        v.skip = skip || 0,
        setDomainEntry(essencePath, handlerEntry(v))
      )
      : (
        type === OBJECT
          ? baseSetEssense(essencePath, extendedEssence as MnEntity)
          : (
            type === STRING
              ? baseSetEssense(essencePath, {
                exts: extendedEssence as string,
              })
              : console.warn(
                'MN: extendedEssence value must be an object on',
                extendedEssence, 'where', essencePath,
              )
          )
      );
  }

  // isArray-ветка (тюпл [handler, pattern]) — легальна на уровне реализации, но нигде
  // не используется в presets/*.ts или тестах и не задокументирована в MnInstance.
  function baseSetMapIteratee(extendedEssence: MnHandler | MnEntity | string | [MnHandler, string], essencePath: string): void {
    isArray(extendedEssence)
      ? mnBaseSet(
        extendedEssence[0],
        essencePath,
        extendedEssence[1],
      )
      : mnBaseSet(extendedEssence,
        essencePath);
  }

  /**
   * Запоминает, что для `base` объявлен статический медиа-контекст.
   *
   * Важностные дубликаты (`box@sm-i`, заводятся рядом с каждой статикой)
   * пропускаются: иначе у `box` появился бы медиа-ребёнок с именем `sm-i`
   * и в CSS уехало бы `@media sm-i`.
   */
  function indexStaticMedia(name: string): void {
    if (REGEXP_IMPORTANT.test(name)) {
      return;
    }
    const at = name.indexOf('@');
    if (at < 1 || at === name.length - 1) {
      return;
    }
    const base = name.slice(0, at);
    ($$staticsMedias[base] || ($$staticsMedias[base] = {}))[name.slice(at + 1)] = 1;
  }

  function baseSetEssenseBase(
    name: string, path: string[], extendedEssence: MnEssenceRaw,
  ): void {
    indexStaticMedia(name);
    $$staticsEssences[name] || ($$staticsEssences[name] = __normalize({
      inited: 1,
    }) as MnEssenceResult);
    baseSet(
      $$staticsEssences, path, mergeEssenceDepth([
        getBase($$staticsEssences, path) || [],
        __normalize(extendedEssence) as MnEssenceResult,
      ], []),
    );
  }

  const MN_ESSENCE_CHILDS_KEY = '' + MN_ESSENCE_CHILDS;
  function baseSetEssense(_essencePath: string, extendedEssence: MnEssenceRaw): void {
    const essencePath = _essencePath.split('.');
    const essenceName = essencePath[0];
    const path = [essenceName];
    const l = essencePath.length;
    let i = 1;
    // Эссенция — кортеж по индексам (см. utils.ts MN_ESSENCE_*): дочерняя часть
    // `tbl.cell` лежит в essence[MN_ESSENCE_CHILDS].cell, а не в свойстве `childs`
    // (строковый ключ на массиве компилятор не видит — регрессия миграции на кортежи,
    // найдена сверкой с v1 2026-09-17: `tbl` терял `.tbl>*{display:table-cell}`).
    for (;i < l; i++) {
      push(
        path, MN_ESSENCE_CHILDS_KEY, essencePath[i],
      );
    }
    // Статика ищется через домен, как и хендлер (D-063); `box@sm` — переопределение медиа,
    // его находят по полному имени из `initEssence`, отдельной записи домена ему не нужно.
    essenceName.indexOf('@') > -1 || setDomainEntry(essenceName, staticEntry(essenceName));
    baseSetEssenseBase(
      essenceName, path, extendedEssence,
    );
    // for important
    baseSetEssenseBase(
      path[0] = essenceName + '-i', path,
      extend(extend({}, extendedEssence), {
        important: 1,
      }),
    );
  }

  /**
   * Компилятор атрибута. `settings` — настройки разбора его классов (файл или пакет со своей
   * декларацией, D-045 этап 3, D-081): у каждого набора свой компилятор и свой кеш. Без них —
   * настройки экземпляра.
   *
   * @example
   * mn.getCompiler('class', { notationMode: 'tw4-compatible', groupMode: 'css' })('hover:cF00');
   */
  function getCompiler(attrName: string, settings?: MnParseSettings): MnCompiler {
    const settingsKey = parseSettingsKey(settings);
    const key = settingsKey ? attrName + ' ' + settingsKey : attrName;
    settingsKey && ($$compilerModes[key] = [
      attrName,
      settings as MnParseSettings,
    ]);
    return $$compilers[key]
      || ($$compilers[key] = __compileProvider(attrName));
  }

  /**
   * Записывает готовый CSS-текст под ключом в `$$stylesMap` и помечает `$$updated`.
   * Используется как для внутренних источников (`'css'`, `MN_KEYFRAMES_TOKEN`),
   * так и для произвольного пользовательского CSS через {@link MnInstance.setStyle}.
   *
   * @param name — уникальный ключ записи в `$$stylesMap` (не CSS-селектор)
   * @param content — готовый CSS-текст
   * @param priority — порядок сортировки при финальной сборке (`priotitySort`)
   * @returns сам `mn` (чейнинг)
   */
  function setStyle(
    name: string, content: string, priority: number,
  ): any {
    $$stylesMap[name] = {
      name,
      priority: priority || 0,
      content: content || '',
      revision: ++$$revision,
    };
    $$updated = 1;
    return mn;
  }


  (selectorsCompileProvider as any)(mn);
  const parseComboNameProvider = (mn as any).parseComboNameProvider;
  const parseSelectors: (source: string) => Record<string, string> = (mn as any).parseSelector;
  const __parseComboName: any = withCatchParseComboNameDecorate((mn as any).parseComboName);

  /** Кэширующая обёртка над `parseComboNameProvider(attrName)` — сама обёртка (try/catch) не пересоздаётся на каждый вызов {@link updateAttrByMap}/{@link updateAttrByValues}, а живёт всё время жизни инстанса, как {@link getCompiler}. */
  function getParseComboName(attrName: string): ParseComboNameFn {
    // Ключ компилятора с настройками — `'class tw4-compatible,css,'` (см. getCompiler).
    const meta = $$compilerModes[attrName];
    return $$parseComboNameCache[attrName]
      || ($$parseComboNameCache[attrName] = withCatchParseComboNameDecorate(meta
        ? parseComboNameProvider(meta[0], meta[1])
        : parseComboNameProvider(attrName)));
  }

  /**
   * Пересчитывает CSS-правила для набора комбо-имён одного атрибута, переданных
   * КАРТОЙ `{ comboName: 1 }` (например снимок `MnCompiler.cache` — полный набор
   * текущих значений атрибута на странице).
   *
   * @param comboNamesMap — карта комбо-имён атрибута `attrName`
   * @param attrName — имя атрибута (`'class'`, `'id'` и т.д.)
   */
  const updateAttrByMap = mn.updateAttrByMap = (comboNamesMap: Record<string, number>, attrName: string): any => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseComboName: any = getParseComboName(attrName);
    let comboName: string;
    for (comboName in comboNamesMap) forEach( // eslint-disable-line
      parseComboName(comboName), updateSelectorIteratee);
    return mn;
  };
  /**
   * То же, что {@link updateAttrByMap}, но для СПИСКА новых комбо-имён
   * (например `MnCompiler.getNext` — только что появившиеся значения атрибута).
   *
   * @param comboNames — массив комбо-имён атрибута `attrName`
   * @param attrName — имя атрибута
   */
  const updateAttrByValues = mn.updateAttrByValues = (comboNames: string[], attrName: string): any => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseComboName: any = getParseComboName(attrName);
    forEach(comboNames, (comboName: string) => {
      forEach(parseComboName(comboName), updateSelectorIteratee);
    });
    return mn;
  };

  /**
   * Полная пересборка CSS с нуля по явно переданному снимку атрибутов —
   * `{ attrName: { comboName: 1 } }` (в отличие от {@link MnInstance.compile},
   * не читает состояние компиляторов из `getCompiler`).
   *
   * @param attrsMap — снимок `{ attrName: comboNamesMap }` по всем нужным атрибутам
   */
  mn.recompileFrom = (attrsMap: Record<string, Record<string, number>>): any => {
    __clear();
    forIn(attrsMap, updateAttrByMap);
    forIn($$root, generate);
    keyframesRender();
    styleRender();
    return mn;
  };

  /**
   * Возвращает компилятор для указанного атрибута.
   *
   * Компилятор собирает токены из DOM-атрибутов (например `class="w50 cF00"`).
   *
   * @param attrName — имя атрибута (`'class'`, `'id'`, `'m-n'` и др.)
   * @returns компилятор с методами `clear`, `getNext`, `checkNode`, `recursiveCheck`
   */
  mn.getCompiler = getCompiler;
  /**
   * Рекурсивно обходит поддерево DOM от `node` и проверяет узлы по каждому из `attrs`
   * (см. `MnCompiler.recursiveCheck`) — используется для первичного скана/после
   * массовых DOM-изменений (SSR-гидрация, вставка большого фрагмента).
   *
   * @param node — корневой DOM-узел обхода
   * @param attrs — имя атрибута или список имён (`'class'`, `['class', 'id']`)
   */
  mn.recursiveCheckByAttrs = (node: any, attrs: string | string[]): any => {
    eachApply((isString(attrs) ? [attrs] : attrs).map((attr: string) => getCompiler(attr))
      .map(x => x.recursiveCheck), [node]);
    return mn;
  };
  /**
   * Проверяет ОДИН узел (без рекурсии в потомков) по каждому из `attrs` —
   * дешевле {@link MnInstance.recursiveCheckByAttrs} для точечных обновлений
   * (например реакция на мутацию одного элемента).
   *
   * @param node — DOM-узел для проверки
   * @param attrs — имя атрибута или список имён
   */
  mn.checkOneNodeByAttrs = (node: any, attrs: string | string[]): any => {
    eachApply((isString(attrs) ? [attrs] : attrs).map((attr: string) => getCompiler(attr))
      .map(x => x.checkNode), [node]);
    return mn;
  };
  /**
   * Прогоняет ГОТОВОЕ значение атрибута (не DOM-узел) через компилятор(ы) —
   * когда значение известно без чтения DOM (SSR, ручная генерация классов).
   *
   * @param v — значение атрибута (например `'w50 cF00'`)
   * @param attrs — имя атрибута или список имён, каждому передаётся то же `v`
   */
  mn.checkByAttrs = (v: string, attrs: string | string[]): any => {
    isString(attrs)
      ? getCompiler(attrs)(v)
      : eachApply(attrs.map((attr: string) => getCompiler(attr)), [v]);
    return mn;
  };
  /**
   * Добавляет произвольный именованный CSS-блок в стили экземпляра
   * (обёртка над {@link setStyle} с префиксом `'custom.'` и дефолтным приоритетом).
   *
   * @param name — уникальное имя блока (ключ, не селектор)
   * @param content — готовый CSS-текст
   * @param priority — порядок сортировки (default `MN_DEFAULT_OTHER_CSS_PRIORITY`)
   * @returns сам `mn` (чейнинг)
   *
   * @example
   * mn.setStyle('reset', '*{box-sizing:border-box}');
   */
  mn.setStyle = (
    name: string, content: string, priority?: number,
  ) => setStyle(
    'custom.' + name, content, priority || MN_DEFAULT_OTHER_CSS_PRIORITY,
  );

  mn.options = extend({}, options) as MnOptions;
  const $$data = mn.data = {} as MnData;
  const $$compilers: Record<string, MnCompiler> = $$data.compilers = {};
  /** Ключ компилятора с режимом → `[атрибут, режим]` (D-045 этап 3). */
  const $$compilerModes: Record<string, [string, MnParseSettings]> = {};
  const $$parseComboNameCache: Record<string, ParseComboNameFn> = {};
  const cssPropertiesStringify: IStringifyCss = mn.propertiesStringify
    = cssPropertiesStringifyProvider();
  const emit = (mn.styles$ = observableProvider<MnStyleEntry[]>([])).emit;
  const error$ = mn.error$ = observableProvider<Error | undefined>(undefined);
  const emitError = error$.emit;
  let $$onError = noop as (e: Error) => void;
  const warnings$ = mn.warnings$ = observableProvider<MnWarning[]>([]);
  const emitWarnings = warnings$.emit;
  let $$logWarning: (warning: MnWarning) => void = logWarning;
  let $$onWarning: (warning: MnWarning) => void = noop;
  let $$warnings: MnWarning[] = [];
  let $$warningTokens: Record<string, number> = {};
  let $$updated: number;
  let $$essences: Record<string, MnEssenceResult>;
  let $$root: Record<string, Record<string, MnContextEssence>>;
  let $$statics: MnStatics;
  let $$staticsAssigned: Record<string, Record<string, Record<string, number>>>;
  let $$staticsEssences: Record<string, MnEssenceResult>;
  /**
   * Медиа-контексты, объявленные СТАТИКОЙ: `base` → набор медиа-имён.
   *
   * Нужен потому, что `mn('box@sm', {...})` кладёт эссенцию под плоским ключом
   * `box@sm`, а рендер обходит `essence[MN_ESSENCE_MEDIA]` самого `box`. Если у
   * хендлера своего `media`-блока для `sm` нет, обходить нечего — и статика
   * молча не применялась вообще. Индекс позволяет завести недостающего
   * медиа-ребёнка пустым, чтобы статике было куда влиться.
   */
  let $$staticsMedias: Record<string, Record<string, number>> = {};
  let $$keyframes: [Record<string, string>, number];
  let $$stylesMap: Record<string, MnStyleEntry> = $$data.stylesMap = {};
  let $$assigned: Record<string, Record<string, Record<string, number>>> = $$data.assigned = {};
  let $$media: Record<string, MnMediaEntry> = mn.media = settings.media || {};
  // Медиа из опции `media` (D-092): пресет их не перезаписывает — опция меняет его значения по умолчанию.
  const $$ownMedia: Record<string, MnMediaEntry> = {
    ...settings.media,
  };
  // Шкала контейнеров (D-086): пресеты заполняют, контейнерные варианты `@md:` берут ширину отсюда.
  mn.containers = {};
  // Домены имён (D-063): первые строчные буквы → записи `[префикс, функция]`.
  let $$domains: Record<string, MnDomainEntry[]> = mn.domains = {};
  let $$force: number;
  let $$altColor: boolean;
  let $$failOnWarnings: boolean;
  let $$raiseModes: Record<RaiseType, MnRaiseMode>;
  /** `mediaNesting` (D-070): вложенные `@media` вместо `and`. */
  let $$mediaNesting = false;
  /** `mediaSyntax: 'classic'` (D-087): условия через `min-`/`max-` вместо формы диапазона. */
  let $$mediaClassic = false;
  /** Уже учтённые `*N`/`-i` (ключ — тип и токен): одно сообщение на токен. */
  let $$raisedTokens: Record<string, number> = {};
  /** Запрещённые в режиме `'strict'` токены текущего состояния (D-039). */
  let $$forbidden: MnWarning[] = [];
  let $$revision = 0;

  error$.on((error: Error | undefined) => {
    // `undefined` в типе канала — начальное значение; `on` его не доставляет
    // (подписка срабатывает только на `emit`), а `emit` зовётся лишь из
    // `emitError`, который всегда даёт `Error`.
    $$onError(error as Error);
  });
  // Позволяет selectorsCompileProvider (отдельный модуль, свой замкнутый scope)
  // сообщать о превышении maxDepth в режиме 'warn' — по тому же соглашению,
  // что и уже существующие internal-геттеры (mn.states/mn._synonyms).
  (mn as any)._collectWarning = collectWarning;
  // Там же разбирается `*N` и видны эссенции `-i` (D-039).
  (mn as any)._raisedToken = raisedToken;

  function withCatchParseComboNameDecorate(parseComboNameFn: (...args: any[]) => any): (...args: any[]) => any {
    return function (this: unknown) {
      try {
        // `arguments` вместо rest — §6.1: это горячий путь, и rest-массив
        // аллоцировался бы на каждый разбор. Приведение нужно только для
        // `apply`, которому при строгом режиме нужен массив.
        // eslint-disable-next-line
        return parseComboNameFn.apply(this, arguments as unknown as any[]);
      } catch (ex) {
        if (ex instanceof MnParseError) {
          // Запрещённый токен уже учтён для MnForbiddenTokenError (D-039).
          ex.context.forbidden || collectWarning({
            type: ex.context.warningType || 'parse-error',
            token: ex.context.token,
            handler: ex.context.handler,
            arg: ex.context.arg,
            utility: ex.context.utility,
            message: ex.message,
            error: ex,
          });
        } else {
          emitError(asError(ex));
        }
      }
      return [];
    };
  }

  function selectorsValidateFilter<T>(selectorsMap: Record<string, T>): Record<string, T> {
    let selector: string;
    const output: Record<string, T> = {};
    for (selector in selectorsMap) { // eslint-disable-line
      isInvalidSelector(selector)
        ? emitError(new Error('Invalid selector: "' + selector + '"'))
        : (output[selector] = selectorsMap[selector]);
    }
    return output;
  }

  /**
   * Разбирает `@`-медиа-выражение в список готовых медиа-записей.
   *
   * Грамматика (полностью):
   * `media-expr ::= media-atom ('&' media-atom)* (',' media-expr)?` — `&` объединяет
   * атомы через AND в одном `@media (...)`, `,` заводит отдельную альтернативную запись.
   * Каждый атом — либо зарегистрированное имя медиа (`$$media`, добавляется через
   * `options.media`/`mn.media`), либо диапазон `ширина/высота:контейнер` ({@link mediaRangeQuery})
   * с опциональным `^приоритет`.
   *
   * @param mediaExpression — например `'m&dark,tablet'`
   * @returns массив кортежей `[имя, приоритет, query, доп.селектор]`; `[[]]` — пустое выражение
   */
  function parseMediaExpression(mediaExpression: string): Array<[string, number | undefined, string, string] | []> {
    if (!mediaExpression) {
      return [[]];
    }

    let mediaPriority: number | undefined;
    let priority: number | undefined;
    let selector: string | undefined;
    let query: string | undefined;
    let partsAnd: string[];
    let iAnd: number;
    let lAnd: number;
    let fragment: string;
    let outputQuery: string[];
    let outputSelector: string[];
    let outputRules: string[];
    let priorityMatch: RegExpExecArray | null;
    let name: string;
    let media: MnMediaEntry | undefined;
    let point: [string, number | undefined, string] | undefined;
    const medias: Array<[string, number | undefined, string, string] | []> = [];
    const names: string[] = [];
    const queries: string[] = [];

    // get media priority
    if (priorityMatch = REGEXP_MEDIA_PRIORITY.exec(mediaExpression)) {
      mediaExpression = priorityMatch[1];
      mediaPriority = parseInt(priorityMatch[2]);
      // `@^5` — приоритет без медиа: правило без условия, но своим блоком с этим приоритетом.
      if (!mediaExpression) {
        return [
          [
            priorityMatch[0],
            mediaPriority,
            '',
            '',
          ],
        ];
      }
    }

    // eslint-disable-next-line
    let partsOr = SPLIT_SELECTOR(mediaExpression), iOr = 0, lOr = partsOr.length;
    for (;iOr < lOr; iOr++) {
      partsAnd = SPLIT_AMP(name = partsOr[iOr]);
      lAnd = partsAnd.length;
      iAnd = 0;
      outputQuery = [];
      outputSelector = [];
      outputRules = [];
      priority = mediaPriority;
      for (;iAnd < lAnd; iAnd++) {
        (fragment = partsAnd[iAnd]) && (
          (point = mediaRangeQuery(fragment)) ? (
            point[2] ? push(outputRules, point[2]) : push(outputQuery, point[0]),
            isDefined(priority) || (priority = point[1])
          ) : (media = $$media[fragment]) ? (
            (query = media.query) && push(outputQuery, query),
            (selector = media.selector) && push(outputSelector, selector),
            // `@supports`/`@container` (D-057) — вложенными правилами вокруг `@media`.
            (query = media.supports) && push(outputRules, '@supports ' + query),
            (query = media.container) && push(outputRules, '@container ' + query),
            isDefined(priority) || (priority = media.priority)
          ) : push(outputQuery, unknownMedia(fragment))
        );
      }
      // Ошибка в медиа (D-088): ни это правило, ни его вариант с этим условием в CSS не попадают.
      if (outputQuery.indexOf(MEDIA_NEVER) > -1) {
        continue;
      }

      // Одинаковые условия — один раз: `p10:h@mouse` → `(pointer: fine) and (hover: hover)`, а не
      // `… and (hover: hover) and (hover: hover)` (`mouse` уже содержит условие `:h`, D-069).
      // `mediaNesting` (D-070): условия разных записей — вложенными `@media`, как у Tailwind 4,
      // а не через `and`; условия одной записи (`mouse`) остаются вместе.
      $$mediaNesting && outputQuery.length > 1
        ? (outputRules = nestedMedia(outputQuery).concat(outputRules), query = '')
        : query = JOIN_AND(uniqueConditions(outputQuery));
      // Запись с at-правилами — отдельная: `@supports` и `@media` через запятую не объединить.
      outputRules.length && (query = (query ? '@media ' + query + '{' : '') + outputRules.join('{'));
      (selector = joinOnly(outputSelector)) || outputRules.length
        ? push(medias, [
          name,
          priority,
          query,
          selector,
        ])
        : query && (
          push(names, name),
          push(queries, query)
        );
    }

    (query = joinComma(queries))
      && push(medias, [
        joinComma(names),
        priority,
        query,
        '',
      ]);
    return medias;
  }

  /**
   * Диапазон медиа в записи minotation (D-054, D-087, D-088): `ширина[/высота][:контейнер]`. Граница —
   * точка медиа или число с единицей (`480`, `10rem`; без единицы — px): `@a` — до `a`, `@a-` — от `a`,
   * `@a-b` — от `a` до `b`. Точка в первом слоте даёт свою сторону (ширину, а без неё — высоту), в слоте
   * высоты — свою высоту. Число «до» включительно (`<=`), точка — нет (`<`). `:имя` — запрос к контейнеру
   * (`@:side` — только по имени), всегда в форме диапазона.
   *
   * @returns `[условие, приоритет, at-правило контейнера]`; `undefined` — не диапазон (обычное имя медиа);
   *   ошибка — сообщение и условие {@link MEDIA_NEVER}
   */
  function mediaRangeQuery(fragment: string): [string, number | undefined, string] | undefined {
    const entry = $$media[fragment];
    // Описанное имя без точки — обычное медиа, даже с `:` и `/` в имени (готовые запросы режимов Tailwind и
    // Master CSS регистрируются под своим текстом: `(prefers-color-scheme: dark)`).
    if (entry && !isDefined(entry.width) && !isDefined(entry.height)) {
      return undefined;
    }
    const colon = fragment.indexOf(':');
    const noColon = colon < 0;
    const body = noColon ? fragment : fragment.slice(0, colon);
    const container = noColon ? '' : fragment.slice(colon + 1);
    const slash = body.indexOf('/');
    const noSlash = slash < 0;
    const explicit = !noColon || !noSlash;
    const classic = $$mediaClassic && noColon;
    const conditions: string[] = [];
    const width = noSlash ? body : body.slice(0, slash);
    const height = noSlash ? '' : body.slice(slash + 1);
    const first = width ? rangeOf(
      width, '', fragment, classic, conditions,
    ) : [undefined];
    const second = height ? rangeOf(
      height, 'height', fragment, classic, conditions,
    ) : [undefined];
    const firstSingle = first.length < 2;
    if (!explicit && firstSingle) {
      // Не диапазон: имя медиа — дальше; записано цифрами — битый шаблон.
      return first[0] === 0 ? [
        MEDIA_NEVER,
        0,
        '',
      ] : REGEXP_MEDIA_NUMERIC_START.test(body) ? mediaRangeProblem(fragment) : undefined;
    }
    if (first[0] === 0 || second[0] === 0) {
      return [
        MEDIA_NEVER,
        0,
        '',
      ];
    }
    if (width && firstSingle || height && second.length < 2 || explicit && !width && !height && !container) {
      return mediaRangeProblem(fragment);
    }
    if (!noColon && !REGEXP_CONTAINER_NAME.test(container)) {
      mediaProblem(fragment, 'names the container "' + container + '", which is not a CSS identifier. The class gives'
        + ' no CSS.');
      return [
        MEDIA_NEVER,
        0,
        '',
      ];
    }
    return [
      container ? '' : conditions.join(' and '),
      first.length > 1 ? first[1] : second[1],
      container ? '@container ' + container + (conditions.length ? ' ' + conditions.join(' and ') : '') : '',
    ];
  }

  /**
   * Слот диапазона → условия в `conditions`. `side` — `''` для первого слота (сторона точки) или `height`.
   *
   * @returns `[undefined]` — не диапазон, `[0]` — ошибка (сообщение выдано), `[1, приоритет]` — готово
   */
  function rangeOf(
    part: string, side: string, fragment: string, classic: boolean, conditions: string[],
  ): [undefined] | [0] | [1, number | undefined] {
    const whole = $$media[part] ? part : '';
    const dash = whole ? -1 : part.indexOf('-');
    const noDash = dash < 0;
    const lowerText = noDash ? '' : part.slice(0, dash);
    const upperText = noDash ? part : part.slice(dash + 1);
    const lower = lowerText ? boundOf(
      lowerText, side, fragment,
    ) : undefined;
    const upper = upperText ? boundOf(
      upperText, side, fragment,
    ) : undefined;
    if (lower === 0 || upper === 0) {
      return [0];
    }
    if (dash === 0 || lowerText && !lower || upperText && !upper) {
      return [undefined];
    }
    if (lower && upper && lower[0] !== upper[0]) {
      mediaProblem(fragment, 'mixes width and height. The class gives no CSS.');
      return [0];
    }
    lower && conditions.push(mediaCondition(
      lower[0], '>=', lower[1], classic,
    ));
    upper && conditions.push(mediaCondition(
      upper[0], upper[3] ? '<' : '<=', upper[1], classic,
    ));
    // Порядок правил: «до» — по верхней границе (меньшие ниже и важнее), «от» точки — по нижней.
    return [
      1,
      upper ? -upper[2] : (lower as MediaBound)[3] ? (lower as MediaBound)[2] : undefined,
    ];
  }

  /**
   * Граница: `[сторона, CSS-длина, px для порядка, точка ли]`; `undefined` — не граница, `0` — ошибка
   * (сообщение выдано): у точки нет нужной стороны или описание точки битое.
   */
  function boundOf(
    part: string, side: string, fragment: string,
  ): MediaBound | 0 | undefined {
    const entry = $$media[part];
    const matchs = REGEXP_MEDIA_BOUND.exec(part);
    let value: number | string | undefined;
    let length: [string, number, boolean] | undefined;
    if (entry) {
      if (!pointOf(entry, fragment)) {
        return undefined;
      }
      value = side ? (entry as Record<string, number | string | undefined>)[side]
        : isDefined(entry.width) ? entry.width : entry.height;
      if (!isDefined(value)) {
        mediaProblem(fragment, 'uses the point "' + part + '" for the height, but it has no "height". The class gives'
          + ' no CSS.');
        return 0;
      }
      length = pointLength(value as number | string) as [string, number, boolean];
      return [
        side || (isDefined(entry.width) ? 'width' : 'height'),
        length[0],
        length[1],
        1,
      ];
    }
    return matchs ? [
      side || 'width',
      matchs[1] + (matchs[2] || 'px'),
      matchs[2] && matchs[2] !== 'px' ? parseFloat(matchs[1]) * 16 : parseFloat(matchs[1]),
      0,
    ] : undefined;
  }

  /** Битый диапазон: сообщение с допустимыми формами и условие, которое никогда не выполняется. */
  function mediaRangeProblem(fragment: string): [string, number, string] {
    mediaProblem(fragment, 'is malformed. Allowed: "@760" (up to), "@760-" (from), "@360-1024" (range),'
      + ' "@10rem-30rem" (units), "@m4-d" (points), "@360-1024/100-200" (width / height), "@360-:side" and'
      + ' "@:side" (container "side"). The class gives no CSS.');
    return [
      MEDIA_NEVER,
      0,
      '',
    ];
  }

  /**
   * Есть ли у описания точка; `query` вместе с точкой — предупреждение, берётся `query`.
   * Точка — число (px) или строка с единицей (`'48rem'`, D-069); иное — предупреждение.
   */
  function pointOf(entry: MnMediaEntry, fragment: string): boolean {
    const value = isDefined(entry.width) ? entry.width : entry.height;
    const has = isDefined(value);
    if (has && entry.query) {
      mediaProblem(fragment, 'has both "query" and "width"/"height" — "query" is used');
      return false;
    }
    if (has && !pointLength(value as number | string)) {
      mediaProblem(fragment, 'has an invalid point ' + JSON.stringify(value) + ': expected a number (px)'
        + ' or a string with px, rem or em');
      return false;
    }
    return has;
  }

  /**
   * Длина точки: `[CSS, px для порядка правил, в px ли]`. Число — px; строка — с единицей
   * (`'48rem'` → 768 px для порядка: rem и em считаются от 16px).
   */
  function pointLength(value: number | string): [string, number, boolean] | undefined {
    const numeric = typeof value === 'number';
    const matchs = numeric ? null : REGEXP_POINT_LENGTH.exec(value);
    const amount = matchs ? parseFloat(matchs[1]) : value as number;
    const px = !!matchs && matchs[2] === 'px';
    return numeric ? [
      value + 'px',
      value,
      true,
    ] : matchs ? [
      value,
      px ? amount : amount * 16,
      px,
    ] : undefined;
  }

  /**
   * Медиа разбирается при выводе CSS, вне перехвата ошибок разбора токена: бросок уронил бы
   * компиляцию. Поэтому — предупреждение и условие {@link MEDIA_NEVER}: правило в CSS не попадает.
   */
  function mediaProblem(fragment: string, problem: string): [string, number] {
    collectWarning({
      type: 'parse-error',
      token: '@' + fragment,
      handler: '',
      arg: fragment,
      utility: 'parseMediaExpression',
      message: 'Media "@' + fragment + '" ' + problem,
    });
    return [
      MEDIA_NEVER,
      0,
    ];
  }

  /**
   * Имя не из `mn.media`, не точка и не числовой шаблон (D-058): тип медиа CSS (`print`,
   * `screen`, `all`) — как есть; иначе — по `unknownMediaMode`: `'warn'`/`'silent'` — как
   * написано, `'strict'` — правило в CSS не попадает (и брак сборки).
   */
  function unknownMedia(fragment: string): string {
    return CSS_MEDIA_TYPES[fragment] || !raisedToken(
      '@' + fragment, 'unknown-media', (strict: boolean) => unknownMediaMessage(fragment, strict),
    ) ? fragment : MEDIA_NEVER;
  }

  /** Публичный доступ к {@link parseMediaExpression} — разбор `@`-медиа-выражения без побочных эффектов. */
  mn.parseMediaExpression = parseMediaExpression;

  /** Хелпер {@link generate} — вынесен из тела цикла по essence, чтобы не создавать замыкание на каждую essence, только на каждый media-контекст. */
  function mapEssenceSelectors(map: Record<string, Record<string, number>>, selectorsIteratee: (selectors: string[]) => string): string[] {
    const sels = getEessenceSelectors(map);
    // §6.3: длина читалась на каждой итерации; §6.2: счётчик — до цикла.
    const l = sels.length;
    const result: string[] = new Array(l);
    let si = 0;
    for (; si < l; si++) {
      result[si] = selectorsIteratee(sels[si]);
    }
    return result;
  }

  /** Хелпер {@link generate} — вынесен из инлайн-IIFE, собирает контент всех essence по имени медиа-контекста. */
  function mapContentByMediaName(sortedContext: MnContextEssence[], mediaName: string): string[] {
    const l = sortedContext.length;
    const result: string[] = new Array(l);
    let si = 0;
    for (; si < l; si++) {
      result[si] = sortedContext[si][MN_CONTEXT_ESSENCE_CONTENT][mediaName];
    }
    return result;
  }

  function generate(context: Record<string, MnContextEssence>, mediaExpression: string): void {
    const medias = parseMediaExpression(mediaExpression);
    const lMedia = medias.length;
    const updated: Record<string, number> = {};
    let iMedia = 0;
    let media: [string, number | undefined, string, string] | [];
    let mediaPriority: number | undefined;
    let mediaQuery: string;
    let essenceName: string;
    let contextEssence: MnContextEssence | undefined;
    let cssText: string;
    let output: string;
    let selectorPrefixes: string[] | 0;
    let selectorsIteratee: (selectors: string[]) => string;
    let isContinue: number;
    let mediaName: string;
    let mediaSelector: string;

    for (; iMedia < lMedia; iMedia++) {
      isContinue = 1;
      // Пустой кортеж `parseMediaExpression` отдаёт только на пустое
      // выражение, а сюда приходят ключи `$$root` — имена медиа-контекстов,
      // и пустых среди них нет: `updateEssence` подставляет `'all'`
      // (`mediaName = mediaName || 'all'`). Приведение фиксирует это, не
      // заводя ветку, которую нельзя было бы покрыть тестом.
      media = medias[iMedia] as [string, number | undefined, string, string];
      [
        mediaName,
        mediaPriority,
        mediaQuery,
        mediaSelector,
      ] = media;

      // Селектор медиа-контекста (`@dark` → `.dark `) — предок всех правил этого контекста.
      selectorPrefixes = mediaSelector ? [mediaSelector] : 0;

      // Два замыкания на итерацию — аллокация в цикле, и §18.1 велит такие
      // места проверять. Здесь она оправдана: ветвление по `selectorPrefixes`
      // делается ОДИН раз на медиа-контекст, а сам iteratee зовётся на каждую
      // эссенцию внутреннего цикла. Слить их в одно замыкание с проверкой
      // внутри — значит перенести ветвление в горячий путь. Итераций внешнего
      // цикла столько же, сколько медиа-выражений (единицы).
      selectorsIteratee = selectorPrefixes
        ? ((selectors: string[]) => (
          joinComma(joinArrays(
            selectorPrefixes as string[], selectors, ' ',
          )) + cssText
        ))
        : ((selectors: string[]) => joinComma(selectors) + cssText);

      for (essenceName in context) { // eslint-disable-line
        (contextEssence = context[essenceName])
          && contextEssence[MN_CONTEXT_ESSENCE_UPDATED]
          && (
            isContinue = 0,
            updated[essenceName] = 1,
            cssText = contextEssence[MN_CONTEXT_ESSENCE_CSS_TEXT],
            contextEssence[MN_CONTEXT_ESSENCE_CONTENT][mediaName] = cssText
              ? joinOnly(mapEssenceSelectors(contextEssence[MN_CONTEXT_ESSENCE_MAP], selectorsIteratee))
              : ''
          );
      }

      isContinue || (
        output = joinOnly(mapContentByMediaName(values(context).sort(priotitySortContext), mediaName)),
        mediaQuery && mediaQuery !== 'all' && output
          && (output = mediaQuery[0] === '@'
            // Цепочка at-правил (D-057): `@media …{@supports …` — закрыть столько же скобок.
            ? mediaQuery + '{' + output + repeat('}', mediaQuery.split('{').length)
            : joinOnly([
              '@media ',
              mediaQuery,
              '{',
              output,
              '}',
            ])),
        setStyle(
          // Часть выражения `@safari,dark` (запись с селектором или at-правилом) — под ключом
          // всего выражения: иначе `.safari` из `@safari,dark` затирал стили `@safari`.
          'media.' + (mediaName === mediaExpression ? mediaName : mediaExpression + '|' + mediaName),
          output,
          isDefined(mediaPriority) ? mediaPriority : MN_DEFAULT_PRIORITY,
        )
      );
    }
    for (essenceName in updated) { // eslint-disable-line
      context[essenceName][MN_CONTEXT_ESSENCE_UPDATED] = 0;
    }
  }

  function __assignCore(
    assigned: Record<string, Record<string, Record<string, number>>>,
    comboNames: Record<string, number>,
    selectors: Record<string, number>,
    defaultMediaName?: string,
    excludes?: Record<string, number>,
    selectorMedia?: string,
  ): void {
    defaultMediaName = defaultMediaName || 'all';
    let name: string;
    let selector: string;
    let l: number;
    let i: number;
    let items: Array<[Record<string, number>, Record<string, string>]>;
    let essenceName: string;
    let item: [Record<string, number>, Record<string, string>];
    let selectorsMedias: Record<string, string>;
    let essencesNames: Record<string, number>;
    let childSelectors: Record<string, number>;
    let childSelector: string;
    let mediaName: string;
    let actx: Record<string, Record<string, number>>;

    for (name in comboNames) { // eslint-disable-line
      for (selector in selectors) { // eslint-disable-line
        for (
          items = __parseComboName(name, selector) as Array<[Record<string, number>, Record<string, string>]>,
          l = items.length, i = 0;
          i < l;
          i++
        ) {
          item = items[i];
          essencesNames = item[0];
          selectorsMedias = selectorsValidateFilter(item[1]);
          for (childSelector in selectorsMedias) { // eslint-disable-line
            // Медиа токена и медиа селектора (D-071) — вместе, через `&`; иначе — по умолчанию.
            mediaName = joinMedia(selectorsMedias[childSelector], selectorMedia) || defaultMediaName;
            childSelectors = {};
            childSelectors[childSelector] = 1;
            actx = assigned[mediaName] || (assigned[mediaName] = {});
            for (essenceName in essencesNames) { // eslint-disable-line
              // eslint-disable-next-line
              (actx[essenceName] || (actx[essenceName] = {}))[childSelector] = 1;
              updateEssence(
                essenceName, childSelectors, mediaName, excludes,
              );
            }
          }
        }
      }
    }
  }

  /**
   * Назначает селекторам комбо-имена (статические привязки).
   *
   * Используется в пресетах для связи CSS-правил с селекторами.
   *
   * @param selectors — строка селекторов или объект `{ [selector]: comboNames }`
   * @param comboNames — комбо-имена (если selectors — строка)
   *
   * @example
   * mn.assign('*, *:before, *:after', 'bxzBB');
   * mn.assign({ html: 'lh1.15', body: 'm' });
   */
  // selectors/comboNames: произвольная вложенная форма (строка/массив/объект), см. normalizeSelectors/normalizeComboNames.
  /** Селектор `mn.css` → имя его статики (`\u0004` + номер): объявления копятся в одну статику. */
  const $$cssRules: Record<string, string> = {};
  /** Имя статики `mn.css` → разобранный селектор (селектор CSS → медиа): для обновления правила. */
  const $$cssTargets: Record<string, Record<string, string>> = {};

  /**
   * Правило CSS для селектора (D-071). Селектор — элемент и контекст в записи классов
   * (`'.x(:h|.active)@d^3'`), разбор — тот же, что у `mn.assign`; значения — как есть.
   * Повторный вызов с тем же селектором дописывает объявления в то же правило.
   *
   * @example
   * mn.css(':root@^-100', { '--brand': '#f00' });
   * mn.css('.selector(:h|.active)@d', { '--some-color': '#F00' });
   */
  mn.css = (selector: string | Record<string, MnCssDeclarations>, declarations?: MnCssDeclarations): any => {
    isPlainObject(selector)
      ? forIn(selector as Record<string, MnCssDeclarations>, cssRule)
      : cssRule(declarations as MnCssDeclarations, selector as string);
    return mn;
  };

  function cssRule(declarations: MnCssDeclarations, selector: string): void {
    typeof selector === 'string' && selector.trim()
      || fail('mn.css: the selector expects a non-empty string, got ' + describeValue(selector));
    isPlainObject(declarations) && values(declarations).every(isCssValue)
      || fail('mn.css: declarations of "' + selector + '" expect an object of strings or numbers, got '
        + describeValue(declarations));
    const known = $$cssRules[selector];
    const name = known || ($$cssRules[selector] = MN_CSS_RULE + keys($$cssRules).length);
    const parsed = $$cssTargets[name] || ($$cssTargets[name] = parseSelectors(selector));
    let target: string;
    let media: string;
    let actx: Record<string, Record<string, number>>;
    let selectors: Record<string, number>;
    mn(name, {
      style: declarations,
    } as never);
    // Объявления дописаны в статику; собранное по прежним — сбросить, чтобы правило пересобралось.
    if (known) {
      delete $$essences[name];
      for (target in parsed) { // eslint-disable-line
        // Контекст правила есть всегда: первый вызов `mn.css` уже привязал статику (и `recompile`
        // привязывает её заново из `$$staticsAssigned`).
        delete $$root[parsed[target] || 'all'][name];
      }
    }
    // Привязка — к разобранным селекторам напрямую: имя статики не токен, разбирать его не нужно.
    for (target in parsed) { // eslint-disable-line
      media = parsed[target] || 'all';
      actx = $$staticsAssigned[media] || ($$staticsAssigned[media] = {});
      (actx[name] || (actx[name] = {}))[target] = 1;
      selectors = {};
      selectors[target] = 1;
      updateEssence(
        name, selectors, media,
      );
    }
  }

  // selectors/comboNames: произвольная вложенная форма; `any` — как у прочих форм вызова mn.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mn.assign = (selectors: string | Record<string, any>, comboNames?: string | Record<string, any>): any => {
    // comboNames: произвольная вложенная форма, см. normalizeComboNames.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function iteratee(comboNames: string | string[] | Record<string, any>, s: string | string[]): void {
      // Селектор — элемент и контекст в записи классов (D-071): состояния, группы, медиа, `^N`.
      const byMedia: Record<string, Record<string, number>> = {};
      const parsed = parseSelectors(isArray(s) ? (s as string[]).join(',') : s as string);
      let selector: string;
      let media: string;
      for (selector in parsed) { // eslint-disable-line
        (byMedia[parsed[selector]] || (byMedia[parsed[selector]] = {}))[selector] = 1;
      }
      for (media in byMedia) { // eslint-disable-line
        __assignCore(
          $$staticsAssigned,
          normalizeComboNames(comboNames),
          byMedia[media],
          undefined,
          undefined,
          media,
        );
      }
    }
    isPlainObject(selectors)
      ? forIn(selectors, iteratee)
      // Вторая форма вызова: `mn.assign(selectors, comboNames)`. Сюда
      // попадаем только когда `selectors` — строка (объект ушёл в ветку
      // выше), а `comboNames` задан: без него вызов бессмыслен.
      : iteratee(comboNames as string, selectors as string);
    return mn;
  };

  /**
   * Разбирает токен, вызывает хендлер пресета и СРАЗУ нормализует результат
   * (`__normalize`) — наружу (обоим вызывающим в {@link initEssence}) никогда
   * не попадает "сырой" `MnEssenceRaw` от автора пресета, только уже готовый
   * кортеж `MnEssenceResult`. Автор пресета по-прежнему пишет обычный объект
   * (`{ style: {...} }`) — удобство холодного пути не меняется; движок
   * перестраивает его во внутреннее представление ровно в точке появления,
   * не давая "сырой" форме просочиться дальше по компиляционному пайплайну.
   */
  /** Хендлер не дал стиля — см. D-021. Ловится `catch` ниже как `parse-error`. */
  function throwNoStyle(value: string, name: string): never {
    throw new MnParseError('"' + value + '" produced no CSS: handler "' + name
      + '" needs a value here', {
      token: value,
      handler: name,
      arg: '',
    });
  }

  /**
   * Сырая декларация `свойство:значение` (D-055): без хендлера, `!important` — суффиксом `-i`.
   * Свойство — как написано (`--brand` тоже); пустое значение — брак.
   */
  function __rawProperty(value: string): ReturnType<typeof __normalize> {
    const important = value.slice(-2) === '-i';
    const body = important ? value.slice(0, -2) : value;
    const at = body.indexOf(':');
    const property = body.slice(0, at).trim();
    const style: Record<string, string> = {};
    REGEXP_RAW_PROPERTY.test(property) && body.slice(at + 1).trim() || throwRawProperty(body);
    style[property] = body.slice(at + 1).trim() + (important ? '!important' : '');
    return __normalize({
      style,
    });
  }

  /**
   * Разбор класса через домены (D-063): ключ домена — первые строчные буквы имени (`min-w-4` →
   * `min`), записи домена — `[префикс остатка, функция]`, самый длинный префикс первым. Первая
   * функция, давшая результат, побеждает; статика с непустым хвостом результата не даёт —
   * поиск идёт к следующему, более короткому префиксу. Проверки «чужого» класса нет (D-065):
   * хендлер вызывается всегда и решает сам.
   */
  function __initEssence(value: string): MnEssenceResult | 0 | null | false | void {
    let matchs: RegExpExecArray | null;
    // Пустая строка, а не `undefined`: обе читаются в `catch`, куда можно
    // попасть и до их присваивания.
    let name = '';
    let suffix = '';
    let ni = '';
    let sign = '';
    let body = value;
    let pair: number;
    let entries: MnDomainEntry[] | undefined;
    let entry: MnDomainEntry;
    let prefix: string;
    let result: MnEssenceResult | 0 | null | false | void;
    let i = 0;
    let l: number;
    try {
      if (matchs = REGEXP_MATCH_VAR.exec(value)) {
        const varStyle: Record<string, string> = {};
        varStyle[matchs[1]] = spaceNormalize(matchs[2]);
        return __normalize({
          style: varStyle,
        });
      }
      // Произвольное свойство Tailwind `[mask-type:luminance]` (D-055) — сырая декларация.
      if (value[0] === MN_RAW_PROPERTY) {
        return __rawProperty(value.slice(1));
      }
      // Ведущий `-` Tailwind (`-mt-4`) разборщик режима помечает знаком; хендлер получает
      // `p.sign` и решает сам (D-064). В записи minotation `-mt-4` — не токен.
      value[0] === MN_NEGATIVE && (sign = '-', body = value.slice(1));
      // Эссенция-пара «имя\u0001значение» от разборщика режима (D-045 этап 5): имя задано явно.
      (pair = body.indexOf(MN_ESSENCE_PAIR)) < 0
        ? (matchs = REGEXP_DOMAIN.exec(body) as RegExpExecArray, name = matchs[1], suffix = matchs[2])
        : (name = body.slice(0, pair), suffix = body.slice(pair + 1));
      (matchs = REGEXP_MATCH_IMPORTANT.exec(suffix)) && (suffix = matchs[1], ni = matchs[2]);
      entries = $$domains[name];
      l = entries ? entries.length : 0;
      const rest = suffix;
      const domain = name;
      for (; i < l; i++) {
        entry = (entries as MnDomainEntry[])[i];
        prefix = entry[0];
        if (prefixMatches(rest, prefix)) {
          name = domain + prefix;
          suffix = rest.slice(prefix.length);
          result = entry[1]({
            name: name,
            suffix: suffix,
            ni: ni,
            sign: sign,
          }, value);
          if (result !== undefined) {
            return result;
          }
        }
      }
      // Ни одна запись не подошла — это не токен minotation (`container`, `btn`): молчим.
      // Исключение — пара от разборщика режима: имя свойства задано явно.
      return pair < 0 ? undefined : throwNoHandler(domain, value);
    } catch (ex) {
      // Хендлер распознал класс другой системы (D-065, D-066) — своя опция `suspectClassMode`.
      if (ex instanceof MnParseError && ex.context.warningType === 'suspect-class') {
        raisedToken(
          value, 'suspect-class', (strict: boolean) => suspectClassMessage(ex.message, strict),
        );
        return;
      }
      if (ex instanceof MnParseError) {
        // Контекст может быть пустым: `throwInvalid` в пресетах зовётся из
        // глубины разбора значения, где ни токена, ни имени хендлера не видно
        // (см. его JSDoc в `presets/standard/index.ts`). Здесь они известны —
        // дозаполняем, чтобы предупреждение указывало на конкретный токен.
        ex.context.silent || collectWarning({
          type: ex.context.warningType || 'parse-error',
          token: ex.context.token || value,
          handler: ex.context.handler || name,
          arg: ex.context.arg || suffix,
          utility: ex.context.utility,
          message: ex.message,
          error: ex,
        });
        return;
      }
      emitError(new Error('MN parsing error for essence "' + value + '": ' + asError(ex).message));
    }
  }

  /**
   * Запись домена для хендлера: разбор значения, `!important`, проверка CSS, нормализация —
   * то, что ядро делало после вызова хендлера. Возвращает готовую эссенцию или `0` (CSS нет,
   * причина уже сообщена) — но не `undefined`: хендлер свой остаток всегда принимает.
   */
  function handlerEntry(handle: ((p: MnEssenceParams) => MnEssenceRaw | void | 0) & { skip?: number }): MnDomainFn {
    return (params, value) => {
      const matchs = handle.skip ? null : REGEXP_MATCH_VALUE.exec(params.suffix);
      let essence: MnEssenceRaw | void | 0;
      matchs && (
        params.value = matchs[2],
        params.camel = matchs[3],
        params.num = matchs[4],
        params.negative = matchs[5],
        params.unit = matchs[6],
        params.other = matchs[7]
      );
      // Хендлер ничего не вернул — автор писал токен, а стиля не будет (`fx` без значения).
      // Молчать нельзя (D-021): пропажу иначе замечали бы только в браузере. Исключение —
      // минус Tailwind (`-p-4`), который хендлер не принимает: CSS нет, молча, как в Tailwind (D-064).
      if (!(essence = handle(params))) {
        return params.sign ? 0 : throwNoStyle(value, params.name);
      }
      (essence as MnEssenceRaw).important = params.ni ? 1 : 0;
      return validateEssenceStyle(
        essence as MnEssenceRaw, value, params.name,
      ) && __normalize(essence) || 0;
    };
  }

  /**
   * Запись домена для статики: эссенция из хранилища статики (`-i` — её версия с
   * `!important`). Хвост после префикса или минус Tailwind — не она: `undefined`, поиск идёт
   * к более короткому префиксу (`min-w-fullx` → `min-w`).
   */
  function staticEntry(essenceName: string): MnDomainFn {
    const important = essenceName + '-i';
    return (params) => (params.suffix || params.sign ? undefined
      : $$staticsEssences[params.ni ? important : essenceName]);
  }

  /**
   * Регистрирует запись в домене имени: заменяет запись с тем же префиксом, иначе вставляет,
   * сохраняя порядок «длинный префикс первым».
   */
  function setDomainEntry(fullName: string, fn: MnDomainFn): void {
    const matchs = REGEXP_DOMAIN.exec(fullName) as RegExpExecArray;
    const entries = $$domains[matchs[1]] || ($$domains[matchs[1]] = []);
    const prefix = matchs[2];
    const owner: string = (mn as any)._presetName || '';
    const l = entries.length;
    let i = 0;
    let entry: MnDomainEntry;
    for (; i < l; i++) {
      entry = entries[i];
      if (entry[0] === prefix) {
        // Одно имя от двух пресетов (D-067); вне пресета (код приложения) — не сравниваем.
        owner && entry[2] && entry[2] !== owner && raiseConfiguration(
          'handler-conflict', '"' + fullName + '" is registered by ' + entry[2] + ' and ' + owner
            + ' — ' + owner + ' wins', 'handlerConflictMode',
        );
        entry[1] = fn;
        entry[2] = owner;
        return;
      }
      if (entry[0].length < prefix.length) {
        break;
      }
    }
    entries.splice(
      i, 0, [
        prefix,
        fn,
        owner,
      ],
    );
  }

  /**
   * Предупреждение о настройке пресетов (D-067): при регистрации, а не при компиляции, — поэтому
   * `'strict'` бросает сразу, как неподключённый `requires`.
   */
  function raiseConfiguration(
    type: 'handler-conflict' | 'preset-conflict' | 'media-conflict', message: string, option: string,
  ): void {
    const mode = $$raiseModes[type];
    const warning: MnWarning = {
      type: type,
      token: '',
      message: message + '. To hide this warning: ' + option + ': \'silent\'.',
    };
    if (mode === 'silent' || $$raisedTokens[type + ' ' + message]) {
      return;
    }
    $$raisedTokens[type + ' ' + message] = 1;
    if (mode === 'strict') {
      type === 'preset-conflict' && fail(message + ' (' + option + ': \'strict\')');
      $$strictConflicts.push(message + ' (' + option + ': \'strict\')');
      return;
    }
    $$warnings = $$warnings.concat([warning]);
    (mn as any)._quietRaise || logWarning(warning);
    $$onWarning(warning);
    emitWarnings($$warnings);
  }

  function initEssence(
    essenceName: string, essence: MnEssenceResult, excludes: Record<string, number>,
  ): void {
    // Статика и хендлеры ищутся одним путём — через домен (D-063): статика — запись домена.
    const tmpEssence = __initEssence(essenceName);

    if (!tmpEssence) {
      return;
    }
    compileMixedEssence(
      essence, tmpEssence, excludes,
    );
    // Статика могла объявить медиа-контекст, которого у хендлера нет вовсе
    // (`mn('box', …)` без `media` + `mn('box@sm', …)`). Тогда обходить в
    // `__childsHandle` нечего, и переопределение не применялось бы — заводим
    // пустого ребёнка, чтобы статике было куда влиться.
    const staticMedias = $$staticsMedias[essenceName];
    if (staticMedias) {
      const media = essence[MN_ESSENCE_MEDIA] || (essence[MN_ESSENCE_MEDIA] = {});
      let staticMediaName: string;
      for (staticMediaName in staticMedias) { // eslint-disable-line
        media[staticMediaName] || (media[staticMediaName] = []);
      }
    }
    const important = essence[MN_ESSENCE_IMPORTANT];

    function __childsHandle(
      childs: Record<string, MnEssenceResult> | undefined, separator: string, withStatic?: number,
    ): void {
      if (!childs) {
        return;
      }
      const __prefix = essenceName + separator;
      forIn(childs, withStatic ? (_childEssence: MnEssenceResult, _childName: string) => {
        const childEssenceName = __prefix + _childName;
        const childStaticEssence = $$staticsEssences[childEssenceName];
        // Статическое переопределение для конкретного медиа-контекста
        // (`mn('box@sm', {...})`) СЛИВАЕТСЯ с собственным
        // `media`-блоком хендлера, а не затирает его. Раньше ветка
        // `childStaticEssence[MN_ESSENCE_INITED] ? childStaticEssence : …`
        // выбирала статику целиком — а `INITED` стоит у неё ВСЕГДА
        // (`baseSetEssenseBase` заводит запись с `inited: 1`), так что
        // `media`-блок хендлера терялся при любом переопределении.
        // Порядок источников — статика ПОСЛЕ: `mergeEssenceDepth` льёт их по
        // очереди в `dst`, поэтому побеждает последний, а переопределение и
        // должно побеждать.
        childs[_childName] = compileMixedEssence(
          $$essences[childEssenceName] = [],
          childStaticEssence
            ? mergeEssenceDepth([
              _childEssence,
              childStaticEssence,
            ], [])
            : _childEssence,
          excludes, important,
        );
      } : (_childEssence: MnEssenceResult, _childName: string) => {
        childs[_childName] = compileMixedEssence(
          $$essences[__prefix + _childName] = [],
          _childEssence,
          excludes, important,
        );
      });
    }
    __childsHandle(essence[MN_ESSENCE_CHILDS], '.');
    __childsHandle(
      essence[MN_ESSENCE_MEDIA], '@', 1,
    );
  }
  function compileMixedEssence(
    dst: MnEssenceResult, src: MnEssenceResult, excludes: Record<string, number>, important?: number,
  ): MnEssenceResult {
    const include = src[MN_ESSENCE_INCLUDE];
    let i = include ? include.length : 0;
    let mergingMixins: MnEssenceResult[];
    let styleObj: Record<string, string | string[]> | undefined;
    let styleText: string | undefined;
    if (include && i) {
      mergingMixins = new Array(i + 1);
      mergingMixins[i] = src;
      // eslint-disable-next-line
      for (; i--;) mergingMixins[i] = updateEssence(include[i], {}, '', excludes) as MnEssenceResult;
      mergeEssenceDepth(mergingMixins, dst);
    } else {
      mergeEssenceInto(dst, src);
    }

    dst[MN_ESSENCE_CSS_TEXT] = (styleObj = dst[MN_ESSENCE_STYLE])
      && (styleText = (cssPropertiesStringify as any)(styleObj, dst[MN_ESSENCE_IMPORTANT] || important))
      ? ('{' + styleText + '}') : '';
    dst[MN_ESSENCE_INITED] = 1;
    return dst;
  }
  function createContextEssence(
    essenceName: string, essence: MnEssenceResult, excludes: Record<string, number>,
  ): MnContextEssence {
    essence[MN_ESSENCE_INITED] || initEssence(
      essenceName, essence, excludes,
    );
    return [
      {},
      essence[MN_ESSENCE_SELECTORS] || {},
      essence[MN_ESSENCE_PRIORITY] || 0,
      essence[MN_ESSENCE_CSS_TEXT] || '',
      0,
      {},
    ];
  }
  function updateEssence(
    essenceName: string,
    selectors: Record<string, number>,
    mediaName: string,
    _excludes?: Record<string, number>,
    essence?: MnEssenceResult,
  ): MnEssenceResult | void {
    const excludes = extend({}, _excludes);
    if (excludes[essenceName]) {
      return;
    }
    // Запоминаем ДО подстановки 'all': медиа-детям нужно отличать «медиа не
    // задан» от «задан и называется all», иначе их собственный контекст
    // затирается фолбэком (см. __childsHandle ниже).
    const explicitMediaName = mediaName;
    mediaName = mediaName || 'all';
    excludes[essenceName] = 1;
    essence || (essence = $$essences[essenceName] || []);
    const context = $$root[mediaName] || ($$root[mediaName] = {});
    const contextEssence: MnContextEssence = context[essenceName] || (context[essenceName]
      = createContextEssence(
        essenceName, essence, excludes,
      ));

    isEmpty(essence) || ($$essences[essenceName] = essence);

    contextEssence[MN_CONTEXT_ESSENCE_UPDATED] = 1;
    extend(contextEssence[MN_CONTEXT_ESSENCE_MAP],
      selectors = joinEssenceSelectors(selectors, contextEssence[MN_CONTEXT_ESSENCE_SELECTORS]));
    /**
     * @param asMedia — дети из `media`-блока: имя ребёнка И ЕСТЬ его медиа-контекст.
     *   Без этого они рендерились с медиа РОДИТЕЛЯ (обычно пустым), то есть
     *   `media: { sm: {...} }` уезжал в CSS безусловным правилом — ровно та
     *   утечка. Явный медиа-суффикс токена (`box@md`) имеет
     *   приоритет: два медиа-контекста на одно правило в плоском выводе не
     *   совместить, а тот, что написан в разметке, ближе к намерению автора.
     */
    function __childsHandle(
      childs: Record<string, MnEssenceResult>, separator: string, asMedia?: number,
    ): void {
      let childName: string;
      for (childName in childs) updateEssence( // eslint-disable-line
        essenceName + separator + childName,
        selectors,
        asMedia ? (explicitMediaName || childName) : mediaName,
        excludes,
        childs[childName],
      );
    }
    const childs = essence[MN_ESSENCE_CHILDS];
    const media = essence[MN_ESSENCE_MEDIA];
    const exts = essence[MN_ESSENCE_EXTS];
    childs && __childsHandle(childs, '.');
    media && __childsHandle(
      media, '@', 1,
    );
    exts && __assignCore(
      $$assigned, exts, selectors, mediaName, excludes,
    );
    return essence;
  }
  function updateSelectorIteratee(item: [Record<string, number>, Record<string, string>]): void {
    let selector: string;
    let essenceName: string;
    let mediaName: string;
    let selectors: Record<string, number>;
    const essences = item[0];
    const selectorsMedias = selectorsValidateFilter(item[1]);
    for (selector in selectorsMedias) { // eslint-disable-line
      mediaName = selectorsMedias[selector];
      selectors = {};
      selectors[selector] = 1;
      for (essenceName in essences) { // eslint-disable-line
        updateEssence(
          essenceName, selectors, mediaName,
        );
      }
    }
  }
  // selectors: произвольная вложенная форма, см. normalizeSelectors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function baseSetSynonyms(selectors: string | Record<string, any>, name: string): void {
    const selectorsMedias: Record<string, [number, string]> = {};
    let from: string;
    let to: string;
    let mediaNames: string[];
    const normalizedSelectors = normalizeSelectors(selectors);
    for (from in normalizedSelectors) { // eslint-disable-line
      to = extractMedia(mediaNames = [], from);
      selectorsMedias[to] = [
        0,
        mediaNames[0],
      ];
    }
    // _synonyms: внутреннее expando-свойство, не часть публичного MnInstance.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((mn as any)._synonyms || ((mn as any)._synonyms = {}))[name] = selectorsMedias;
  }

  function __assignItemCompile(actx: Record<string, Record<string, number>>, mediaName: string): void {
    forIn(actx, (selectors: Record<string, number>, essenceName: string) => {
      updateEssence(
        essenceName, selectors, mediaName,
      );
    });
  }
  function __clear() {
    // mn.media/mn.domains заведены при создании инстанса (см. выше) —
    // фолбэк на пустой объект здесь не нужен
    $$media = mn.media;
    $$domains = mn.domains;
    $$essences = $$data.essences = {};
    $$root = $$data.root = {};
    $$statics = $$data.statics || ($$data.statics = {
      essences: {},
      assigned: {},
    });

    // обе половины $$statics заводятся вместе (либо из $$data.statics, либо тут же выше)
    $$staticsEssences = $$statics.essences;
    $$keyframes = $$data.keyframes || ($$data.keyframes = [
      {},
      0,
    ]);
    // Кадры переживают сброс, а их отрисованный блок уходит вместе с `$$stylesMap` — перерисовать.
    $$keyframes[1] = $$keyframes[1] || (Object.keys($$keyframes[0]).length ? 1 : 0);
    $$stylesMap = $$data.stylesMap = {};
    $$assigned = $$data.assigned = {};
    forIn($$staticsAssigned = $$statics.assigned, __assignItemCompile);
    // Отдельный mn.clearWarnings не нужен (§10-error-warnings.md, Q3) —
    // recompile/__clear уже "чистый лист" для остального состояния.
    $$warnings = [];
    $$warningTokens = {};
    $$raisedTokens = {};
    $$forbidden = [];
    emitWarnings($$warnings);
  }
  __clear();
  /**
   * Полностью сбрасывает состояние экземпляра: карту эссенций, `$$root`, кэши
   * компиляторов атрибутов (`$$compilers[*].clear`) и накопленный CSS.
   * Следующий {@link MnInstance.compile} пересоберёт всё с нуля.
   */
  mn.clear = (attrName?: string): any => {
    // eslint-disable-next-line
    for (attrName in $$compilers) $$compilers[attrName].clear();
    __clear();
    return mn;
  };

  /** Пересобирает CSS-блок `@keyframes` (`MN_KEYFRAMES_TOKEN`) из `$$keyframes[0]`, включая браузерные префиксы. Вызывается автоматически из {@link MnInstance.compile}, когда есть неприменённые изменения (`$$keyframes[1]`). */
  const keyframesRender = mn.keyframesCompile = (): any => {
    $$keyframes[1] = 0;
    const keyframesPrefix = MN_KEYFRAMES_TOKEN + ' ';
    const prefixes = cssPropertiesStringify.prefixes;
    // eslint-disable-next-line
    setStyle(MN_KEYFRAMES_TOKEN, joinOnly(reduceIn($$keyframes[0], (output: string[], v: string, k: string): string[] => {
      let prefix: string;
      for (prefix in prefixes) push( // eslint-disable-line
        output, '@' + prefix + keyframesPrefix + k + v);
      push(output, '@' + keyframesPrefix + k + v);
      return output;
    }, [],
    )), MN_DEFAULT_CSS_PRIORITY,
    );
    return mn;
  };
  /**
   * Компилирует накопленные токены в CSS-стили.
   *
   * Должен вызываться после того, как все токены собраны через `getCompiler`.
   * Результат доступен через `mn.styles$.getValue`.
   *
   * Инкрементально: по умолчанию читает только НОВЫЕ значения атрибутов
   * (`$$compilers[*].getNext`) — уже обработанные не пересчитываются
   * (§16 `coding.md`, паттерн «два буфера»). Полный пересчёт — {@link MnInstance.recompile}.
   *
   * @returns mn (чейнинг)
   */
  const __render = mn.compile = (): any => {
    let attrName: string;
    if ($$force) {
      __clear();
      // eslint-disable-next-line
      for (attrName in $$compilers) {
        updateAttrByMap($$compilers[attrName].cache, attrName);
      }
    } else {
      // eslint-disable-next-line
      for (attrName in $$compilers) {
        updateAttrByValues($$compilers[attrName].getNext(), attrName);
      }
    }
    $$keyframes[1] && keyframesRender();
    forIn($$root, generate);
    $$updated && styleRender();
    $$updated = $$force = 0;
    // Бросок ЗДЕСЬ, а не из collectWarning — там он попал бы в try/catch
    // вокруг разбора токена (__initEssence) и был бы проглочен как обычный
    // Error через $$onError (по умолчанию noop). Здесь, после того как вся
    // работа compile уже сделана, throw ничем не перехватывается и доходит
    // до вызывающего кода (сборщика) как есть.
    if ($$forbidden.length) {
      throw new MnForbiddenTokenError($$forbidden);
    }
    // `*N`/`-i` в режиме `'warn'` сборку не роняют: ими управляют свои опции (D-039).
    const failing = $$failOnWarnings && $$warnings.filter(isCompileWarning);
    if (failing && failing.length) {
      throw new MnWarningError(failing);
    }
    return mn;
  };
  /**
   * Форсирует ПОЛНЫЙ пересчёт CSS (в отличие от инкрементального {@link MnInstance.compile}) —
   * очищает состояние и заново читает ВЕСЬ кэш каждого компилятора (`$$compilers[*].cache`),
   * а не только новые значения. Нужен, например, после смены `options` (`isolateMode`,
   * `altColor`), меняющей вывод для уже обработанных токенов.
   *
   * @returns mn (чейнинг)
   */
  mn.recompile = (): any => {
    $$force = 1;
    __render();
    return mn;
  };
  /** Отложенная (debounced/batched через `withDefer`) версия {@link MnInstance.compile} — несколько синхронных вызовов схлопываются в один реальный проход компиляции. */
  const deferCompile = mn.deferCompile = withDefer(__render, mn);
  /** Отложенная версия {@link MnInstance.recompile} (полный пересчёт), см. {@link deferCompile}. */
  mn.deferRecompile = () => {
    $$force = 1;
    return deferCompile();
  };
  /**
   * Регистрирует @keyframes-анимацию.
   *
   * @param name — имя анимации
   * @param body — тело анимации (строка или объект `{ '0%': {...}, '100%': {...} }`)
   * @param ifEmpty — если `true`, не перезаписывать существующую
   */
  // body/css: произвольная вложенная форма (строка или объект CSS-свойств).
  mn.setKeyframes = (
    name: string,
    body: string | Record<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
    ifEmpty?: number,
  ): any => {
    const keyframes = $$keyframes[0];
    if (ifEmpty && keyframes[name]) {
      return mn;
    }
    if (body) {
      const output = ['{'];
      isObject(body)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? forIn(body, (css: string | Record<string, any>, k: string) => push(output, k + '{'
          + (isObject(css) ? cssPropertiesStringify(css) : css) + '}'))
        : push(output, body);
      push(output, '}');
      keyframes[name] = joinOnly(output);
    } else {
      delete keyframes[name];
    }
    $$keyframes[1] = 1;
    return mn;
  };

  /**
   * Регистрирует синонимы селекторов.
   *
   * @param synonym — имя синонима (строка) или объект `{ [name]: selectors }`
   * @param selectors — селекторы (строка или объект)
   *
   * @example
   * mn.synonyms('big', '.big');
   * mn.synonyms({ big: '.big', small: '.small' });
   */
  // synonym/selectors: произвольная вложенная форма, см. baseSetSynonyms/normalizeSelectors.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  /**
   * Метки вариантов `{имя}-{состояние}` для `'tw4-compatible'` (D-046): селектор метки и
   * отношение к элементу. Без записи имя — предок `.имя` (`group-hover:` → `.group:hover .x`);
   * с записью `peer: '.peer~'` — сосед (`peer-invalid:` → `.peer:invalid~.x`).
   *
   * @param map — имя → селектор метки, в конце — комбинатор (`~`, `+`, `>`) или без него (предок)
   * @returns mn (чейнинг)
   * @example
   * mn.variantPrefixedSynonyms({ peer: '.peer~' });
   */
  mn.variantPrefixedSynonyms = (map: Record<string, string>): any => {
    checkOptions(
      {
        map,
      }, {
        map: isObjectOption,
      }, 'mn.variantPrefixedSynonyms',
    );
    let name: string;
    for (name in map) { // eslint-disable-line
      typeof map[name] === 'string' && map[name]
        || fail('mn.variantPrefixedSynonyms: "' + name + '" expects a selector string, got ' + describeValue(map[name]));
    }
    extend((mn as any)._variantPrefixedSynonyms || ((mn as any)._variantPrefixedSynonyms = {}), map);
    return mn;
  };
  mn.synonyms = (synonym: string | Record<string, any>, selectors?: string | Record<string, any>): any => {
    isObject(synonym)
      ? forIn(synonym, baseSetSynonyms)
      // Та же пара форм: объект-карта либо «имя + селекторы». Во второй
      // `synonym` — строка, а `selectors` обязателен.
      : baseSetSynonyms(selectors as string, synonym as string);
    return mn;
  };

  /**
   * Загружает пресеты (наборы хендлеров и стилей).
   *
   * Каждый пресет — функция `(mn) => void`, которая регистрирует хендлеры
   * и CSS через API экземпляра.
   *
   * @param presets — массив функций-пресетов
   *
   * @example
   * mn.setPresets([presetStyles, presetMedias, presetSynonyms]);
   */
  mn.setPresets = setPresets;
  /**
   * Утилиты, доступные пресетам внутри `(mn) => {...}` (см. {@link MnUtils}).
   *
   * `baseUtils` (`core/utils.ts`) + `color`/`colorGetBackground`, переопределённые
   * здесь с зафиксированным `$$altColor` (из `options.altColor`, читается в
   * {@link applyOptions}) — сами пресеты передают только цвет, без второго аргумента.
   */
  mn.utils = extend(extend({}, baseUtils), {
    color: (v: string) => color(v, $$altColor),
    colorGetBackground: (v: string) => colorGetBackground(v, $$altColor),
  });

  /**
   * Переконфигурирует инстанс после создания — слияние с текущими опциями
   * (частичное обновление, не замена целиком). Единственный поддерживаемый
   * способ поменять `onError`/`onWarning`/`warningMode`/`isolateMode`/`altColor`
   * на уже созданном `mn` — эти поля читаются из замыкания и пересчитываются
   * только здесь и при создании инстанса, не на каждой компиляции (см.
   * {@link applyOptions}, пересмотрено 2026-09-23). Прямая мутация `mn.options`
   * эффекта не имеет — это только снимок для чтения/отладки.
   *
   * @param partialOptions — поля {@link MnOptions} для обновления
   * @returns mn (чейнинг)
   *
   * @example
   * mn.setOptions({ altColor: true });
   * mn.recompile;
   */
  mn.setOptions = (partialOptions: Partial<MnOptions>): any => {
    checkOptions(
      partialOptions, CORE_OPTIONS_SCHEMA, 'mn.setOptions',
    );
    settings = extend(extend({}, settings), partialOptions) as MnOptions;
    applyOptions();
    return mn;
  };

  applyOptions();
  settings.presets?.length && setPresets(settings.presets);

  return mn;
}

export default minotationProvider;
export {
  minotationProvider,
};
