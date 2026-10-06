import type { Plugin, ViteDevServer } from 'vite';
import {
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
} from 'minotation';
import type { MnInstance, MnWarning } from 'minotation';
import { createFileFilter, createTokenCollector, walkFiles } from 'minotation-build';
import type { FileFilter, MnBuildOptions } from 'minotation-build';
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
 * Опции плагина {@link mnVite} — эталонный набор `minotation-build` целиком
 * (D-026): `attrs`, `root`, `extensions`, `include`, `exclude`, `skipPartials`,
 * `presets`, `presetExtensions`, `safelist`, `classVarSuffixes`, `mergeFnNames`,
 * `syntax`, `mn`. Описание каждой — в README `minotation-build`.
 *
 * `root` у vite по умолчанию — `<root конфига Vite>/src`.
 */
export interface MnViteOptions extends MnBuildOptions {}


/** Имя CSS-файла: asset сборки и адрес, по которому dev-сервер отдаёт тот же CSS. */
export const MN_CSS_FILE_NAME = 'mn.css';

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
 * import type { MnInstance, MnWarning } from 'minotation';
 * export function presetApp(mn: MnInstance): void {
 *   mn('card', () => ({ style: { borderRadius: '8px' } }));
 * }
 *
 * // src/main.tsx
 * import './mn/app.mn';
 */
