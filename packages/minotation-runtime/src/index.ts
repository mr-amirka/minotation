/**
 * Framework-agnostic runtime для Minimalist Notation: без build-шага и без
 * bundler-плагина — компилирует токены прямо из реального DOM в браузере.
 *
 * ## Почему не патч `React.createElement` (как в старом 1.x `browser/reactCreateElementPatch.js`)
 *
 * Старый подход перехватывал `React.createElement` и сканировал `props.className`
 * на каждом вызове. Он ломается, как только рендер идёт НЕ через `createElement` —
 * а это ровно то, что происходит с automatic JSX runtime (`"jsx": "react-jsx"`,
 * умолчание в большинстве современных сборок): JSX компилируется в вызовы
 * `jsx()`/`jsxs()` из `react/jsx-runtime`, `React.createElement` не вызывается
 * вообще. Патч тогда просто не срабатывает — молча, без ошибки.
 *
 * Здесь вместо перехвата ЛЮБОГО конкретного API рендера — `MutationObserver`
 * поверх итогового DOM. Работает одинаково для React (classic и automatic JSX
 * runtime), Vue, Angular, Svelte, vanilla JS — DOM не знает и не обязан знать,
 * кто и как его создал.
 *
 * @module minotation-runtime
 */

/** Минимальный контракт `minotationProvider()`-инстанса, нужный рантайму. */
export interface MnRuntimeInstance {
  getCompiler(attrName: string): (value: string) => void;
  compile(): void;
  styles$: {
    getValue(): Array<{ content: string }>;
    on(callback: (value: Array<{ content: string }>) => void): () => void;
  };
}

/** Опции {@link createMnRuntime}. */
export interface MnRuntimeOptions {
  /** Атрибут, из которого извлекаются токены. @default 'class' */
  attr?: string;
  /** Корень наблюдения — элемент или документ целиком. @default document */
  root?: Document | Element;
  /**
   * Маркер-атрибут на инжектируемом `<style>` — под своим именем, отличным от
   * `data-mn` bundler-плагинов (vite/webpack/…), чтобы рантайм и build-time
   * доставка CSS не конфликтовали, если в проекте вдруг включены оба пути.
   * @default 'data-mn-runtime'
   */
  styleAttr?: string;
}

export interface MnRuntimeHandle {
  /** Останавливает наблюдение и отписывается от `styles$`. Безопасно вызывать повторно. */
  stop(): void;
}

const REGEXP_SPACE = /\s+/;

function renderStyles(styleAttr: string, doc: Document, items: Array<{ content: string }>): void {
  let styleEl = doc.querySelector('style[' + styleAttr + ']') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.setAttribute(styleAttr, '');
    doc.head.appendChild(styleEl);
  }
  styleEl.textContent = items.map((s) => s.content).join('\n');
}

/**
 * Запускает DOM-рантайм: сканирует текущий DOM, компилирует найденные токены,
 * затем следит за изменениями (новые узлы, изменения атрибута) через
 * `MutationObserver` — без привязки к конкретному UI-фреймворку.
 *
 * @param mn — инстанс `minotationProvider()` с уже загруженными пресетами
 * @param options — {@link MnRuntimeOptions}
 * @returns {@link MnRuntimeHandle} — `stop()` останавливает наблюдение
 *
 * @example
 * import { minotationProvider, presetStandard } from 'minotation';
 * import { createMnRuntime } from 'minotation-runtime';
 *
 * const mn = minotationProvider();
 * mn.setPresets([presetStandard]);
 * const runtime = createMnRuntime(mn); // сканирует document, следит дальше
 * // runtime.stop() — при размонтировании приложения
 */
export function createMnRuntime(mn: MnRuntimeInstance, options: MnRuntimeOptions = {}): MnRuntimeHandle {
  const attr = options.attr || 'class';
  const styleAttr = options.styleAttr || 'data-mn-runtime';
  const root: Document | Element = options.root || document;
  const doc: Document = root.nodeType === 9 ? (root as Document) : (root.ownerDocument as Document);
  const rootEl: Element = root.nodeType === 9 ? (root as Document).documentElement : (root as Element);

  const compile = mn.getCompiler(attr);

  let flushScheduled = false;
  function flush(): void {
    flushScheduled = false;
    mn.compile();
  }
  function scheduleFlush(): void {
    if (flushScheduled) return;
    flushScheduled = true;
    // Микротаска, не requestAnimationFrame: инъекция <style> не завязана на кадр
    // отрисовки, а RAF в связке с React DOM (свой шедулер поверх RAF/MessageChannel)
    // непредсказуемо гонится по времени со сторонними таймерами в jsdom-тестах.
    queueMicrotask(flush);
  }

  function scanElement(el: Element): void {
    const value = el.getAttribute(attr);
    if (!value) return;
    const tokens = value.split(REGEXP_SPACE);
    for (let i = 0; i < tokens.length; i++) tokens[i] && compile(tokens[i]);
  }

  function scanSubtree(el: Element): void {
    scanElement(el);
    // `el` — всегда Element (корень резолвится в `documentElement`, узлы мутаций
    // фильтруются по `nodeType === 1`), поэтому `querySelectorAll` есть всегда.
    const nested = el.querySelectorAll('[' + attr + ']');
    for (let i = 0; i < nested.length; i++) scanElement(nested[i]);
  }

  scanSubtree(rootEl);
  scheduleFlush();

  const observer = new MutationObserver((mutations) => {
    let dirty = false;
    for (let i = 0; i < mutations.length; i++) {
      const m = mutations[i];
      if (m.type === 'attributes') {
        scanElement(m.target as Element);
        dirty = true;
      } else if (m.type === 'childList') {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            scanSubtree(node as Element);
            dirty = true;
          }
        });
      }
    }
    dirty && scheduleFlush();
  });
  observer.observe(rootEl, {
    attributes: true,
    attributeFilter: [attr],
    childList: true,
    subtree: true,
  });

  const unsubscribeStyles = mn.styles$.on((items) => renderStyles(styleAttr, doc, items));
  renderStyles(styleAttr, doc, mn.styles$.getValue());

  return {
    stop(): void {
      observer.disconnect();
      unsubscribeStyles();
    },
  };
}
