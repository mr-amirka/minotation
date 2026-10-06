/**
 * Webpack plugin: компилирует MN-токены в CSS на этапе emit.
 */
import type { Compiler } from 'webpack';
import { Compilation } from 'webpack';
import type { MnOptions, MnWarning } from 'minotation';
import {
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
} from 'minotation';
import type { MnInstance } from 'minotation';
import { getState, collectTokens, MnState } from './state';
import { createTokenCollector } from 'minotation-build';
import type { TokenCollector } from 'minotation-build';

/** Опции {@link MnWebpackPlugin}. */
export interface MnWebpackPluginOptions {
  /** Путь для выходного CSS-файла. @default 'app.css' */
  output?: string;
  /** Глобальный CSS-префикс для всех генерируемых селекторов. */
  selectorPrefix?: string;
  /**
   * Что делать с предупреждениями компиляции. По умолчанию плагин
   * перехватывает их и кладёт в `compilation.warnings` (вместо `console`
   * ядра) — так они попадают в отчёт сборки и в CI. `'silent'` — не выводить
   * вовсе; своя функция вызывается как есть.
   */
  onWarning?: 'silent' | 'console' | ((warning: MnWarning) => void);
  /** Карта именованных медиа-контекстов. */
  media?: Record<string, { query?: string; selector?: string; priority?: number }>;
  /**
   * Дополнительные пресеты.
   * Вызываются поверх стандартного набора (или вместо него, если задан `presets`).
   */
  presets?: Array<(mn: MnInstance) => void>;
  /** Токены, нужные всегда; группы через пробел — как в `minotation-build`. */
  safelist?: string[];
  /**
   * Опции mn-инстанса целиком (`altColor`, `strict`, `maxDepth`, `onError`, …) —
   * как у остальных плагинов. `selectorPrefix`, `media` и `onWarning` верхнего
   * уровня (исторически у webpack) перекрывают одноимённые поля отсюда; перенос
   * их внутрь `mn` ждёт решения владельца — PLAN, D-026, §6 RESEARCH 09.
   */
  mn?: MnOptions;
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

  /** Файлы, стоявшие на учёте в прошлую компиляцию, — чтобы снять исчезнувшие. */
  private _files = new Set<string>();

  /** Накопитель каркаса; создаётся лениво, см. {@link _collector}. */
  private _tokenCollector?: TokenCollector;

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
          const state = getState();
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
    const output = this.options.output || 'app.css';
    const collector = this._collector();
    // Вызов ради побочного действия: `collectTokens` вычищает из стейта записи
    // файлов, которых больше нет на диске. В watch-режиме webpack просто не
    // зовёт лоадер для удалённого файла, и сам стейт о пропаже не узнаёт.
    collectTokens(state);
    // Токены приходят от лоадера через общий стейт: сканирует он, а собирает
    // CSS плагин — между ними только `MnState`. Поэтому `set`, а не `add`.
    const seen = new Set<string>();
    for (const [file, tokens] of state.tokensByFile) {
      seen.add(file);
      collector.set(file, tokens);
    }
    // Файл исчез из стейта (удалён с диска — см. `collectTokens`): снимаем и
    // с учёта, иначе его правила остались бы в CSS до перезапуска сборки.
    for (const file of this._files) {
      seen.has(file) || collector.remove(file);
    }
    this._files = seen;
    for (const [file, preset] of state.dynamicPresets) {
      collector.setPreset(file, preset);
    }

    // Компиляция, кеш по набору токенов и накопление предупреждений — в
    // каркасе (`minotation-build`); повторный вызов без изменений ничего не
    // пересчитывает.
    const css = collector.css();

    for (const warning of collector.takeWarnings()) {
      compilation.warnings.push(
        new compilation.compiler.webpack.WebpackError(
          '[minotation] ' + warning.token + ': ' + warning.message,
        ),
      );
    }

    if (css) {
      compilation.emitAsset(
        output,
        new compilation.compiler.webpack.sources.RawSource(css),
      );
    }
  }

  /** Накопитель заводится при первой компиляции: опции к тому моменту известны. */
  private _collector(): TokenCollector {
    const options = this.options;
    const mn: MnOptions = { ...options.mn };
    options.selectorPrefix === undefined || (mn.selectorPrefix = options.selectorPrefix);
    options.media === undefined || (mn.media = options.media);
    options.onWarning === undefined || (mn.onWarning = options.onWarning);
    return this._tokenCollector || (this._tokenCollector = createTokenCollector({
      presets: options.presets || DEFAULT_PRESETS,
      safelist: options.safelist,
      mn,
    }));
  }
}
