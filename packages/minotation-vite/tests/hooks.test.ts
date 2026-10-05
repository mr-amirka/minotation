/**
 * Dev-ветка плагина: HMR-клиент в `transformIndexHtml` и `handleHotUpdate`.
 * Реального dev-сервера здесь нет (он поднимал бы сокет и watcher на всю
 * сессию) — хуки вызываются напрямую, но на настоящей файловой системе
 * и настоящем mn-ядре; подменён только `server.ws.send`, чей вызов и проверяется.
 */
import { join } from 'path';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { mnVite, type MnViteOptions } from '../src/index';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Создаёт временный проект: ключ — относительный путь файла, значение — содержимое. */
function makeProject(files: Record<string, string>): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'mn-vite-hooks-')));
  for (const rel of Object.keys(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, files[rel]);
  }
  return root;
}

/** Плагин с уже применённым configResolved — как его настраивает сам Vite. */
function makePlugin(root: string, command: 'serve' | 'build', options: MnViteOptions = {}) {
  const plugin = mnVite(options) as any;
  plugin.configResolved({ root, command });
  return plugin;
}

function transformHtml(plugin: any, html: string): Array<{ tag: string; children: string }> {
  return plugin.transformIndexHtml.handler(html);
}

/** Мок только для транспорта сообщений dev-сервера. */
function makeServer() {
  return { ws: { send: jest.fn() } };
}

