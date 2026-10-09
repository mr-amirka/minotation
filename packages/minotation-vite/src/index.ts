import type { ModuleNode, Plugin, ViteDevServer } from 'vite';
import {
  presetHints,
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
  oneOf,
} from 'minotation';
import type { MnInstance, MnWarning } from 'minotation';
import { checkBuildOptions as checkBuildOptionsImpl, createBuildCollector, createFileFilter, metricsFileName, walkFiles } from 'minotation-build';
import type { BuildCollector, FileFilter, MnBuildOptions } from 'minotation-build';
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
 * `syntax`, `mn`, `entry`. Описание каждой — в README `minotation-build`.
 *
 * `root` у vite по умолчанию — `<root конфига Vite>/src`.
 */
export interface MnViteOptions extends MnBuildOptions {
  /**
   * Как CSS попадает в `index.html` SPA (D-031):
   * - `'inline'` — `<style data-mn>` прямо в HTML;
   * - `'link'` — `<link>` на модуль `virtual:mn.css`: Vite выдаёт его файлом с
   *   хешем в имени и сам подставляет ссылку;
   * - `false` — ничего не вставлять: CSS подключают импортом `virtual:mn.css`
   *   (или `virtual:mn/<запись>.css`) в коде приложения.
   *
   * Без `index.html` (Astro, SSR) опция не действует — там CSS подключается модулем.
   * @default 'inline'
   */
  inject?: 'inline' | 'link' | false;
}

/** Модуль со всем CSS (все записи `entry`). */
export const MN_VIRTUAL = 'virtual:mn.css';
/** Префикс модуля одной записи: `virtual:mn/<имя>.css`. */
export const MN_VIRTUAL_ENTRY = 'virtual:mn/';

/**
 * Проверка опций плагина (D-038) — для обёрток над ним (astro): неизвестный
 * ключ и некорректное значение — ошибка с подсказкой.
 */
export const checkBuildOptions = checkBuildOptionsImpl;
/**
 * Адрес, под которым модули живут в графе Vite. Путь, а не `\0…`: ссылка из
 * `index.html` и запрос браузера в dev приходят именно путём, и Vite должен
 * узнать в нём CSS по расширению.
 */
// Последний сегмент — имя ассета в сборке: Vite называет файл по имени модуля
// (`mn-<hash>.css`, `admin-<hash>.css`).
const MN_RESOLVED = '/__mn/mn.css';
const MN_RESOLVED_ENTRY = '/__mn/entry/';

