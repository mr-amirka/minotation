/**
 * Реальный React 18 (`createRoot`) + реальный DOM (jsdom) + реальный
 * `minotationProvider` — не моки. JSX здесь компилируется через automatic
 * JSX runtime (`"jsx": "react-jsx"`, tsconfig этого пакета) — то есть именно
 * тот путь рендера, на котором ломался старый `React.createElement`-патч
 * (см. `minotation-runtime`'s `src/index.ts` module doc). Прохождение этих
 * тестов — прямое доказательство, что новый DOM-based подход с этим путём
 * рендера работает.
 */
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
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

function Widget({ mn }: { mn: ReturnType<typeof makeMn> }) {
  useMnRuntime(mn, { root: document.body });
  return <div className="p10 dF">widget</div>;
}

describe('minotation-runtime-react — реальный React 18 (automatic JSX runtime)', () => {
  let container: HTMLDivElement;
  let root: Root;
  let unmounted: boolean;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    unmounted = false;
  });

  afterEach(() => {
    if (!unmounted) act(() => root.unmount());
    container.remove();
    document.head.querySelectorAll('style[data-mn-runtime]').forEach((el) => el.remove());
  });

  test('компонент, отрендеренный через automatic JSX runtime, компилируется рантаймом', async () => {
    const mn = makeMn();
    root = createRoot(container);
    await act(async () => {
      root.render(<Widget mn={mn} />);
    });
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).toContain('.p10{padding:10px}');
    expect(css).toContain('.dF{display:flex}');
  });

  test('размонтирование компонента останавливает рантайм', async () => {
    const mn = makeMn();
    root = createRoot(container);
    await act(async () => {
      root.render(<Widget mn={mn} />);
    });
    await flushMicrotasks();

    await act(async () => {
      root.unmount();
    });
    unmounted = true;

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

    function ScopedWidget() {
      useMnRuntime(mn, { rootRef: { current: scoped } });
      return null;
    }

    root = createRoot(container);
    await act(async () => {
      root.render(<ScopedWidget />);
    });
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
    outside.remove();
    scoped.remove();
  });
});
