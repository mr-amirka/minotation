/**
 * Next.js интеграция для Minimalist Notation.
 *
 * **Важно:** работает только с webpack-бандлером Next.js. Проверено эмпирически
 * (`next build --help` + реальная сборка, Next.js 15.5.19) — `next build`/
 * `next dev` БЕЗ флагов уже используют webpack, `--turbopack` — opt-in
 * пользователя, не умолчание; никакого `--webpack`-флага в CLI не существует.
 * Просто не включайте `--turbopack`/`--turbo`.
 *
 * Использование (next.config.js):
 *   const { withMn } = require('minotation-next');
 *
 *   module.exports = withMn({}, {
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
  /**
   * Атрибуты, в значениях которых ищутся токены.
   * @default ['class', 'className']
   */
  attrs?: string[];
  /**
   * Суффиксы имён переменных со списком токенов (`const thClass = 'py12'`).
   * Пустой массив отключает механизм. @default ['Class']
   */
  classVarSuffixes?: string[];
  /**
   * Имена функций слияния, чьи строковые аргументы сканируются.
   * Пустой массив отключает механизм. @default ['mne', 'mnClass']
   */
  mergeFnNames?: string[];
  /**
   * Разбирать ли `.js/.jsx/.ts/.tsx` парсером вместо текстового поиска.
   * По умолчанию автоматически: есть `typescript` — разбором, нет — текстом.
   * `false` выключает разбор, `true` требует его явно.
   */
  syntax?: boolean;
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
          // Опции сканера прокидываются из `mnOptions`, а не задаются здесь:
          // пока они были прописаны в этом месте, ни `classVarSuffixes`, ни
          // `mergeFnNames` до лоадера не доходили вовсе.
          options: {
            attrs: opts.attrs || ['class', 'className'],
            classVarSuffixes: opts.classVarSuffixes,
            mergeFnNames: opts.mergeFnNames,
            syntax: opts.syntax,
          },
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
