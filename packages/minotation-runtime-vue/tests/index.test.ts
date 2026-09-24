/**
 * Реальный jsdom + реальный Vue 3 (createApp/mount) + реальный
 * `minotationProvider` — не моки.
 */
import { createApp, createRenderer, defineComponent, h, ref } from 'vue';
import { minotationProvider, presetStandard } from 'minotation';
import { useMnRuntime } from '../src/index';

function makeMn() {
  const mn = minotationProvider();
  mn.setPresets([presetStandard]);
  return mn;
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('minotation-runtime-vue — реальный Vue 3', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    document.head.querySelectorAll('style[data-mn-runtime]').forEach((el) => el.remove());
  });

  test('компонент, отрендеренный реальным Vue-рендерером, компилируется рантаймом', async () => {
    const mn = makeMn();
    const Widget = defineComponent({
      setup() {
        useMnRuntime(mn, { root: document.body });
        return () => h('div', { class: 'p10 dF' }, 'widget');
      },
    });
    const app = createApp(Widget);
    app.mount(container);
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).toContain('.p10{padding:10px}');
    expect(css).toContain('.dF{display:flex}');

    app.unmount();
  });

  test('размонтирование компонента (app.unmount()) останавливает рантайм', async () => {
    const mn = makeMn();
    const Widget = defineComponent({
      setup() {
        useMnRuntime(mn, { root: document.body });
        return () => h('div', { class: 'p10' }, 'widget');
      },
    });
    const app = createApp(Widget);
    app.mount(container);
    await flushMicrotasks();

    app.unmount();

    const div = document.createElement('div');
    div.className = 'bgF';
    document.body.appendChild(div);
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).not.toContain('bgF');
    div.remove();
  });

  test('rootRef скоупит рантайм на контейнер — узлы вне него не сканируются', async () => {
    const mn = makeMn();
    const scoped = document.createElement('div');
    document.body.appendChild(scoped);

    const ScopedWidget = defineComponent({
      setup() {
        const rootRef = ref(scoped);
        useMnRuntime(mn, { rootRef });
        return () => null;
      },
    });
    const app = createApp(ScopedWidget);
    app.mount(container);
    await flushMicrotasks();

    const outside = document.createElement('div');
    outside.className = 'fw5';
    document.body.appendChild(outside);
    const inside = document.createElement('div');
    inside.className = 'crP';
    scoped.appendChild(inside);
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).not.toContain('fw5');
    expect(css).toContain('.crP{cursor:pointer}');

    app.unmount();
    outside.remove();
    scoped.remove();
  });

  test('без options: рантайм стартует на document целиком', async () => {
    const mn = makeMn();
    const Widget = defineComponent({
      setup() {
        useMnRuntime(mn);
        return () => h('div', { class: 'mt4' }, 'widget');
      },
    });
    const app = createApp(Widget);
    app.mount(container);
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).toContain('.mt4{margin-top:4px}');
    app.unmount();
  });

  test('rootRef, оставшийся null, не ломает старт — рантайм падает обратно на document', async () => {
    const mn = makeMn();
    // ref объявлен, но ни к какому узлу не привязан (условный рендер не сработал)
    const rootRef = ref<HTMLElement | null>(null);
    const Widget = defineComponent({
      setup() {
        useMnRuntime(mn, { rootRef });
        return () => h('div', { class: 'fw5' }, 'widget');
      },
    });
    const app = createApp(Widget);
    app.mount(container);
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).toContain('.fw5{font-weight:500}');
    app.unmount();
  });

  test('среда без DOM (кастомный рендерер Vue): рантайм не стартует и не падает', async () => {
    // onMounted вызывается и на НЕ-DOM рендерерах Vue (NativeScript-Vue и прочие
    // кастомные рендереры через createRenderer) — там глобального `document` нет.
    // Проверяется ровно эта защита, поэтому document на время монтирования убран.
    const mn = makeMn();
    let mounted = false;

    interface FakeNode { type: string; children: FakeNode[]; parent: FakeNode | null; text?: string }
    const makeNode = (type: string): FakeNode => ({ type, children: [], parent: null });
    const { createApp: createFakeApp } = createRenderer<FakeNode, FakeNode>({
      createElement: (type: string) => makeNode(type),
      createText: (text: string) => Object.assign(makeNode('#text'), { text }),
      createComment: (text: string) => Object.assign(makeNode('#comment'), { text }),
      setText: (node, text) => { node.text = text; },
      setElementText: (node, text) => { node.text = text; },
      patchProp: () => undefined,
      insert: (child, parent) => { child.parent = parent; parent.children.push(child); },
      remove: (child) => { const i = child.parent ? child.parent.children.indexOf(child) : -1; if (i >= 0) child.parent!.children.splice(i, 1); },
      parentNode: (node) => node.parent,
      nextSibling: () => null,
    });

    const Widget = defineComponent({
      setup() {
        useMnRuntime(mn);
        mounted = true;
        return () => h('view', { class: 'p10' });
      },
    });

    const realDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', { value: undefined, configurable: true });
    try {
      const app = createFakeApp(Widget);
      expect(() => app.mount(makeNode('root'))).not.toThrow();
      app.unmount();
    } finally {
      Object.defineProperty(globalThis, 'document', { value: realDocument, configurable: true });
    }

    expect(mounted).toBe(true);
    expect(document.querySelector('style[data-mn-runtime]')).toBeNull();
  });
});