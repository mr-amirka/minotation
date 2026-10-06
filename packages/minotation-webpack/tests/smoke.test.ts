/**
 * Smoke-тесты для minotation-webpack.
 *
 * Проверяют, что MnWebpackPlugin и loader экспортируются корректно.
 */

import { MN_CSS_REQUEST, MnWebpackPlugin, loader } from '../src/index';

describe('minotation-webpack — smoke', () => {
  test('MnWebpackPlugin — класс', () => {
    expect(typeof MnWebpackPlugin).toBe('function');
  });

  test('MnWebpackPlugin — инстанцируется', () => {
    const plugin = new MnWebpackPlugin({ fileName: 'test.css' });
    expect(plugin).toHaveProperty('apply');
    expect(typeof plugin.apply).toBe('function');
  });

  test('MnWebpackPlugin — с дефолтными опциями', () => {
    const plugin = new MnWebpackPlugin({});
    expect(plugin).toBeDefined();
  });

  test('loader — функция', () => {
    expect(typeof loader).toBe('function');
  });



  test('модуль CSS — minotation-webpack/mn.css', () => {
    expect(MN_CSS_REQUEST).toBe('minotation-webpack/mn.css');
  });
});
