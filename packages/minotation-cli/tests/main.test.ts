/**
 * Поведение команды целиком: что печатается и с каким кодом она завершается.
 *
 * Проверяется `main`, а не собранный бинарь: в `cli.ts` остаётся только связь с
 * процессом, а всё, что можно сломать, — здесь.
 */
import {
  mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync,
} from 'node:fs';
import {
  join,
} from 'node:path';
import {
  tmpdir,
} from 'node:os';
import {
  main,
} from '../src/main';
import * as run from '../src/run';
import type {
  Reporter,
} from '../src/run';
import * as api from '../src/index';

let dir: string;
let logs: string[];
let errors: string[];
let report: Reporter;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mn-cli-main-'));
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
  writeFileSync(
    full, text, 'utf8',
  );
  return full;
}

describe('main', () => {
  test('собирает CSS и возвращает 0', () => {
    write('a.html', '<div class="p10">');
    const out = join(dir, 'app.css');
    expect(main([
      dir,
      '-o',
      out,
    ], report)).toBe(0);
    expect(readFileSync(out, 'utf8')).toContain('padding:10px');
  });

  test('`--help` печатает справку и ничего не собирает', () => {
    expect(main(['--help'], report)).toBe(0);
    expect(logs.join('')).toContain('Использование: mn');
    expect(existsSync(join(dir, 'mn.css'))).toBe(false);
  });

  test('`--version` печатает версию пакета', () => {
    expect(main(['--version'], report)).toBe(0);
    // Не хардкод: версия читается из package.json, поэтому сверяем с ним же.
    expect(logs[0]).toBe(JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8')).version);
  });

  test('неизвестная опция: код 1, сообщение и справка', () => {
    expect(main(['--нет-такой'], report)).toBe(1);
    expect(errors[0]).toContain('Неизвестная опция');
    expect(errors.join('')).toContain('Использование: mn');
  });

  test('битый токен без `--strict` — предупреждение, но код 0', () => {
    // Чужие классы в разметке обычное дело, ронять из-за них сборку незачем.
    write('a.html', '<div class="w10zz p10">');
    expect(main([
      dir,
      '-o',
      join(dir, 'app.css'),
    ], report)).toBe(0);
    expect(errors.some((m) => m.includes('Предупреждение'))).toBe(true);
  });

  test('битый токен с `--strict` — исключение из ядра', () => {
    // Печатает его `cli.ts`, превращая в код возврата 1.
    write('a.html', '<div class="w10zz">');
    expect(() => main([
      dir,
      '-o',
      join(dir, 'app.css'),
      '--strict',
    ], report)).toThrow(/strict/i);
  });

  test('чужой класс в kebab-case под `--strict` сборку не роняет', () => {
    // `sr-only`, `mt-auto` и прочее из чужих фреймворков — не битые токены.
    write('a.html', '<div class="sr-only mt-auto p10">');
    expect(main([
      dir,
      '-o',
      join(dir, 'app.css'),
      '--strict',
    ], report)).toBe(0);
  });

  test('нечитаемый конфиг обрывает работу', () => {
    expect(() => main(['-c', join(dir, 'нет.js')], report))
      .toThrow('Конфиг не найден');
  });

  test('`--watch` собирает и включает наблюдение', () => {
    write('a.html', '<div class="p10">');
    const out = join(dir, 'app.css');
    // Наблюдение подменено: настоящее держало бы процесс до конца прогона, а
    // что оно делает, проверяет `run.test.ts`. Здесь важно лишь, что `main`
    // сперва собирает, а потом включает его с теми же настройками.
    const watching = jest.spyOn(run, 'startWatch').mockReturnValue(() => {});
    try {
      expect(main([
        dir,
        '-o',
        out,
        '--watch',
      ], report)).toBe(0);
      expect(readFileSync(out, 'utf8')).toContain('padding:10px');
      expect(watching).toHaveBeenCalledTimes(1);
      expect(watching.mock.calls[0][0].input).toBe(dir);
      expect(watching.mock.calls[0][0].output).toBe(out);
    } finally {
      watching.mockRestore();
    }
  });

  test('без `--watch` наблюдение не включается', () => {
    write('a.html', '<div class="p10">');
    const watching = jest.spyOn(run, 'startWatch');
    try {
      main([
        dir,
        '-o',
        join(dir, 'app.css'),
      ], report);
      expect(watching).not.toHaveBeenCalled();
    } finally {
      watching.mockRestore();
    }
  });
});

describe('публичный API пакета', () => {
  test('экспортирует то, чем пользуются из кода', () => {
    // Пакет ставят и ради команды, и ради `compile` в своём скрипте сборки.
    expect(typeof api.compile).toBe('function');
    expect(typeof api.collectFiles).toBe('function');
    expect(typeof api.build).toBe('function');
    expect(typeof api.startWatch).toBe('function');
    expect(typeof api.loadConfig).toBe('function');
    expect(typeof api.mergeSettings).toBe('function');
    expect(typeof api.parseArgs).toBe('function');
    expect(typeof api.main).toBe('function');
    expect(api.HELP).toContain('Использование: mn');
    expect(api.DEFAULT_CONFIG).toBe('./mn.config.js');
  });
});
