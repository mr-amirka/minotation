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
  toFixed,
  toUpper,
  trim,
  unslash,
  upperFirst,
  values,
  variants,
} from 'fundamentool';
import {
  selectorNormalize,
  pseudoBrackets,
} from '../selectorNormalize';
import {
  MnParseError,
} from './types';
import type {
  MnCompiler,
  MnContextEssence,
  MnEssenceParams,
  MnEssenceRaw,
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
  toFixed,
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

// Индексы MnEssenceResult (кортеж, см. core/types.ts) — экспериментальный
// перевод с объекта на кортеж (§2 coding.md), сравнение по бенчмарку.
export const MN_ESSENCE_STYLE = 0;
export const MN_ESSENCE_PRIORITY = 1;
export const MN_ESSENCE_IMPORTANT = 2;
export const MN_ESSENCE_EXTS = 3;
export const MN_ESSENCE_SELECTORS = 4;
export const MN_ESSENCE_CHILDS = 5;
export const MN_ESSENCE_MEDIA = 6;
export const MN_ESSENCE_INCLUDE = 7;
export const MN_ESSENCE_CSS_TEXT = 8;
export const MN_ESSENCE_INITED = 9;

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
/**
 * Точечная эвристика "похоже на битое CSS-значение", не полный грамматический
 * разбор (см. `AGENT_DRAFT/SPEC/10-error-warnings.md` — валидация итогового
 * CSS-вывода целиком признана отдельным, более поздним этапом; это её первый,
 * узкий проход). Ловит класс багов "буквы вместо числа перед юнитом" —
 * например `bxshR3` → `box-shadow:...Rpx...` (см. `HANDLERS.md`, унаследовано
 * из v1: изолированный `r`/`R`-модификатор без ведущего blur-числа) — плюс
 * `NaN`/`undefined`/`null`, протёкшие в значение из JS. НЕ ловит: неверные
 * ключевые слова (`display:flexx`), несочетаемые значения — тут нужен полный
 * per-свойству грамматический разбор, сознательно не делается.
 *
 * Юниты `ex`/`ch`/`in` сознательно ИСКЛЮЧЕНЫ из списка — слишком много
 * обычных CSS-ключевых слов случайно оканчиваются на эти буквосочетания
 * (`flex`, `complex`, `index` → ложно матчат `ex`; `thin`, `within`, `chain` →
 * `in`) — найдено эмпирически: `dF`→`display:flex` ложно браковался при
 * первой версии этого регэкспа (6 упавших тестов), см. `CHANGELOG.md` 2026-09-04.
 */
export const REGEXP_INVALID_CSS_VALUE = /\b(?:undefined|null|NaN)\b|(?:^|[\s,(])(?:undefined|null|NaN|[A-Za-z]{1,3})(?:px|em|rem|deg|vh|vw|vmin|vmax|pt|pc|cm|mm|fr)(?=[\s,)]|$)/;
export const JOIN_AND = joinProvider(' and ');

// flatFlags (не fundamentool.flags()): та трактует '.'/'[...]' как путь (nested
// set), а имена эссенций (`f1.5em`) и CSS-селекторы (`[type=button]`, `.foo`)
// должны оставаться плоскими непрозрачными строковыми ключами.
export const normalizeSelectors = normalizeMapProvider<Record<string, number>>(normalizeSelectorsIteratee);
export const normalizeComboNames = normalizeMapProvider<Record<string, number>>((namesMap, name) => {
  return flatFlags(SPLIT_SPACE(name), namesMap);
});
/**
 * Бракует вырожденную группу вариантов — скобки без `|` внутри.
 *
 * `(a|b)` — это группа: `p10@(sm|md)` разворачивается в два медиа-контекста,
 * `'(button|[type=submit])'` — в два селектора. А вот скобки БЕЗ `|` группой не
 * являются: `variants()` схлопывает такую группу в единственный вариант, и
 * единственный её эффект — молчаливое удаление самих скобок:
 *
 * | Запись | Давала | Ожидалось автором |
 * |---|---|---|
 * | `gtcRepeat(auto-fit,minmax(240px,1fr))` | `grid-template-columns:repeatauto-fit,minmax240px,1fr` | функция `repeat()` |
 * | `crUrl(a.png)` | `cursor:urla` + `.png` уехал в селектор | `url(a.png)` |
 * | `'button:not(.plain)'` в `mn.assign` | `button:not.plain` | `button:not(.plain)` |
 * | `'li:nth-child(2n)'` в `mn.assign` | `li:nth-child2n` | `li:nth-child(2n)` |
 *
 * Во всех случаях в CSS уезжало правило, которое не сработает никогда, и без
 * единого предупреждения — запрещено D-004. Рабочая запись для функции —
 * экранировать скобки (`crUrl\(a.png\)`, `'button:not\(.plain\)'`);
 * проверено, что после экранирования обе формы дают корректный CSS.
 *
 * Непарные скобки бракуются по той же причине: лишний `)` в `a)b` просто
 * исчезал, давая `ab`.
 *
 * @param value — имя токена или селектор, как его написал автор
 * @param utility — что подставить в контекст ошибки (`variants`/`selectors`)
 * @throws {MnParseError} если найдена группа без `|` или непарная скобка
 */
export function assertVariantGroups(
  value: string, utility: string, valueOnly?: number,
): void {
  const l = value.length;
  let i = 0;
  // Стек «была ли `|` на этом уровне»: индекс — глубина вложенности.
  const hasAlternative: boolean[] = [];
  let depth = 0;
  let ch: string;
  while (i < l) {
    ch = value[i];
    if (ch === '\\') {
      // Экранированная скобка — часть значения, а не грамматики.
      i += 2;
      continue;
    }
    if (valueOnly && !depth && CONTEXT_START[ch]) {
      // Дальше начинается контекст токена (состояние, предок, медиа, условие),
      // а там скобки — это scope-грамматика, а не группа вариантов:
      // `p10:h(.x)` даёт `:hover.x`, и это штатное поведение. Проверяем только
      // значение — часть до первого контекстного символа на нулевой глубине.
      return;
    }
    if (ch === '(') {
      hasAlternative[depth++] = false;
    } else if (ch === ')') {
      if (!depth) {
        throwVariantGroup(
          'Непарная закрывающая скобка в "' + value + '": она молча исчезнет из '
            + 'результата. Экранируйте её — "\\)" — если это часть значения',
          value, utility,
        );
      }
      if (!hasAlternative[--depth]) {
        throwVariantGroup(
          'Скобки в "' + value + '" не образуют группу вариантов: внутри нет "|", '
            + 'и они будут молча удалены. Группа вариантов пишется как "@(sm|md)". '
            + 'Если это CSS-функция или часть значения — экранируйте скобки: '
            + '"\\(" и "\\)". В токене после состояния работает и краткая форма '
            + 'через scope: "cF00:not[.a]" даёт ":not(.a)"',
          value, utility,
        );
      }
    } else if (ch === '|' && depth) {
      hasAlternative[depth - 1] = true;
    }
    i++;
  }
  if (depth) {
    throwVariantGroup(
      'Незакрытая скобка в "' + value + '": остаток строки будет разобран не так, '
        + 'как написано. Экранируйте её — "\\(" — если это часть значения',
      value, utility,
    );
  }
}

/** Начала контекстной части токена — дальше скобки принадлежат scope-грамматике. */
const CONTEXT_START: Record<string, 1> = {
  ':': 1,
  '<': 1,
  '>': 1,
  '@': 1,
  '&': 1,
  '~': 1,
  '[': 1,
  '.': 1,
  '#': 1,
};

function throwVariantGroup(
  message: string, value: string, utility: string,
): never {
  throw new MnParseError(message, {
    token: value,
    handler: '',
    arg: value,
    utility: utility,
  });
}

export function normalizeSelectorsIteratee(selectorsMap: Record<string, number>, selector: string): Record<string, number> {
  forEach(SPLIT_SELECTOR(trim(selector).replace(RE_SPACE, ' ')), (selector: string) => {
    if (!selector) {
      return;
    }
    assertVariantGroups(selector, 'selectors');
    // `pseudoBrackets` — только здесь: имена токенов разворачивают scope
    // собственным механизмом, и второе преобразование их бы испортило.
    flatFlags(map(map(variants(selector)[0], pseudoBrackets), selectorNormalize), selectorsMap);
  });
  return selectorsMap;
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
/** Корректная часть числового медиа-шаблона: `760`, `760-`, `760-1200`. */
const REGEXP_MEDIA_RANGE = /^\d+(?:-\d*)?$/;
/** Записано цифрами и дефисами — то есть автор явно имел в виду числовой шаблон. */
const REGEXP_MEDIA_NUMERIC = /^[-\d]+$/;

/**
 * Часть медиа-шаблона выглядит числовой, но записана не по форме.
 *
 * Разбор числового шаблона («сколько частей после split('-')») принимал лишнее
 * и делал это молча:
 *
 * | Запись | Давала | Почему плохо |
 * |---|---|---|
 * | `@-760` | `max-width: 760px` | вторая запись того же, что `@760` |
 * | `@-760-1200` | `max-width: 760px` | `-1200` отброшен |
 * | `@760-1200-1500` | `(min 760) and (max 1200)` | `-1500` отброшен |
 * | `@-` | пустой запрос | правила нет, причина не названа |
 *
 * Первое — нарушение «один результат — одна запись» (Р-1), остальные —
 * молчаливо отброшенный хвост (D-004). Названные медиа (`sm`, `safari`) сюда
 * не попадают: в них есть буквы, и `REGEXP_MEDIA_NUMERIC` их не пропускает.
 */
export function isBadMediaRange(mediaPart?: string): boolean {
  return !!mediaPart
    && REGEXP_MEDIA_NUMERIC.test(mediaPart)
    && !REGEXP_MEDIA_RANGE.test(mediaPart);
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
export function handlerWrap(essenceHandler: (p: MnEssenceParams) => MnEssenceRaw | void | 0,
  paramsMatchPath: string | string[]): (p: MnEssenceParams) => MnEssenceRaw | void | 0 {
  // Паттерны-массивы (напр. SHADOW_PATTERNS) — независимые regex'ы, каждый ищет
  // СВОЙ фрагмент где угодно в общем суффиксе (`19r3c43F` → r-паттерн находит "r3",
  // c-паттерн — "c43F", независимо друг от друга) — anchored=false, как было в
  // v1 (mn-utils.routeParseProvider не анкорил вообще). Одиночная строка-паттерн
  // (PATTERN_VAL и т.п.) уже embed'ит собственные `^`/`$` и матчит суффикс целиком.
  const parse = isArray(paramsMatchPath)
    ? aggregate(map(paramsMatchPath, (pattern: string) => routeParseProvider(pattern, false)), eachApply)
    : routeParseProvider(paramsMatchPath);
  return (p) => {
    parse(p.suffix, p);
    return essenceHandler(p);
  };
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
 * Строит новый кортеж `MnEssenceResult` из "сырого" объекта `MnEssenceRaw`
 * (childs/media рекурсивно) — НЕ мутирует `essence` на месте (в отличие от
 * дообъектной версии): вход остаётся объектом (холодный путь регистрации
 * пресета), выход — кортеж (горячий путь компиляции).
 */
export function __normalize(essence: MnEssenceRaw | 0 | null | false | void): MnEssenceResult | 0 | null | false | void {
  if (!essence) {
    // strictNullChecks выключен — TS не сужает essence здесь.
    return essence as 0 | null | false | void;
  }
  const {
    selectors, exts, include, important, childs, media,
  } = essence;
  return [
    essence.style,
    essence.priority,
    important,
    exts
      ? (important
        ? reduceIn(
          normalizeComboNames(exts), iterateeCheckImportant, {},
        )
        : normalizeComboNames(exts))
      : undefined,
    selectors ? normalizeSelectors(selectors) : {
      '': 1,
    },
    childs && childAddNormalize(childs, important),
    media && childAddNormalize(media, important),
    include
      ? (important
        ? map(normalizeInclude(include), __iterateeCheckImportant)
        : normalizeInclude(include))
      : undefined,
    essence.cssText,
    essence.inited,
  ];
}
function childAddNormalize(childs: Record<string, MnEssenceRaw>, important?: number): Record<string, MnEssenceResult> {
  const result: Record<string, MnEssenceResult> = {};
  let key: string;
  let child: MnEssenceRaw;
  for (key in childs) {
    child = childs[key];
    important && (child.important = 1);
    result[key] = __normalize(child) as MnEssenceResult;
  }
  return result;
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
/**
 * Глубокий merge двух эссенций-кортежей — заменяет `__mergeDepth`/`extendDepth`
 * (fundamentool) специально для `MnEssenceResult`: та генерика умеет мержить
 * только ПЛОСКИЕ объекты с именованными ключами (`isPlainObject()` явно
 * исключает массивы) — теперь, когда сама эссенция стала кортежем, обобщённый
 * merge молча перестал бы рекурсивно сливать `childs`/`media` (каждый
 * следующий src просто перезаписывал бы весь дочерний кортеж целиком вместо
 * слияния полей). Семантика 1:1 повторяет старую (объектную): `style`/`exts`/
 * `selectors` — плоское слияние ключей (их значения — строки/числа/массивы,
 * не вложенные объекты, глубже мержить нечего); `childs`/`media` — слияние
 * по имени, при совпадении имени — РЕКУРСИВНЫЙ вызов этой же функции;
 * `priority`/`important`/`include`/`cssText`/`inited` — перезапись значением
 * `src`, если оно задано. Мутирует `dst` на месте (как и оригинал —
 * `$$essences`-кеш переиспользуется, а не пересоздаётся, §16 coding.md).
 *
 * @param dst — накопитель (мутируется)
 * @param src — источник, накладывается поверх `dst`
 * @returns тот же `dst`
 */
export function mergeEssenceInto(dst: MnEssenceResult, src: MnEssenceResult | 0 | null | void): MnEssenceResult {
  // Оригинальный generic merge (extendDepth.base) мержил через `for k in src` —
  // безопасный no-op при src=undefined/null. Индексный доступ src[N] так не
  // умеет — guard явно, чтобы не потерять эту терпимость (updateEssence может
  // вернуть void при циклической ссылке include, см. compileMixedEssence).
  if (!src) {
    return dst;
  }
  let v: unknown;
  if ((v = src[MN_ESSENCE_STYLE]) !== undefined) {
    dst[MN_ESSENCE_STYLE] = dst[MN_ESSENCE_STYLE]
      ? extend(dst[MN_ESSENCE_STYLE], v as Record<string, string | string[]>)
      : extend({}, v as Record<string, string | string[]>);
  }
  if ((v = src[MN_ESSENCE_PRIORITY]) !== undefined) {
    dst[MN_ESSENCE_PRIORITY] = v as number;
  }
  if ((v = src[MN_ESSENCE_IMPORTANT]) !== undefined) {
    dst[MN_ESSENCE_IMPORTANT] = v as number;
  }
  if ((v = src[MN_ESSENCE_EXTS]) !== undefined) {
    dst[MN_ESSENCE_EXTS] = dst[MN_ESSENCE_EXTS]
      ? extend(dst[MN_ESSENCE_EXTS], v as Record<string, number>)
      : extend({}, v as Record<string, number>);
  }
  if ((v = src[MN_ESSENCE_SELECTORS]) !== undefined) {
    dst[MN_ESSENCE_SELECTORS] = dst[MN_ESSENCE_SELECTORS]
      ? extend(dst[MN_ESSENCE_SELECTORS], v as Record<string, number>)
      : extend({}, v as Record<string, number>);
  }
  if ((v = src[MN_ESSENCE_CHILDS]) !== undefined) {
    dst[MN_ESSENCE_CHILDS] = mergeEssenceMap(dst[MN_ESSENCE_CHILDS], v as Record<string, MnEssenceResult>);
  }
  if ((v = src[MN_ESSENCE_MEDIA]) !== undefined) {
    dst[MN_ESSENCE_MEDIA] = mergeEssenceMap(dst[MN_ESSENCE_MEDIA], v as Record<string, MnEssenceResult>);
  }
  if ((v = src[MN_ESSENCE_INCLUDE]) !== undefined) {
    dst[MN_ESSENCE_INCLUDE] = v as string[];
  }
  if ((v = src[MN_ESSENCE_CSS_TEXT]) !== undefined) {
    dst[MN_ESSENCE_CSS_TEXT] = v as string;
  }
  if ((v = src[MN_ESSENCE_INITED]) !== undefined) {
    dst[MN_ESSENCE_INITED] = v as number;
  }
  return dst;
}
/** `childs`/`media`-карты: слияние по имени, рекурсия в `mergeEssenceInto` при совпадении. Мутирует `dst` на месте. */
function mergeEssenceMap(dst: Record<string, MnEssenceResult> | undefined,
  src: Record<string, MnEssenceResult>): Record<string, MnEssenceResult> {
  dst || (dst = {});
  let key: string;
  let existing: MnEssenceResult | undefined;
  for (key in src) {
    existing = dst[key];
    dst[key] = existing ? mergeEssenceInto(existing, src[key]) : src[key];
  }
  return dst;
}
/**
 * Мержит несколько эссенций-источников В `dst` последовательно (порядок —
 * позже в массиве побеждает при конфликте скаляров) — прямая замена
 * `__mergeDepth(sources, dst)`, специализированная под `MnEssenceResult`.
 */
export function mergeEssenceDepth(sources: Array<MnEssenceResult | 0 | null | void>, dst: MnEssenceResult): MnEssenceResult {
  let i = 0;
  const l = sources.length;
  for (; i < l; i++) {
    mergeEssenceInto(dst, sources[i]);
  }
  return dst;
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
    // пустое значение уже отсеяно выше — дополнительный фолбэк не нужен
    const vs = SPLIT_SPACE(v);
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
 * @param options.altColor — запасное непрозрачное объявление рядом с `rgba()` (по умолчанию `false`)
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
