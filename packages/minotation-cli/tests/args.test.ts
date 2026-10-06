/**
 * Разбор аргументов командной строки.
 *
 * Разбор написан руками, а не взят из `commander`: у CLI должно быть как можно
 * меньше зависимостей. Цена такого решения — эти тесты: всё, что обычно
 * гарантирует библиотека, здесь гарантируем мы.
 */
import {
  parseArgs, HELP,
} from '../src/args';

describe('parseArgs', () => {
  test('неуказанные опции остаются пустыми', () => {
    // Умолчания подставляет `mergeSettings`: приди они отсюда как обычные
    // значения — перекрыли бы те же поля из конфига.
    const args = parseArgs([]);
    expect(args.input).toBeUndefined();
    expect(args.output).toBeUndefined();
    expect(args.attrs).toBeUndefined();
    expect(args.watch).toBe(false);
  });

  test('путь позиционно', () => {
    expect(parseArgs(['./src']).input).toBe('./src');
  });

  test('путь опцией `--compile` — форма из v1', () => {
    expect(parseArgs(['--compile', './src']).input).toBe('./src');
  });

  test.each([
    [
      ['-o', 'a.css'],
      'output',
      'a.css',
    ],
    [
      ['--output', 'a.css'],
      'output',
      'a.css',
    ],
    [
      ['-a', 'className:class'],
      'attrs',
      'className:class',
    ],
    [
      ['--attrs', 'class, className:class'],
      'attrs',
      'class, className:class',
    ],
    [
      ['-p', '.app'],
      'prefix',
      '.app',
    ],
    [
      ['--prefix', '.app'],
      'prefix',
      '.app',
    ],
    [
      ['-c', 'my.config.js'],
      'config',
      'my.config.js',
    ],
    [
      ['--include', '\\.html$'],
      'include',
      '\\.html$',
    ],
    [
      ['--exclude', 'vendor'],
      'exclude',
      'vendor',
    ],
  ])('%p → %s = %p', (
    argv, key, value,
  ) => {
    expect(parseArgs(argv as string[])[key]).toBe(value);
  });

  test.each([
    [['--no-syntax'], 'noSyntax'],
    [['-w'], 'watch'],
    [['--watch'], 'watch'],
    [['--alt-color'], 'altColor'],
    [['--strict'], 'strict'],
    [['-h'], 'help'],
    [['--help'], 'help'],
    [['-v'], 'version'],
    [['--version'], 'version'],
  ])('%p → %s = true', (argv, key) => {
    expect(parseArgs(argv as string[])[key]).toBe(true);
  });

  test('опции комбинируются', () => {
    const args = parseArgs([
      './src',
      '-o',
      'out.css',
      '-w',
      '--strict',
    ]);
    expect(args.input).toBe('./src');
    expect(args.output).toBe('out.css');
    expect(args.watch).toBe(true);
    expect(args.strict).toBe(true);
  });

  test.each([
    [['-o'], 'Option "-o" requires a value'],
    [['--attrs'], 'Option "--attrs" requires a value'],
    [['--zzz'], 'Unknown option: "--zzz"'],
    [['a', 'b'], 'Path given twice'],
  ])('%p — ошибка', (argv, message) => {
    // Молча проглотить опечатку в опции значит собрать не то, что просили.
    expect(() => parseArgs(argv as string[])).toThrow(message as string);
  });

  test('справка перечисляет все опции', () => {
    // Справка и есть документация: если опция не попала сюда, о ней не узнают.
    for (const option of [
      '--output',
      '--watch',
      '--config',
      '--attrs',
      '--prefix',
      '--alt-color',
      '--strict',
      '--include',
      '--exclude',
      '--version',
      '--help',
    ]) {
      expect(HELP).toContain(option);
    }
  });
});
