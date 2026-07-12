/**
 * Minotation — ядро.
 *
 * Minotation (MN) — лаконичный синтаксис для описания CSS-классов
 * прямо в HTML-атрибутах. Значения атрибутов `class`, `m-n` и др.
 * компилируются в настоящий CSS.
 *
 * ## Основное API
 *
 * ```ts
 * import mnProvider from 'minotation';
 * const mn = mnProvider({ presets: [styles, medias, synonyms] });
 *
 * // Зарегистрировать хендлер
 * mn('w', (params) => ({ style: { width: params.suffix + 'px' } }));
 *
 * // Скомпилировать токены из HTML
 * mn.getCompiler('class')('w50 w100%+10');
 * mn.compile();
 * const css = mn.styles$.getValue();
 * ```
 *
 * ## Архитектура
 *
 * - **Хендлеры** (`mn(name, fn)`) — функции, преобразующие токен в стили
 * - **Сущности** (`mn(name, { exts, childs, include })`) — статические описания
 * - **Компилятор** (`mn.getCompiler(attrName)`) — сбор токенов из DOM
 * - **Пресеты** (`mn.setPresets([...])`) — готовые наборы хендлеров и стилей
 *
 * @module core
 */

/* eslint-disable @typescript-eslint/no-explicit-any, no-useless-escape, no-cond-assign */
import {
  addOf,
  aggregate,
  camelToKebabCase,
  color,
  colorGetBackground,
  cssPropertiesParseSimple,
  cssPropertiesStringifyProvider,
  createTimeout,
  defer,
  eachApply,
  eachTry,
  escapeCss,
  escapeQuote,
  escapeRegExp,
  escapedHalfProvider,
  escapedSplitProvider,
  extend,
  extendDepth,
  filter,
  flags,
  forEach,
  forIn,
  get,
  floatval,
  half,
  indexOf,
  intval,
  isArray,
  isDefined,
  isEmpty,
  isIndex,
  isLength,
  isNumber,
  isObject,
  isObjectLike,
  isPlainObject,
  isPromise,
  isString,
  joinArrays,
  joinComma,
  joinMaps,
  joinOnly,
  joinProvider,
  kebabToCamelCase,
  keys,
  lowerFirst,
  map,
  mapIn,
  mapperProvider,
  merge,
  mergeDepth,
  noop,
  once,
  push,
  pushArray,
  reduce,
  reduceIn,
  regexpMapperProvider,
  removeOf,
  routeParseProvider,
  scopeJoin,
  scopeSplit,
  set,
  size,
  slice,
  splitProvider,
  toUpper,
  trim,
  unslash,
  upperFirst,
  values,
  variants,
  withDefer,
  withResult,
} from 'fundamentool';
import {
  selectorNormalize,
} from '../selectorNormalize';

/**
 * Нормализует пробелы в MN-значениях:
 * `_` → пробел, `\\_` → литерал `_`.
 *
 * @example
 * spaceNormalize('10px_solid_red')  // → '10px solid red'
 * spaceNormalize('a\\_b')           // → 'a_b'
 */
export const REGEXP_SPACE_NORMALIZE = /(\\_)|(_)/g;

export function replacerSpaceNormalize(_all: string, escaped: string): string {
  return escaped ? '_' : ' ';
}
export function spaceNormalize(v: string): string {
  return v.replace(REGEXP_SPACE_NORMALIZE, replacerSpaceNormalize);
}

/**
 * Простая реализация Observable.
 *
 * Используется для `mn.styles$` (поток стилей) и `mn.error$` (поток ошибок).
 */
type Observer<T> = {
  getValue: () => T;
  emit: (value: T) => void;
  on: (callback: (value: T) => void) => () => void;
};

export function observableProvider<T>(_value: T): Observer<T> {
  const callbacks: Array<((value: T) => void) | 0> = [];
  return {
    getValue: () => {
      return _value;
    },
    emit: (value: T) => {
      _value = value;
      eachTry(callbacks, [value]);
    },
    on: (callback: (value: T) => void) => {
      callbacks.push(callback);
      return () => {
        if (callback) {
          (callback as any) = 0;
          (removeOf as any)(callbacks, callback);
        }
      };
    },
  };
}

