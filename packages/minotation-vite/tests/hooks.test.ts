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

  test('load для несуществующего пресет-файла: пустой модуль, ошибки нет', () => {
    const plugin = makePlugin(tmpdir(), 'build');

    expect(plugin.load(join(tmpdir(), 'no-such-dir-6c1f', 'ghost.mn.ts')))
      .toEqual({ code: 'export {};', map: null });
    // не-пресет id плагин не трогает
    expect(plugin.load(join(tmpdir(), 'main.ts'))).toBeNull();
  });
});
