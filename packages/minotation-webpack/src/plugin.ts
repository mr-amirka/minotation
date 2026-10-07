/**
 * Webpack plugin: сканирует проект, компилирует MN-токены в CSS и отдаёт его
 * сборке — модулем `minotation-webpack/mn.css` или ассетом.
 */
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import type { Compiler } from 'webpack';
import { Compilation } from 'webpack';
import {
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
} from 'minotation';
import type { MnInstance } from 'minotation';
import {
  createBuildCollector, createFileFilter, formatFileName, manifestFileName, manifestOf, walkFiles,
} from 'minotation-build';
import type { MnBuildOptions } from 'minotation-build';
import { evalPreset } from './preset-loader';
import { getState } from './state';
import type { MnPluginHandle } from './state';

/**
 * Опции {@link MnWebpackPlugin} — эталонный набор `minotation-build` (D-026):
 * `attrs`, `root`, `extensions`, `include`, `exclude`, `skipPartials`, `presets`,
 * `presetExtensions`, `safelist`, `classVarSuffixes`, `mergeFnNames`, `syntax`,
 * поля ядра (`selectorPrefix`, `altColor`, `strict`, `media`, `maxDepth`, `onWarning`,
 * `onError` — плоско, D-034), `entry`, `fileName`, `manifest`. Описание каждой — в
 * README `minotation-build`.
 *
 * `root` по умолчанию — `src/` проекта, если он есть, иначе корень проекта
 * (`context` webpack).
 */
export type MnWebpackPluginOptions = MnBuildOptions;

/** Модуль с CSS — импортируется в точке входа или корневом layout. */
export const MN_CSS_REQUEST = 'minotation-webpack/mn.css';
/** Заглушки `mn.css` этого пакета и `minotation-next`: содержимое даёт CSS-лоадер. */
const REGEXP_MN_CSS = /[\\/]minotation-(?:webpack|next)[\\/]mn\.css$/;

const DEFAULT_PRESETS: Array<(mn: MnInstance) => void> = [
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
];

/** Номер следующего плагина в общем реестре. */
let nextId = 0;

/**
 * Webpack-плагин Minimalist Notation.
 *
 * Перед каждой сборкой сканирует проект (в watch — только изменённые файлы),
 * поэтому CSS полный к моменту, когда сборке понадобится модуль `mn.css`.
 * Дальше два пути (D-031):
 *
 * - **Импорт `minotation-webpack/mn.css`** (Next.js — `minotation-next/mn.css`)
 *   в точке входа или layout: CSS ведёт штатный конвейер проекта — имя с хешем,
 *   ссылка в HTML, минификация. Отдельного ассета плагин не выдаёт.
 * - **Без импорта** — ассет по `fileName`. По умолчанию с хешем, если хеш есть
 *   в `output.filename` проекта, иначе `[name].css`. Ассет привязывается к чанкам
 *   точек входа — `HtmlWebpackPlugin` сошлётся на него сам. Рядом манифест.
 *
 * @example
 * // webpack.config.js
 * const { MnWebpackPlugin } = require('minotation-webpack');
 * module.exports = {
 *   plugins: [new MnWebpackPlugin({ attrs: 'class, className:class' })],
 * };
 * // src/index.js
 * import 'minotation-webpack/mn.css';
 */
export class MnWebpackPlugin {
  private options: MnWebpackPluginOptions;

  /** Номер в общем реестре — по нему токен- и preset-лоадер находят плагины процесса. */
  private readonly id = nextId++;

  /** Связь с лоадерами; заводится в `apply`, когда известен корень. */
  private handle?: MnPluginHandle;

  constructor(options: MnWebpackPluginOptions = {}) {
    // Конфиги на JS типов не видят: старое имя опции иначе потерялось бы молча.
    'output' in options && throwRenamed('output', 'fileName');
    this.options = options;
  }

