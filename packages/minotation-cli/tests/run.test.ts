/**
 * Сборка настроек, запись результата, наблюдение.
 *
 * Вынесено из `cli.ts` именно ради этих тестов: иначе проверять пришлось бы
 * запуском процесса и перехватом `process.exit`.
 */
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync,
} from 'node:fs';
import {
  join, resolve,
} from 'node:path';
import {
  tmpdir,
} from 'node:os';
import {
  parseArgs,
} from '../src/args';
import {
  build, loadConfig, mergeSettings, startWatch, DEFAULT_CONFIG,
} from '../src/run';
import type {
  Reporter,
} from '../src/run';

let dir: string;
let logs: string[];
let errors: string[];
let report: Reporter;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mn-cli-run-'));
  logs = [];
  errors = [];
  report = {
    log: (m: string) => logs.push(m),
    error: (m: string) => errors.push(m),
  };
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

describe('loadConfig', () => {
  test('отсутствие конфига по умолчанию — не ошибка', () => {
    // CLI полезен и без конфига: все настройки задаются опциями.
    expect(loadConfig(undefined, report)).toEqual({});
  });

  test('явно указанный конфиг обязан существовать', () => {
    expect(() => loadConfig(join(dir, 'нет.js'), report))
      .toThrow('Конфиг не найден');
  });

  test('битый конфиг — ошибка даже с именем по умолчанию', () => {
    // Молча продолжить с умолчаниями значит собрать не то, что просили.
    const path = write('mn.config.cjs', 'module.exports = { : };');
    expect(() => loadConfig(path, report))
      .toThrow('Не удалось прочитать конфиг');
  });

  test('читает настройки из файла', () => {
    const path = write('mn.config.cjs', 'module.exports = { prefix: ".app" };');
    const config = loadConfig(path, report);
    expect(config.prefix).toBe('.app');
    expect(logs.some((m) => m.includes('Конфиг'))).toBe(true);
  });

  test('понимает `export default`', () => {
    const path = write('esm.config.cjs', 'exports.default = { prefix: ".d" };');
    expect(loadConfig(path, report).prefix).toBe('.d');
  });
});

describe('mergeSettings', () => {
  test('аргументы важнее конфига', () => {
    const settings = mergeSettings(parseArgs([
      './src',
      '-p',
      '.cli',
    ]), {
      prefix: '.config',
    });
    expect(settings.prefix).toBe('.cli');
  });

  test('без аргумента берётся значение из конфига', () => {
    expect(mergeSettings(parseArgs(['./src']), {
      prefix: '.config',
    }).prefix).toBe('.config');
  });

  test('путь, вывод и атрибут тоже берутся из конфига', () => {
    // У них есть умолчания, и раньше эти умолчания молча перекрывали конфиг.
    const settings = mergeSettings(parseArgs([]), {
      input: './шаблоны',
      output: './dist/app.css',
      attr: 'className',
    });
    expect(settings.input).toBe('./шаблоны');
    expect(settings.output).toBe('./dist/app.css');
    expect(settings.attr).toBe('className');
  });

  test('умолчания применяются, когда нет ни аргумента, ни конфига', () => {
    const settings = mergeSettings(parseArgs([]), {});
    expect(settings.input).toBe('./');
    expect(settings.output).toBe('./mn.css');
    expect(settings.attr).toBe('class');
  });

  test('аргумент важнее конфига и у этих трёх', () => {
    const settings = mergeSettings(parseArgs([
      './src',
      '-o',
      './a.css',
      '-a',
      'class',
    ]), {
      input: './шаблоны',
      output: './dist/app.css',
      attr: 'className',
    });
    expect(settings.input).toBe('./src');
    expect(settings.output).toBe('./a.css');
    expect(settings.attr).toBe('class');
  });

  test('флаги складываются: включён хоть где-то — включён', () => {
    expect(mergeSettings(parseArgs(['--strict']), {}).strict).toBe(true);
    expect(mergeSettings(parseArgs([]), {
      strict: true,
    }).strict).toBe(true);
  });

  test('файл конфигурации не сканируется как исходник', () => {
    const settings = mergeSettings(parseArgs(['-c', './my.config.js']), {});
    expect(settings.ignore).toContain(resolve('./my.config.js'));
    // Без опции исключается конфиг по умолчанию.
    expect(mergeSettings(parseArgs([]), {}).ignore)
      .toContain(resolve(DEFAULT_CONFIG));
  });

  test('`ignore` из конфига сохраняется', () => {
    const settings = mergeSettings(parseArgs([]), {
      ignore: ['./legacy.js'],
    });
    expect(settings.ignore).toEqual(['./legacy.js', resolve(DEFAULT_CONFIG)]);
  });

  test('`include` и `exclude` из строк превращаются в регулярки', () => {
    const settings = mergeSettings(parseArgs([
      '--include',
      '\\.html$',
      '--exclude',
      'vendor',
    ]), {});
    expect(settings.include).toBeInstanceOf(RegExp);
    expect(settings.include!.test('a.html')).toBe(true);
    expect(settings.exclude!.test('/vendor/a.html')).toBe(true);
  });
});

describe('build', () => {
  test('пишет CSS и отчитывается', () => {
    write('a.html', '<div class="p10">');
    const out = join(
      dir, 'out', 'app.css',
    );
    const result = build({
      input: dir,
      output: out,
    }, report);
    expect(readFileSync(out, 'utf8')).toContain('padding:10px');
    expect(result.files).toBe(1);
    expect(logs.some((m) => m.includes('1 файлов'))).toBe(true);
  });

  test('создаёт директорию вывода, если её нет', () => {
    write('a.html', '<div class="p10">');
    const out = join(
      dir, 'глубоко', 'внутри', 'app.css',
    );
    build({
      input: dir,
      output: out,
    }, report);
    expect(existsSync(out)).toBe(true);
  });

  test('предупреждения печатаются, но сборку не останавливают', () => {
    write('a.html', '<div class="w10zz p10">');
    build({
      input: dir,
      output: join(dir, 'out.css'),
    }, report);
    expect(errors.some((m) => m.includes('Предупреждение'))).toBe(true);
    expect(readFileSync(join(dir, 'out.css'), 'utf8')).toContain('padding:10px');
  });
});

describe('startWatch', () => {
  test('пересобирает при изменении файла', async () => {
    write('a.html', '<div class="p10">');
    const out = join(dir, 'out.css');
    const stop = startWatch({
      input: dir,
      output: out,
    }, report);
    try {
      write('b.html', '<div class="m20">');
      // Пересборка отложена на 50 мс, чтобы одно сохранение не запускало её
      // трижды — ждём с запасом.
      await new Promise((done) => setTimeout(done, 400));
      expect(readFileSync(out, 'utf8')).toContain('margin:20px');
    } finally {
      stop();
    }
  });

  test('ошибка пересборки не роняет наблюдение', async () => {
    const file = write('a.html', '<div class="p10">');
    // Запись внутрь файла — гарантированная ошибка (ENOTDIR): наблюдение
    // должно её напечатать и продолжить, а не оборвать процесс.
    const stop = startWatch({
      input: dir,
      output: join(file, 'out.css'),
    }, report);
    try {
      write('b.html', '<div class="m20">');
      await new Promise((done) => setTimeout(done, 400));
      expect(errors.length).toBeGreaterThan(0);
    } finally {
      stop();
    }
  });
});
