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

/**
 * Мок транспорта сообщений dev-сервера и графа модулей: в графе — модуль
 * `virtual:mn.css` и посторонний модуль, который трогать нельзя.
 */
function makeServer() {
  const mnModule = { id: '/__mn/mn.css' };
  const other = { id: '/src/main.js' };
  return {
    ws: { send: jest.fn() },
    mnModule,
    moduleGraph: {
      idToModuleMap: new Map<string, { id: string | null }>([
        ['/__mn/mn.css', mnModule],
        ['/src/main.js', other],
        ['virtual', { id: null }],
      ]),
      invalidateModule: jest.fn(),
    },
  };
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

    // Только модуль CSS: свой модуль пресета пуст, перезагружать нечего.
    expect(result).toEqual([server.mnModule]);
    expect(server.moduleGraph.invalidateModule).toHaveBeenCalledWith(server.mnModule);
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

describe('minotation-vite — модуль virtual:mn.css (D-031)', () => {
  /** Загрузка модуля так, как это делает Vite. */
  function load(plugin: any, id: string, warn = jest.fn()): string {
    return plugin.load.call({ warn }, plugin.resolveId(id)).code;
  }

  test('virtual:mn.css и virtual:mn/<запись>.css разрешаются в адреса графа', () => {
    const plugin = makePlugin(makeProject({}), 'serve');
    expect(plugin.resolveId('virtual:mn.css')).toBe('/__mn/mn.css');
    expect(plugin.resolveId('virtual:mn/admin.css')).toBe('/__mn/entry/admin.css');
    // Ссылка из index.html (`inject: 'link'`) приходит уже адресом, с query в dev.
    expect(plugin.resolveId('/__mn/mn.css?direct')).toBe('/__mn/mn.css');
    expect(plugin.resolveId('/src/main.js')).toBeNull();
    expect(plugin.load.call({ warn: jest.fn() }, '/src/main.js')).toBeNull();
  });

  test('модуль отдаёт CSS всех записей или одной; предупреждения — в лог', () => {
    const root = makeProject({
      'src/site/a.html': '<div class="p10"></div>',
      'src/admin/b.html': '<div class="m20 w10zz"></div>',
    });
    const plugin = makePlugin(root, 'build', {
      entry: { site: { include: /site/ }, admin: { include: /admin/ } },
    });
    plugin.buildStart();
    const warn = jest.fn();

    expect(load(plugin, 'virtual:mn.css', warn)).toContain('padding:10px');
    expect(load(plugin, 'virtual:mn.css')).toContain('margin:20px');
    expect(load(plugin, 'virtual:mn/site.css')).not.toContain('margin:20px');
    expect(load(plugin, 'virtual:mn/admin.css')).toContain('margin:20px');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[minotation] w10zz'));
    expect(() => load(plugin, 'virtual:mn/nope.css')).toThrow('no such entry; declared: site, admin');
  });

  test("inject: 'link' — в HTML ссылка на модуль, без инлайна", () => {
    const plugin = makePlugin(makeProject({ 'src/a.html': '<div class="p10"></div>' }), 'build', { inject: 'link' });
    expect(transformHtml(plugin, '<html><head></head><body></body></html>')).toEqual([{
      tag: 'link',
      attrs: { rel: 'stylesheet', href: '/__mn/mn.css' },
    }]);
  });

  test('inject: false — HTML не трогается', () => {
    const plugin = makePlugin(makeProject({ 'src/a.html': '<div class="p10"></div>' }), 'serve', { inject: false });
    expect(transformHtml(plugin, '<html><head></head><body></body></html>')).toEqual([]);
  });

  test('правка файла: модуль CSS пересылается штатным HMR вместе с изменённым модулем', () => {
    const root = makeProject({ 'src/app.html': '<div class="p10"></div>' });
    const plugin = makePlugin(root, 'serve', { inject: false });
    plugin.buildStart();
    const server = makeServer();
    const changed = { id: join(root, 'src/app.html') };

    writeFileSync(join(root, 'src/app.html'), '<div class="p10 mt4"></div>');
    const result = plugin.handleHotUpdate({ file: join(root, 'src/app.html'), server, modules: [changed] });

    expect(result).toEqual([changed, server.mnModule]);
    // Без инлайна событие `mn:update` слать некому.
    expect(server.ws.send).not.toHaveBeenCalled();
  });

  test('битый пресет, которого и не было на учёте: CSS не меняется, модуль пресета не перезагружается', () => {
    const root = makeProject({ 'src/new.mn.js': 'this is ( not ) valid javascript !!!\n' });
    const plugin = makePlugin(root, 'serve');
    const server = makeServer();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(plugin.handleHotUpdate({ file: join(root, 'src/new.mn.js'), server })).toEqual([]);
    } finally {
      errorSpy.mockRestore();
    }
    expect(server.ws.send).not.toHaveBeenCalled();
  });

  test('правка без изменения токенов: HMR не трогается', () => {
    const root = makeProject({ 'src/app.html': '<div class="p10"></div>' });
    const plugin = makePlugin(root, 'serve');
    plugin.buildStart();
    const server = makeServer();

    expect(plugin.handleHotUpdate({ file: join(root, 'src/app.html'), server })).toBeUndefined();
    expect(server.ws.send).not.toHaveBeenCalled();
  });
});

describe('minotation-vite — attr массивом (2026-10-05)', () => {
  test('class и className собираются в одной сборке', () => {
    const root = makeProject({
      'src/Page.html': '<div class="p10"></div>',
      'src/Card.tsx': 'export const Card = () => <div className="m10" />;',
    });
    const plugin = makePlugin(root, 'build', { attrs: ['class', 'className:class'] });

    const css = transformHtml(plugin, '<html><head></head><body></body></html>')
      .map((tag) => tag.children).join('');

    expect(css).toContain('.p10{padding:10px}');
    expect(css).toContain('.m10{margin:10px}');
  });
});

describe('minotation-vite — отбор файлов из эталонного набора (D-026)', () => {
  function cssOf(root: string, options: MnViteOptions): string {
    const plugin = makePlugin(root, 'build', options);
    return transformHtml(plugin, '<html><head></head><body></body></html>')
      .map((tag) => tag.children).join('');
  }

  test('include заменяет extensions; exclude и skipPartials отсекают', () => {
    const root = makeProject({
      'src/a.html': '<div class="p10"></div>',
      'src/_part.html': '<div class="m10"></div>',
      'src/page.tpl': '<div class="w20"></div>',
      'src/skip.tpl': '<div class="h30"></div>',
    });
    const css = cssOf(root, {
      include: [/\.tpl$/, /\.html$/],
      exclude: 'src/skip.tpl',
      skipPartials: true,
    });
    expect(css).toContain('.p10{padding:10px}');
    expect(css).toContain('.w20{width:20px}');
    expect(css).not.toContain('margin:10px');
    expect(css).not.toContain('height:30px');
  });

  test('root задаёт корень первичного скана вместо src/', () => {
    const root = makeProject({
      'src/a.html': '<div class="p10"></div>',
      'templates/b.html': '<div class="m10"></div>',
    });
    const css = cssOf(root, { root: join(root, 'templates') });
    expect(css).toContain('.m10{margin:10px}');
    expect(css).not.toContain('padding:10px');
  });
});