/** Имя записи по разрешённому id или `''` — все записи; `undefined` — не наш модуль. */
function mnEntryOf(id: string): string | undefined {
  const path = id.split('?')[0];
  if (path === MN_RESOLVED || path.endsWith(MN_RESOLVED)) {
    return '';
  }
  const at = path.indexOf(MN_RESOLVED_ENTRY);
  return at > -1 && path.endsWith('.css')
    ? path.slice(at + MN_RESOLVED_ENTRY.length, -4)
    : undefined;
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
 * - На старте сканирует проект (`root`, по умолчанию `src/`) и добирает токены из
 *   модулей, которые проходят через Vite.
 * - CSS отдаёт модулем `virtual:mn.css` (или `virtual:mn/<запись>.css`): дальше им
 *   распоряжается Vite — имя с хешем, ссылка в HTML, минификация, HMR (D-031).
 *   Проект сканируется до загрузки модулей, поэтому к моменту загрузки CSS полный.
 * - SPA с `index.html`: по умолчанию CSS вставляется прямо в HTML (`inject`).
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
 *
 * export default defineConfig({
 *   plugins: [mnVite({ attrs: 'class, className:class' })],
 * });
 */
export function mnVite(options: MnViteOptions = {}): Plugin {
  checkBuildOptions(options, 'mnVite', {
    inject: oneOf('inline', 'link', false),
  });
  const staticPresets = options.presets || [
    // Подсказки — первыми: любой пресет ниже перекрывает их хендлеры (D-024).
    presetHints,
    presetStandard,
    presetSynonyms,
    presetMedias,
    presetNormalize,
    presetMain,
  ];
  const inject = options.inject === undefined ? 'inline' : options.inject;

  let root = process.cwd();
  let command: 'serve' | 'build' = 'serve';

  /**
   * Учёт токенов, пресеты, записи `entry`, компиляция, кеш и предупреждения —
   * общий каркас (`minotation-build`).
   * Пересоздаётся в `configResolved`: пути в `include` записей считаются от корня.
   */
  function createCollector(): BuildCollector {
    return createBuildCollector({
      ...options,
      presets: staticPresets,
    }, root);
  }
  let build = createCollector();
  /** Отбор файлов — общий для всех плагинов; корень известен после `configResolved`. */
  let files: FileFilter = createFileFilter(options, root);

  function collector(): BuildCollector {
    return build;
  }

  /** Корень первичного скана: `root` из опций или `src/` проекта Vite. */
  function scanRoot(): string {
    return options.root || join(root, 'src');
  }

  /** Логгер Vite из `configResolved` — канал вывода там, где нет PluginContext. */
  let logger: { warn: (message: string) => void } | undefined;

  /** Пересылает предупреждения последней компиляции в лог Vite. */
  function flushWarnings(ctx?: { warn: (message: string) => void }): void {
    const out = ctx || logger || console;
    for (const warning of collector().takeWarnings()) {
      out.warn('[minotation] ' + warning.token + ': ' + warning.message);
    }
  }

  /** CSS всех записей или одной (`name`). */
  function cssOf(name: string): string {
    const outputs = collector().outputs();
    const picked = name ? outputs.filter((output) => output.name === name) : outputs;
    if (name && !picked.length) {
      throw new Error('[minotation] ' + MN_VIRTUAL_ENTRY + name + '.css: no such entry; declared: '
        + collector().names.join(', '));
    }
    return picked.map((output) => output.css).filter(Boolean).join('\n');
  }

  /** Сканирует проект и наполняет накопитель до первой компиляции. */
  function scanProject(): void {
    // С `include` расширения не ограничивают обход — решает сам матчер.
    for (const file of walkFiles(scanRoot(), options.include ? [''] : files.extensions)) {
      if (!files.accepts(file)) continue;
      try {
        collector().add(file, readFileSync(file, 'utf-8'));
      } catch (_) { /* skip unreadable */ }
    }
  }

  /** Загружает динамические пресеты `*.mn.ts` из корня скана. */
  function scanPresetFiles(): void {
    for (const file of walkFiles(scanRoot(), files.presetExtensions)) {
      const preset = evalPresetFile(file);
      if (preset) collector().setPreset(file, preset);
    }
  }

  /** Модули CSS в графе dev-сервера — их Vite пересылает клиенту при правке. */
  function mnModules(server: ViteDevServer): ModuleNode[] {
    const out: ModuleNode[] = [];
    for (const mod of server.moduleGraph.idToModuleMap.values()) {
      if (mod.id && mnEntryOf(mod.id) !== undefined) {
        server.moduleGraph.invalidateModule(mod);
        out.push(mod);
      }
    }
    return out;
  }

  return {
    name: 'minotation',
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
      command = config.command;
      logger = config.logger;
      files = createFileFilter(options, root);
      build = createCollector();
    },

    /**
     * Скан проекта до загрузки модулей: CSS модуля `virtual:mn.css` должен быть
     * полным к моменту, когда Vite его запросит. Без этого мета-фреймворки без
     * `index.html` (Astro) теряли бы токены компонентов вне графа импортов
     * страницы (найдено на `minotation-astro`, 2026-09-02).
     */
    buildStart() {
      scanPresetFiles();
      scanProject();
    },

    resolveId(id: string) {
      if (id === MN_VIRTUAL) {
        return MN_RESOLVED;
      }
      if (id.startsWith(MN_VIRTUAL_ENTRY) && id.endsWith('.css')) {
        return MN_RESOLVED_ENTRY + id.slice(MN_VIRTUAL_ENTRY.length);
      }
      // Ссылка из `index.html` (`inject: 'link'`) приходит уже адресом.
      return mnEntryOf(id) === undefined ? null : id.split('?')[0];
    },

    /**
     * `*.mn.ts` — пресет: выполняется на внутреннем инстансе, в бандл уходит
     * пустой модуль. `virtual:mn.css` — готовый CSS, дальше его ведёт Vite.
     */
    load(id: string) {
      const entry = mnEntryOf(id);
      if (entry !== undefined) {
        const css = cssOf(entry);
        flushWarnings(this);
        return { code: css, map: null };
      }
      if (!files.isPreset(id)) return null;
      const preset = evalPresetFile(id);
      if (preset) collector().setPreset(id, preset);
      // Пустой ES-модуль — ноль байт в бандле, ноль runtime-кода
      return { code: 'export {};', map: null };
    },

    transform(source: string, id: string) {
      if (!files.accepts(id)) return null;
      collector().add(id, source);
      return null;
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html: string) {
        // Загружаем пресеты и токены ДО компиляции — transform-хуки ещё не отработали
        scanPresetFiles();
        scanProject();
        collector().add('index.html', html);
        const tags: Array<{ tag: string; attrs: Record<string, string>; children?: string }> = [];
        if (inject === 'link') {
          // Vite разрешит адрес через наш `resolveId`, соберёт файл с хешем и
          // перепишет ссылку сам; в dev отдаст модуль с HMR.
          tags.push({
            tag: 'link',
            attrs: {
              rel: 'stylesheet',
              href: MN_RESOLVED,
            },
          });
          return tags;
        }
        if (!inject) {
          return tags;
        }
        const css = cssOf('');
        flushWarnings();
        if (css) {
          // MutationObserver: держит <style data-mn> последним в <head> —
          // runtime-стили (MUI/Emotion) вставляются раньше → MN побеждает в каскаде.
          tags.push({
            tag: 'script',
            attrs: {},
            children: `(function(){var o=new MutationObserver(function(){var m=document.querySelector('style[data-mn]');if(m&&m!==document.head.lastElementChild)document.head.appendChild(m)});o.observe(document.head,{childList:true})})()`,
          });
          tags.push({ tag: 'style', attrs: { 'data-mn': '' }, children: css });
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

    /**
     * Правка файла или пресета: учёт обновляется, и CSS уходит клиенту — модули
     * `virtual:mn.css` штатным HMR Vite, инлайн-стиль — событием `mn:update`.
     */
    handleHotUpdate({ file, server, modules }: { file: string; server: ViteDevServer; modules: ModuleNode[] }) {
      const preset = files.isPreset(file);
      let changed: boolean;
      if (preset) {
        const loaded = evalPresetFile(file);
        changed = loaded ? (collector().setPreset(file, loaded), true) : collector().removePreset(file);
      } else if (files.accepts(file)) {
        let source: string | undefined;
        try {
          source = readFileSync(file, 'utf-8');
        } catch {
          // Файл удалён (или стал нечитаем) — его токены больше не должны давать
          // правил; без этого клиент показывал бы стили удалённого файла.
        }
        changed = source === undefined ? collector().remove(file) : collector().add(file, source);
      } else {
        return;
      }
      if (!changed) {
        return preset ? [] : undefined;
      }
      inject === 'inline' && server.ws.send({ type: 'custom', event: 'mn:update', data: cssOf('') });
      const css = mnModules(server);
      // Для пресета свой модуль пуст — перезагружать нечего, только CSS.
      return preset ? css : (modules || []).concat(css);
    },

    /** Статистика употребления токенов — по итогам сборки, рядом с остальным (D-032). */
    generateBundle() {
      flushWarnings(this);
      const metrics = metricsFileName(options.metrics);
      const report = collector().metrics();
      // Пустой проход (ни одного файла) — отчёт-пустышка не нужен.
      metrics && report.filesScanned && this.emitFile({
        type: 'asset',
        fileName: metrics,
        source: JSON.stringify(report, null, 2),
      });
    },
  };
}
