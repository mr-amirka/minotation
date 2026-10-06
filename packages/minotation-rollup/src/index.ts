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
import { createFileFilter, createTokenCollector, walkFiles } from 'minotation-build';
import type { MnBuildOptions } from 'minotation-build';
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

/**
 * Опции плагина {@link mnRollup} — эталонный набор `minotation-build` (D-026):
 * `attrs`, `root`, `extensions`, `include`, `exclude`, `skipPartials`, `presets`,
 * `presetExtensions`, `safelist`, `classVarSuffixes`, `mergeFnNames`, `syntax`,
 * `mn`. Описание каждой — в README `minotation-build`.
 *
 * `root` по умолчанию — рабочая директория (`process.cwd()`).
 */
export interface MnRollupOptions extends MnBuildOptions {
  /** Имя выходного CSS-файла. @default 'mn.css' */
  fileName?: string;
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
  const fileName = options.fileName || 'mn.css';
  const root = options.root || process.cwd();
  // Отбор файлов — общий для всех плагинов: `extensions` или `include`,
  // затем `exclude` и `skipPartials`.
  const files = createFileFilter(options, root);
  // С `include` расширения не ограничивают обход — решает сам матчер.
  const walkExts = options.include ? [''] : files.extensions;
  // Учёт токенов, пресеты, компиляция, кеш и предупреждения — общий каркас
  // ядра. До 2026-09-29 каждый плагин вёл это сам, и четыре копии расходились.
  const collector = createTokenCollector({
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
  });

  function isPresetFile(id: string): boolean {
    return files.isPreset(id);
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
    },

    load(this: PluginContext, id: string) {
      if (!isPresetFile(id)) return null;
      const preset = evalPresetFile(id);
      if (preset) collector.setPreset(id, preset);
      return { code: 'export default {};', map: null };
    },

    transform(source: string, id: string) {
      if (!files.accepts(id)) return null;
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
