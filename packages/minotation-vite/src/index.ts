import type { Plugin, ViteDevServer } from 'vite';
import {
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
} from 'minotation';
import type { MnInstance, MnWarning } from 'minotation';
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

/** Опции плагина {@link mnVite}. */
export interface MnViteOptions {
  /**
   * Какие атрибуты сканировать и во что разворачивать селекторы — как в v1 (D-025):
   * `'class, className:class'`, `['class', 'className:class']` или
   * `{ class: 'class', className: 'class' }`. Имя без `:` разворачивается в себя:
   * `m="p10"` → `[m~="p10"]`. @default 'class'
   */
  attrs?: MnAttrs;
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
   * import type { MnInstance, MnWarning } from 'minotation';
   * export function presetApp(mn: MnInstance): void {
   *   mn('card', () => ({ style: { borderRadius: '8px' } }));
   * }
   *
   * // src/main.tsx
   * import './mn/preset.mn';  // ← подключается как side-effect
   */
  presetExtensions?: string[];
  /**
   * Токены, которые нужно скомпилировать всегда, даже если они не встретились
   * в литеральном атрибуте `class="…"`.
   *
   * Плагин извлекает токены **статически**: из значений `class`/`className`
   * в исходниках. Классы, собранные в переменных или выражениях
   * (`const th = 'py12 px14'`, `clsx(...)`, вычисляемые строки), при таком
   * разборе не видны, и соответствующий CSS в сборку не попадает. Для таких
   * случаев — перечислить токены здесь.
   *
   * @default []
   *
   * @example
   * mnVite({ safelist: ['py12 px14 r8', 'crP', 'taL'] })
   */
  safelist?: string[];
  /**
   * Суффиксы имён переменных, значения которых считаются списком MN-токенов.
   *
   * Дополняет статическое извлечение из `class="…"`: классы, собранные в
   * переменной, плагин иначе не видит (он разбирает исходник текстом, а не
   * исполняет его). Достаточно назвать переменную с суффиксом — и токены
   * из её строкового значения попадут в CSS:
   *
   * ```ts
   * const thClass = 'py12 px14 bb1 bsS';   // ← извлекается
   * const th = 'py12 px14';                // ← не извлекается
   * ```
   *
   * Распознаются присваивание (`=`) и свойство объекта (`:`), строки в любых
   * кавычках, включая шаблонные; подстановки `${…}` пропускаются, статические
   * части вокруг них — берутся. Сравнение суффикса регистрозависимое.
   *
   * Пустой массив отключает механизм; всегда доступен запасной путь — {@link safelist}.
   *
   * @default ['Class']
   *
   * @example
   * mnVite({ classVarSuffixes: ['Class', 'Cls', 'Styles'] })
   */
  classVarSuffixes?: string[];
  /**
   * Имена функций слияния токенов, у которых строковые аргументы сканируются.
   *
   * `mne('pt26 pb6', props.class)` — токены `pt26` и `pb6` записаны прямо в вызове,
   * а не в `class="…"` и не в переменной с суффиксом из {@link classVarSuffixes}.
   * Без этой опции они не попадали в CSS: сборка проходила зелёной, а стили молча
   * отсутствовали.
   *
   * Берутся все строковые литералы внутри вызова, на любой глубине вложенности;
   * подстановки `${…}` пропускаются, идентификаторы-аргументы игнорируются
   * (их значения приходят из своих объявлений — их подхватит `classVarSuffixes`).
   *
   * Пустой массив отключает механизм.
   *
   * @default ['mne', 'mnClass']
   *
   * @example
   * mnVite({ mergeFnNames: ['mne', 'mnClass', 'cx'] })
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
  /** Опции создания mn-инстанса (selectorPrefix, media, strict, …). */
  mn?: {
    selectorPrefix?: string;
    media?: Record<string, { query?: string; selector?: string; priority?: number }>;
    /**
     * `true` — предупреждения (неизвестный хендлер, битое CSS-значение и т.п.),
     * накопленные за цикл компиляции, роняют сборку (`MnStrictError`) вместо
     * тихого `console.warn`. @default false — см. `MnOptions.strict` в `minotation`.
     */
    strict?: boolean;
    /**
     * Что делать с предупреждениями компиляции. По умолчанию плагин
     * перехватывает их и пишет в лог Vite (вместо `console` ядра).
     * `'silent'` — не выводить вовсе; своя функция вызывается как есть,
     * дополнительно к логу сборщика.
     */
    onWarning?: 'silent' | 'console' | ((warning: MnWarning) => void);
  };
}


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
  const exts = options.extensions || ['.html', '.jsx', '.tsx', '.vue', '.svelte'];
  const presetExts = options.presetExtensions || ['.mn.ts', '.mn.js', '.mn.tsx'];
  // Плоский набор: элементы safelist могут содержать несколько токенов через пробел.
  const safelist: string[] = [];
  for (const line of options.safelist || []) {
    for (const token of line.split(/\s+/)) {
      if (token) safelist.push(token);
    }
  }
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
    attrs: options.attrs,
    classVarSuffixes: options.classVarSuffixes,
    mergeFnNames: options.mergeFnNames,
    syntax: options.syntax,
    safelist,
    presets: staticPresets,
    mn: options.mn,
  });

  /**
   * Проверяет, является ли файл динамическим пресет-файлом по расширению.
   *
   * @param id - абсолютный путь к файлу
   */
  function isPresetFile(id: string): boolean {
    return presetExts.some(ext => id.endsWith(ext));
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
    const srcDir = join(root, 'src');
    for (const file of walkFiles(srcDir, exts)) {
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
    const srcDir = join(root, 'src');
    for (const file of walkFiles(srcDir, presetExts)) {
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
      if (!exts.some(ext => id.endsWith(ext))) return null;
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

      if (!exts.some(ext => file.endsWith(ext))) return;

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