  /**
   * Подключает плагин к webpack-компилятору: регистрирует правило для `mn.css`,
   * скан проекта перед сборкой и выдачу ассета на `processAssets`.
   *
   * @param compiler - экземпляр webpack Compiler
   */
  apply(compiler: Compiler): void {
    const options = this.options;
    const context = compiler.context;
    const root = options.root || (existsSync(join(context, 'src')) ? join(context, 'src') : context);
    const handle: MnPluginHandle = this.handle = {
      build: createBuildCollector({
        ...options,
        presets: options.presets || DEFAULT_PRESETS,
      }, root),
      files: createFileFilter(options, root),
      root,
      imported: false,
    };
    getState().plugins.set(this.id, handle);

    compiler.options.module.rules.push({
      test: REGEXP_MN_CSS,
      enforce: 'pre',
      use: [{
        loader: require.resolve('./css-loader'),
        options: { handle },
      }],
    });

    let scanned = false;
    const scanAll = (): void => {
      handle.build.clear();
      const walkExts = options.include ? [''] : handle.files.extensions;
      for (const file of walkFiles(root, handle.files.presetExtensions)) {
        this.loadPreset(file);
      }
      for (const file of walkFiles(root, walkExts)) {
        handle.files.accepts(file) && this.loadFile(file);
      }
      scanned = true;
    };
    compiler.hooks.beforeRun.tap('MnWebpackPlugin', scanAll);
    compiler.hooks.watchRun.tap('MnWebpackPlugin', (watching: Compiler) => {
      if (!scanned) {
        scanAll();
        return;
      }
      // Токены должны быть свежими ДО компиляции — модуль `mn.css` может
      // собраться раньше изменённого файла. Корень скана — зависимость-каталог,
      // и о правке внутри него webpack сообщает самим каталогом, без имени
      // файла: тогда сканируем корень заново. Файлы графа импортов приходят
      // поимённо — их пересканируем точечно.
      for (const file of watching.modifiedFiles || []) {
        if (isDirectory(file)) {
          scanAll();
          return;
        }
        if (handle.files.isPreset(file)) {
          this.loadPreset(file);
        } else if (handle.files.accepts(file)) {
          this.loadFile(file);
        }
      }
      for (const file of watching.removedFiles || []) {
        handle.build.remove(file);
        handle.build.removePreset(file);
      }
    });

    compiler.hooks.thisCompilation.tap('MnWebpackPlugin', (compilation: Compilation) => {
      handle.imported = false;
      // Webpack следит только за файлами графа импортов, а разметку (`.html`,
      // шаблоны) никто не импортирует — без этого правка в ней не пересобирала бы
      // CSS. Корень скана — зависимость сборки целиком.
      compilation.contextDependencies.add(root);
      compilation.hooks.processAssets.tap(
        {
          name: 'MnWebpackPlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => this.emitCss(compilation, handle),
      );
    });
  }

  /** Учитывает файл приложения; нечитаемый — снимает с учёта. */
  private loadFile(file: string): void {
    const handle = this.handle as MnPluginHandle;
    let source: string;
    try {
      source = readFileSync(file, 'utf-8');
    } catch {
      handle.build.remove(file);
      return;
    }
    handle.build.add(file, source);
  }

  /** Выполняет пресет-файл; битый — снимает с учёта, ошибку печатает. */
  private loadPreset(file: string): void {
    const handle = this.handle as MnPluginHandle;
    let preset: ((mn: MnInstance) => void) | undefined;
    try {
      preset = evalPreset(file, readFileSync(file, 'utf-8'));
    } catch (e) {
      console.error('[minotation] Failed to evaluate preset file:', file, e);
    }
    preset ? handle.build.setPreset(file, preset) : handle.build.removePreset(file);
  }

  /**
   * Без импорта `mn.css` — выдаёт CSS ассетом: по записи на файл, привязка к
   * чанкам точек входа, манифест. Предупреждения — в отчёт сборки.
   */
  private emitCss(compilation: Compilation, handle: MnPluginHandle): void {
    const outputs = handle.build.outputs();
    for (const warning of handle.build.takeWarnings()) {
      compilation.warnings.push(new compilation.compiler.webpack.WebpackError(
        '[minotation] ' + warning.token + ': ' + warning.message,
      ));
    }
    if (handle.imported) {
      return;
    }
    // Webpack всегда задаёт `output.filename` (по умолчанию `[name].js`).
    const outputName = String(compilation.outputOptions.filename);
    // Хеш — по правилам проекта: если он есть в именах JS, будет и в имени CSS.
    const fallback = outputName.indexOf('hash') > -1 ? '[name].[hash].css' : '[name].css';
    const emitted: Record<string, string> = {};
    const { RawSource } = compilation.compiler.webpack.sources;
    for (const output of outputs) {
      if (!output.css) continue;
      const template = (this.options.entry && this.options.entry[output.name].fileName)
        || this.options.fileName || fallback;
      const name = formatFileName(template, output.name, output.css);
      compilation.emitAsset(name, new RawSource(output.css));
      emitted[output.name] = name;
      // Файл в чанке точки входа — `HtmlWebpackPlugin` подключит его сам.
      for (const entrypoint of compilation.entrypoints.values()) {
        entrypoint.getEntrypointChunk().files.add(name);
      }
    }
    const manifest = manifestFileName(this.options.manifest);
    manifest && Object.keys(emitted).length && compilation.emitAsset(
      manifest, new RawSource(JSON.stringify(manifestOf(emitted), null, 2)),
    );
  }
}

/** Каталог ли это; несуществующий путь — нет. */
function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** Опция переименована — ошибка с подсказкой вместо молчаливого игнора. */
function throwRenamed(from: string, to: string): never {
  throw new Error('[minotation] option "' + from + '" was replaced by "' + to + '" ([name], [hash] supported)');
}
