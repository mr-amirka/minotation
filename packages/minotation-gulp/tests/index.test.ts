/**
 * Плагин проверяется настоящим gulp-пайпом, а не моком потока — по тому же
 * правилу, что vite/webpack/rollup/esbuild проверяются реальными сборками
 * (MEMORY `feedback_bundler_plugins_need_real_builds.md`). Мок пропустил бы
 * ровно то, ради чего плагин и пишут: что файл доходит до `gulp.dest`, что
 * относительный путь считается от `base`, что `isStream`-файл не роняет пайп.
 */
import {
  mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import {
  join,
} from 'node:path';
import {
  tmpdir,
} from 'node:os';
import {
  Readable,
} from 'node:stream';
import gulp from 'gulp';
import Vinyl from 'vinyl';
import {
  mnGulp,
} from '../src/index';
import type {
  MnGulpOptions,
} from '../src/index';

let dir: string;
/**
 * Каталог назначения ВНЕ сканируемого.
 *
 * Иначе рекурсивный шаблон (`**\/*.html`) подхватывает то, что `gulp.dest`
 * туда же и пишет: glob читает дерево параллельно с записью, поток получает
 * собственный вывод обратно на вход и не завершается.
 */
let dest: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mn-gulp-'));
  dest = mkdtempSync(join(tmpdir(), 'mn-gulp-dest-'));
});

afterEach(() => {
  for (const path of [dir, dest]) {
    rmSync(path, {
      recursive: true,
      force: true,
    });
  }
});

/** Создаёт файл проекта; путь относительный. */
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

/** Читает файлы каталога; подкаталоги пропускает — их содержимое не проверяем. */
function filesIn(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  // §6.2: переменная тела цикла объявляется один раз, до него.
  let full: string;
  for (const name of readdirSync(root)) {
    full = join(root, name);
    statSync(full).isFile() && (out[name] = readFileSync(full, 'utf8'));
  }
  return out;
}

/** Прогоняет настоящий gulp-пайп и возвращает содержимое каталога назначения. */
function run(pattern: string, options: MnGulpOptions = {}): Promise<Record<string, string>> {
  const out = dest;
  return new Promise((resolve, reject) => {
    // `gulp.dest` — duplex: без `resume()` его читаемую сторону никто не
    // потребляет, и событие `end` не наступает вовсе.
    gulp.src(join(dir, pattern))
      .pipe(mnGulp(options))
      .pipe(gulp.dest(out))
      .on('error', reject)
      .resume()
      .on('end', () => {
        try {
          resolve(filesIn(out));
        } catch (ex) {
          // Без перехвата исключение отсюда никуда не всплывает: промис
          // просто не завершается, и тест падает по таймауту вместо
          // внятного сообщения.
          reject(ex);
        }
      });
  });
}

describe('mnGulp — реальный пайп', () => {
  test('собирает токены со всех файлов и отдаёт CSS в поток', async () => {
    write('a.html', '<div class="p10">');
    write('b.html', '<div class="m20">');

    const files = await run('*.html');

    expect(files['mn.css']).toContain('padding:10px');
    expect(files['mn.css']).toContain('margin:20px');
    // Исходные файлы проходят насквозь — их забирает `gulp.dest`.
    expect(files['a.html']).toBe('<div class="p10">');
  });

  test('вызов без опций: атрибут `class`, файл `mn.css`', async () => {
    write('a.html', '<div class="p10">');

    const files = await new Promise<Record<string, string>>((resolve, reject) => {
      gulp.src(join(dir, '*.html'))
        .pipe(mnGulp())
        .pipe(gulp.dest(dest))
        .on('error', reject)
        .resume()
        .on('end', () => resolve(filesIn(dest)));
    });

    expect(files['mn.css']).toContain('padding:10px');
  });

  test('имя выходного файла задаётся опцией', async () => {
    write('a.html', '<div class="p10">');

    const files = await run('*.html', {
      fileName: 'app.css',
    });

    expect(files['app.css']).toContain('padding:10px');
    expect(files['mn.css']).toBeUndefined();
  });

  test('без единого токена CSS-файл не появляется', async () => {
    // Иначе `gulp.dest` создал бы пустой файл, и в разметке появилась бы
    // ссылка на него.
    write('a.html', '<div>');

    const files = await run('*.html', {
      presets: [],
    });

    expect(files['mn.css']).toBeUndefined();
    expect(files['a.html']).toBe('<div>');
  });

  test('опции сканера доходят до каркаса', async () => {
    write('a.tsx', '<div className="p10">');
    write('b.tsx', 'const rowCls = "m20";');

    const files = await run('*.tsx', {
      attrs: 'className:class',
      classVarSuffixes: ['Cls'],
    });

    expect(files['mn.css']).toContain('padding:10px');
    expect(files['mn.css']).toContain('margin:20px');
  });

  test('опции ядра доходят до компиляции', async () => {
    write('a.html', '<div class="p10">');

    const files = await run('*.html', {
      selectorPrefix: '.app ',
    });

    expect(files['mn.css']).toContain('.app .p10');
  });

  test('`exclude` исключает файлы из сканирования, но не из пайпа', async () => {
    write('page.html', '<div class="p10">');
    write('_partial.html', '<div class="m20">');

    const files = await run('*.html', {
      exclude: /[\\/]_/,
    });

    expect(files['mn.css']).toContain('padding:10px');
    expect(files['mn.css']).not.toContain('margin:20px');
    // Сам файл дальше по пайпу идёт: исключение только про токены.
    expect(files['_partial.html']).toBe('<div class="m20">');
  });

  test('партиалы `_*` сканируются по умолчанию, skipPartials их пропускает (D-027)', async () => {
    write('page.html', '<div class="p10">');
    write('_partial.html', '<div class="m20">');

    expect((await run('*.html'))['mn.css']).toContain('margin:20px');

    const files = await run('*.html', {
      skipPartials: true,
    });
    expect(files['mn.css']).toContain('padding:10px');
    expect(files['mn.css']).not.toContain('margin:20px');
    expect(files['_partial.html']).toBe('<div class="m20">');
  });

  test('вложенные каталоги: CSS ложится в корень назначения', async () => {
    // Путь CSS считается от `base` первого файла — иначе он уехал бы в
    // `dest` по абсолютному пути исходника.
    write('nested/deep/a.html', '<div class="p10">');

    const files = await run('**/*.html');

    expect(files['mn.css']).toContain('padding:10px');
  });

  test('синтаксический разбор работает и здесь', async () => {
    // Каркас общий, значит `.tsx` разбирается парсером без отдельной настройки.
    write('a.tsx', 'const re = /"/;\n// class="p99"\n<div class="p10" />;');

    const files = await run('*.tsx');

    expect(files['mn.css']).toContain('padding:10px');
    expect(files['mn.css']).not.toContain('padding:99px');
  });
});

