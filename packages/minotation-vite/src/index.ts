import type { Plugin, ViteDevServer } from 'vite';
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

/** Опции плагина {@link mnVite}. */
export interface MnViteOptions {
  /** Имя атрибута для поиска токенов. @default 'class' */
  attr?: string;
  /** Расширения файлов приложения, в которых ищем токены. @default ['.html','.jsx','.tsx','.vue','.svelte'] */
  extensions?: string[];
  /** Статические пресеты, подключаемые через конфиг сборщика. */
  presets?: Array<(mn: MnInstance) => void>;
  /**
   * Расширения файлов, считающихся динамическими MN-пресетами.
   *
   * Файлы с такими расширениями можно импортировать прямо в коде приложения
   * как обычные side-effect импорты (аналог `import 'style.scss'`).
   * Плагин перехватывает их, выполняет на внутреннем mn-инстансе
   * и возвращает в бандл пустой ES-модуль (`export {};`).
   * В dev-режиме при изменении пресет-файла CSS обновляется без перезагрузки.
   *
   * @default ['.mn.ts', '.mn.js', '.mn.tsx']
   *
   * @example
   * // src/mn/preset.mn.ts
   * import type { MnInstance } from 'minotation';
   * export function presetApp(mn: MnInstance): void {
   *   mn('card', () => ({ style: { borderRadius: '8px' } }));
   * }
   *
   * // src/main.tsx
   * import './mn/preset.mn';  // ← подключается как side-effect
   */
  presetExtensions?: string[];
  /** Опции создания mn-инстанса (selectorPrefix, media, …). */
  mn?: {
    selectorPrefix?: string;
    media?: Record<string, { query?: string; selector?: string; priority?: number }>;
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
 * Type-only импорты (`import type`) исчезают при транспиляции;
 * runtime-импорты становятся `require()`-вызовами.
 *
 * @param id - абсолютный путь к файлу пресета
 * @returns экспортированная пресет-функция или `null` при ошибке
 *
 * @example
 * const preset = evalPresetFile('/src/mn/app.mn.ts');
 * if (preset) mn.setPresets([preset]);
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
    // Выполняем CJS-код в изолированном контексте через Function constructor
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
    console.error('[mnVite] Failed to evaluate preset file:', id, e);
    return null;
  }
}

/**
 * Vite-плагин Minimalist Notation с инкрементальной компиляцией и HMR.
 *
 * **Как работает:**
 * - Сканирует `src/` и отслеживает `className`-атрибуты в TSX/JSX-файлах.
 * - Токены накапливаются per-file в `Map<id, Set<token>>`.
 * - При изменении файла обновляет только его токены и пересобирает CSS.
 * - Dev: инжектирует `<style data-mn>` в HTML + HMR-клиент для мгновенного обновления.
 * - Build: эмитирует `mn.css` как asset.
 *
 * **Динамические пресеты (`*.mn.ts`):**
 * Файлы с расширением `.mn.ts` / `.mn.js` импортируются в коде приложения
 * как side-effect (`import './mn/app.mn'`). Плагин их перехватывает:
 * выполняет пресет-функцию на внутреннем mn-инстансе,
 * в бандл возвращает `export {}` (пустой модуль, ноль байт в рантайме).
 * При изменении в dev-режиме CSS обновляется без перезагрузки.
 *
 * @param options - опции плагина {@link MnViteOptions}
 * @returns Vite Plugin
 *
 * @example
 * // vite.config.ts
 * import { mnVite } from 'minotation-vite';
 * import { presetStandard } from 'minotation';
 *
 * export default defineConfig({
 *   plugins: [
 *     mnVite({ attr: 'className', presets: [presetStandard] }),
 *   ],
 * });
 *
 * // src/mn/app.mn.ts  (динамический пресет — подключается в main.tsx)
 * import type { MnInstance } from 'minotation';
 * export function presetApp(mn: MnInstance): void {
 *   mn('card', () => ({ style: { borderRadius: '8px' } }));
 * }
 *
 * // src/main.tsx
 * import './mn/app.mn';
 */
