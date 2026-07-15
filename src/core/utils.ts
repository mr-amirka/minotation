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

import {
  aggregate,
  camelToKebabCase,
  color,
  colorGetBackground,
  cssPropertiesParseSimple,
  cssPropertiesStringifyProvider,
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
  flatFlags,
  forEach,
  forIn,
  get,
  getBase,
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
  setBase,
  size,
  slice,
  splitProvider,
  toUpper,
  trim,
  unslash,
  upperFirst,
  values,
  variants,
} from 'fundamentool';
import {
  selectorNormalize,
} from '../selectorNormalize';
import type {
  MnCompiler,
  MnContextEssence,
  MnEssenceParams,
  MnEssenceResult,
  MnStyleEntry,
} from './types';

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
      let cb: ((value: T) => void) | 0 = callback;
      return () => {
        if (cb) {
          removeOf(callbacks, cb);
          cb = 0;
        }
      };
    },
  };
}

export const baseUtils = merge([{
  observableProvider,
  color,
  colorGetBackground,
  half,
  unslash,
  noop,
  size,
  extend,
  merge,
  isPlainObject,
  isObject,
  isArray,
  isNumber,
  isString,
  isObjectLike,
  isIndex,
  isLength,
  isDefined,
  isEmpty,
  indexOf,
  intval,
  floatval,
  set,
  setBase,
  get,
  getBase,
  extendDepth,
  mergeDepth,
  flags,
  flatFlags,
  joinMaps,
  joinArrays,
  routeParseProvider,
  forIn,
  forEach,
  reduce,
  reduceIn,
  filter,
  cssPropertiesStringifyProvider,
  cssPropertiesParse: cssPropertiesParseSimple,
  push,
  pushArray,
  splitProvider,
  joinProvider,
  joinOnly,
  joinComma,
  map,
  mapIn,
  values,
  keys,
  escapedSplitProvider,
  mapperProvider,
  regexpMapperProvider,
  variants,
  escapeQuote,
  escapeRegExp,
  escapeCss,
  escapedHalfProvider,
  trim,
  toUpper,
  upperFirst,
  lowerFirst,
  camelToKebabCase,
  kebabToCamelCase,
  scopeJoin,
  scopeSplit,
  slice,
  spaceNormalize,
}, {}]);

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
export const REGEXP_BROWSER_PREFIX = /((::-?|:-)([a-z]+-)?)/;
export const REGEXP_MEDIA_PRIORITY = /^(.*)\^(-?[0-9]+)$/;
export const REGEXP_IMPORTANT = /-i$/;
export const JOIN_AND = joinProvider(' and ');

// flatFlags (не fundamentool.flags()): та трактует '.'/'[...]' как путь (nested
// set), а имена эссенций (`f1.5em`) и CSS-селекторы (`[type=button]`, `.foo`)
// должны оставаться плоскими непрозрачными строковыми ключами.
export const normalizeSelectors = normalizeMapProvider<Record<string, number>>(normalizeSelectorsIteratee);
export const normalizeComboNames = normalizeMapProvider<Record<string, number>>((namesMap, name) => {
  return flatFlags(SPLIT_SPACE(name), namesMap);
});
export function normalizeSelectorsIteratee(selectorsMap: Record<string, number>, selector: string): Record<string, number> {
  forEach(SPLIT_SELECTOR(trim(selector).replace(RE_SPACE, ' ')), (selector: string) => {
    selector
      && flatFlags(map(variants(selector)[0], selectorNormalize), selectorsMap);
  });
  return selectorsMap;
}
export function __cssReducer(output: string[], v: { css: Record<string, string>;
content?: string }): string[] {
  push(output, v.content);
  return output;
}
export function parseMediaValue(v: string | undefined): number {
  if (!v) {
    return 0;
  }
  const n = parseInt(v, 10);
  if (isNaN(n)) {
    throw new TypeError('parseMediaValue error');
  }
  return n;
}
export function parseMediaPart(mediaPart?: string): [number, number] | undefined {
  if (!mediaPart) {
    return undefined;
  }
  const parts = mediaPart.split('-');
  const v = parseMediaValue(parts[0]);
  return parts.length > 1
    ? [v, parseMediaValue(parts[1])]
    : [0, v];
}
export function handlerWrap(essenceHandler: (p: MnEssenceParams) => MnEssenceResult | void,
  paramsMatchPath: string | string[]): (p: MnEssenceParams) => MnEssenceResult | void {
  const parse = isArray(paramsMatchPath)
    ? aggregate(map(paramsMatchPath, routeParseProvider), eachApply)
    : routeParseProvider(paramsMatchPath);
  return (p) => {
    parse(p.suffix, p);
    return essenceHandler(p);
  };
}
export function iterateeAddImportant(v: MnEssenceResult): void {
  v.important = 1;
}
export function iterateeCheckImportant(
  a: Record<string, number>, v: number, k: string,
): Record<string, number> {
  a[__iterateeCheckImportant(k)] = v;
  return a;
}
export function __iterateeCheckImportant(v: string): string {
  return REGEXP_IMPORTANT.test(v) ? v : (v + '-i');
}
/**
 * Форма эссенции ДО `__normalize()`: `selectors`/`exts`/`include` — «сырые»
 * значения от автора пресета (строка/массив), которые `__normalize()`
 * мутирует на месте в `Record<string, number>`/`string[]` (см. `MnEssenceResult`).
 */
