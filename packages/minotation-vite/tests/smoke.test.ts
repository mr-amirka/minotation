/**
 * Smoke-тесты для minotation-vite.
 */

import { mnVite } from '../src/index';

describe('minotation-vite — smoke', () => {
  test('mnVite — функция', () => {
    expect(typeof mnVite).toBe('function');
  });

  test('mnVite() — возвращает объект с name=minotation', () => {
    const plugin: any = mnVite();
    expect(plugin.name).toBe('minotation');
  });

  test('mnVite() — имеет хук transform', () => {
    const plugin: any = mnVite();
    expect(typeof plugin.transform).toBe('function');
  });

  test('mnVite() — имеет хук handleHotUpdate', () => {
    const plugin: any = mnVite();
    expect(typeof plugin.handleHotUpdate).toBe('function');
  });

  test('mnVite() — имеет хук buildStart (подстраховка для сборщиков без transformIndexHtml, напр. Astro)', () => {
    const plugin: any = mnVite();
    expect(typeof plugin.buildStart).toBe('function');
  });

  test('mnVite({ attr: "className" }) — принимает опции', () => {
    const plugin: any = mnVite({ attr: 'className' });
    expect(plugin.name).toBe('minotation');
  });
});
