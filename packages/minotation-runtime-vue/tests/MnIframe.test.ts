/**
 * Реальный jsdom + реальный Vue 3 + реальный `minotationProvider` — не моки.
 * Главное, что нужно доказать эмпирически: два `<MnIframe>` реально
 * ИЗОЛИРОВАНЫ (стили одного не текут в другой/в родительский документ).
 */
import { createApp, h } from 'vue';
import { MnIframe } from '../src/MnIframe';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('MnIframe (Vue) — изоляция стилей между инстансами', () => {
  let container: HTMLDivElement;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    app.unmount();
    container.remove();
  });

  test('контент рендерится внутри contentDocument, стили — в contentDocument.head', async () => {
    app = createApp({
      render: () => h(MnIframe, { title: 'widget' }, {
        default: () => h('div', { class: 'p10 bgF', 'data-testid': 'inner' }, 'внутри iframe'),
      }),
    });
    app.mount(container);
    await flushMicrotasks();

    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    const inner = iframe.contentDocument!.querySelector('[data-testid="inner"]');
    expect(inner?.textContent).toBe('внутри iframe');

    const style = iframe.contentDocument!.querySelector('style[data-mn-runtime]');
    expect(style?.textContent).toContain('.p10{padding:10px}');
    expect(style?.textContent).toContain('.bgF{background:#fff}');

    expect(document.querySelector('style[data-mn-runtime]')).toBeNull();
  });

  test('два MnIframe изолированы друг от друга — уникальный токен одного не течёт в другой', async () => {
    app = createApp({
      render: () => h('div', [
        h(MnIframe, { title: 'widget-1' }, { default: () => h('div', { class: 'c0' }, 'A') }),
        h(MnIframe, { title: 'widget-2' }, { default: () => h('div', { class: 'bgF' }, 'B') }),
      ]),
    });
    app.mount(container);
    await flushMicrotasks();

    const [iframe1, iframe2] = Array.from(container.querySelectorAll('iframe'));
    const css1 = iframe1.contentDocument!.querySelector('style[data-mn-runtime]')?.textContent || '';
    const css2 = iframe2.contentDocument!.querySelector('style[data-mn-runtime]')?.textContent || '';

    expect(css1).toContain('.c0{color:#000}');
    expect(css1).not.toContain('bgF');
    expect(css2).toContain('.bgF{background:#fff}');
    expect(css2).not.toContain('.c0{');
  });
});