describe('minotation-vite — dev-хуки', () => {
  test('serve: в HTML добавляются MutationObserver, <style data-mn> и HMR-клиент', () => {
    const root = makeProject({ 'src/app.html': '<div class="p10"></div>' });
    const plugin = makePlugin(root, 'serve');

    const tags = transformHtml(plugin, '<html><head></head><body><div class="mt4"></div></body></html>');

    expect(tags).toHaveLength(3);
    expect(tags[0].children).toContain('MutationObserver');
    expect(tags[1].children).toContain('.p10{padding:10px}');
    expect(tags[1].children).toContain('.mt4{margin-top:4px}');
    expect(tags[2].children).toContain("import.meta.hot.on('mn:update'");
  });

  test('build: HMR-клиент не добавляется', () => {
    const root = makeProject({ 'src/app.html': '<div class="p10"></div>' });
    const plugin = makePlugin(root, 'build');

    const tags = transformHtml(plugin, '<html><head></head><body></body></html>');

    expect(tags).toHaveLength(2);
    expect(JSON.stringify(tags)).not.toContain('mn:update');
  });

  test('serve без единого токена: только HMR-клиент, без <style data-mn>', () => {
    const root = makeProject({ 'src/app.html': '<div></div>' });
    const plugin = makePlugin(root, 'serve', { presets: [] });

    const tags = transformHtml(plugin, '<html><head></head><body></body></html>');

    expect(tags).toHaveLength(1);
    expect(tags[0].children).toContain('mn:update');
  });

  test('hot update пресет-файла: пресет перезагружается, CSS уходит клиенту', () => {
    const root = makeProject({
      'src/app.html': '<div class="hotToken"></div>',
      'src/theme.mn.js': "export default (mn) => { mn('hotToken', 'cF00'); };\n",
    });
    const plugin = makePlugin(root, 'serve');
    transformHtml(plugin, '<html><head></head><body></body></html>');
    const server = makeServer();

    // пресет поменялся на диске — плагин обязан перечитать файл, а не отдать старый CSS
    writeFileSync(join(root, 'src/theme.mn.js'), "export default (mn) => { mn('hotToken', 'c0F0'); };\n");
    const result = plugin.handleHotUpdate({ file: join(root, 'src/theme.mn.js'), server });

    expect(result).toEqual([]);
    expect(server.ws.send).toHaveBeenCalledTimes(1);
    const sent = server.ws.send.mock.calls[0][0] as any;
    expect(sent.event).toBe('mn:update');
    expect(sent.data).toContain('.hotToken{color:#0f0}');
  });

  test('hot update битого пресета: пресет снимается, CSS пересобирается без него', () => {
    const root = makeProject({
      'src/app.html': '<div class="hotToken"></div>',
      'src/theme.mn.js': "export default (mn) => { mn('hotToken', 'cF00'); };\n",
    });
    const plugin = makePlugin(root, 'serve');
    transformHtml(plugin, '<html><head></head><body></body></html>');
    const server = makeServer();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    writeFileSync(join(root, 'src/theme.mn.js'), 'this is ( not ) valid javascript !!!\n');
    try {
      plugin.handleHotUpdate({ file: join(root, 'src/theme.mn.js'), server });
    } finally {
      errorSpy.mockRestore();
    }

    const sent = server.ws.send.mock.calls[0][0] as any;
    expect(sent.data).not.toContain('.hotToken{');
  });

  test('hot update файла приложения: новые токены попадают в CSS', () => {
    const root = makeProject({ 'src/app.html': '<div class="p10"></div>' });
    const plugin = makePlugin(root, 'serve');
    transformHtml(plugin, '<html><head></head><body></body></html>');
    const server = makeServer();

    writeFileSync(join(root, 'src/app.html'), '<div class="p10 mt4"></div>');
    plugin.handleHotUpdate({ file: join(root, 'src/app.html'), server });

    const sent = server.ws.send.mock.calls[0][0] as any;
    expect(sent.data).toContain('.mt4{margin-top:4px}');
  });

  test('hot update: файл потерял все токены — они выбывают из CSS', () => {
    const root = makeProject({ 'src/app.html': '<div class="mt4"></div>' });
    const plugin = makePlugin(root, 'serve', { presets: [] });
    transformHtml(plugin, '<html><head></head><body></body></html>');
    const server = makeServer();

    writeFileSync(join(root, 'src/app.html'), '<div></div>');
    plugin.handleHotUpdate({ file: join(root, 'src/app.html'), server });

    const sent = server.ws.send.mock.calls[0][0] as any;
    expect(sent.data).toBe('');
  });

  test('hot update удалённого файла: токены выбывают И клиент получает обновление', () => {
    // Q-09. Раньше плагин снимал токены с учёта и молча выходил — у клиента
    // оставались стили удалённого файла до ручной перезагрузки страницы.
    const root = makeProject({
      'src/app.html': '<div class="mt4"></div>',
      'src/keep.html': '<div class="p10"></div>',
    });
    const plugin = makePlugin(root, 'serve');
    transformHtml(plugin, '<html><head></head><body></body></html>');
    const server = makeServer();

    rmSync(join(root, 'src/app.html'));
    expect(() => plugin.handleHotUpdate({ file: join(root, 'src/app.html'), server })).not.toThrow();

    expect(server.ws.send).toHaveBeenCalledTimes(1);
    const sent = server.ws.send.mock.calls[0][0] as any;
    expect(sent.event).toBe('mn:update');
    expect(sent.data).not.toContain('.mt4{');
    expect(sent.data).toContain('.p10{'); // соседний файл не задет
  });

  test('hot update файла, которого и не было на учёте: лишней пересборки нет', () => {
    // Чтение может упасть и на файле, токенов в котором никогда не было —
    // рассылать по такому поводу обновление незачем.
    const root = makeProject({ 'src/app.html': '<div class="p10"></div>' });
    const plugin = makePlugin(root, 'serve', { presets: [] });
    transformHtml(plugin, '<html><head></head><body></body></html>');
    const server = makeServer();

    plugin.handleHotUpdate({ file: join(root, 'src/never-existed.html'), server });

    expect(server.ws.send).not.toHaveBeenCalled();
  });

  test('hot update постороннего файла игнорируется', () => {
    const root = makeProject({ 'src/app.html': '<div class="p10"></div>' });
    const plugin = makePlugin(root, 'serve');
    transformHtml(plugin, '<html><head></head><body></body></html>');
    const server = makeServer();

    const result = plugin.handleHotUpdate({ file: join(root, 'src/styles.css'), server });

    expect(result).toBeUndefined();
    expect(server.ws.send).not.toHaveBeenCalled();
  });

  test('конфигурация без логгера: предупреждение уходит в console, а не теряется', () => {
    // Логгер плагин берёт из `configResolved`. Когда хуки зовут напрямую — из
    // тестов или другого плагина — логгера может не быть; запасным каналом
    // остаётся console, иначе битый токен исчезал бы бесследно.
    const root = makeProject({ 'src/app.html': '<div class="p10 w10zz"></div>' });
    const plugin = makePlugin(root, 'build');
    const said: string[] = [];
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation((m) => { said.push(String(m)); });

    try {
      transformHtml(plugin, '<html><head></head><body></body></html>');
    } finally {
      warnSpy.mockRestore();
    }

    expect(said.join('\n')).toContain('[minotation] w10zz');
  });

  test('load для несуществующего пресет-файла: пустой модуль, ошибки нет', () => {
    const plugin = makePlugin(tmpdir(), 'build');

    expect(plugin.load(join(tmpdir(), 'no-such-dir-6c1f', 'ghost.mn.ts')))
      .toEqual({ code: 'export {};', map: null });
    // не-пресет id плагин не трогает
    expect(plugin.load(join(tmpdir(), 'main.ts'))).toBeNull();
  });
});

