/**
 * Проверка объекта опций публичного API (D-038, конвенция
 * `api-input-validation.md`): неизвестный ключ и некорректное значение —
 * ошибка с подсказкой, а не молчаливое игнорирование.
 *
 * Холодный путь: вызывается один раз при создании (провайдер, плагин, конфиг).
 */

import {
  describeValue,
  isPlainObject,
  nearestKnown,
} from 'fundamentool';
import {
  MN_MAX_SPECIFICITY,
} from './core/types';

/** What came — for a message: `string "p10"`, `number 5`, `array`, `RegExp /x/i`, a class name (fundamentool's). */
export {
  describeValue,
};

const LIST_SEPARATOR = ', ';
const MODE_SILENT = 'silent';
const MODE_WARN = 'warn';
const MODE_STRICT = 'strict';

/**
 * Проверка значения одной опции: `undefined` — значение подходит, строка —
 * что ожидалось («a boolean», `"log", "silent" or "error"`). `where` и `path`
 * (полное имя опции) — для вложенных проверок ({@link optionsOf}).
 */
export type OptionCheck = (value: unknown, where: string, path: string) => string | undefined;

/** Допустимые опции: имя → проверка значения. */
export type OptionSchema = Record<string, OptionCheck>;

/**
 * Проверяет объект опций по схеме; при ошибке бросает `Error` с подсказкой.
 * `undefined` вместо объекта и `undefined` в значениях — то же, что отсутствие.
 *
 * @param options — опции, как их передал пользователь
 * @param schema — допустимые опции и проверки значений
 * @param where — где проверяем: имя функции/плагина (`mnVite`)
 * @param path — путь вложенного объекта опций (`entry.admin`); у верхнего уровня пусто
 *
 * @example
 * checkOptions({ atrs: 'class' }, { attrs: isString }, 'mnVite');
 * // Error: [minotation] mnVite: unknown option "atrs". Did you mean "attrs"?
 */
export function checkOptions(
  options: unknown, schema: OptionSchema, where: string, path = '',
): void {
  if (options === undefined) {
    return;
  }
  const at = '[minotation] ' + where + ': ';
  if (!isPlainObject(options)) {
    throw new Error(at + (path ? 'option "' + path + '" expects' : 'options expect')
      + ' an object, got ' + describeValue(options));
  }
  const names = Object.keys(schema);
  const prefix = path ? path + '.' : '';
  let check: OptionCheck | undefined;
  let expected: string | undefined;
  let hint: string;
  for (const key of Object.keys(options)) {
    check = Object.prototype.hasOwnProperty.call(schema, key) ? schema[key] : undefined;
    if (!check) {
      hint = nearestKnown(key, names);
      throw new Error(at + 'unknown option "' + prefix + key + '". ' + (hint
        ? 'Did you mean "' + prefix + hint + '"?'
        : 'Known options: ' + names.join(LIST_SEPARATOR)));
    }
    expected = options[key] === undefined ? undefined : check(
      options[key], where, prefix + key,
    );
    if (expected) {
      throw new Error(at + 'option "' + prefix + key + '" expects ' + expected
        + ', got ' + describeValue(options[key]));
    }
  }
}

/**
 * Проверяет значения списка-опции по перечню допустимых (`excludeGroups: ['bootsrap']`):
 * неизвестное — ошибка с ближайшим допустимым и перечнем (D-042).
 *
 * @param values — значения, как их передал пользователь (уже проверено, что это массив строк)
 * @param known — допустимые значения
 * @param where — где проверяем (`presetHints`)
 * @param option — имя опции (`excludeGroups`)
 * @param what — что это за значения, во множественном числе (`groups`)
 *
 * @example
 * checkKnownValues(['bootsrap'], ['typos', 'tailwind', 'bootstrap'], 'presetHints', 'excludeGroups', 'groups');
 * // Error: [minotation] presetHints: unknown value "bootsrap" in "excludeGroups". Did you mean "bootstrap"?
 * //   Known groups: typos, tailwind, bootstrap
 */
export function checkKnownValues(
  values: string[], known: string[], where: string, option: string, what: string,
): void {
  let hint: string;
  for (const value of values) {
    if (known.indexOf(value) < 0) {
      hint = nearestKnown(value, known);
      throw new Error('[minotation] ' + where + ': unknown value "' + value + '" in "' + option + '". '
        + (hint ? 'Did you mean "' + hint + '"? ' : '') + 'Known ' + what + ': ' + known.join(LIST_SEPARATOR));
    }
  }
}

/** Логическое значение. */
export const isBoolean: OptionCheck = (value) => (
  typeof value === 'boolean' ? undefined : 'a boolean'
);

/** Строка. */
/** Имя класса CSS без экранирования: `_l`, `mn-scope`. */
const REGEXP_CLASS_NAME = /^-?[_a-zA-Z][\w-]*$/;

export const isString: OptionCheck = (value) => (
  typeof value === 'string' ? undefined : 'a string'
);

