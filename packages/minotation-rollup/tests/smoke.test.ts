/**
 * Smoke-тесты для minotation-rollup.
 */
import { mnRollup } from '../src/index';

describe('minotation-rollup — smoke', () => {
  test('mnRollup — функция', () => {
    expect(typeof mnRollup).toBe('function');
  });

  test('mnRollup() — возвращает объект с name=minotation', () => {
    const plugin = mnRollup();
    expect(plugin.name).toBe('minotation');
  });

  test('mnRollup() — имеет хуки buildStart/transform/generateBundle', () => {
    const plugin = mnRollup();
    expect(typeof plugin.buildStart).toBe('function');
    expect(typeof plugin.transform).toBe('function');
    expect(typeof plugin.generateBundle).toBe('function');
  });

  test('mnRollup({ attr: "className" }) — принимает опции', () => {
    const plugin = mnRollup({ attr: 'className' });
    expect(plugin.name).toBe('minotation');
  });
});
