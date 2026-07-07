// @ts-nocheck
/* eslint-disable */
/**
 * Тесты selectorNormalize — нормализация MN-селекторов → CSS.
 */

const { selectorNormalize } = require('../selectorNormalize');

describe('selectorNormalize', () => {
  describe('простой класс', () => {
    test('без спецсимволов — как есть', () => {
      expect(selectorNormalize('myClass')).toBe('myClass');
    });

    test('camelCase остаётся', () => {
      expect(selectorNormalize('camelCase')).toBe('camelCase');
    });

    test('с дефисом', () => {
      expect(selectorNormalize('my-class')).toBe('my-class');
    });
  });

  describe('разворот через !', () => {
    test('Parent!Child → ChildParent', () => {
      expect(selectorNormalize('Parent!Child')).toBe('ChildParent');
    });

    test('два разделителя: A!B!C → CBA', () => {
      expect(selectorNormalize('A!B!C')).toBe('CBA');
    });

    test('экранированный \\! не разворачивает', () => {
      // \\! сохраняется как \\! — splitter не разбирает экранирование в base-режиме
      expect(selectorNormalize('not\\!split')).toBe('not\\!split');
    });
  });

  describe('wildcard-класс .*', () => {
    test('.*active → [class*=active]', () => {
      expect(selectorNormalize('.*active')).toBe('[class*=active]');
    });

    test('camelCase: .*myClass → [class*=myClass]', () => {
      expect(selectorNormalize('.*myClass')).toBe('[class*=myClass]');
    });

    test('с дефисом: .*my-class → [class*=my-class]', () => {
      expect(selectorNormalize('.*my-class')).toBe('[class*=my-class]');
    });

    test('с $: .*my$Class → [class*=my$Class]', () => {
      expect(selectorNormalize('.*my$Class')).toBe('[class*=my$Class]');
    });
  });

  describe('wildcard-id #*', () => {
    test('#*main → [id*=main]', () => {
      expect(selectorNormalize('#*main')).toBe('[id*=main]');
    });

    test('camelCase: #*mainContent → [id*=mainContent]', () => {
      expect(selectorNormalize('#*mainContent')).toBe('[id*=mainContent]');
    });
  });

  describe('комбинированные', () => {
    test('.*active с разворотом: Parent!.*active → [class*=activeParent]', () => {
      // ! разворачивает: active + Parent = activeParent, затем .* → [class*=]
      expect(selectorNormalize('Parent!.*active')).toBe('[class*=activeParent]');
    });

    test('#*main с разворотом: A!#*main → [id*=mainA]', () => {
      // ! разворачивает: main + A = mainA, затем #* → [id*=]
      expect(selectorNormalize('A!#*main')).toBe('[id*=mainA]');
    });

    test('.* и #* вместе: .*active!#*main → [id*=main][class*=active]', () => {
      expect(selectorNormalize('.*active!#*main')).toBe('[id*=main][class*=active]');
    });
  });
});
