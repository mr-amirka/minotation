/**
 * Тесты самого webpack-хука `withMn`: что именно он добавляет в конфиг Next.js
 * и как ведёт себя с уже существующим пользовательским `webpack`-хуком.
 */
import type { Configuration } from 'webpack';
import { MnWebpackPlugin } from 'minotation-webpack';
import { withMn } from '../src/index';

/** Минимальный webpack-конфиг в том виде, в каком его передаёт Next.js. */
function makeConfig(): Configuration {
  return { module: { rules: [] }, plugins: [] };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function callWebpackHook(config: any, nextConfig = {}, mnOptions = {}): any {
  const result = withMn(nextConfig, mnOptions);
  return (result.webpack as any)(config, {} as any);
}

describe('minotation-next — webpack-хук', () => {
  test('добавляет лоадер токенов, preset-лоадер и MnWebpackPlugin', () => {
    const config = makeConfig();
    const out = callWebpackHook(config);

    const rules = out.module.rules as any[];
    expect(rules).toHaveLength(2);
    expect(rules[0].test.source).toBe('\\.(tsx|jsx|html|php)$');
    expect(rules[0].use.loader).toBe('minotation-webpack/dist/loader');
    expect(rules[0].use.options).toEqual({ attrs: ['class', 'className'] });
    expect(rules[1].test.source).toBe('\\.mn\\.(ts|js|tsx)$');
    expect(rules[1].use).toBe('minotation-webpack/dist/preset-loader');

    expect(out.plugins).toHaveLength(1);
    expect(out.plugins[0]).toBeInstanceOf(MnWebpackPlugin);
  });

  test('без своего webpack-хука возвращает тот же config', () => {
    const config = makeConfig();
    expect(callWebpackHook(config)).toBe(config);
  });

  test('существующий webpack-хук пользователя вызывается, его результат возвращается', () => {
    const config = makeConfig();
    const userResult = { marker: 'от пользователя' };
    const userWebpack = jest.fn((cfg: any, ctx: any) => { void cfg; void ctx; return userResult; });
    const context = { isServer: true };

    const result = withMn({ webpack: userWebpack as any });
    const out = (result.webpack as any)(config, context);

    expect(userWebpack).toHaveBeenCalledTimes(1);
    // хук пользователя получает УЖЕ дополненный конфиг и исходный контекст Next.js
    expect(userWebpack.mock.calls[0][0]).toBe(config);
    expect((userWebpack.mock.calls[0][0] as any).plugins[0]).toBeInstanceOf(MnWebpackPlugin);
    expect(userWebpack.mock.calls[0][1]).toBe(context);
    expect(out).toBe(userResult);
  });

  test('конфиг без module/plugins не ломает хук', () => {
    const out = callWebpackHook({});
    expect(out).toEqual({});
  });

  test('withMn() без аргументов: дефолтные nextConfig и опции', () => {
    const config = makeConfig();
    const result = withMn();
    const out = (result.webpack as any)(config, {} as any);

    expect(out.plugins[0]).toBeInstanceOf(MnWebpackPlugin);
  });

  test('кастомные опции доходят до MnWebpackPlugin', () => {
    const config = makeConfig();
    callWebpackHook(config, {}, { output: 'custom/mn.css', selectorPrefix: 'mn-' });

    const plugin = (config.plugins as any[])[0] as { options: Record<string, unknown> };
    expect(plugin.options).toMatchObject({
      enabled: true,
      output: 'custom/mn.css',
      selectorPrefix: 'mn-',
    });
  });
});
