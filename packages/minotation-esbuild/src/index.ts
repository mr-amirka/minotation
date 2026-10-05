import type { Plugin, PluginBuild } from 'esbuild';
import type { MnWarning } from 'minotation';
import {
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
} from 'minotation';
import type { MnInstance } from 'minotation';
import { createTokenCollector, walkFiles } from 'minotation-build';
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  mkdirSync,
} from 'fs';
import {
  join,
  dirname,
} from 'path';
import { transformSync } from 'esbuild';
import { createRequire } from 'module';

/** Опции плагина {@link mnEsbuild}. */
export interface MnEsbuildOptions {
  /**
   * Имя атрибута для поиска токенов или несколько — `['class', 'className']`,
   * когда в проекте есть и `.astro`/`.html`, и React-компоненты. @default 'class'
   */
  attr?: string | string[];
  /**
   * Суффиксы имён переменных, чьё строковое значение считается списком MN-токенов
   * (`const thClass = 'py12 px14'`). Пустой массив отключает механизм.
   * @default ['Class']
   */
  classVarSuffixes?: string[];
  /**
   * Имена функций слияния токенов, чьи строковые аргументы сканируются
   * (`mne('pt26 pb6', props.class)`). Пустой массив отключает механизм.
   * @default ['mne', 'mnClass']
   */
  mergeFnNames?: string[];
  /**
   * Разбирать ли `.js/.jsx/.ts/.tsx` парсером вместо текстового поиска.
   *
   * По умолчанию — автоматически: если `typescript` доступен, файлы
   * JS-семейства идут через него, иначе текстом и молча. Точный разбор
   * снимает ложные токены из мест, которые текстовый сканер не отличает от
   * кода: примеры разметки в JSDoc, закомментированный код, строки с кавычкой
   * внутри регулярного литерала.
   *
   * `true` — то же самое, но отсутствие парсера становится предупреждением.
   * `false` — всегда текстовый разбор.
   *
   * Файлы прочих форматов (`.html`, `.vue`, `.svelte`, `.astro`) сканируются
   * текстом при любом значении.
   */
  syntax?: boolean;

  /** Расширения файлов приложения, в которых ищем токены. @default ['.html','.jsx','.tsx','.vue','.svelte'] */
  extensions?: string[];
  /** Статические пресеты, подключаемые через конфиг сборщика. */
  presets?: Array<(mn: MnInstance) => void>;
  /**
   * Расширения файлов, считающихся динамическими MN-пресетами (`import './app.mn'`).
   * @default ['.mn.ts', '.mn.js', '.mn.tsx']
   */
  presetExtensions?: string[];
  /** Имя выходного CSS-файла. @default 'mn.css' */
  fileName?: string;
  /**
   * Корень для сканирования файлов приложения — у esbuild, как и у Rollup,
   * нет встроенного понятия "root проекта". @default process.cwd()
   */
  root?: string;
  /** Опции создания mn-инстанса (selectorPrefix, media, …). */
  mn?: {
    selectorPrefix?: string;
    media?: Record<string, { query?: string; selector?: string; priority?: number }>;
    /**
     * Что делать с предупреждениями компиляции. По умолчанию плагин
     * перехватывает их и пересылает в лог сборщика (вместо `console` ядра).
     * `'silent'` — не выводить вовсе; своя функция вызывается как есть.
     */
    onWarning?: 'silent' | 'console' | ((warning: MnWarning) => void);
  };
}


/**
 * Транспилирует TypeScript/JS пресет-файл через esbuild и выполняет его
 * в Node.js-контексте через `new Function`.
 *
 * @param id - абсолютный путь к файлу пресета
 * @returns экспортированная пресет-функция или `null` при ошибке
 */
function evalPresetFile(id: string): ((mn: MnInstance) => void) | null {
  let source: string;
  try {
    source = readFileSync(id, 'utf-8');
  } catch {
    return null;
  }
  try {
    const loader = id.endsWith('.tsx') ? 'tsx' : id.endsWith('.ts') ? 'ts' : 'js';
    const { code } = transformSync(source, {
      loader,
      format: 'cjs',
      target: 'node18',
    });
    const mod: { exports: Record<string, unknown> } = { exports: {} };
    const req = createRequire(id);
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      'require',
      'module',
      'exports',
      '__dirname',
      '__filename',
      code,
    );
    fn(req, mod, mod.exports, dirname(id), id);
    const preset = mod.exports['default'] ?? Object.values(mod.exports).find(v => typeof v === 'function');
    return typeof preset === 'function' ? (preset as (mn: MnInstance) => void) : null;
  } catch (e) {
    console.error('[mnEsbuild] Failed to evaluate preset file:', id, e);
    return null;
  }
}