export function mnVite(options: MnViteOptions = {}): Plugin {
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

  /**
   * Учёт токенов, пресеты, компиляция, кеш и предупреждения — общий каркас
   * (`minotation-build`). До 2026-09-29 каждый плагин вёл это сам: четыре
   * копии одного и того же расходились, а `walkFiles` в трёх из них совпадал
   * побайтово. Накопитель сохраняется между hot-update-циклами.
   */
  const collector = createTokenCollector({
    // Опции целиком — чтобы каркас увидел и устаревшие ключи (`attr`) и
    // сказал о них, а не потерял молча; ниже — то, что плагин подставляет сам.
    ...options,
    presets: staticPresets,
  });

  /** Отбор файлов — общий для всех плагинов; корень известен после `configResolved`. */
  let files: FileFilter = createFileFilter(options, root);

  /** Корень первичного скана: `root` из опций или `src/` проекта Vite. */
  function scanRoot(): string {
    return options.root || join(root, 'src');
  }

  /**
   * Проверяет, является ли файл динамическим пресет-файлом по расширению.
   *
   * @param id - абсолютный путь к файлу
   */
  function isPresetFile(id: string): boolean {
    return files.isPreset(id);
  }

  // extractTokens импортируется из ядра minotation — кеш регексов там

  /** Логгер Vite из `configResolved` — канал вывода там, где нет PluginContext. */
  let logger: { warn: (message: string) => void } | undefined;

  /** Пересылает предупреждения последней компиляции в лог Vite. */
  function flushWarnings(ctx: { warn: (message: string) => void }): void {
    for (const warning of collector.takeWarnings()) {
      ctx.warn('[minotation] ' + warning.token + ': ' + warning.message);
    }
  }

  /**
   * Сканирует `src/` и наполняет накопитель до первой компиляции.
   * Вызывается в `transformIndexHtml` — до того, как Vite запустил transform-хуки.
   */
  function scanProject(): void {
    // С `include` расширения не ограничивают обход — решает сам матчер.
    for (const file of walkFiles(scanRoot(), options.include ? [''] : files.extensions)) {
      if (!files.accepts(file)) continue;
      try {
        collector.add(file, readFileSync(file, 'utf-8'));
      } catch (_) { /* skip unreadable */ }
    }
  }

  /**
   * Сканирует `src/` на наличие `*.mn.ts` / `*.mn.js` файлов и загружает их.
   * Вызывается в `transformIndexHtml` при старте dev-сервера и build.
   */
  function scanPresetFiles(): void {
    for (const file of walkFiles(scanRoot(), files.presetExtensions)) {
      const preset = evalPresetFile(file);
      if (preset) collector.setPreset(file, preset);
    }
  }

  return {
    name: 'minotation',
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
      command = config.command;
      logger = config.logger;
      files = createFileFilter(options, root);
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
     * Dev: отдаёт `GET {base}mn.css` — тот же CSS, что сборка эмитит файлом.
     *
     * Нужен мета-фреймворкам без `transformIndexHtml` (Astro): им `<style
     * data-mn>` не вставить, и в dev стили не попадали на страницу вовсе —
     * `/mn.css` отвечал 404 (найдено на `affiliate`, 2026-10-05). Ссылку на
     * файл и HMR-слушатель вставляет сама интеграция (`minotation-astro`).
     *
     * CSS собирается на каждый запрос: накопитель кеширует результат по
     * набору токенов, так что повторный запрос без правок ничего не стоит,
     * а отстать от последней правки отдаваемый файл не может.
     */
    configureServer(server: ViteDevServer) {
      const base = server.config.base || '/';
      const path = (base.endsWith('/') ? base : base + '/') + MN_CSS_FILE_NAME;
      server.middlewares.use((req, res, next) => {
        if ((req.url || '').split('?')[0] !== path) {
          next();
          return;
        }
        cssOutput = collector.css();
        flushWarnings({
          warn: (message: string) => (logger || console).warn(message),
        });
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        // Без кеша: ссылка одна и та же, а содержимое меняется с каждой правкой.
        res.setHeader('Cache-Control', 'no-cache');
        res.end(cssOutput);
      });
    },

    /**
     * Перехватывает `*.mn.ts` / `*.mn.js` файлы при импорте из приложения.
     * Выполняет пресет на внутреннем mn-инстансе.
     * Возвращает `export {}` — в рантайм ничего не попадает.
     */
    load(id) {
      if (!isPresetFile(id)) return null;
      const preset = evalPresetFile(id);
      if (preset) collector.setPreset(id, preset);
      // Пустой ES-модуль — ноль байт в бандле, ноль runtime-кода
      return { code: 'export {};', map: null };
    },

    transform(source: string, id: string) {
      if (!files.accepts(id)) return null;
      collector.add(id, source);
      return null;
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html: string) {
        // Загружаем пресеты и токены ДО компиляции — transform-хуки ещё не отработали
        scanPresetFiles();
        scanProject();
        collector.add('index.html', html);
        cssOutput = collector.css();
        // В transformIndexHtml PluginContext недоступен — пишем через логгер
        // конфигурации, он и в dev, и в build один и тот же.
        flushWarnings({
          warn: (message: string) => (logger || console).warn(message),
        });
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
          collector.setPreset(file, preset);
        } else {
          collector.removePreset(file);
        }
        cssOutput = collector.css();
        server.ws.send({ type: 'custom', event: 'mn:update', data: cssOutput });
        return []; // полный HMR-цикл не нужен — CSS уже обновлён
      }

      if (!files.accepts(file)) return;

      let source: string;
      try {
        source = readFileSync(file, 'utf-8');
      } catch {
        // Файл удалён (или стал нечитаем) — его токены больше не должны давать
        // правил. Без пересборки и отправки клиент продолжал бы показывать
        // стили удалённого файла до ручной перезагрузки страницы.
        // Пересобираем только если файл действительно был на учёте: чтение
        // может упасть и на файле, токенов в котором никогда не было.
        if (collector.remove(file)) {
          cssOutput = collector.css();
          server.ws.send({ type: 'custom', event: 'mn:update', data: cssOutput });
        }
        return;
      }

      collector.add(file, source);
      cssOutput = collector.css();
      server.ws.send({ type: 'custom', event: 'mn:update', data: cssOutput });
    },

    generateBundle() {
      cssOutput = collector.css();
      flushWarnings(this);
      if (cssOutput) {
        this.emitFile({ type: 'asset', fileName: MN_CSS_FILE_NAME, source: cssOutput });
      }
    },
  };
}
