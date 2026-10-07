/**
 * Next.js интеграция для Minimalist Notation.
 *
 * **Важно:** работает только с webpack-бандлером Next.js. Проверено эмпирически
 * (`next build --help` + реальная сборка, Next.js 15.5.19) — `next build`/
 * `next dev` БЕЗ флагов уже используют webpack, `--turbopack` — opt-in
 * пользователя, не умолчание; никакого `--webpack`-флага в CLI не существует.
 * Просто не включайте `--turbopack`/`--turbo`.
 *
 * Использование:
 *   // next.config.js
 *   const { withMn } = require('minotation-next');
 *   module.exports = withMn({});
 *
 *   // app/layout.tsx — CSS идёт конвейером Next.js: файл с хешем, ссылка в <head>
 *   import 'minotation-next/mn.css';
 */
import type { NextConfig } from 'next';
import type { Configuration } from 'webpack';
import { isBoolean } from 'minotation';
import { MnWebpackPlugin, checkBuildOptions } from 'minotation-webpack';
import type { MnWebpackPluginOptions } from 'minotation-webpack';

/**
 * Опции {@link withMn} — опции {@link MnWebpackPlugin} (эталонный набор
 * `minotation-build`, D-026) и `enabled`.
 *
 * `attrs` по умолчанию `'class, className:class'`: в React `className` — класс.
 */
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
  attrs: 'class, className:class',
  // Без импорта `minotation-next/mn.css` — файл рядом с остальной статикой Next.
  fileName: 'static/[name].css',
};

/**
 * Лоадеры — абсолютными путями: строку `minotation-webpack/...` разрешало бы
 * приложение, а при строгих зависимостях (pnpm) оно видит только `minotation-next`.
 */
const TOKEN_LOADER = require.resolve('minotation-webpack/dist/loader');
const PRESET_LOADER = require.resolve('minotation-webpack/dist/preset-loader');

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
 * export default withMn({});
 * // app/layout.tsx
 * import 'minotation-next/mn.css';
 */
export function withMn(
  nextConfig: NextConfig = {},
  mnOptions: MnNextOptions = {},
): NextConfig {
  checkBuildOptions(mnOptions, 'withMn', {
    enabled: isBoolean,
  });
  const opts = { ...DEFAULT_OPTIONS, ...mnOptions };

  if (!opts.enabled) return nextConfig;

  const originalWebpack = nextConfig.webpack;

  return {
    ...nextConfig,
    webpack(config: Configuration, context: any) {
      // Токен-лоадер добирает модули вне корня скана (плагин сканирует проект
      // сам); что и как сканировать — в опциях плагина.
      config.module?.rules?.push({
        test: /\.(tsx|jsx|html|php)$/,
        use: TOKEN_LOADER,
      });

      // Preset-лоадер для динамических пресетов (import './app.mn')
      config.module?.rules?.push({
        test: /\.mn\.(ts|js|tsx)$/,
        use: PRESET_LOADER,
      });

      // Плагин: скан проекта, CSS модулем `minotation-next/mn.css` или ассетом.
      const { enabled: _enabled, ...pluginOptions } = opts;
      void _enabled;
      config.plugins?.push(new MnWebpackPlugin(pluginOptions));

      if (typeof originalWebpack === 'function') {
        return originalWebpack(config, context);
      }

      return config;
    },
  };
}
