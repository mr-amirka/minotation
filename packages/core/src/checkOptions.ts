/**
 * Проверка объекта опций публичного API (D-038, конвенция
 * `api-input-validation.md`): неизвестный ключ и некорректное значение —
 * ошибка с подсказкой, а не молчаливое игнорирование.
 *
 * Холодный путь: вызывается один раз при создании (провайдер, плагин, конфиг).
 */

/**
 * Проверка значения одной опции: `undefined` — значение подходит, строка —
 * что ожидалось («a boolean», `"log", "silent" or "error"`). `where` и `path`
 * (полное имя опции) — для вложенных проверок ({@link optionsOf}).
 */
export type OptionCheck = (value: unknown, where: string, path: string) => string | undefined;

/** Допустимые опции: имя → проверка значения. */
export type OptionSchema = Record<string, OptionCheck>;

/** Наибольшее расстояние правки, при котором ключ считается опечаткой. */
const MAX_TYPO_DISTANCE = 2;

/** Обычный объект: не массив, не `null`, не RegExp/функция. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

/** Что пришло — для сообщения: `string "p10"`, `number 5`, `array`, `null`. */
export function describeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value instanceof RegExp) {
    return 'RegExp ' + value;
  }
  const type = typeof value;
  if (type === 'string') {
    return 'string ' + JSON.stringify(value);
  }
  return type === 'number' || type === 'boolean' ? type + ' ' + value : type;
}

/** Расстояние Левенштейна — для подсказки «did you mean». */
function distance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  let prev: number[] = [];
  let next: number[];
  let i = 0;
  let j: number;
  for (j = 0; j <= bl; j++) {
    prev[j] = j;
  }
  for (i = 1; i <= al; i++) {
    next = [i];
    for (j = 1; j <= bl; j++) {
      next[j] = Math.min(
        prev[j] + 1,
        next[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = next;
  }
  return prev[bl];
}

/** Ближайший допустимый ключ, если неизвестный похож на опечатку. */
function closest(key: string, names: string[]): string | undefined {
  const lower = key.toLowerCase();
  let best: string | undefined;
  let bestDistance = MAX_TYPO_DISTANCE + 1;
  let d: number;
  for (const name of names) {
    d = distance(lower, name.toLowerCase());
    d < bestDistance && (best = name, bestDistance = d);
  }
  return best;
}

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
  let hint: string | undefined;
  for (const key of Object.keys(options)) {
    check = Object.prototype.hasOwnProperty.call(schema, key) ? schema[key] : undefined;
    if (!check) {
      hint = closest(key, names);
      throw new Error(at + 'unknown option "' + prefix + key + '". ' + (hint
        ? 'Did you mean "' + prefix + hint + '"?'
        : 'Known options: ' + names.join(', ')));
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

/** Логическое значение. */
export const isBoolean: OptionCheck = (value) => (
  typeof value === 'boolean' ? undefined : 'a boolean'
);

/** Строка. */
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

/** Одно из перечисленных значений: `"log", "silent" or "error"`. */
export function oneOf(...values: unknown[]): OptionCheck {
  const list = values.map((value) => JSON.stringify(value));
  const expected = list.length > 1
    ? list.slice(0, -1).join(', ') + ' or ' + list[list.length - 1]
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
  presets: isFunctionArray,
  media: isObject,
  onError: isFunction,
  warningMode: oneOf(
    'log', 'silent', 'error',
  ),
  onWarning: isFunction,
  maxDepth: isCount,
  maxDepthMode: oneOf(
    'warn', 'silent', 'strict',
  ),
  specificityMode: oneOf(
    'warn', 'silent', 'strict',
  ),
  importantMode: oneOf(
    'warn', 'silent', 'strict',
  ),
  selectorPrefix: isString,
  altColor: isBoolean,
};