type MnEssenceRaw = Omit<MnEssenceResult, 'selectors' | 'exts' | 'include' | 'childs' | 'media'> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- «сырое» значение от автора пресета до normalizeSelectors/normalizeComboNames, форма произвольная.
  selectors?: string | string[] | Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- см. selectors выше.
  exts?: string | string[] | Record<string, any>;
  include?: string | string[];
  childs?: Record<string, MnEssenceRaw>;
  media?: Record<string, MnEssenceRaw>;
};

export function __normalize(essence: MnEssenceRaw | false | void): MnEssenceResult | false | void {
  if (!essence) {
    // strictNullChecks выключен — TS не сужает essence до `false | void` здесь.
    return essence as false | void;
  }
  const {
    selectors, exts, include, important,
  } = essence;
  function childAddNormalize(childs?: Record<string, MnEssenceRaw>): void {
    important && forIn(childs, iterateeAddImportant);
    forIn(childs, __normalize);
  }
  essence.selectors = selectors ? normalizeSelectors(selectors) : {
    '': 1,
  };
  exts && (
    essence.exts = important
      ? reduceIn(
        normalizeComboNames(exts), iterateeCheckImportant, {},
      )
      : normalizeComboNames(exts)
  );
  include && (
    essence.include = important
      ? map(normalizeInclude(include), __iterateeCheckImportant)
      : normalizeInclude(include)
  );
  childAddNormalize(essence.childs);
  childAddNormalize(essence.media);
  return essence as MnEssenceResult;
}
// Вход normalizeMapProvider может быть строкой, массивом или произвольным объектом от вызывающей стороны.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeMapProvider<Acc>(iteratee: (acc: Acc, item: string) => Acc): (names: string | string[] | Record<string, any>) => Acc {
  return (names) => isObject(names)
    ? reduce(
      isArray(names) ? names : keys(names), iteratee, {} as Acc,
    )
    : iteratee({} as Acc, names);
}
export function normalizeIncludeIteratee(names: string[], name: string): string[] {
  return pushArray(names, SPLIT_SPACE(name)) as string[];
}
export function normalizeInclude(names: string | string[]): string[] {
  return isArray(names)
    ? reduce(
      names, normalizeIncludeIteratee, [],
    )
    : SPLIT_SPACE(names);
}
export function priotitySort(a: MnStyleEntry, b: MnStyleEntry): number {
  return a.priority - b.priority;
}
export function priotitySortContext(a: MnContextEssence, b: MnContextEssence): number {
  return a[MN_CONTEXT_ESSENCE_PRIORITY] - b[MN_CONTEXT_ESSENCE_PRIORITY];
}
export function getEessenceSelectors(selectorsMap: Record<string, Record<string, number>>): string[][] {
  const specifics: Record<string, string[]> = {};
  const other: string[] = [];
  const outputSelectors: string[][] = [];
  let matchs: RegExpExecArray | null;
  let prefix: string;
  let selector: string;
  for (selector in selectorsMap) {
    matchs = REGEXP_BROWSER_PREFIX.exec(selector);
    if (matchs) {
      prefix = matchs[3];
      push(specifics[prefix] || (specifics[prefix] = []), selector);
    } else {
      push(other, selector);
    }
  }
  for (selector in specifics) {
    push(outputSelectors, specifics[selector]);
  }
  if (other.length) {
    push(outputSelectors, other);
  }
  return outputSelectors;
}
// mergeDepth (fundamentool) сам типизирован как any: рекурсивный deep-merge
// без осмысленно более узкого типа — параметры/возврат намеренно остаются any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function __mergeDepth(src: any[], dst: Record<string, any>): Record<string, any> {
  return mergeDepth(
    src, dst, MN_MERGE_DEPTH,
  );
}
export function __compileProvider(attrName: string): MnCompiler {
  let _cache: Record<string, number>;
  let _values: string[];
  // node: any наследуется от MnCompiler (core/types.ts) — DOM-узел, тип не сужаем здесь.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function recursiveCheckNode(node: any): void {
    node.getAttribute && instance(node.getAttribute(attrName));
    forEach(node.childNodes, recursiveCheckNode);
  }
  function instance(v: string): void {
    if (!v) {
      return;
    }
    let k: string;
    const vs = SPLIT_SPACE(v || '');
    const l = vs.length;
    let i = 0;
    for (; i < l; i++) {
      k = vs[i];
      _cache[k] || (
        _cache[k] = 1,
        push(_values, k)
      );
    }
  }
  const compiler = instance as unknown as MnCompiler;
  (compiler.clear = () => {
    _cache = compiler.cache = {};
    _values = [];
  })();
  compiler.getNext = () => {
    const values = _values;
    _values = [];
    return values;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- см. recursiveCheckNode выше.
  compiler.checkNode = (node: any) => {
    node.getAttribute && instance(node.getAttribute(attrName));
  };
  compiler.recursiveCheck = recursiveCheckNode;
  return compiler;
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
