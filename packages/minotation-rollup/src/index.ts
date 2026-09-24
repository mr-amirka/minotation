import type { Plugin, PluginContext } from 'rollup';
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
  readdirSync,
  statSync,
} from 'fs';
import {
  join,
  dirname,
} from 'path';
import { transformSync } from 'esbuild';
import { createRequire } from 'module';

/** Опции плагина {@link mnRollup}. */
export interface MnRollupOptions {
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
  /** Имя выходного CSS-asset'а. @default 'mn.css' */
  fileName?: string;
  /**
   * Корень для сканирования `src/` файлов — в отличие от Vite, у Rollup нет
   * встроенного понятия "root проекта". @default process.cwd()
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
    console.error('[mnRollup] Failed to evaluate preset file:', id, e);
    return null;
  }
}

/**
 * Rollup-плагин Minimalist Notation.
 *
 * **Как работает:**
 * - `buildStart`: сканирует `root` (по умолчанию `process.cwd()`) на файлы приложения
 *   и динамические пресет-файлы — как и `minotation-vite`, ПО ВСЕЙ файловой системе,
 *   а не только по графу импортов Rollup (защищает от пропуска токенов из модулей,
 *   не попавших в текущий конкретный бандл — см. `minotation-vite`'s `scanProject()`).
 * - `transform`: дополнительно накапливает токены из каждого реально обрабатываемого модуля.
 * - `generateBundle`: компилирует все накопленные токены в CSS и эмитирует как asset.
 *
 * @param options - опции плагина {@link MnRollupOptions}
 * @returns Rollup Plugin
 *
 * @example
 * // rollup.config.js
 * import { mnRollup } from 'minotation-rollup';
 * export default {
 *   plugins: [mnRollup({ attr: 'className' })],
 * };
 */
export function mnRollup(options: MnRollupOptions = {}): Plugin {
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

  function isPresetFile(id: string): boolean {
    return presetExts.some(ext => id.endsWith(ext));
  }

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

  return {
    name: 'minotation',

    buildStart() {
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
    },

    load(this: PluginContext, id: string) {
      if (!isPresetFile(id)) return null;
      const preset = evalPresetFile(id);
      if (preset) dynamicPresets.set(id, preset);
      return { code: 'export default {};', map: null };
    },

    transform(source: string, id: string) {
      if (!exts.some(ext => id.endsWith(ext))) return null;
      const tokens = extractTokens(source, attr);
      if (tokens.length > 0) {
        fileTokens.set(id, new Set(tokens));
      }
      return null;
    },

    generateBundle() {
      const css = recompile();
      flushWarnings(this);
      if (css) {
        this.emitFile({ type: 'asset', fileName, source: css });
      }
    },
  };
}
