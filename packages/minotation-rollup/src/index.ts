import type { Plugin, PluginContext } from 'rollup';
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
import type { MnAttrs } from 'minotation-build';
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
  /**
   * Какие атрибуты сканировать и во что разворачивать селекторы — как в v1 (D-025):
   * `'class, className:class'`, `['class', 'className:class']` или
   * `{ class: 'class', className: 'class' }`. Имя без `:` разворачивается в себя:
   * `m="p10"` → `[m~="p10"]`. @default 'class'
   */
  attrs?: MnAttrs;
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
 *   plugins: [mnRollup({ attrs: 'class, className:class' })],
 * };
 */
export function mnRollup(options: MnRollupOptions = {}): Plugin {
  const exts = options.extensions || ['.html', '.jsx', '.tsx', '.vue', '.svelte'];
  const presetExts = options.presetExtensions || ['.mn.ts', '.mn.js', '.mn.tsx'];
  const fileName = options.fileName || 'mn.css';
  const root = options.root || process.cwd();
  // Учёт токенов, пресеты, компиляция, кеш и предупреждения — общий каркас
  // ядра. До 2026-09-29 каждый плагин вёл это сам, и четыре копии расходились.
  const collector = createTokenCollector({
    // Опции целиком — чтобы каркас увидел и устаревшие ключи (`attr`) и
    // сказал о них, а не потерял молча; ниже — то, что плагин подставляет сам.
    ...options,
    attrs: options.attrs,
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

  function isPresetFile(id: string): boolean {
    return presetExts.some(ext => id.endsWith(ext));
  }

  /** Пересылает предупреждения последней компиляции в лог Rollup. */
  function flushWarnings(ctx: { warn: (message: string) => void }): void {
    for (const warning of collector.takeWarnings()) {
      ctx.warn('[minotation] ' + warning.token + ': ' + warning.message);
    }
  }

  return {
    name: 'minotation',

    buildStart() {
      // Накопитель живёт между сборками (плагин создаётся один раз), а в
      // watch-режиме `buildStart` зовётся на каждую пересборку. Без очистки
      // токены и пресеты УДАЛЁННОГО файла оставались бы в выводе до перезапуска:
      // обход ниже добавляет записи, но никогда не убирает. Чистим здесь, а не
      // в `generateBundle`, потому что `transform`/`load` дозаполняют наборы
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
    },

    load(this: PluginContext, id: string) {
      if (!isPresetFile(id)) return null;
      const preset = evalPresetFile(id);
      if (preset) collector.setPreset(id, preset);
      return { code: 'export default {};', map: null };
    },

    transform(source: string, id: string) {
      if (!exts.some(ext => id.endsWith(ext))) return null;
      collector.add(id, source);
      return null;
    },

    generateBundle() {
      const css = collector.css();
      flushWarnings(this);
      if (css) {
        this.emitFile({ type: 'asset', fileName, source: css });
      }
    },
  };
}