describe('mnGulp — особые файлы потока', () => {
  /** Прогоняет плагин напрямую: такие файлы через `gulp.src` не получить. */
  function pipeThrough(file: Vinyl): Promise<Vinyl[]> {
    const out: Vinyl[] = [];
    // Без пресетов CSS пустой, и в потоке остаётся ровно то, что в него
    // положили: стандартный набор дал бы normalize даже без единого токена.
    const stream = mnGulp({
      presets: [],
    });
    return new Promise((resolve, reject) => {
      stream.on('data', (item: Vinyl) => out.push(item));
      stream.on('error', reject);
      stream.on('end', () => resolve(out));
      stream.write(file);
      stream.end();
    });
  }

  test('файл-директория (isNull) проходит насквозь', async () => {
    const out = await pipeThrough(new Vinyl({
      cwd: dir,
      base: dir,
      path: join(dir, 'sub'),
      contents: null,
    }));

    expect(out.length).toBe(1);
    expect(out[0].isNull()).toBe(true);
  });

  test('файл-поток (isStream) не роняет пайп', async () => {
    // Такой файл приходит при `gulp.src(..., { buffer: false })`; прочитать
    // его здесь нечем, поэтому он идёт дальше нетронутым.
    const out = await pipeThrough(new Vinyl({
      cwd: dir,
      base: dir,
      path: join(dir, 'a.html'),
      contents: Readable.from(['<div class="p10">']),
    }));

    expect(out.length).toBe(1);
    expect(out[0].isStream()).toBe(true);
  });
});

describe('mnGulp — предупреждения', () => {
  test('битый токен печатается в вывод задачи', async () => {
    write('a.html', '<div class="w10zz p10">');
    const said: string[] = [];
    const warnSpy = jest.spyOn(console, 'warn')
      .mockImplementation((m) => said.push(String(m)));

    try {
      const files = await run('*.html');
      expect(files['mn.css']).toContain('padding:10px');
    } finally {
      warnSpy.mockRestore();
    }

    expect(said.join('\n')).toContain('[minotation] w10zz');
  });

  test("`mn.onWarning: 'silent'` гасит вывод", async () => {
    write('a.html', '<div class="w10zz">');
    const said: string[] = [];
    const warnSpy = jest.spyOn(console, 'warn')
      .mockImplementation((m) => said.push(String(m)));

    try {
      await run('*.html', {
        onWarning: 'silent',
      });
    } finally {
      warnSpy.mockRestore();
    }

    expect(said.join('\n')).not.toContain('[minotation]');
  });
});

describe('minotation-gulp — имя файла, entry и манифест (D-030, D-031)', () => {
  test('по умолчанию — mn.css и манифест в потоке', async () => {
    write('page.html', '<div class="p10">');

    const files = await run('*.html');

    expect(files['mn.css']).toContain('padding:10px');
    expect(JSON.parse(files['mn-manifest.json'])).toEqual({
      'mn.css': 'mn.css', 
    });
  });

  test('[name].[hash].css, записи entry и свой fileName записи; manifest: false', async () => {
    write('site/a.html', '<div class="p10">');
    write('admin/b.html', '<div class="m20">');

    const files = await run('**/*.html', {
      fileName: '[name].[hash].css',
      manifest: false,
      entry: {
        site: {
          include: /site/, 
        },
        admin: {
          include: /admin/,
          fileName: 'adm.css', 
        }, 
      },
    });

    const site = Object.keys(files).find((name) => /^site\.[0-9a-f]{8}\.css$/.test(name))!;
    expect(files[site]).toContain('padding:10px');
    expect(files['adm.css']).toContain('margin:20px');
    expect(files['mn-manifest.json']).toBeUndefined();
  });
});
