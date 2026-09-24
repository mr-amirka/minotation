/**
 * Vue-компонент для монтирования контента внутри `<iframe>` с ПОЛНОСТЬЮ
 * изолированными стилями — Vue-аналог `minotation-runtime-react`'s
 * `<MnIframe>` (см. его module doc для полного обоснования изоляции vs.
 * старый 1.x `browser/reactFrameProvider.js`, который шарил один `mn.styles$`
 * на все iframe сразу).
 *
 * ## Отличие от React-версии: ОТДЕЛЬНЫЙ Vue app instance, не портал
 *
 * React даёт `createPortal` — единый рендер-дерево, узел просто телепортируется
 * в другой контейнер того же (или другого) документа. У Vue нет прямого
 * аналога для ЧУЖОГО документа (`<Teleport>` штатно рассчитан на реparenting
 * внутри одного документа) — вместо этого здесь монтируется СОВСЕМ ОТДЕЛЬНЫЙ
 * `createApp()`-инстанс прямо в `contentDocument.body` конкретного iframe.
 * Проверено эмпирически (jsdom): элементы, созданные `app.mount(iframeDoc.body)`,
 * получают `ownerDocument === iframeDoc` — Vue-рендерер корректно создаёт узлы
 * через документ переданного контейнера, а не через глобальный `document`.
 *
 * **Важное следствие**: это ИЗОЛИРОВАННЫЙ Vue app instance — provide/inject
 * и плагины родительского приложения (роутер, Pinia store и т.п.) сюда НЕ
 * попадают автоматически. Если слоту нужен доступ к чему-то из родительского
 * app — передавайте явно через props/slots.
 *
 * @module MnIframe
 */
import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';
import { createApp } from 'vue';
import {
  minotationProvider,
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
} from 'minotation';
import type { MnInstance } from 'minotation';
import { createMnRuntime, type MnRuntimeHandle } from 'minotation-runtime';

const DEFAULT_PRESETS = [presetStandard, presetSynonyms, presetMedias, presetNormalize, presetMain];

/**
 * @example
 * <MnIframe title="Виджет 1">
 *   <template #default>
 *     <div class="p10 bgF r8">Изолированный виджет</div>
 *   </template>
 * </MnIframe>
 */
export const MnIframe = defineComponent({
  name: 'MnIframe',
  props: {
    presets: { type: Array as PropType<Array<(mn: MnInstance) => void>>, default: undefined },
    /** Атрибут `class` внутри iframe. @default 'class' */
    attr: { type: String, default: undefined },
    /** Обязателен для доступности — у `<iframe>` без `title` нет осмысленного имени для screen reader'ов. */
    title: { type: String, required: true },
  },
  setup(props, { slots }) {
    const iframeRef = ref<HTMLIFrameElement | null>(null);
    const doc = ref<Document | null>(null);
    let childApp: ReturnType<typeof createApp> | null = null;
    let runtime: MnRuntimeHandle | undefined;

    onMounted(() => {
      const iframe = iframeRef.value;
      /* istanbul ignore if — template ref на элемент гарантированно привязан
         к моменту onMounted (контракт Vue); проверка только для TS-narrowing */
      if (!iframe) return;
      function handleLoad(): void {
        const contentDoc = iframe!.contentDocument;
        // cross-origin iframe: после load contentDocument === null — монтировать некуда
        if (contentDoc) doc.value = contentDoc;
      }
      if (iframe.contentDocument?.readyState === 'complete') {
        handleLoad();
      }
      iframe.addEventListener('load', handleLoad);
    });

    // watch (не прямая логика в handleLoad) — так двойное срабатывание load
    // (readyState уже 'complete' + сам event) безопасно: Vue не триггерит
    // watcher повторно на идентичное значение ref (та же ссылка на Document).
    watch(doc, (iframeDoc) => {
      /* istanbul ignore if — null отфильтрован в handleLoad, здесь только TS-narrowing */
      if (!iframeDoc) return;
      const ChildRoot = defineComponent({
        render: () => (slots.default ? slots.default() : null),
      });
      childApp = createApp(ChildRoot);
      childApp.mount(iframeDoc.body);

      const mn = minotationProvider();
      mn.setPresets(props.presets ?? DEFAULT_PRESETS);
      runtime = createMnRuntime(mn, { root: iframeDoc, attr: props.attr });
    });

    // onBeforeUnmount (не onUnmounted) — важно: onUnmounted этого компонента
    // срабатывает УЖЕ ПОСЛЕ того, как Vue удалил <iframe> из родительского
    // DOM (detach нарушает contentDocument иностранного app instance —
    // childApp.unmount() падает на уже недействительных узлах). onBeforeUnmount
    // выполняется, пока iframe ещё подключён и валиден.
    onBeforeUnmount(() => {
      runtime?.stop();
      childApp?.unmount();
    });

    return () => h('iframe', { ref: iframeRef, title: props.title });
  },
});
