/**
 * Vue-адаптер `minotation-runtime`: тонкая обвязка жизненного цикла
 * (`onMounted`/`onUnmounted`) поверх фреймворк-агностичного DOM-рантайма —
 * структурно зеркалит `minotation-runtime-react`'s `useMnRuntime`, только
 * на Vue 3 Composition API вместо `useEffect`.
 *
 * Как и в React-адаптере: сам DOM-рантайм (`MutationObserver`) не знает
 * и не обязан знать, что именно отрендерило DOM — этому пакету нечего
 * чинить под конкретный Vue-рендер-путь, он только запускает/останавливает
 * {@link createMnRuntime} в нужный момент жизненного цикла компонента.
 *
 * @module minotation-runtime-vue
 */
import { onMounted, onUnmounted } from 'vue';
import type { Ref } from 'vue';
import {
  createMnRuntime,
  MnRuntimeInstance,
  MnRuntimeOptions,
  MnRuntimeHandle,
} from 'minotation-runtime';

export interface UseMnRuntimeOptions extends MnRuntimeOptions {
  /**
   * Ref-контейнер вместо `options.root` — резолвится ВНУТРИ `onMounted`
   * (после монтирования, когда `ref.value` уже привязан к DOM-узлу), а не
   * в момент вызова композабла. Нужен для скоупинга рантайма на конкретное
   * поддерево (напр. под отдельный виджет), а не на весь `document`.
   */
  rootRef?: Ref<Element | null | undefined>;
}

/**
 * Запускает {@link createMnRuntime} в `onMounted`, останавливает в
 * `onUnmounted`. Опции читаются один раз, на момент монтирования — вызывайте
 * composable заново (пересоздав компонент), если нужно поменять опции
 * динамически.
 *
 * @example
 * import { useMnRuntime } from 'minotation-runtime-vue';
 *
 * export default defineComponent({
 *   setup() {
 *     useMnRuntime(mn);
 *   },
 * });
 *
 * @example
 * // скоуп на контейнер, а не на весь document — напр. для изолированного виджета
 * const rootRef = ref<HTMLElement | null>(null);
 * useMnRuntime(mn, { rootRef });
 * // <template><div ref="rootRef" class="p10">...</div></template>
 */
export function useMnRuntime(mn: MnRuntimeInstance, options: UseMnRuntimeOptions = {}): void {
  let runtime: MnRuntimeHandle | undefined;
  onMounted(() => {
    if (typeof document === 'undefined') return;
    const { rootRef, ...rest } = options;
    const root = rootRef ? rootRef.value || undefined : rest.root;
    runtime = createMnRuntime(mn, { ...rest, root });
  });
  onUnmounted(() => {
    runtime?.stop();
  });
}

export { MnIframe } from './MnIframe';
