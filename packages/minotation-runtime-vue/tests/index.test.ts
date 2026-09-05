/**
 * Реальный jsdom + реальный Vue 3 (createApp/mount) + реальный
 * `minotationProvider` — не моки.
 */
import { createApp, defineComponent, h, ref } from 'vue';
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
});