export const baseUtils = merge([{
  observableProvider,
  color,
  colorGetBackground,
  half: half,
  unslash: unslash,
  noop,
  size: size,
  concat: (Array as any).prototype.concat,
  extend,
  merge,
  isPlainObject,
  isObject,
  isArray,
  isNumber,
  isString,
  isObjectLike: isObjectLike,
  isPromise: isPromise,
  isIndex: isIndex,
  isLength: isLength,
  isDefined,
  isEmpty,
  indexOf: indexOf,
  once: once,
  delay: createTimeout,
  intval,
  floatval,
  removeOf,
  addOf: addOf,
  set,
  get,
  aggregate,
  eachApply,
  eachTry,
  extendDepth: extendDepth,
  mergeDepth,
  flags,
  flagsSet: flags,
  joinMaps,
  joinArrays,
  routeParseProvider,
  forIn,
  forEach,
  reduce,
  reduceIn,
  reduceEach: reduce,
  filter,
  cssPropertiesStringifyProvider,
  cssPropertiesParse: cssPropertiesParseSimple,
  push,
  pushArray,
  splitProvider,
  joinProvider,
  joinOnly,
  joinComma,
  withDefer,
  withResult,
  map,
  mapIn,
  mapEach: map,
  values: values,
  keys,
  escapedSplitProvider: escapedSplitProvider,
  mapperProvider: mapperProvider,
  regexpMapperProvider: regexpMapperProvider,
  variants,
  escapeQuote: escapeQuote,
  escapeRegExp: escapeRegExp,
  escapeCss: escapeCss,
  escapedHalfProvider: escapedHalfProvider,
  trim,
  toUpper: toUpper,
  upperFirst: upperFirst,
  lowerFirst: lowerFirst,
  camelToKebabCase: camelToKebabCase,
  kebabToCamelCase: kebabToCamelCase,
  defer: defer,
  scopeJoin: scopeJoin,
  scopeSplit: scopeSplit,
  slice: slice,
  spaceNormalize,
}, {} as any]);

export const
  OBJECT = 'object',
  FUNCTION = 'function',
  STRING = 'string';

export const MN_CONTEXT_ESSENCE_MAP = 0;
export const MN_CONTEXT_ESSENCE_SELECTORS = 1;
export const MN_CONTEXT_ESSENCE_PRIORITY = 2;
export const MN_CONTEXT_ESSENCE_CSS_TEXT = 3;
export const MN_CONTEXT_ESSENCE_UPDATED = 4;
export const MN_CONTEXT_ESSENCE_CONTENT = 5;

export const MN_MERGE_DEPTH = 50;
export const MN_KEYFRAMES_TOKEN = 'keyframes';
export const MN_DEFAULT_PRIORITY = -2000;
export const MN_DEFAULT_CSS_PRIORITY = MN_DEFAULT_PRIORITY - 2000;
export const MN_DEFAULT_OTHER_CSS_PRIORITY = MN_DEFAULT_PRIORITY - 4000;
export const RE_SPACE = /\s+/gim;
export const SPLIT_SPACE = splitProvider(/\s+/);
export const SPLIT_SELECTOR = splitProvider(/\s*,+\s*/);
export const SPLIT_AMP = splitProvider(/\s*&+\s*/);
export const REGEXP_MATCH_VAR = /^(--[^=]+)=(.*)$/;
export const REGEXP_MATCH_NAME = /^([a-z]+)(.*)$/;
export const REGEXP_MATCH_IMPORTANT = /^(.*)(-i)$/;
export const REGEXP_MATCH_VALUE = /^((([A-Z][A-Za-z]*)|((-)?[0-9.]+))([a-z%]+)?)?(.*)?$/;
export const REGEXP_BROWSER_PREFIX = /((\:\:\-?|\:\-)([a-z]+\-)?)/;
export const REGEXP_MEDIA_PRIORITY = /^(.*)\^(-?[0-9]+)$/;
export const REGEXP_IMPORTANT = /-i$/;
export const JOIN_AND = joinProvider(' and ');

