/**
 * Smoke-тесты для minotation-rollup.
 */
import { mnRollup } from '../src/index';
import { presetHints, presetStandard, presetSynonyms, presetMedias, presetMain } from 'minotation';

/** Набор, который раньше подключался по умолчанию; теперь пресеты — только явно (D-110). */
const PRESETS = [presetHints, presetStandard, presetSynonyms, presetMedias, presetMain];

describe('minotation-rollup — smoke', () => {
  test('mnRollup — функция', () => {
    expect(typeof mnRollup).toBe('function');
  });

  test('mnRollup() — возвращает объект с name=minotation', () => {
    const plugin = mnRollup({ presets: PRESETS });
    expect(plugin.name).toBe('minotation');
  });

  test('mnRollup() — имеет хуки buildStart/transform/generateBundle', () => {
    const plugin = mnRollup({ presets: PRESETS });
    expect(typeof plugin.buildStart).toBe('function');
    expect(typeof plugin.transform).toBe('function');
    expect(typeof plugin.generateBundle).toBe('function');
  });

  test('mnRollup({ attrs: "className:class" }) — принимает опции', () => {
    const plugin = mnRollup({ presets: PRESETS, attrs: 'className:class' });
    expect(plugin.name).toBe('minotation');
  });
});

describe('mnRollup — проверка опций (D-038)', () => {
  test('опечатка и неверное значение — ошибка с подсказкой', () => {
    expect(() => mnRollup({ fileNmae: 'a.css' } as never))
      .toThrow('[minotation] mnRollup: unknown option "fileNmae". Did you mean "fileName"?');
    expect(() => mnRollup({ attrs: 5 } as never))
      .toThrow('[minotation] mnRollup: option "attrs" expects');
  });
});
