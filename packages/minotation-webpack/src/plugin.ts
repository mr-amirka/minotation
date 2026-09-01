/**
 * Webpack plugin: компилирует MN-токены в CSS на этапе emit.
 */
import type { Compiler } from 'webpack';
import { Compilation } from 'webpack';
import {
  minotationProvider,
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
} from 'minotation';
import type { MnInstance } from 'minotation';
import { getState, MnState } from './state';

/** Опции {@link MnWebpackPlugin}. */
export interface MnWebpackPluginOptions {
  /** Путь для выходного CSS-файла. @default 'app.css' */
  output?: string;
  /** Глобальный CSS-префикс для всех генерируемых селекторов. */
  selectorPrefix?: string;
  /** Карта именованных медиа-контекстов. */
  media?: Record<string, { query?: string; selector?: string; priority?: number }>;
  /**
   * Дополнительные пресеты.
   * Вызываются поверх стандартного набора (или вместо него, если задан `presets`).
   */
  presets?: Array<(mn: MnInstance) => void>;
}

const DEFAULT_PRESETS: Array<(mn: MnInstance) => void> = [
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
];

/**
 * Webpack-плагин Minimalist Notation.
 *
 * Собирает все MN-токены, собранные лоадером из исходников,
 * компилирует их в CSS и эмитирует как отдельный asset.
 * Использует кеш по слепку токенов — CSS не пересчитывается, если токены не изменились.
 *
 * @example
 * // webpack.config.js
 * const { MnWebpackPlugin } = require('minotation-webpack');
 * module.exports = {
 *   plugins: [new MnWebpackPlugin({ output: 'dist/app.css' })],
 * };
 */
export class MnWebpackPlugin {
  private options: MnWebpackPluginOptions;

  /** Слепок токенов последней компиляции — для кеширования. */
  private _lastTokenKey = '';

  /** Закешированный CSS-результат последней компиляции. */
  private _cachedCss = '';

  constructor(options: MnWebpackPluginOptions = {}) {
    this.options = options;
  }

  /**
   * Подключает плагин к webpack-компилятору.
   * Регистрируется на хук `processAssets` (стадия `ADDITIONAL`).
   *
   * @param compiler - экземпляр webpack Compiler
   */
  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap('MnWebpackPlugin', (compilation: Compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'MnWebpackPlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          const state = getState(compiler);
          this._emitCss(compilation, state);
        },
      );
    });
  }

  /**
   * Компилирует накопленные токены в CSS и эмитирует asset.
   * Пропускает перекомпиляцию, если набор токенов не изменился.
   *
   * @param compilation - текущий webpack Compilation
   * @param state - shared-стейт с набором токенов от лоадера
   */
  private _emitCss(compilation: Compilation, state: MnState): void {
    const {
      output = 'app.css',
      selectorPrefix,
      media,
    } = this.options;

    // Сортируем токены для стабильного слепка — порядок добавления не важен
    const sorted = Array.from(state.tokens).sort();
    const tokenKey = sorted.join('\0');

    // Кеш: если токены не изменились — повторно используем CSS
    if (tokenKey === this._lastTokenKey && this._cachedCss) {
      compilation.emitAsset(
        output,
        new compilation.compiler.webpack.sources.RawSource(this._cachedCss),
      );
      return;
    }

    const mn = minotationProvider({ selectorPrefix, media });
    const presets = this.options.presets || DEFAULT_PRESETS;
    mn.setPresets([...presets, ...state.dynamicPresets.values()]);

    // §6.3: кешируем compile — без property lookup на каждой итерации.
    // 'class' — все токены компилируются как class-селекторы независимо от того,
    // из какого атрибута (class/className) их извлёк лоадер: это одно и то же
    // DOM-свойство, разница только в JSX-синтаксисе.
    const compile = mn.getCompiler('class');
    for (const token of state.tokens) compile(token);
    mn.compile();

    const css = mn.styles$.getValue()
      .map((s: { content: string }) => s.content)
      .join('\n');

    this._lastTokenKey = tokenKey;
    this._cachedCss = css;

    if (css) {
      compilation.emitAsset(
        output,
        new compilation.compiler.webpack.sources.RawSource(css),
      );
    }
  }
}
