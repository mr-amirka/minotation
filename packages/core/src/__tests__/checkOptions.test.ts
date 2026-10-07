/**
 * Проверка опций публичного API (D-038): неизвестный ключ и некорректное
 * значение — ошибка с подсказкой.
 */
import {
  checkOptions, describeValue, isBoolean, isBooleanOrString, isCount, isFunction,
  isFunctionArray, isObject, isString, isStringArray, oneOf, optionsOf,
} from '../checkOptions';
import minotationProvider from '../core/index';
import {
  createScanner,
} from '../scanner';

const schema = {
  attrs: isString,
  altColor: isBoolean,
  entry: optionsOf({
    fileName: isString,
  }),
};

describe('checkOptions — ключи', () => {
  test('неизвестный ключ, похожий на допустимый — «did you mean»', () => {
    expect(() => checkOptions(
      {
        atrs: 'class', 
      }, schema, 'mnVite',
    ))
      .toThrow('[minotation] mnVite: unknown option "atrs". Did you mean "attrs"?');
  });

  test('регистр не мешает подсказке', () => {
    expect(() => checkOptions(
      {
        AltColor: true, 
      }, schema, 'mnVite',
    ))
      .toThrow('Did you mean "altColor"?');
  });

  test('неизвестный ключ без похожих — список допустимых', () => {
    expect(() => checkOptions(
      {
        mn: {
          strict: true, 
        }, 
      }, schema, 'mnVite',
    ))
      .toThrow('[minotation] mnVite: unknown option "mn". Known options: attrs, altColor, entry');
  });

  test('ключ из прототипа объекта — не опция', () => {
    expect(() => checkOptions(
      {
        toString: 'x', 
      }, schema, 'mnVite',
    ))
      .toThrow('unknown option "toString"');
  });

  test('undefined вместо опций и в значениях — то же, что отсутствие', () => {
    expect(() => checkOptions(
      undefined, schema, 'mnVite',
    )).not.toThrow();
    expect(() => checkOptions(
      {
        attrs: undefined, 
      }, schema, 'mnVite',
    )).not.toThrow();
    expect(() => checkOptions(
      {}, schema, 'mnVite',
    )).not.toThrow();
  });

  test('не объект вместо опций', () => {
    expect(() => checkOptions(
      'class', schema, 'mnVite',
    ))
      .toThrow('[minotation] mnVite: options expect an object, got string "class"');
    expect(() => checkOptions(
      [], schema, 'mnVite',
    ))
      .toThrow('options expect an object, got array');
  });
});

