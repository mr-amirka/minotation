/**
 * React-адаптер `minotation-runtime`: тонкая обвязка жизненного цикла
 * (`useEffect`-старт/стоп) поверх фреймворк-агностичного DOM-рантайма.
 *
 * Никакого патча `React.createElement`/`jsx()` — сам DOM-рантайм не знает
 * и не обязан знать, как React отрендерил разметку (classic или automatic
 * JSX runtime), поэтому здесь нечего чинить под конкретный рендер-путь.
 * Этот пакет только запускает/останавливает {@link createMnRuntime} в нужный
 * момент жизненного цикла компонента.
 *
 * @module minotation-runtime-react
 */
import { useEffect } from 'react';
import {
  createMnRuntime,
  MnRuntimeInstance,
  MnRuntimeOptions,
} from 'minotation-runtime';

export interface UseMnRuntimeOptions extends MnRuntimeOptions {
  /**
   * Ref на контейнер вместо `options.root` — резолвится ВНУТРИ эффекта
   * (после коммита, когда `ref.current` уже привязан), а не в момент вызова
   * хука. Нужен для скоупинга рантайма на конкретное поддерево (напр. под
   * отдельный виджет), а не на весь `document`.
   */
  rootRef?: { current: Element | null };
}

/**
 * Запускает {@link createMnRuntime} на монтировании компонента, останавливает
 * на размонтировании. Перезапускается только при смене идентичности `mn` —
 * изменения `options` между рендерами не перезапускают рантайм (передавайте
 * стабильную ссылку, если нужна реакция на смену опций).
 *
 * @example
 * function App() {
 *   useMnRuntime(mn);
 *   return <div className="p10 dF">...</div>;
 * }
 *
 * @example
 * // скоуп на контейнер, а не на весь document — напр. для изолированного виджета
 * function Widget() {
 *   const ref = useRef<HTMLDivElement>(null);
 *   useMnRuntime(mn, { rootRef: ref });
 *   return <div ref={ref} className="p10">...</div>;
 * }
 */
export function useMnRuntime(mn: MnRuntimeInstance, options: UseMnRuntimeOptions = {}): void {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const { rootRef, ...rest } = options;
    const root = rootRef ? rootRef.current || undefined : rest.root;
    const runtime = createMnRuntime(mn, { ...rest, root });
    return () => runtime.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mn]);
}