export function mnVite(options: MnViteOptions = {}): Plugin {
  const attr = options.attr || 'class';
  const exts = options.extensions || ['.html', '.jsx', '.tsx', '.vue', '.svelte'];
  const presetExts = options.presetExtensions || ['.mn.ts', '.mn.js', '.mn.tsx'];
  const staticPresets = options.presets || [
    presetStandard,
    presetSynonyms,
    presetMedias,
    presetNormalize,
    presetMain,
  ];

  let cssOutput = '';
  let root = process.cwd();
  let command: 'serve' | 'build' = 'serve';

  /** Per-file накопитель токенов. Сохраняется между hot-update-циклами. */
  const fileTokens = new Map<string, Set<string>>();

  /** Динамически загруженные пресеты из *.mn.ts файлов. */
  const dynamicPresets = new Map<string, (mn: MnInstance) => void>();

  /**
   * Проверяет, является ли файл динамическим пресет-файлом по расширению.
   *
   * @param id - абсолютный путь к файлу
   */
  function isPresetFile(id: string): boolean {
    return presetExts.some(ext => id.endsWith(ext));
  }

  // extractTokens импортируется из ядра minotation — кеш регексов там

  /**
   * Пересобирает CSS из всех накопленных токенов и пресетов.
   * Каждый вызов создаёт свежий mn-инстанс — старые пресеты не аффектят.
   *
   * @returns строка CSS
   */
  function recompile(): string {
    const allTokens = new Set<string>();
    for (const tokens of fileTokens.values()) {
      for (const t of tokens) allTokens.add(t);
    }
    const fresh = minotationProvider(options.mn);
    fresh.setPresets([...staticPresets, ...dynamicPresets.values()]);
    // §6.3: кешируем compile — без property lookup на каждой итерации.
    // 'class' — все токены компилируются как class-селекторы независимо от того,
    // из какого атрибута (class/className) их извлёк extractTokens: это одно и то
    // же DOM-свойство, разница только в JSX-синтаксисе.
    const compile = fresh.getCompiler('class');
    for (const token of allTokens) compile(token);
    fresh.compile();
    return fresh.styles$.getValue()
      .map((s: { content: string }) => s.content)
      .join('\n');
  }

  /**
   * Сканирует `src/` и наполняет {@link fileTokens} до первой компиляции.
   * Вызывается в `transformIndexHtml` — до того, как Vite запустил transform-хуки.
   */
  function scanProject(): void {
    const srcDir = join(root, 'src');
    for (const file of walkFiles(srcDir, exts)) {
      try {
        const source = readFileSync(file, 'utf-8');
        const tokens = extractTokens(source, attr);
        if (tokens.length > 0) {
          fileTokens.set(file, new Set(tokens));
        }
      } catch (_) { /* skip unreadable */ }
    }
  }

  /**
   * Сканирует `src/` на наличие `*.mn.ts` / `*.mn.js` файлов и загружает их.
   * Вызывается в `transformIndexHtml` при старте dev-сервера и build.
   */
  function scanPresetFiles(): void {
    const srcDir = join(root, 'src');
    for (const file of walkFiles(srcDir, presetExts)) {
      const preset = evalPresetFile(file);
      if (preset) dynamicPresets.set(file, preset);
    }
  }

  return {
    name: 'minotation',
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
      command = config.command;
    },

    /**
     * Подстраховка для сборщиков поверх Vite, которые НЕ используют
     * `transformIndexHtml` (Astro и другие мета-фреймворки без одного
     * центрального `index.html` — они рендерят HTML сами). Без этого
     * хука `scanProject`/`scanPresetFiles` (blanket-скан `src/` по
     * расширениям, а не по графу импортов Vite) никогда не вызывались бы —
     * токены из компонентов вне графа импортов текущей страницы молча
     * терялись бы (найдено эмпирически на `minotation-astro`, 2026-09-02).
     * `transformIndexHtml`'s собственный вызов этих же функций остаётся —
     * дублирование безопасно (идемпотентно, просто перезаписывает те же
     * ключи Map теми же значениями).
     */
    buildStart() {
      scanPresetFiles();
      scanProject();
    },

    /**
     * Перехватывает `*.mn.ts` / `*.mn.js` файлы при импорте из приложения.
     * Выполняет пресет на внутреннем mn-инстансе.
     * Возвращает `export {}` — в рантайм ничего не попадает.
     */
    load(id) {
      if (!isPresetFile(id)) return null;
      const preset = evalPresetFile(id);
      if (preset) dynamicPresets.set(id, preset);
      // Пустой ES-модуль — ноль байт в бандле, ноль runtime-кода
      return { code: 'export {};', map: null };
    },

    transform(source: string, id: string) {
      if (!exts.some(ext => id.endsWith(ext))) return null;
      const tokens = extractTokens(source, attr);
      if (tokens.length > 0) {
        fileTokens.set(id, new Set(tokens));
      }
      return null;
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html: string) {
        // Загружаем пресеты и токены ДО компиляции — transform-хуки ещё не отработали
        scanPresetFiles();
        scanProject();
        const tokens = extractTokens(html, attr);
        if (tokens.length > 0) {
          fileTokens.set('index.html', new Set(tokens));
        }
        cssOutput = recompile();
        const tags: Array<{ tag: string; attrs: Record<string, string>; children: string }> = [];
        if (cssOutput) {
          // MutationObserver: держит <style data-mn> последним в <head> —
          // runtime-стили (MUI/Emotion) вставляются раньше → MN побеждает в каскаде.
          // Работает в dev и prod без изменений в коде приложения.
          tags.push({
            tag: 'script',
            attrs: {},
            children: `(function(){var o=new MutationObserver(function(){var m=document.querySelector('style[data-mn]');if(m&&m!==document.head.lastElementChild)document.head.appendChild(m)});o.observe(document.head,{childList:true})})()`,
          });
          tags.push({ tag: 'style', attrs: { 'data-mn': '' }, children: cssOutput });
        }
        // HMR-клиент: обновляет <style data-mn> при получении события mn:update
        if (command === 'serve') {
          tags.push({
            tag: 'script',
            attrs: { type: 'module' },
            children: `
if (import.meta.hot) {
  import.meta.hot.on('mn:update', (css) => {
    let el = document.querySelector('style[data-mn]');
    if (!el) { el = document.createElement('style'); el.setAttribute('data-mn', ''); document.head.appendChild(el); }
    el.textContent = css;
    document.head.appendChild(el);
  });
}`,
          });
        }
        return tags;
      },
    },

    handleHotUpdate({ file, server }: { file: string; server: ViteDevServer }) {
      // Пресет-файл изменился: перезагружаем, пересобираем CSS, отправляем обновление
      if (isPresetFile(file)) {
        const preset = evalPresetFile(file);
        if (preset) {
          dynamicPresets.set(file, preset);
        } else {
          dynamicPresets.delete(file);
        }
        cssOutput = recompile();
        server.ws.send({ type: 'custom', event: 'mn:update', data: cssOutput });
        return []; // полный HMR-цикл не нужен — CSS уже обновлён
      }

      if (!exts.some(ext => file.endsWith(ext))) return;

      let source: string;
      try {
        source = readFileSync(file, 'utf-8');
      } catch {
        fileTokens.delete(file);
        return;
      }

      const tokens = extractTokens(source, attr);
      if (tokens.length > 0) {
        fileTokens.set(file, new Set(tokens));
      } else {
        fileTokens.delete(file);
      }
      cssOutput = recompile();
      server.ws.send({ type: 'custom', event: 'mn:update', data: cssOutput });
    },

    generateBundle() {
      cssOutput = recompile();
      if (cssOutput) {
        this.emitFile({ type: 'asset', fileName: 'mn.css', source: cssOutput });
      }
    },
  };
}