describe('checkOptions — значения', () => {
  test('ошибка называет опцию, ожидание и полученное', () => {
    expect(() => checkOptions(
      {
        altColor: 'off', 
      }, schema, 'minotationProvider',
    ))
      .toThrow('[minotation] minotationProvider: option "altColor" expects a boolean, got string "off"');
  });

  test('вложенные опции — полный путь', () => {
    expect(() => checkOptions(
      {
        entry: {
          admin: {
            fileNmae: 'a.css', 
          }, 
        }, 
      }, schema, 'mnGulp',
    ))
      .toThrow('[minotation] mnGulp: unknown option "entry.admin.fileNmae". Did you mean "entry.admin.fileName"?');
    expect(() => checkOptions(
      {
        entry: {
          admin: {
            fileName: 1, 
          }, 
        }, 
      }, schema, 'mnGulp',
    ))
      .toThrow('option "entry.admin.fileName" expects a string, got number 1');
    expect(() => checkOptions(
      {
        entry: {
          admin: 'a.css', 
        }, 
      }, schema, 'mnGulp',
    ))
      .toThrow('option "entry.admin" expects an object, got string "a.css"');
    expect(() => checkOptions(
      {
        entry: [], 
      }, schema, 'mnGulp',
    ))
      .toThrow('option "entry" expects an object, got array');
    expect(() => checkOptions(
      {
        entry: {
          admin: {
            fileName: 'a.css', 
          }, 
        }, 
      }, schema, 'mnGulp',
    ))
      .not.toThrow();
  });

  test.each([
    [
      isBoolean,
      true,
      1,
      'a boolean',
    ],
    [
      isString,
      '',
      null,
      'a string',
    ],
    [
      isFunction,
      () => 0,
      {},
      'a function',
    ],
    [
      isCount,
      0,
      -1,
      'a non-negative integer',
    ],
    [
      isCount,
      3,
      1.5,
      'a non-negative integer',
    ],
    [
      isCount,
      3,
      '3',
      'a non-negative integer',
    ],
    [
      isObject,
      {},
      [],
      'an object',
    ],
    [
      isBooleanOrString,
      'a.json',
      1,
      'a boolean or a string',
    ],
    [
      isBooleanOrString,
      false,
      null,
      'a boolean or a string',
    ],
    [
      isStringArray,
      ['p10'],
      'p10',
      'an array of strings',
    ],
    [
      isStringArray,
      [],
      [1],
      'an array of strings',
    ],
    [
      isFunctionArray,
      [() => 0],
      ['x'],
      'an array of functions',
    ],
    [
      isFunctionArray,
      [],
      'x',
      'an array of functions',
    ],
  ])('%p: подходит и не подходит', (
    check, good, bad, expected,
  ) => {
    expect(check(
      good, 'x', 'y',
    )).toBeUndefined();
    expect(check(
      bad, 'x', 'y',
    )).toBe(expected);
  });

  test('oneOf — перечисление значений', () => {
    expect(oneOf(
      'log', 'silent', 'error',
    )(
      'strict', 'x', 'y',
    )).toBe('"log", "silent" or "error"');
    expect(oneOf(
      'inline', 'link', false,
    )(
      'none', 'x', 'y',
    )).toBe('"inline", "link" or false');
    expect(oneOf('a')(
      'b', 'x', 'y',
    )).toBe('"a"');
    expect(oneOf('log', 'silent')(
      'log', 'x', 'y',
    )).toBeUndefined();
  });

  test.each([
    [null, 'null'],
    [[1], 'array'],
    [/x/i, 'RegExp /x/i'],
    ['p10', 'string "p10"'],
    [5, 'number 5'],
    [false, 'boolean false'],
    [() => 0, 'function'],
    [{}, 'object'],
    [undefined, 'undefined'],
  ])('describeValue(%p) → %p', (value, text) => {
    expect(describeValue(value)).toBe(text);
  });
});

describe('точки входа ядра', () => {
  test('minotationProvider', () => {
    expect(() => minotationProvider({
      warningMode: 'strict', 
    } as never))
      .toThrow('[minotation] minotationProvider: option "warningMode" expects "log", "silent" or "error", got string "strict"');
    expect(() => minotationProvider({
      strict: true, 
    } as never))
      .toThrow('[minotation] minotationProvider: unknown option "strict". Known options: presets,');
    expect(() => minotationProvider({
      maxDepthMode: 'block',
      maxDepth: 3, 
    })).not.toThrow();
  });

  test('mn.setOptions', () => {
    const mn = minotationProvider();
    expect(() => mn.setOptions({
      selectorPrefx: '.app', 
    } as never))
      .toThrow('[minotation] mn.setOptions: unknown option "selectorPrefx". Did you mean "selectorPrefix"?');
  });

  test('createScanner', () => {
    expect(() => createScanner({
      attrs: 'class', 
    } as never))
      .toThrow('[minotation] createScanner: unknown option "attrs". Did you mean "attr"?');
    expect(() => createScanner({
      attr: 1, 
    } as never))
      .toThrow('option "attr" expects a string or an array of strings, got number 1');
    expect(() => createScanner({
      attr: ['class', 'className'],
      syntax: false, 
    })).not.toThrow();
    expect(() => createScanner({
      attr: 'class', 
    })).not.toThrow();
  });
});
