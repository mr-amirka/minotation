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

    test('states с несколькими селекторами разворачиваются в несколько ключей AltMap', () => {
      const scp = selectorsCompileProvider();
      scp.states = { big: ['.big', '.huge'] };
      const result = scp.parseClass('w50:big');
      const selectors = Object.keys(result[0][1]);
      expect(selectors).toContain('.w50\\:big.huge');
      expect(selectors).toContain('.w50\\:big.big');
    });
  });

  // Прямые (не через полный mn()-пайплайн, см. wildcard-selectors.test.ts/
  // variant-groups.test.ts/media-advanced.test.ts) юнит-тесты на getParents/
  // getSynonyms — реальные output-строки сверены эмпирически с dist/, не
  // выведены умозрительно.
  describe('getParents — родительский/дочерний контекст (<, >)', () => {
    test('w50<Parent → потомок родителя (пробел-комбинатор)', () => {
      const scp = selectorsCompileProvider();
      const result = scp.parseClass('w50<Parent');
      expect(Object.keys(result[0][1])).toContain('Parent .w50\\<Parent');
    });

    test('w50<Parent<GrandParent → цепочка предков', () => {
      const scp = selectorsCompileProvider();
      const result = scp.parseClass('w50<Parent<GrandParent');
      expect(Object.keys(result[0][1])).toContain('GrandParent Parent .w50\\<Parent\\<GrandParent');
    });

    test('w50>Child → потомок текущего элемента', () => {
      const scp = selectorsCompileProvider();
      const result = scp.parseClass('w50>Child');
      expect(Object.keys(result[0][1])).toContain('.w50\\>Child Child');
    });
  });

  describe('getSynonyms — :state суффикс', () => {
    test('w50:hover без регистрации → литеральный CSS-псевдокласс', () => {
      const scp = selectorsCompileProvider();
      const result = scp.parseClass('w50:hover');
      expect(Object.keys(result[0][1])).toContain('.w50\\:hover:hover');
    });

    test('w50:h → регистрация через mn.synonyms() (_synonyms) разворачивается в :hover', () => {
      // Реальная форма _synonyms из core/index.ts (baseSetSynonyms) — ОДИН
      // кортеж [priority, mediaName] на селектор, НЕ массив кортежей
      // (AltMap-тип объявлен как StrMap<AltEntry[]>, но $$synonyms доступен
      // через `any` и в рантайме содержит именно эту, более узкую форму).
      const scp = selectorsCompileProvider({
        _synonyms: {
          h: {
            ':hover': [0, undefined],
          },
        },
      } as any);
      const result = scp.parseClass('w50:h');
      expect(Object.keys(result[0][1])).toContain('.w50\\:h:hover');
    });
  });

  describe('variant groups (a|b) — разворот в отдельные элементы результата', () => {
    test('w(50|100) → одна запись, две эссенции на общем селекторе', () => {
      const scp = selectorsCompileProvider();
      const result = scp.parseClass('w(50|100)');
      expect(result).toHaveLength(1);
      expect(result[0][0]).toEqual({
        w50: 1,
        w100: 1,
      });
    });

    test('w50:(hover|focus) → variants разворачиваются ДО суффикс-группировки — два отдельных элемента результата', () => {
      const scp = selectorsCompileProvider();
      const result = scp.parseClass('w50:(hover|focus)');
      expect(result).toHaveLength(2);
      const selectors = result.flatMap(([, sels]) => Object.keys(sels));
      expect(selectors).toContain('.w50\\:\\(hover\\|focus\\):hover');
      expect(selectors).toContain('.w50\\:\\(hover\\|focus\\):focus');
    });
  });

  describe('self-class (.WORD) и *N-множитель', () => {
    test('w50.active → self-class добавляется к селектору', () => {
      const scp = selectorsCompileProvider();
      const result = scp.parseClass('w50.active');
      expect(Object.keys(result[0][1])).toContain('.w50\\.active.active');
    });

    test('w50*3 → целевой селектор повторяется 3 раза подряд (буст специфичности)', () => {
      const scp = selectorsCompileProvider();
      const result = scp.parseClass('w50*3');
      expect(Object.keys(result[0][1])).toContain('.w50\\*3.w50\\*3.w50\\*3');
    });
  });

  describe('@media суффикс', () => {
    test('w50@sm → медиа-имя попадает в AltEntry', () => {
      const scp = selectorsCompileProvider();
      const result = scp.parseClass('w50@sm');
      expect(result[0][1]['.w50\\@sm']).toBe('sm');
    });
  });
});
