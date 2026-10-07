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
import {
  createBuildCollector, createFileFilter, formatFileName, manifestFileName, manifestOf, metricsFileName, walkFiles,
} from 'minotation-build';
import type { MnBuildOptions } from 'minotation-build';
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

/**
 * Опции плагина {@link mnEsbuild} — эталонный набор `minotation-build` (D-026):
 * `attrs`, `root`, `extensions`, `include`, `exclude`, `skipPartials`, `presets`,
 * `presetExtensions`, `safelist`, `classVarSuffixes`, `mergeFnNames`, `syntax`,
 * `mn`, `entry`, `fileName`, `manifest`. Описание каждой — в README `minotation-build`.
 *
 * `root` по умолчанию — рабочая директория (`process.cwd()`).
 *
 * CSS можно подключить импортом `virtual:mn.css` в коде: тогда он идёт в бандл
 * esbuild и получает имя по `entryNames` (с хешем, если он там задан, D-031).
 * Без импорта плагин пишет файл сам — по `fileName` (по умолчанию `[name].css`)
 * и кладёт рядом манифест.
 */
export interface MnEsbuildOptions extends MnBuildOptions {}

/** Модуль со всем CSS; `virtual:mn/<запись>.css` — одна запись `entry`. */
export const MN_VIRTUAL = 'virtual:mn.css';
const REGEXP_MN_VIRTUAL = /^virtual:mn(?:\/([^/]+))?\.css$/;


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
 *   plugins: [mnEsbuild({ attrs: 'class, className:class' })],
 * });
 */
export function mnEsbuild(options: MnEsbuildOptions = {}): Plugin {
  const root = options.root || process.cwd();
  const manifest = manifestFileName(options.manifest);
  // Отбор файлов — общий для всех плагинов: `extensions` или `include`,
  // затем `exclude` и `skipPartials`.
  const files = createFileFilter(options, root);
  // С `include` расширения не ограничивают обход — решает сам матчер.
  const walkExts = options.include ? [''] : files.extensions;
  // Учёт токенов, пресеты, компиляция, кеш и предупреждения — общий каркас
  // (`minotation-build`). До 2026-09-29 каждый плагин вёл это сам, и четыре
  // копии расходились между собой.
  const collector = createBuildCollector({
    // Опции целиком — чтобы каркас увидел и устаревшие ключи (`attr`) и
    // сказал о них, а не потерял молча; ниже — то, что плагин подставляет сам.
    ...options,
    presets: options.presets || [
      presetStandard,
      presetSynonyms,
      presetMedias,
      presetNormalize,
      presetMain,
    ],
  }, root);
  /** Подключён ли CSS импортом в этой сборке — тогда отдельный файл не нужен. */
  let imported = false;

  /** CSS всех записей или одной (`name`). */
  function cssOf(name: string | undefined): string {
    const outputs = collector.outputs();
    const picked = name ? outputs.filter((output) => output.name === name) : outputs;
    if (name && !picked.length) {
      throw new Error('[minotation] virtual:mn/' + name + '.css: no such entry; declared: '
        + collector.names.join(', '));
    }
    return picked.map((output) => output.css).filter(Boolean).join('\n');
  }

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
        imported = false;

        for (const file of walkFiles(root, files.presetExtensions)) {
          const preset = evalPresetFile(file);
          if (preset) collector.setPreset(file, preset);
        }
        for (const file of walkFiles(root, walkExts)) {
          if (!files.accepts(file)) continue;
          try {
            collector.add(file, readFileSync(file, 'utf-8'));
          } catch (_) { /* skip unreadable */ }
        }
      });

      // `import 'virtual:mn.css'` — CSS уходит в бандл esbuild как обычный CSS.
      // Проект просканирован в `onStart`, поэтому к загрузке модуля CSS полный.
      build.onResolve({ filter: REGEXP_MN_VIRTUAL }, args => ({ path: args.path, namespace: 'minotation' }));
      build.onLoad({ filter: /./, namespace: 'minotation' }, args => {
        imported = true;
        const name = (REGEXP_MN_VIRTUAL.exec(args.path) as RegExpExecArray)[1];
        return { contents: cssOf(name), loader: 'css', resolveDir: root };
      });

      build.onLoad({ filter: /./ }, args => {
        if (!files.isPreset(args.path)) return undefined;
        const preset = evalPresetFile(args.path);
        if (preset) collector.setPreset(args.path, preset);
        return { contents: 'export default {};', loader: 'js' };
      });

      build.onLoad({ filter: /./ }, args => {
        if (!files.accepts(args.path)) return undefined;
        try {
          collector.add(args.path, readFileSync(args.path, 'utf-8'));
        } catch (_) { /* skip unreadable */ }
        return undefined; // не подменяем контент — пусть грузит штатный loader
      });

      build.onEnd((result) => {
        // CSS вычисляется до сброса предупреждений — иначе предупреждения
        // компиляции появились бы уже после него и потерялись. Накопитель
        // кеширует результат, так что повторного счёта ниже нет.
        const outputs = collector.outputs();
        // esbuild собирает предупреждения в result.warnings — пишем туда же,
        // чтобы они попали в общий отчёт сборки, а не только в stdout.
        flushWarnings({
          // `result.warnings` у esbuild всегда массив (в типах он обязателен),
          // поэтому запасного `|| []` здесь нет: он был бы недостижимой веткой.
          warn: (message: string) => {
            result.warnings.push({ text: message } as never);
          },
        });
        const outDir = resolveOutDir(build);
        // Статистика употребления токенов (D-032) — при любом способе подключения CSS.
        const metrics = metricsFileName(options.metrics);
        const report = collector.metrics();
        // Пустой проход (ни одного файла) — отчёт-пустышка не нужен.
        if (metrics && report.filesScanned) {
          mkdirSync(dirname(join(outDir, metrics)), { recursive: true });
          writeFileSync(join(outDir, metrics), JSON.stringify(report, null, 2));
        }
        // Подключили импортом — CSS уже в бандле, отдельный файл был бы вторым.
        if (imported) return;
        const written: Record<string, string> = {};
        for (const output of outputs) {
          if (!output.css) continue;
          const template = (options.entry && options.entry[output.name].fileName)
            || options.fileName || '[name].css';
          const name = formatFileName(template, output.name, output.css);
          mkdirSync(dirname(join(outDir, name)), { recursive: true });
          writeFileSync(join(outDir, name), output.css);
          written[output.name] = name;
        }
        manifest && Object.keys(written).length && writeFileSync(
          join(outDir, manifest), JSON.stringify(manifestOf(written), null, 2),
        );
      });
    },
  };
}
