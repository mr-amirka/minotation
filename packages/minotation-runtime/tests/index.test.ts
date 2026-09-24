/**
 * Реальный DOM (jsdom) + реальный `minotationProvider`, не моки — см. MEMORY
 * `feedback_bundler_plugins_need_real_builds.md`: мок MutationObserver/mn-инстанса
 * не поймал бы баг вида "начальный скан не находит уже смонтированные узлы"
 * или "изменение class-атрибута не подхватывается".
 */
import { minotationProvider, presetStandard } from 'minotation';
import { createMnRuntime } from '../src/index';

function makeMn() {
  const mn = minotationProvider();
  mn.setPresets([presetStandard]);
  return mn;
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('minotation-runtime — реальный DOM', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.head.querySelectorAll('style[data-mn-runtime]').forEach((el) => el.remove());
  });

  test('начальный скан: элемент, уже существующий в DOM до старта, компилируется', async () => {
    document.body.innerHTML = '<div class="p10"></div>';
    const runtime = createMnRuntime(makeMn(), { root: document.body });
    await flushMicrotasks();

    const style = document.querySelector('style[data-mn-runtime]');
    expect(style?.textContent).toContain('.p10{padding:10px}');
    runtime.stop();
  });

  test('несколько токенов в одном class — оба компилируются', async () => {
    document.body.innerHTML = '<div class="p10 mt4"></div>';
    const runtime = createMnRuntime(makeMn(), { root: document.body });
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).toContain('.p10{padding:10px}');
    expect(css).toContain('.mt4{margin-top:4px}');
    runtime.stop();
  });

  test('динамически добавленный узел подхватывается MutationObserver', async () => {
    document.body.innerHTML = '';
    const runtime = createMnRuntime(makeMn(), { root: document.body });
    await flushMicrotasks();

    const div = document.createElement('div');
    div.className = 'w50%';
    document.body.appendChild(div);
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).toContain('.w50\\%{width:50%}');
    runtime.stop();
  });

  test('изменение class-атрибута на существующем узле подхватывается', async () => {
    document.body.innerHTML = '<div id="target" class="p10"></div>';
    const runtime = createMnRuntime(makeMn(), { root: document.body });
    await flushMicrotasks();

    document.getElementById('target')!.className = 'bgF';
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).toContain('.bgF{background:#fff}');
    runtime.stop();
  });

  test('stop() останавливает наблюдение — новые узлы после stop() не компилируются', async () => {
    document.body.innerHTML = '';
    const runtime = createMnRuntime(makeMn(), { root: document.body });
    await flushMicrotasks();
    runtime.stop();

    const div = document.createElement('div');
    div.className = 'fw5';
    document.body.appendChild(div);
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).not.toContain('fw5');
  });

  test('без options: корень — document целиком, дефолтные attr/styleAttr', async () => {
    document.body.innerHTML = '<div class="p10"></div>';
    const runtime = createMnRuntime(makeMn());
    await flushMicrotasks();

    const style = document.querySelector('style[data-mn-runtime]');
    expect(style?.textContent).toContain('.p10{padding:10px}');
    runtime.stop();
  });

  test('кастомный attr: токены берутся из него, class игнорируется', async () => {
    document.body.innerHTML = '<div data-mn="p10" class="mt4"></div>';
    const runtime = createMnRuntime(makeMn(), { root: document.body, attr: 'data-mn' });
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    // При нестандартном attr ядро генерирует атрибутный селектор, не классовый
    expect(css).toContain('[data-mn~="p10"]{padding:10px}');
    expect(css).not.toContain('margin-top');
    runtime.stop();
  });

  test('кастомный styleAttr: <style> помечается им, а не data-mn-runtime', async () => {
    document.body.innerHTML = '<div class="p10"></div>';
    const runtime = createMnRuntime(makeMn(), { root: document.body, styleAttr: 'data-custom-mn' });
    await flushMicrotasks();

    expect(document.querySelector('style[data-mn-runtime]')).toBeNull();
    expect(document.querySelector('style[data-custom-mn]')?.textContent).toContain('.p10{padding:10px}');
    runtime.stop();
    document.head.querySelectorAll('style[data-custom-mn]').forEach((el) => el.remove());
  });

  test('пустой атрибут и лишние пробелы не ломают скан', async () => {
    document.body.innerHTML = '<div class=""></div><div class="  p10   mt4  "></div>';
    const runtime = createMnRuntime(makeMn(), { root: document.body });
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).toContain('.p10{padding:10px}');
    expect(css).toContain('.mt4{margin-top:4px}');
    runtime.stop();
  });

  test('добавленный текстовый узел не считается изменением (нет лишней компиляции)', async () => {
    document.body.innerHTML = '';
    const mn = makeMn();
    let compileCalls = 0;
    const origCompile = mn.compile.bind(mn);
    mn.compile = () => {
      compileCalls++;
      origCompile();
    };
    const runtime = createMnRuntime(mn, { root: document.body });
    await flushMicrotasks();
    const afterStart = compileCalls;

    document.body.appendChild(document.createTextNode('просто текст'));
    await flushMicrotasks();

    expect(compileCalls).toBe(afterStart);
    runtime.stop();
  });

  test('несколько мутаций в одном тике дают один flush (дебаунс)', async () => {
    document.body.innerHTML = '';
    const mn = makeMn();
    let compileCalls = 0;
    const origCompile = mn.compile.bind(mn);
    mn.compile = () => {
      compileCalls++;
      origCompile();
    };
    const runtime = createMnRuntime(mn, { root: document.body });
    await flushMicrotasks();
    const afterStart = compileCalls;

    for (let i = 0; i < 3; i++) {
      const div = document.createElement('div');
      div.className = 'p' + (i + 1);
      document.body.appendChild(div);
    }
    await flushMicrotasks();

    expect(compileCalls).toBe(afterStart + 1);
    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).toContain('.p3{padding:3px}');
    runtime.stop();
  });

  test('вложенный узел (не прямой child) в добавленном поддереве тоже сканируется', async () => {
    document.body.innerHTML = '';
    const runtime = createMnRuntime(makeMn(), { root: document.body });
    await flushMicrotasks();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<section><span class="dB"></span></section>';
    document.body.appendChild(wrapper);
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).toContain('.dB{display:block}');
    runtime.stop();
  });
});
