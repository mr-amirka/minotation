// @ts-nocheck
/* eslint-disable */
/**
 * Тесты isInvalidSelector — валидация CSS-селекторов.
 */

const { isInvalidSelector } = require('../isInvalidSelector');

describe('isInvalidSelector', () => {
  describe('валидные селекторы', () => {
    test('.myClass', () => {
      expect(isInvalidSelector('.myClass')).toBe(false);
    });

    test('.camelCase', () => {
      expect(isInvalidSelector('.camelCase')).toBe(false);
    });

    test('.my-class', () => {
      expect(isInvalidSelector('.my-class')).toBe(false);
    });

    test('.my_class', () => {
      expect(isInvalidSelector('.my_class')).toBe(false);
    });

    test('.my\\+class (экранированный +)', () => {
      // \\+ — экранированный плюс, удаляется перед проверкой
      expect(isInvalidSelector('.my\\+class')).toBe(false);
    });
  });

  describe('невалидные селекторы', () => {
    test('.[myClass] — квадратные скобки сразу после точки', () => {
      expect(isInvalidSelector('.[myClass]')).toBe(true);
    });

    test('.0leading — цифра сразу после точки', () => {
      expect(isInvalidSelector('.0leading')).toBe(true);
    });

    test('пустая строка', () => {
      expect(isInvalidSelector('')).toBe(false);
    });
  });

  describe('закавыченные строки игнорируются', () => {
    test('"invalid[chars]" внутри кавычек', () => {
      expect(isInvalidSelector('."invalid[chars]"')).toBe(false);
    });

    test("\"invalid'chars\" с одинарными внутри двойных", () => {
      expect(isInvalidSelector(".\"invalid'chars\"")).toBe(false);
    });
  });
});