/** Функция. */
export const isFunction: OptionCheck = (value) => (
  typeof value === 'function' ? undefined : 'a function'
);

/** Неотрицательное целое. */
export const isCount: OptionCheck = (value) => (
  typeof value === 'number' && value >= 0 && value % 1 === 0 ? undefined : 'a non-negative integer'
);

/** Целое от `min` до `max` включительно. */
export function integerFrom(min: number, max: number): OptionCheck {
  return (value) => (typeof value === 'number' && value % 1 === 0 && value >= min && value <= max
    ? undefined : 'an integer from ' + min + ' to ' + max);
}

/** Обычный объект. */
export const isObject: OptionCheck = (value) => (
  isPlainObject(value) ? undefined : 'an object'
);

/** Строка или логическое значение (`manifest`, `metrics`). */
export const isBooleanOrString: OptionCheck = (value) => (
  typeof value === 'boolean' || typeof value === 'string' ? undefined : 'a boolean or a string'
);

/** Массив строк. */
export const isStringArray: OptionCheck = (value) => (
  Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? undefined : 'an array of strings'
);

/** Массив функций (`presets`). */
export const isFunctionArray: OptionCheck = (value) => (
  Array.isArray(value) && value.every((item) => typeof item === 'function')
    ? undefined : 'an array of functions'
);

/** Массив пресетов: функций или пресет-объектов (поля объекта проверяет `setPresets`, D-045). */
export const isPresetArray: OptionCheck = (value) => (
  Array.isArray(value) && value.every((item) => typeof item === 'function'
    || Object.prototype.toString.call(item) === '[object Object]')
    ? undefined : 'an array of presets (functions or preset objects)'
);

/** Одно из перечисленных значений: `"log", "silent" or "error"`. */
export function oneOf(...values: unknown[]): OptionCheck {
  const list = values.map((value) => JSON.stringify(value));
  const expected = list.length > 1
    ? list.slice(0, -1).join(LIST_SEPARATOR) + ' or ' + list[list.length - 1]
    : list[0];
  return (value) => (values.indexOf(value) < 0 ? expected : undefined);
}

/**
 * Объект, каждое значение которого — опции по схеме (`entry`): ошибка внутри
 * называет полный путь — `entry.admin.fileName`.
 */
export function optionsOf(schema: OptionSchema): OptionCheck {
  return (
    value, where, path,
  ) => {
    if (!isPlainObject(value)) {
      return 'an object';
    }
    for (const name of Object.keys(value)) {
      checkOptions(
        value[name], schema, where, path + '.' + name,
      );
    }
    return undefined;
  };
}

/** Схема опций провайдера ({@link MnOptions}). */
export const CORE_OPTIONS_SCHEMA: OptionSchema = {
  presets: isPresetArray,
  media: isObject,
  onError: isFunction,
  warningMode: oneOf(
    'log', MODE_SILENT, 'error',
  ),
  onWarning: isFunction,
  maxDepth: isCount,
  maxDepthMode: oneOf(
    MODE_WARN, MODE_SILENT, MODE_STRICT,
  ),
  maxSpecificity: integerFrom(1, MN_MAX_SPECIFICITY),
  maxSpecificityMode: oneOf(MODE_WARN, MODE_STRICT),
  specificityMode: oneOf(
    MODE_WARN, MODE_SILENT, MODE_STRICT,
  ),
  importantMode: oneOf(
    MODE_WARN, MODE_SILENT, MODE_STRICT,
  ),
  childSelectorMode: oneOf(
    MODE_WARN, MODE_SILENT, MODE_STRICT,
  ),
  unknownMediaMode: oneOf(
    MODE_WARN, MODE_SILENT, MODE_STRICT,
  ),
  suspectClassMode: oneOf(
    MODE_WARN, MODE_SILENT, MODE_STRICT,
  ),
  mediaConflictMode: oneOf(
    MODE_WARN, MODE_SILENT, MODE_STRICT,
  ),
  handlerConflictMode: oneOf(
    MODE_WARN, MODE_SILENT, MODE_STRICT,
  ),
  presetConflictMode: oneOf(
    MODE_WARN, MODE_SILENT, MODE_STRICT,
  ),
  groupSuspectMode: oneOf(
    MODE_WARN, MODE_SILENT, MODE_STRICT,
  ),
  groupMode: oneOf('groups', 'css'),
  notationMode: oneOf(
    'context-qualified', 'tw4-compatible', 'breakpoint-prefixed', 'property-value',
  ),
  isolateMode: oneOf(
    'none', 'class', 'where',
  ),
  isolateClass: (value) => (typeof value === 'string' && REGEXP_CLASS_NAME.test(value)
    ? undefined : 'a class name without a dot (e.g. "_l")'),
  altColor: isBoolean,
  contextWhere: isBoolean,
  mediaNesting: isBoolean,
  mediaSyntax: oneOf('range', 'classic'),
};
