/**
 * Smoke-тесты для minotation-webpack.
 *
 * Проверяют, что MnWebpackPlugin и loader экспортируются корректно.
 */

import { MnWebpackPlugin, loader } from '../src/index';

describe('minotation-webpack — smoke', () => {
  test('MnWebpackPlugin — класс', () => {
    expect(typeof MnWebpackPlugin).toBe('function');
  });

  test('MnWebpackPlugin — инстанцируется', () => {
    const plugin = new MnWebpackPlugin({ output: 'test.css' });
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

  test('MnWebpackPlugin.apply — не падает с минимальным compiler', () => {
    const plugin = new MnWebpackPlugin({ output: 'test.css' });
    const mockCompiler = {
      hooks: {
        thisCompilation: { tap: jest.fn() },
        emit: { tapAsync: jest.fn() },
        done: { tap: jest.fn() },
      },
    };
    expect(() => plugin.apply(mockCompiler as any)).not.toThrow();
  });
});
