/**
 * Разбор аргументов командной строки.
 *
 * Разбор написан руками, а не взят из `commander`: у CLI должно быть как можно
 * меньше зависимостей. Цена такого решения — эти тесты: всё, что обычно
 * гарантирует библиотека, здесь гарантируем мы.
 */
import {
  parseArgs,
  HELP,
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
    expect(parseArgs([
      '--compile',
      './src',
    ]).input).toBe('./src');
  });

  test.each([
    [
      [
        '-o',
        'a.css',
      ],
      'output',
      'a.css',
    ],
    [
      [
        '--output',
        'a.css',
      ],
      'output',
      'a.css',
    ],
    [
      [
        '-a',
        'className:class',
      ],
      'attrs',
      'className:class',
    ],
    [
      [
        '--attrs',
        'class, className:class|m; m-n',
      ],
      'attrs',
      'class, className:class|m; m-n',
    ],
    [
      [
        '-c',
        'my.config.js',
      ],
      'config',
      'my.config.js',
    ],
    [
      [
        '--include',
        '\\.html$',
      ],
      'include',
      '\\.html$',
    ],
    [
      [
        '--exclude',
        'vendor',
      ],
      'exclude',
      'vendor',
    ],
  ])('%p → %s = %p', (
    argv, key, value,
  ) => {
    expect(parseArgs(argv as string[])[key]).toEqual(value);
  });

  test.each([
    [
      ['--no-syntax'],
      'noSyntax',
    ],
    [
      ['-w'],
      'watch',
    ],
    [
      ['--watch'],
      'watch',
    ],
    [
      ['--alt-color'],
      'altColor',
    ],
    [
      ['-h'],
      'help',
    ],
    [
      ['--help'],
      'help',
    ],
    [
      ['-v'],
      'version',
    ],
    [
      ['--version'],
      'version',
    ],
  ])('%p → %s = true', (argv, key) => {
    expect(parseArgs(argv as string[])[key]).toBe(true);
  });

  test('опции комбинируются', () => {
    const args = parseArgs([
      './src',
      '-o',
      'out.css',
      '-w',
      '--warning-mode',
      'error',
    ]);
    expect(args.input).toBe('./src');
    expect(args.output).toBe('out.css');
    expect(args.watch).toBe(true);
    expect(args.warningMode).toBe('error');
  });

  test('--specificity-mode и --important-mode: warn, silent, strict (D-039)', () => {
    const args = parseArgs([
      '--specificity-mode',
      'strict',
      '--important-mode',
      'silent',
    ]);
    expect(args.specificityMode).toBe('strict');
    expect(args.importantMode).toBe('silent');
    expect(() => parseArgs([
      '--specificity-mode',
      'error',
    ]))
      .toThrow('Option "--specificity-mode": expects one of warn, silent, strict, got string "error"');
    expect(() => parseArgs([
      '--important-mode',
      'block',
    ]))
      .toThrow('Option "--important-mode": expects one of warn, silent, strict, got string "block"');
    expect(parseArgs([
      '--child-selector-mode',
      'strict',
    ]).childSelectorMode).toBe('strict');
    expect(parseArgs([
      '--notation-mode',
      'tw4-compatible',
    ]).notationMode).toBe('tw4-compatible');
    expect(parseArgs([
      '--notation-conflict-mode',
      'strict',
    ]).notationConflictMode).toBe('strict');
    expect(() => parseArgs([
      '--notation-conflict-mode',
      'silent',
    ]))
      .toThrow('Option "--notation-conflict-mode": expects one of warn, strict, got string "silent"');
    expect(() => parseArgs([
      '--notation-mode',
      'tailwind',
    ]))
      .toThrow('Option "--notation-mode": expects one of context-qualified, tw4-compatible, breakpoint-prefixed, property-value, got string "tailwind"');
    expect(() => parseArgs([
      '--child-selector-mode',
      'error',
    ]))
      .toThrow('Option "--child-selector-mode": expects one of warn, silent, strict, got string "error"');
    expect(parseArgs([
      '--unknown-media-mode',
      'strict',
    ]).unknownMediaMode).toBe('strict');
    expect(parseArgs([
      '--suspect-class-mode',
      'silent',
    ]).suspectClassMode).toBe('silent');
    expect(parseArgs([
      '--handler-conflict-mode',
      'strict',
    ]).handlerConflictMode).toBe('strict');
    expect(parseArgs([
      '--preset-conflict-mode',
      'silent',
    ]).presetConflictMode).toBe('silent');
    expect(parseArgs([
      '--group-suspect-mode',
      'strict',
    ]).groupSuspectMode).toBe('strict');
    expect(() => parseArgs([
      '--group-suspect-mode',
      'x',
    ]))
      .toThrow('Option "--group-suspect-mode": expects one of warn, silent, strict, got string "x"');
    expect(parseArgs([
      '--bare-math-mode',
      'strict',
    ]).bareMathMode).toBe('strict');
    expect(() => parseArgs([
      '--bare-math-mode',
      'x',
    ]))
      .toThrow('Option "--bare-math-mode": expects one of warn, silent, strict, got string "x"');
    expect(parseArgs([
      '--group-mode',
      'css',
    ]).groupMode).toBe('css');
    expect(() => parseArgs([
      '--group-mode',
      'x',
    ])).toThrow('Option "--group-mode": expects one of groups, css, got string "x"');
    expect(() => parseArgs([
      '--handler-conflict-mode',
      'x',
    ]))
      .toThrow('Option "--handler-conflict-mode": expects one of warn, silent, strict, got string "x"');
    expect(() => parseArgs([
      '--preset-conflict-mode',
      'x',
    ]))
      .toThrow('Option "--preset-conflict-mode": expects one of warn, silent, strict, got string "x"');
    expect(() => parseArgs([
      '--suspect-class-mode',
      'off',
    ]))
      .toThrow('Option "--suspect-class-mode": expects one of warn, silent, strict, got string "off"');
    expect(() => parseArgs([
      '--unknown-media-mode',
      'warning',
    ]))
      .toThrow('Option "--unknown-media-mode": expects one of warn, silent, strict, got string "warning"');
  });

  test('--warning-mode принимает только log, silent, error', () => {
    expect(parseArgs([
      '--warning-mode',
      'silent',
    ]).warningMode).toBe('silent');
    expect(() => parseArgs([
      '--warning-mode',
      'errror',
    ]))
      .toThrow('Option "--warning-mode": expects one of log, silent, error, got string "errror". Did you mean "error"?');
  });

  test.each([
    [
      ['-o'],
      'Option "-o" requires a value',
    ],
    [
      ['--attrs'],
      'Option "--attrs" requires a value',
    ],
    [
      [
        '--attrs',
        'class, *ClassName',
      ],
      'Option "--attrs": entry "*ClassName" has no value: write "*ClassName:…"',
    ],
    [
      [
        '--attr',
        'class',
      ],
      'Unknown option: "--attr"',
    ],
    [
      ['--zzz'],
      'Unknown option: "--zzz"',
    ],
    [
      [
        'a',
        'b',
      ],
      'Path given twice',
    ],
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
      '--alt-color',
      '--warning-mode',
      '--include',
      '--exclude',
      '--skip-partials',
      '--no-manifest',
      '--no-metrics',
      '--version',
      '--help',
    ]) {
      expect(HELP).toContain(option);
    }
  });
});
