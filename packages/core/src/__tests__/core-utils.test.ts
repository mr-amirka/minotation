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
  normalizeSelectors, normalizeComboNames, REGEXP_INVALID_CSS_VALUE,
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
