// @ts-nocheck
/* eslint-disable */
/**
 * Тесты selectorsCompileProvider — парсер MN-комбо-имён.
 */

const { selectorsCompileProvider } = require('../selectorsCompileProvider');

describe('selectorsCompileProvider', () => {
  describe('parseClass', () => {
    let parseClass;

    beforeEach(() => {
      const scp = selectorsCompileProvider();
      parseClass = scp.parseClass;
    });

    test('простой класс w50 → сущность w, селектор .w50', () => {
      const result = parseClass('w50');
      expect(result).toHaveLength(1);
      // Первый элемент: [essences, selectors]
      const [essences, selectors] = result[0];
      expect(typeof essences).toBe('object');
      expect(typeof selectors).toBe('object');
      expect(Object.keys(selectors).length).toBeGreaterThan(0);
    });

    test('cF00 → селектор .cF00', () => {
      const result = parseClass('cF00');
      expect(Object.keys(result[0][1])).toContain('.cF00');
    });

    test('класс с дефисом my-class → .my-class', () => {
      const result = parseClass('my-class');
      expect(Object.keys(result[0][1])).toContain('.my-class');
    });
  });

  describe('parseId', () => {
    let parseId;

    beforeEach(() => {
      const scp = selectorsCompileProvider();
      parseId = scp.parseId;
    });

    test('main → селектор #main', () => {
      const result = parseId('main');
      expect(Object.keys(result[0][1])).toContain('#main');
    });
  });

  describe('parseComboNameProvider', () => {
    test('возвращает парсер для class', () => {
      const scp = selectorsCompileProvider();
      const parser = scp.parseComboNameProvider('class');
      expect(typeof parser).toBe('function');
      const result = parser('w50');
      expect(result.length).toBeGreaterThan(0);
    });

    test('возвращает парсер для id', () => {
      const scp = selectorsCompileProvider();
      const parser = scp.parseComboNameProvider('id');
      expect(typeof parser).toBe('function');
      const result = parser('main');
      expect(result.length).toBeGreaterThan(0);
    });

    test('неизвестный атрибут создаёт парсер на лету', () => {
      const scp = selectorsCompileProvider();
      const parser = scp.parseComboNameProvider('data-mn');
      expect(typeof parser).toBe('function');
    });
  });

  describe('расширение существующего экземпляра', () => {
    test('передача instance расширяет его методами', () => {
      const existing = {};
      const scp = selectorsCompileProvider(existing);
      // existing расширен методами парсинга
      expect(typeof scp.parseClass).toBe('function');
      expect(typeof scp.parseId).toBe('function');
    });
  });

  describe('состояния (states)', () => {
    test('states влияют на разбор суффикса', () => {
      const scp = selectorsCompileProvider();
      scp.states = { big: ['.big'] };
      const result = scp.parseClass('w50:big');
      // Должен найти состояние 'big' и добавить его селектор
      const selectors = result.flatMap(([, sels]) => Object.keys(sels));
      expect(selectors.length).toBeGreaterThan(0);
    });
  });
});
