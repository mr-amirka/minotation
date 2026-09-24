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
import type { MnInstance, MnWarning } from 'minotation';
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

/** Экранирует спецсимволы регулярного выражения в суффиксе из пользовательской опции. */
function escapeRe(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Собирает регексп для поиска `…<Суффикс> = 'токены'` и `{ …<Суффикс>: 'токены' }`.
 *
 * Группы: 1 — кавычка (для обратной ссылки), 2 — содержимое строки.
 * После суффикса обязателен не-идентификаторный символ, иначе `thClassy`
 * совпал бы с суффиксом `Class`.
 *
 * @param suffixes - суффиксы имён переменных (`['Class']`)
 * @returns регексп с флагом `g` или `undefined`, если суффиксов нет
 */
function classVarRegExp(suffixes: string[]): RegExp | undefined {
  if (suffixes.length === 0) return undefined;
  const alt = suffixes.map(escapeRe).join('|');
  return new RegExp(
    '[\\w$]*(?:' + alt + ')(?![\\w$])'      // имя переменной с суффиксом
    + '\\s*(?::[^=;\\n]+)?'                  // необязательная аннотация типа
    + '\\s*[=:]\\s*'                         // присваивание или свойство объекта
    + '([\'"`])((?:\\\\.|[^\\\\])*?)\\1',        // строка в кавычках
    'g',
  );
}

/**
 * Извлекает MN-токены из строковых значений переменных с заданными суффиксами.
 *
 * @param source - исходный текст файла
 * @param re - регексп из {@link classVarRegExp}
 * @returns список токенов (с возможными повторами)
 */
function extractClassVarTokens(source: string, re: RegExp | undefined): string[] {
  if (!re) return [];
  const out: string[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    // `${…}` — вычисляемая часть, её содержимое статически неизвестно; берём остальное.
    for (const token of m[2].replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
      if (token) out.push(token);
    }
  }
  return out;
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
  // Плоский набор: элементы safelist могут содержать несколько токенов через пробел.
  const classVarRe = classVarRegExp(
    options.classVarSuffixes === undefined ? ['Class'] : options.classVarSuffixes,
  );
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
  /**
   * Предупреждения последней компиляции — ядро отдаёт их через `onWarning`,
   * а плагин пересылает в лог сборщика (см. {@link flushWarnings}).
   * Перезаписывается на каждый {@link recompile}, потому что инстанс каждый раз
   * свежий и набор токенов пересчитывается целиком.
   */
  let lastWarnings: MnWarning[] = [];

  /** Логгер Vite из `configResolved` — канал вывода там, где нет PluginContext. */
  let logger: { warn: (message: string) => void } | undefined;

  function recompile(): string {
    const allTokens = new Set<string>(safelist);
    for (const tokens of fileTokens.values()) {
      for (const t of tokens) allTokens.add(t);
    }
    const collected: MnWarning[] = [];
    const userOnWarning = options.mn && options.mn.onWarning;
    const fresh = minotationProvider({
      ...options.mn,
      // Перехватываем всегда: по умолчанию ядро пишет в console, а у сборщика
      // есть свой канал вывода — иначе предупреждение либо теряется в потоке
      // сборки, либо дублируется. Пользовательскую функцию вызываем как есть;
      // явный 'silent' уважаем и в лог сборщика тоже ничего не шлём.
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
    // §6.3: кешируем compile — без property lookup на каждой итерации.
    // 'class' — все токены компилируются как class-селекторы независимо от того,
    // из какого атрибута (class/className) их извлёк extractTokens: это одно и то
    // же DOM-свойство, разница только в JSX-синтаксисе.
    const compile = fresh.getCompiler('class');
    for (const token of allTokens) compile(token);
    fresh.compile();
    lastWarnings = collected;
    return fresh.styles$.getValue()
      .map((s: { content: string }) => s.content)
      .join('\n');
  }

  /** Пересылает предупреждения последней компиляции в лог Vite. */
  function flushWarnings(ctx: { warn: (message: string) => void }): void {
    for (let i = 0; i < lastWarnings.length; i++) {
      const warning = lastWarnings[i];
      ctx.warn('[minotation] ' + warning.token + ': ' + warning.message);
    }
    lastWarnings = [];
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
        const tokens = extractTokens(source, attr).concat(extractClassVarTokens(source, classVarRe));
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
      const tokens = extractTokens(source, attr).concat(extractClassVarTokens(source, classVarRe));
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
        const tokens = extractTokens(html, attr).concat(extractClassVarTokens(html, classVarRe));
        if (tokens.length > 0) {
          fileTokens.set('index.html', new Set(tokens));
        }
        cssOutput = recompile();
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

      const tokens = extractTokens(source, attr).concat(extractClassVarTokens(source, classVarRe));
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
      flushWarnings(this);
      if (cssOutput) {
        this.emitFile({ type: 'asset', fileName: 'mn.css', source: cssOutput });
      }
    },
  };
}
