// @ts-nocheck
/* eslint-disable */
/**
 * Регресс: normalizeSelectors/normalizeComboNames корёжили строки с `.`/`[...]`.
 *
 * fundamentool.flags трактует точку и квадратные скобки как путь для
 * вложенного set (например, flags(['a.b']) → {a: {b: 1}}) — это ломает
 * CSS-селекторы (`[type=button]`, `.foo`, `abbr[title]`) и имена эссенций
 * с десятичной точкой (`f1.5em`), которые должны оставаться плоскими
 * непрозрачными строковыми ключами. См. CHANGELOG.
 */

import {
  asError, normalizeSelectors, normalizeComboNames, observableProvider, REGEXP_INVALID_CSS_VALUE,
} from '../core/utils';

describe('normalizeSelectors', () => {
  test('атрибутный селектор с группой-альтернативой не теряется', () => {
    expect(normalizeSelectors('[type=(button|reset|submit)]')).toEqual({
      '[type=button]': 1,
      '[type=reset]': 1,
      '[type=submit]': 1,
    });
  });

  test('селектор-список с атрибутной группой — все части сохраняются', () => {
    expect(normalizeSelectors('button, [type=(button|reset|submit)]')).toEqual({
      button: 1,
      '[type=button]': 1,
      '[type=reset]': 1,
      '[type=submit]': 1,
    });
  });

  test('атрибутный селектор без группы (abbr[title]) остаётся плоским ключом', () => {
    expect(normalizeSelectors('abbr[title]')).toEqual({ 'abbr[title]': 1 });
  });

  test('классовый селектор (.foo) остаётся плоским ключом', () => {
    expect(normalizeSelectors('.myClass')).toEqual({ '.myClass': 1 });
  });
});

describe('normalizeComboNames', () => {
  test('имя эссенции с десятичной точкой (f1.5em) остаётся плоским ключом', () => {
    expect(normalizeComboNames('f1.5em')).toEqual({ 'f1.5em': 1 });
  });

  test('несколько имён через пробел', () => {
    expect(normalizeComboNames('bxzBB lh115%')).toEqual({
      bxzBB: 1,
      'lh115%': 1,
    });
  });
});

describe('observableProvider', () => {
  test('регресс: unsubscribe() реально снимает подписку (раньше callback обнулялся до removeOf, удалялся 0, а не сам callback)', () => {
    const obs = observableProvider(0);
    let calls = 0;
    const unsubscribe = obs.on(() => {
      calls++;
    });
    obs.emit(1);
    expect(calls).toBe(1);
    unsubscribe();
    obs.emit(2);
    expect(calls).toBe(1);
  });

  test('повторный вызов unsubscribe() безопасен (не падает, не снимает чужую подписку)', () => {
    const obs = observableProvider(0);
    let calls = 0;
    const unsubscribe = obs.on(() => {
      calls++;
    });
    unsubscribe();
    unsubscribe();
    obs.emit(1);
    expect(calls).toBe(0);
  });

  test('getValue() возвращает последнее значение', () => {
    const obs = observableProvider('a');
    expect(obs.getValue()).toBe('a');
    obs.emit('b');
    expect(obs.getValue()).toBe('b');
  });
});

/**
 * Приведение перехваченного к `Error`. Нужно потому, что `catch` даёт
 * `unknown`: бросить в JS можно что угодно, и до строгого режима в `error$`
 * могла уехать строка или объект без `message` — подписчик получал бы
 * `undefined` вместо текста ошибки.
 */
describe('asError', () => {
  test('настоящая ошибка возвращается как есть — без потери стека', () => {
    const original = new TypeError('сломалось');
    expect(asError(original)).toBe(original);
  });

  test('строка становится сообщением', () => {
    const error = asError('просто строка');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('просто строка');
  });

  test.each([
    [42, '42'],
    [null, 'null'],
    [undefined, 'undefined'],
    [{
      a: 1,
    }, '[object Object]'],
  ])('%p описывается как %p', (value, expected) => {
    expect(asError(value).message).toBe(expected);
  });
});

describe('REGEXP_INVALID_CSS_VALUE — эвристика битого значения', () => {
  test.each([
    '0px 0px Rpx 3px #000',
    'NaNpx',
    'undefined',
    'calc(Rem + 1px)',
  ])('%p — битое', (value) => {
    expect(REGEXP_INVALID_CSS_VALUE.test(value)).toBe(true);
  });

  // Буквы в токене заглавные (D-113), имя в CSS — строчное: `it` + `em` не утечка буквы (D-124, cntCounter_item).
  test.each([
    'counter(item)',
    'item 1s',
    'stem',
    'attr(poem)',
    '10px 2em',
  ])('%p — не битое', (value) => {
    expect(REGEXP_INVALID_CSS_VALUE.test(value)).toBe(false);
  });
});