export const normalizeSelectors = normalizeMapProvider(normalizeSelectorsIteratee);
export const normalizeComboNames = normalizeMapProvider((namesMap, name) => {
  return flags(SPLIT_SPACE(name), namesMap);
});
export function normalizeSelectorsIteratee(selectorsMap, selector) {
  forEach((SPLIT_SELECTOR(trim(selector).replace(RE_SPACE, ' ')) as any), (selector: string) => {
    selector
      && flags(map((variants(selector) as any)[0], selectorNormalize as any), selectorsMap);
  });
  return selectorsMap;
}
export function __cssReducer(output, v) {
  push(output, v.content);
  return output;
}
export function parseMediaValue(v) {
  if (!v) {
    return 0;
  }
  if (isNaN(v = parseInt(v))) {
    throw new TypeError('parseMediaValue error');
  }
  return v;
}
export function parseMediaPart(
  mediaPart: any, parts?: any, v?: any,
) {
  return mediaPart && (
    parts = mediaPart.split('-'),
    v = parseMediaValue(parts[0]),
    parts.length > 1
      ? [v, parseMediaValue(parts[1])]
      : [0, v]
  );
}
export function handlerWrap(essenceHandler, paramsMatchPath) {
  const parse = isArray(paramsMatchPath)
    ? aggregate(map(paramsMatchPath, routeParseProvider as any) as any, eachApply as any)
    : routeParseProvider(paramsMatchPath);
  return (p) => {
    parse(p.suffix, p);
    return essenceHandler(p);
  };
}
export function iterateeAddImportant(v) {
  v.important = 1;
}
export function iterateeCheckImportant(
  a, v, k,
) {
  a[__iterateeCheckImportant(k)] = v;
  return a;
}
export function __iterateeCheckImportant(v) {
  return REGEXP_IMPORTANT.test(v) ? v : (v + '-i');
}
export function __normalize(essence) {
  if (!essence) {
    return essence;
  }
  const {
    selectors, exts, include, important,
  } = essence;
  function childAddNormalize(childs) {
    important && (forIn as any)(childs, iterateeAddImportant);
    (forIn as any)(childs, __normalize);
  }
  essence.selectors = selectors ? normalizeSelectors(selectors) : {
    '': 1,
  };
  exts && (
    essence.exts = important
      ? (reduceIn as any)(
        normalizeComboNames(exts), iterateeCheckImportant, {},
      )
      : normalizeComboNames(exts)
  );
  include && (
    essence.include = important
      ? map(normalizeInclude(include), __iterateeCheckImportant as any)
      : normalizeInclude(include)
  );
  childAddNormalize(essence.childs);
  childAddNormalize(essence.media);
  return essence;
}
export function normalizeMapProvider(iteratee) {
  return (names) => isObject(names)
    ? (reduce as any)(
      isArray(names) ? names : keys(names), iteratee, {},
    )
    : iteratee({}, names);
}
export function normalizeIncludeIteratee(names, name) {
  return pushArray(names, SPLIT_SPACE(name));
}
export function normalizeInclude(names) {
  return isArray(names)
    ? (reduce as any)(
      names, normalizeIncludeIteratee, [],
    )
    : SPLIT_SPACE(names);
}
export function priotitySort(a, b) {
  return a.priority - b.priority;
}
export function priotitySortContext(a, b) {
  return a[MN_CONTEXT_ESSENCE_PRIORITY] - b[MN_CONTEXT_ESSENCE_PRIORITY];
}
export function getEessenceSelectors(selectorsMap) {
  const specifics = {}, other = [], outputSelectors = []; // eslint-disable-line
  let matchs, prefix, selector; // eslint-disable-line
  for (selector in selectorsMap) (push as any)( // eslint-disable-line
    (matchs = REGEXP_BROWSER_PREFIX.exec(selector))
      ? (specifics[prefix = matchs[3]] || (specifics[prefix] = []))
      : other, selector);
  // eslint-disable-next-line
  for (selector in specifics) (push as any)(outputSelectors, specifics[selector]);
  other.length && (push as any)(outputSelectors, other);
  return outputSelectors;
}
export function __mergeDepth(src, dst) {
  return mergeDepth(
    src, dst, MN_MERGE_DEPTH,
  );
}
export function __compileProvider(attrName) {
  let _cache, _values; // eslint-disable-line
  function recursiveCheckNode(node) {
    node.getAttribute && instance(node.getAttribute(attrName));
    forEach(node.childNodes, recursiveCheckNode);
  }
  function instance(v) {
    if (!v) {
      return;
    }
    // eslint-disable-next-line
    for (let vs = SPLIT_SPACE(v || ''), i = 0, l = vs.length, k; i < l; i++) {
      _cache[k = vs[i]] || (
        _cache[k] = 1,
        (push as any)(_values, k)
      );
    }
  }
  (instance.clear = () => {
    _cache = (instance as any).cache = {};
    _values = [];
  })();
  instance.getNext = (_node: any) => {
    const values = _values;
    _values = [];
    return values;
  };
  instance.checkNode = (node) => {
    node.getAttribute && instance(node.getAttribute(attrName));
  };
  instance.recursiveCheck = recursiveCheckNode;
  return instance;
}

/**
 * Создаёт экземпляр Minotation.
 *
 * @param options — конфигурация
 * @param options.presets — массив функций-пресетов `(mn) => void`
 * @param options.media — объект медиа-запросов `{ name: { query, selector, priority } }`
 * @param options.onError — обработчик ошибок
 * @param options.selectorPrefix — префикс для всех селекторов
 * @param options.altColor — включить альтернативные цвета (по умолчанию `true`)
 * @returns экземпляр MN
 *
 * @example
 * const mn = minotationProvider({
 *   presets: [presetStyles, presetMedias],
 * });
 *
 * mn('w', (p) => ({ style: { width: p.suffix + 'px' } }));
 * mn.getCompiler('class')('w50');
 * mn.compile();
 * console.log(mn.styles$.getValue()); // [{ content: '.w50{width:50px}' }]
 */
