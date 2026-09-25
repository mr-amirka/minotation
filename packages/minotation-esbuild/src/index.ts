import type { Plugin, PluginBuild } from 'esbuild';
import type { MnWarning } from 'minotation';
import {
  minotationProvider,
  extractTokens,
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
} from 'minotation';
import type { MnInstance } from 'minotation';
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
  /** Имя атрибута для поиска токенов. @default 'class' */
  attr?: string;
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
 * Рекурсивно обходит директорию и возвращает пути файлов с заданными расширениями.
 *
 * @param dir - корневая директория
 * @param exts - набор расширений (`.tsx`, `.html`, …)
 * @param maxDepth - максимальная глубина рекурсии
 * @returns массив абсолютных путей
 */
function walkFiles(dir: string, exts: string[], maxDepth = 10): string[] {
  const results: string[] = [];
  try {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.') || name === 'node_modules') continue;
      const full = join(dir, name);
      try {
        const st = statSync(full);
        if (st.isDirectory() && maxDepth > 0) {
          results.push(...walkFiles(full, exts, maxDepth - 1));
        } else if (st.isFile() && exts.some(ext => name.endsWith(ext))) {
          results.push(full);
        }
      } catch (_) { /* skip unreadable */ }
    }
  } catch (_) { /* skip unreadable dir */ }
  return results;
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
  const staticPresets = options.presets || [
    presetStandard,
    presetSynonyms,
    presetMedias,
    presetNormalize,
    presetMain,
  ];

  /** Per-file накопитель токенов. */
  const fileTokens = new Map<string, Set<string>>();

  /** Динамически загруженные пресеты из *.mn.ts файлов. */
  const dynamicPresets = new Map<string, (mn: MnInstance) => void>();

  /** Компилирует все накопленные токены + пресеты в CSS. Свежий mn-инстанс на каждый вызов. */

  /** Предупреждения последней компиляции — пересылаются в лог сборщика. */
  let lastWarnings: MnWarning[] = [];

  function flushWarnings(ctx: { warn: (message: string) => void }): void {
    for (let i = 0; i < lastWarnings.length; i++) {
      const warning = lastWarnings[i];
      ctx.warn('[minotation] ' + warning.token + ': ' + warning.message);
    }
    lastWarnings = [];
  }

  function recompile(): string {
    const allTokens = new Set<string>();
    for (const tokens of fileTokens.values()) {
      for (const t of tokens) allTokens.add(t);
    }
    const collected: MnWarning[] = [];
    const userOnWarning = options.mn && options.mn.onWarning;
    const fresh = minotationProvider({
      ...options.mn,
      // Перехватываем всегда: ядро по умолчанию пишет в console, а у сборщика
      // свой канал вывода. Явный 'silent' уважаем; пользовательскую функцию
      // вызываем дополнительно.
      onWarning: (warning: MnWarning) => {
        if (userOnWarning !== 'silent') {
          collected.push(warning);
        }
        if (typeof userOnWarning === 'function') {
          userOnWarning(warning);
        }
      },
    });
    fresh.setPresets([...staticPresets, ...dynamicPresets.values()]);
    const compile = fresh.getCompiler('class');
    for (const token of allTokens) compile(token);
    fresh.compile();
    lastWarnings = collected;
    return fresh.styles$.getValue()
      .map((s: { content: string }) => s.content)
      .join('\n');
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
        fileTokens.clear();
        dynamicPresets.clear();

        for (const file of walkFiles(root, presetExts)) {
          const preset = evalPresetFile(file);
          if (preset) dynamicPresets.set(file, preset);
        }
        for (const file of walkFiles(root, exts)) {
          try {
            const source = readFileSync(file, 'utf-8');
            const tokens = extractTokens(source, attr);
            if (tokens.length > 0) {
              fileTokens.set(file, new Set(tokens));
            }
          } catch (_) { /* skip unreadable */ }
        }
      });

      build.onLoad({ filter: /./ }, args => {
        if (!presetExts.some(ext => args.path.endsWith(ext))) return undefined;
        const preset = evalPresetFile(args.path);
        if (preset) dynamicPresets.set(args.path, preset);
        return { contents: 'export default {};', loader: 'js' };
      });

      build.onLoad({ filter: /./ }, args => {
        if (!exts.some(ext => args.path.endsWith(ext))) return undefined;
        try {
          const source = readFileSync(args.path, 'utf-8');
          const tokens = extractTokens(source, attr);
          if (tokens.length > 0) {
            fileTokens.set(args.path, new Set(tokens));
          }
        } catch (_) { /* skip unreadable */ }
        return undefined; // не подменяем контент — пусть грузит штатный loader
      });

      build.onEnd((result) => {
        const css = recompile();
        // esbuild собирает предупреждения в result.warnings — пишем туда же,
        // чтобы они попали в общий отчёт сборки, а не только в stdout.
        flushWarnings({
          warn: (message: string) => {
            (result.warnings || []).push({ text: message } as never);
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
