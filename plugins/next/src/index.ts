/**
 * Next.js интеграция для Minimalist Notation.
 *
 * **Важно:** работает только с webpack-режимом Next.js.
 * Для Turbopack (по умолчанию в Next.js 15+) — нужен флаг `--webpack`
 * или `experimental.turbo: false` в next.config.
 *
 * Использование (next.config.ts):
 *   import { withMn } from 'minotation-next';
 *
 *   export default withMn({
 *     experimental: { turbo: false },  // отключаем Turbopack
 *   }, {
 *     output: 'static/mn.css',
 *   });
 */
import type { NextConfig } from 'next';
import type { Configuration } from 'webpack';
import { MnWebpackPlugin } from 'minotation-webpack';
import type { MnWebpackPluginOptions } from 'minotation-webpack';

/** Опции {@link withMn}. Расширяет {@link MnWebpackPluginOptions}. */
export interface MnNextOptions extends MnWebpackPluginOptions {
  /**
   * Включить или выключить MN-плагин.
   * Удобно для conditional disable через переменную окружения.
   * @default true
   */
  enabled?: boolean;
}

const DEFAULT_OPTIONS: MnNextOptions = {
  enabled: true,
  output: 'static/mn.css',
};

/**
 * HOC-обёртка над `next.config` — подключает webpack-лоадер и плагин MN.
 *
 * @param nextConfig - исходный Next.js конфиг
 * @param mnOptions - опции MN-плагина {@link MnNextOptions}
 * @returns расширенный Next.js конфиг
 *
 * @example
 * // next.config.ts
 * import { withMn } from 'minotation-next';
 * export default withMn({}, { output: 'static/mn.css' });
 */
export function withMn(
  nextConfig: NextConfig = {},
  mnOptions: MnNextOptions = {},
): NextConfig {
  const opts = { ...DEFAULT_OPTIONS, ...mnOptions };

  if (!opts.enabled) return nextConfig;

  const originalWebpack = nextConfig.webpack;

  return {
    ...nextConfig,
    webpack(config: Configuration, context: any) {
      // Лоадер для извлечения MN-токенов из исходников
      config.module?.rules?.push({
        test: /\.(tsx|jsx|html|php)$/,
        use: {
          loader: 'minotation-webpack/dist/loader',
          options: { attrs: ['class', 'className'] },
        },
      });

      // Preset-лоадер для динамических пресетов (import './app.mn')
      config.module?.rules?.push({
        test: /\.mn\.(ts|js|tsx)$/,
        use: 'minotation-webpack/dist/preset-loader',
      });

      // Плагин для компиляции CSS
      config.plugins?.push(new MnWebpackPlugin(opts));

      if (typeof originalWebpack === 'function') {
        return originalWebpack(config, context);
      }

      return config;
    },
  };
}