/**
 * esbuild-плагин Minimalist Notation.
 *
 * **Как работает:**
 * - `onStart`: сканирует `root` (по умолчанию `process.cwd()`) на файлы приложения
 *   и динамические пресет-файлы — по расширениям, а не по графу зависимостей esbuild
 *   (тот же blanket-scan, что и у `minotation-vite`/`minotation-rollup` — защищает
 *   от пропуска токенов из модулей, не попавших в текущий конкретный бандл).
 * - `onLoad` (пресет-файлы): перехватывает реальный side-effect импорт
 *   `import './mn/app.mn'` из кода приложения — `*.mn.ts`/`.mn.js`/`.mn.tsx`
 *   по умолчанию. Оценивает файл через `evalPresetFile` (как и blanket-скан
 *   в `onStart`, так что дубли безопасны — `dynamicPresets` это `Map` по пути)
 *   и возвращает заглушку (`export default {}`), чтобы реальный код пресета
 *   (расcчитанный на Node-контекст, не на браузер) не попал в клиентский бандл.
 * - `onLoad` (файлы приложения): дополнительно накапливает токены из каждого реально
 *   загружаемого esbuild'ом файла. Контент НЕ подменяется — callback явно возвращает
 *   `undefined`, чтобы esbuild продолжил грузить файл своим штатным лоадером.
 * - `onEnd`: компилирует все накопленные токены в CSS и пишет как файл рядом
 *   с `outdir`/`outfile` (esbuild, в отличие от Rollup/Vite, не умеет "эмитировать
 *   asset" декларативно — плагин пишет файл на диск напрямую).
 *
 * @param options - опции плагина {@link MnEsbuildOptions}
 * @returns esbuild Plugin
 *
 * @example
 * // build.js
 * const esbuild = require('esbuild');
 * const { mnEsbuild } = require('minotation-esbuild');
 *
 * esbuild.build({
 *   entryPoints: ['src/main.tsx'],
 *   outdir: 'dist',
 *   bundle: true,
 *   plugins: [mnEsbuild({ attr: 'className' })],
 * });
 */
export function mnEsbuild(options: MnEsbuildOptions = {}): Plugin {
  const attr = options.attr || 'class';
  const exts = options.extensions || ['.html', '.jsx', '.tsx', '.vue', '.svelte'];
  const presetExts = options.presetExtensions || ['.mn.ts', '.mn.js', '.mn.tsx'];
  const fileName = options.fileName || 'mn.css';
  const root = options.root || process.cwd();
  // Учёт токенов, пресеты, компиляция, кеш и предупреждения — общий каркас
  // (`minotation-build`). До 2026-09-29 каждый плагин вёл это сам, и четыре
  // копии расходились между собой.
  const collector = createTokenCollector({
    attr,
    classVarSuffixes: options.classVarSuffixes,
    mergeFnNames: options.mergeFnNames,
    syntax: options.syntax,
    presets: options.presets || [
      presetStandard,
      presetSynonyms,
      presetMedias,
      presetNormalize,
      presetMain,
    ],
    mn: options.mn,
  });

  /** Пересылает предупреждения последней компиляции в лог esbuild. */
  function flushWarnings(ctx: { warn: (message: string) => void }): void {
    for (const warning of collector.takeWarnings()) {
      ctx.warn('[minotation] ' + warning.token + ': ' + warning.message);
    }
  }

  /** Определяет директорию для выходного CSS-файла из опций сборки esbuild. */
  function resolveOutDir(build: PluginBuild): string {
    const { outdir, outfile } = build.initialOptions;
    if (outdir) return outdir;
    if (outfile) return dirname(outfile);
    return root;
  }

  return {
    name: 'minotation',
    setup(build: PluginBuild) {
      build.onStart(() => {
        // Оба накопителя живут между сборками (плагин создаётся один раз), а в
        // watch-режиме `onStart` зовётся на каждую пересборку. Без очистки
        // токены и пресеты УДАЛЁННОГО файла оставались бы в выводе до
        // перезапуска: обход ниже добавляет записи, но никогда не убирает.
        // Чистим здесь, а не в `onEnd`, потому что `onLoad` дозаполняет наборы
        // уже после этого хука.
        collector.clear();

        for (const file of walkFiles(root, presetExts)) {
          const preset = evalPresetFile(file);
          if (preset) collector.setPreset(file, preset);
        }
        for (const file of walkFiles(root, exts)) {
          try {
            collector.add(file, readFileSync(file, 'utf-8'));
          } catch (_) { /* skip unreadable */ }
        }
      });

      build.onLoad({ filter: /./ }, args => {
        if (!presetExts.some(ext => args.path.endsWith(ext))) return undefined;
        const preset = evalPresetFile(args.path);
        if (preset) collector.setPreset(args.path, preset);
        return { contents: 'export default {};', loader: 'js' };
      });

      build.onLoad({ filter: /./ }, args => {
        if (!exts.some(ext => args.path.endsWith(ext))) return undefined;
        try {
          collector.add(args.path, readFileSync(args.path, 'utf-8'));
        } catch (_) { /* skip unreadable */ }
        return undefined; // не подменяем контент — пусть грузит штатный loader
      });

      build.onEnd((result) => {
        const css = collector.css();
        // esbuild собирает предупреждения в result.warnings — пишем туда же,
        // чтобы они попали в общий отчёт сборки, а не только в stdout.
        flushWarnings({
          // `result.warnings` у esbuild всегда массив (в типах он обязателен),
          // поэтому запасного `|| []` здесь нет: он был бы недостижимой веткой.
          warn: (message: string) => {
            result.warnings.push({ text: message } as never);
          },
        });
        if (!css) return;
        const outDir = resolveOutDir(build);
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, fileName), css);
      });
    },
  };
}
