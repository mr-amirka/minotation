/**
 * Реальный jsdom + реальный React 18 + реальный `minotationProvider` — не
 * моки. Главное, что здесь нужно доказать эмпирически (не по описанию кода):
 * два `<MnIframe>` реально ИЗОЛИРОВАНЫ — стили одного не текут в другой и
 * не текут в родительский документ.
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { presetStandard } from 'minotation';
import { MnIframe } from '../src/index';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('MnIframe — изоляция стилей между инстансами', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test('контент рендерится внутри contentDocument через портал, стили — в contentDocument.head', async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(
        <MnIframe title="widget">
          <div className="p10 bgF" data-testid="inner">внутри iframe</div>
        </MnIframe>,
      );
    });
    await flushMicrotasks();

    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    const inner = iframe.contentDocument!.querySelector('[data-testid="inner"]');
    expect(inner?.textContent).toBe('внутри iframe');

    const style = iframe.contentDocument!.querySelector('style[data-mn-runtime]');
    expect(style?.textContent).toContain('.p10{padding:10px}');
    expect(style?.textContent).toContain('.bgF{background:#fff}');

    // родительский документ НЕ должен получить эти стили — своей рантайм-разметки нет
    expect(document.querySelector('style[data-mn-runtime]')).toBeNull();
  });

  test('два MnIframe изолированы друг от друга — уникальный токен одного не течёт в другой', async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(
        <>
          <MnIframe title="widget-1">
            <div className="c0">A</div>
          </MnIframe>
          <MnIframe title="widget-2">
            <div className="bgF">B</div>
          </MnIframe>
        </>,
      );
    });
    await flushMicrotasks();

    const [iframe1, iframe2] = Array.from(container.querySelectorAll('iframe'));
    const css1 = iframe1.contentDocument!.querySelector('style[data-mn-runtime]')?.textContent || '';
    const css2 = iframe2.contentDocument!.querySelector('style[data-mn-runtime]')?.textContent || '';

    expect(css1).toContain('.c0{color:#000}');
    expect(css1).not.toContain('bgF');
    expect(css2).toContain('.bgF{background:#fff}');
    expect(css2).not.toContain('.c0{');
  });

  test('iframe уже загружен к моменту эффекта: монтирование идёт синхронно, без ожидания load', async () => {
    // В jsdom свежесозданный <iframe> на момент useEffect ещё в readyState
    // 'loading' — в реальном браузере about:blank часто готов сразу. Второй
    // путь ветвления воспроизводится подменой readyState на прототипе:
    // сам contentDocument остаётся настоящим, событие load не диспатчится.
    const orig = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument')!;
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
      configurable: true,
      get(this: HTMLIFrameElement) {
        const d = orig.get!.call(this) as Document | null;
        if (d && d.readyState !== 'complete') {
          Object.defineProperty(d, 'readyState', { configurable: true, get: () => 'complete' });
        }
        return d;
      },
    });

    try {
      await act(async () => {
        root = createRoot(container);
        root.render(<MnIframe title="ready"><div className="p10">готов сразу</div></MnIframe>);
      });
      await flushMicrotasks();

      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      expect(iframe.contentDocument!.body.textContent).toBe('готов сразу');
      expect(iframe.contentDocument!.querySelector('style[data-mn-runtime]')?.textContent)
        .toContain('.p10{padding:10px}');
    } finally {
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', orig);
    }
  });

  test('cross-origin iframe (contentDocument === null): монтирования нет, ошибки нет', async () => {
    const orig = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument')!;
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', { configurable: true, get: () => null });

    try {
      await act(async () => {
        root = createRoot(container);
        root.render(<MnIframe title="cross-origin"><div className="p10">не смонтируется</div></MnIframe>);
      });
      const iframe = container.querySelector('iframe') as HTMLIFrameElement;
      await act(async () => {
        iframe.dispatchEvent(new Event('load'));
      });
      await flushMicrotasks();

      expect(document.querySelector('style[data-mn-runtime]')).toBeNull();
    } finally {
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', orig);
    }
  });

  test('кастомные presets и attr применяются вместо умолчаний', async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <MnIframe title="custom" presets={[presetStandard]} attr="data-mn">
          <div data-mn="p10 c0">через data-mn</div>
        </MnIframe>,
      );
    });
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    await act(async () => {
      iframe.dispatchEvent(new Event('load'));
    });
    await flushMicrotasks();

    const css = iframe.contentDocument!.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).toContain('[data-mn~="p10"]{padding:10px}');
    expect(css).toContain('[data-mn~="c0"]{color:#000}');
  });
});