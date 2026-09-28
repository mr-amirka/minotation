/**
 * Обход файлов и компиляция.
 *
 * Сканирование берётся из ядра (`scanTokens`) — свой разбор здесь заводить
 * нельзя: ровно так `classVarSuffixes` однажды оказался только в vite-плагине,
 * а остальные сборщики молча теряли токены из переменных.
 */
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync,
} from 'node:fs';
import {
  join,
} from 'node:path';
import {
  tmpdir,
} from 'node:os';
import {
  createServer,
} from 'node:net';
import {
  collectFiles, compile,
} from '../src/compile';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mn-cli-'));
});

afterEach(() => {
  rmSync(dir, {
    recursive: true,
    force: true,
  });
});

function write(name: string, text: string): string {
  const full = join(dir, name);
  mkdirSync(join(full, '..'), {
    recursive: true,
  });
  writeFileSync(
    full, text, 'utf8',
  );
  return full;
}

describe('collectFiles', () => {
  test('обходит директорию рекурсивно', () => {
    write('a.html', '');
    write('nested/b.tsx', '');
    expect(collectFiles(dir).sort()).toEqual([join(dir, 'a.html'), join(dir, 'nested/b.tsx')].sort());
  });

  test('пропускает node_modules, .git и сборки', () => {
    write('a.html', '');
    write('node_modules/pkg/b.html', '');
    write('dist/c.html', '');
    expect(collectFiles(dir)).toEqual([join(dir, 'a.html')]);
  });

  test('пропускает расширения, которых нет в списке', () => {
    write('a.html', '');
    write('b.css', '');
    write('c.md', '');
    expect(collectFiles(dir)).toEqual([join(dir, 'a.html')]);
  });

  test('одиночный файл принимается без фильтра по расширению', () => {
    // Автор уже выбрал файл сам — заставлять указывать директорию незачем.
    const file = write('page.tmpl', '<div class="p10">');
    expect(collectFiles(file)).toEqual([file]);
  });

  test('несуществующий путь — пустой список, а не исключение', () => {
    expect(collectFiles(join(dir, 'нет-такого'))).toEqual([]);
  });

  test('не файл и не директория — пропускается молча', async () => {
    // Сокет или очередь внутри проекта — не причина ронять сборку: прочитать
    // такое всё равно нечем, а `readFileSync` на нём повис бы.
    write('a.html', '');
    const socket = join(dir, 'ipc.sock');
    const server = createServer();
    await new Promise<void>((done) => server.listen(socket, done));
    try {
      expect(collectFiles(dir)).toEqual([join(dir, 'a.html')]);
    } finally {
      server.close();
    }
  });

  test('`ignore` исключает конкретные файлы', () => {
    write('a.html', '');
    const skipped = write('b.html', '');
    expect(collectFiles(
      dir, undefined, undefined, [skipped],
    )).toEqual([join(dir, 'a.html')]);
  });

  test('`include` и `exclude` задаются явно', () => {
    write('a.html', '');
    write('b.tsx', '');
    write('vendor/c.html', '');
    expect(collectFiles(dir, /\.html$/)).toEqual([join(dir, 'a.html'), join(dir, 'vendor/c.html')]);
    expect(collectFiles(
      dir, /\.html$/, /vendor/,
    )).toEqual([join(dir, 'a.html')]);
  });
});

describe('compile', () => {
  test('собирает токены из атрибута и переменных', () => {
    write('a.html', '<div class="p10 dF">');
    write('b.tsx', "const aClass = 'm5';");
    const result = compile({
      input: dir,
    });
    expect(result.files).toBe(2);
    expect(result.css).toContain('padding:10px');
    expect(result.css).toContain('display:flex');
    expect(result.css).toContain('margin:5px');
  });

  test('токены из комментариев не попадают в CSS', () => {
    write('a.html', '<!-- class="p99" --><div class="p10">');
    const css = compile({
      input: dir,
    }).css;
    expect(css).toContain('padding:10px');
    expect(css).not.toContain('padding:99px');
  });

  test('атрибут задаётся опцией', () => {
    write('a.tsx', '<div className="p10">');
    expect(compile({
      input: dir,
      attr: 'className',
    }).css).toContain('padding:10px');
  });

  test('префикс селекторов', () => {
    write('a.html', '<div class="p10">');
    expect(compile({
      input: dir,
      prefix: '.app',
    }).css).toContain('.app');
  });

  test('safelist добавляет токены, которых нет в файлах', () => {
    write('a.html', '<div class="p10">');
    expect(compile({
      input: dir,
      safelist: ['m20'],
    }).css).toContain('margin:20px');
  });

  test('битый токен возвращается предупреждением, а не печатается', () => {
    // Что с ним делать — решает вызывающий: у CLI это зависит от `--strict`.
    write('a.html', '<div class="w10zz">');
    const result = compile({
      input: dir,
    });
    expect(result.warnings.length).toBe(1);
  });

  test('пустая директория даёт пустой набор токенов', () => {
    const result = compile({
      input: dir,
    });
    expect(result.files).toBe(0);
    expect(result.tokens).toBe(0);
  });
});
