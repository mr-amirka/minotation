/**
 * Smoke-тесты для minotation-next.
 *
 * Проверяют, что withMn() экспортируется, возвращает валидный конфиг Next.js.
 */

import { withMn } from '../src/index';

describe('minotation-next — smoke', () => {
  test('withMn — функция', () => {
    expect(typeof withMn).toBe('function');
  });

  test('withMn({}) — возвращает конфиг с webpack', () => {
    const config = withMn({});
    expect(config).toHaveProperty('webpack');
    expect(typeof config.webpack).toBe('function');
  });

  test('withMn — с кастомными опциями', () => {
    const config = withMn(
      { reactStrictMode: true },
      { output: 'custom/mn.css', selectorPrefix: 'mn-' },
    );
    expect(config).toHaveProperty('webpack');
    expect(config.reactStrictMode).toBe(true);
  });

  test('withMn — enabled: false пропускает webpack', () => {
    const config = withMn({}, { enabled: false });
    // Когда enabled=false, webpack НЕ добавляется
    expect(config).not.toHaveProperty('webpack');
  });
});