describe('minotation-vite — dev-middleware /mn.css (2026-10-05)', () => {
  /**
   * Мета-фреймворки без `transformIndexHtml` (Astro) получают CSS только по
   * ссылке — до этого в dev `/mn.css` отвечал 404, и страница была без стилей.
   */
  function serve(plugin: any, base: string | undefined, url: string | undefined) {
    let handler: any;
    plugin.configureServer({
      config: { base },
      middlewares: { use: (fn: any) => { handler = fn; } },
    });
    const headers: Record<string, string> = {};
    const res = {
      body: undefined as string | undefined,
      setHeader: (name: string, value: string) => { headers[name] = value; },
      end: (body: string) => { res.body = body; },
    };
    const next = jest.fn();
    handler({ url }, res, next);
    return { body: res.body, headers, next };
  }

  test('отдаёт актуальный CSS по /mn.css, query не мешает', () => {
    const root = makeProject({ 'src/app.html': '<div class="p10"></div>' });
    const plugin = makePlugin(root, 'serve');
    plugin.buildStart();

    const r = serve(plugin, '/', '/mn.css?t=123');

    expect(r.next).not.toHaveBeenCalled();
    expect(r.body).toContain('.p10{padding:10px}');
    expect(r.headers['Content-Type']).toBe('text/css; charset=utf-8');
    expect(r.headers['Cache-Control']).toBe('no-cache');
  });

  test('учитывает base, в том числе без завершающего слэша', () => {
    const root = makeProject({ 'src/app.html': '<div class="p10"></div>' });
    const plugin = makePlugin(root, 'serve');

    expect(serve(plugin, '/docs', '/docs/mn.css').next).not.toHaveBeenCalled();
    expect(serve(plugin, '/docs/', '/mn.css').next).toHaveBeenCalled();
    expect(serve(plugin, undefined, '/mn.css').next).not.toHaveBeenCalled();
  });

  test('предупреждения компиляции уходят в логгер Vite, без него — в console', () => {
    const root = makeProject({ 'src/app.html': '<div class="fx p10"></div>' });
    const warn = jest.fn();
    const withLogger = mnVite() as any;
    withLogger.configResolved({ root, command: 'serve', logger: { warn } });
    withLogger.buildStart();
    serve(withLogger, '/', '/mn.css');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[minotation] fx'));

    const spy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const plain = makePlugin(root, 'serve');
    plain.buildStart();
    serve(plain, '/', '/mn.css');
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[minotation] fx'));
    spy.mockRestore();
  });

  test('чужие запросы проходят дальше', () => {
    const plugin = makePlugin(makeProject({}), 'serve');

    expect(serve(plugin, '/', '/index.html').next).toHaveBeenCalled();
    expect(serve(plugin, '/', undefined).next).toHaveBeenCalled();
  });
});

describe('minotation-vite — attr массивом (2026-10-05)', () => {
  test('class и className собираются в одной сборке', () => {
    const root = makeProject({
      'src/Page.html': '<div class="p10"></div>',
      'src/Card.tsx': 'export const Card = () => <div className="m10" />;',
    });
    const plugin = makePlugin(root, 'build', { attr: ['class', 'className'] });

    const css = transformHtml(plugin, '<html><head></head><body></body></html>')
      .map((tag) => tag.children).join('');

    expect(css).toContain('.p10{padding:10px}');
    expect(css).toContain('.m10{margin:10px}');
  });
});
