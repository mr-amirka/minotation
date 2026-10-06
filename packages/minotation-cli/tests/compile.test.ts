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

  test('атрибут разворачивается в class — className:class', () => {
    write('a.tsx', '<div className="p10">');
    expect(compile({
      input: dir,
      attrs: 'className:class',
    }).css).toContain('.p10{padding:10px}');
  });

  test('устаревший attr из конфига — ошибка с подсказкой', () => {
    write('a.html', '<div class="p10">');
    expect(() => compile({
      input: dir,
      attr: 'className',
    } as never)).toThrow("use attrs: 'className:class'");
  });

  test('атрибут без цели разворачивается в себя — [m~="p10"], как в v1', () => {
    write('a.html', '<div class="w20" m="p10">');
    const result = compile({
      input: dir,
      attrs: 'class, m',
      metrics: true,
    });
    expect(result.css).toContain('[m~="p10"]{padding:10px}');
    expect(result.css).toContain('.w20{width:20px}');
    expect(JSON.stringify(result.metrics)).toContain('m:p10');
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

  test('по умолчанию .tsx разбирается парсером', () => {
    // Текстовый сканер комментарии вырезает сам, а вот кавычка внутри
    // регулярного литерала его сбивает — парсеру это безразлично.
    write('a.tsx', 'const re = /"/;\n// class="p99"\n<div class="p10" />;');
    const parsed = compile({
      input: dir,
    });
    expect(parsed.css).toContain('padding:10px');
    expect(parsed.css).not.toContain('padding:99px');
  });

  test('`syntax: false` возвращает текстовый разбор со всеми его промахами', () => {
    write('a.tsx', 'const re = /"/;\n// class="p99"\n<div class="p10" />;');
    const plain = compile({
      input: dir,
      syntax: false,
    });
    expect(plain.css).toContain('padding:10px');
    expect(plain.css).toContain('padding:99px');
  });

  test('прочие форматы сканируются текстом при любом значении', () => {
    write('a.html', '<div class="p10">');
    expect(compile({
      input: dir,
    }).css).toContain('padding:10px');
    expect(compile({
      input: dir,
      syntax: true,
    }).css).toContain('padding:10px');
  });

  test('пустая директория даёт пустой набор токенов', () => {
    const result = compile({
      input: dir,
    });
    expect(result.files).toBe(0);
    expect(result.tokens).toBe(0);
  });
});

/**
 * Статистика употребления токенов — перенос опции `--metrics` из v1.
 *
 * Формат тот же: список `{name, count}` по убыванию частоты. Разбивка по
 * файлам лежит рядом, а не в отдельном отчёте: в v1 это были две опции,
 * писавшие два файла с пересекающимся содержимым.
 */
describe('метрики', () => {
  test('считает употребления по всему проекту и по файлам', () => {
    write('a.html', '<div class="p10 p10 m20"></div>');
    write('b.html', '<div class="p10"></div>');

    const metrics = compile({
      input: dir,
      metrics: true,
    }).metrics!;

    expect(metrics.filesScanned).toBe(2);
    expect(metrics.tokensTotal).toBe(2);
    expect(metrics.occurrences).toBe(4);
    // По убыванию частоты: p10 встретился трижды, m20 — один раз.
    expect(metrics.tokens).toEqual([{
      name: 'p10',
      count: 3,
    }, {
      name: 'm20',
      count: 1,
    }]);
    expect(metrics.files[join(dir, 'b.html')]).toEqual([{
      name: 'p10',
      count: 1,
    }]);
  });

  test('при равной частоте порядок по имени — отчёт воспроизводим', () => {
    // Иначе две выгрузки одного проекта нечем сравнить.
    write('a.html', '<div class="w50 m20 p10"></div>');

    const names = compile({
      input: dir,
      metrics: true,
    }).metrics!.tokens.map((t) => t.name);

    expect(names).toEqual([
      'm20',
      'p10',
      'w50',
    ]);
  });

  test('файлы без токенов в отчёт не попадают', () => {
    write('a.html', '<div class="p10"></div>');
    write('empty.html', '<div></div>');

    const files = compile({
      input: dir,
      metrics: true,
    }).metrics!.files;

    expect(Object.keys(files)).toEqual([join(dir, 'a.html')]);
  });

  test('без опции статистика не собирается', () => {
    // Счётчики по файлам — запись на каждый файл в памяти; обычной сборке
    // они не нужны.
    write('a.html', '<div class="p10"></div>');
    expect(compile({
      input: dir,
    }).metrics).toBeUndefined();
  });

  test('safelist в статистику не попадает — его в файлах не было', () => {
    write('a.html', '<div class="p10"></div>');
    const metrics = compile({
      input: dir,
      metrics: true,
      safelist: ['m20'],
    }).metrics!;

    // В счётчики употребления safelist не попадает: в файлах его не было.
    expect(metrics.tokens.map((t) => t.name)).toEqual(['p10']);
    // А в общем числе токенов — да: оно про то, что уехало в CSS.
    expect(metrics.tokensTotal).toBe(2);
  });
});
