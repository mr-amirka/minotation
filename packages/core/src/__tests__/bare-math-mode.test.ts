/**
 * Режим `bareMathMode`: математика без скобок (`w1/2+32`) разрешена, отмечена или запрещена; в скобках
 * (`w{1/2+32}`) — CSS тот же, режим её не касается.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import {
  MnForbiddenTokenError,
} from '../core/types';
import type {
  MnOptions,
  MnWarning,
} from '../core/types';

/** Блок объявлений правила — без селектора: в селекторе скобки токена экранированы. */
const REGEXP_DECLARATIONS = /\{[^{}]*\}$/;
const HINT_WARN = '. To hide this warning: bareMathMode: \'silent\'; to forbid such tokens: bareMathMode: \'strict\'.';

/**
 * Компилирует токены с `presetStandard` и опциями.
 * @param tokens — токены
 * @param options — опции экземпляра
 * @returns CSS, предупреждения «тип: текст» и ошибка `compile`
 */
function compile(tokens: string[], options: MnOptions = {}) {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    onWarning: (w) => warnings.push(w),
    ...options,
  });
  mn.setPresets([presetStandard]);
  const c = mn.getCompiler('class');
  tokens.forEach((t) => c(t));
  let error: unknown;
  try {
    mn.compile();
  } catch (ex) {
    error = ex;
  }
  return {
    css: mn.styles$.getValue().map((s: { content: string }) => s.content).join(''),
    warnings: warnings.map((w) => w.type + ': ' + w.message),
    error,
  };
}

describe('bareMathMode', () => {
  test('по умолчанию — разрешена, молча', () => {
    expect(compile(['w1/2+32'])).toEqual({
      css: '.w1\\/2\\+32{width:calc(50% + 32px)}',
      warnings: [],
      error: undefined,
    });
  });

  test.each([
    [
      'w1/2+32',
      'w{1/2+32}',
    ],
    [
      'p10+5_20',
      'p{10+5}_20',
    ],
    [
      'p10+5_10+5',
      'p{10+5}_{10+5}',
    ],
    [
      'w$a*2',
      'w{$a*2}',
    ],
    [
      'x$a*2;y3',
      'x{$a*2}y3',
    ],
    [
      'bxshB$a*2;x2',
      'bxsh{$a*2}x2',
    ],
    [
      'op10+5_T',
      'op{10+5}_T',
    ],
    [
      'ftBlur2+1',
      'ftBlur{2+1}',
    ],
    [
      'gtc100-20_1fr',
      'gtc{100-20}_1fr',
    ],
  ])('warn: %s — CSS и форма в скобках %s, которая даёт тот же CSS', (token, braced) => {
    const bare = compile([token], {
      bareMathMode: 'warn',
    });
    const inBraces = compile([braced], {
      bareMathMode: 'strict',
    });
    expect([
      bare.warnings,
      (REGEXP_DECLARATIONS.exec(bare.css) as RegExpExecArray)[0],
      inBraces.warnings,
      inBraces.error,
    ]).toEqual([
      ['bare-math: "' + token + '" writes math without braces: write "' + braced + '"' + HINT_WARN],
      (REGEXP_DECLARATIONS.exec(inBraces.css) as RegExpExecArray)[0],
      [],
      undefined,
    ]);
  });

  test('выражение с группы в начале — терм перед ней: `{{` читатель не принимает', () => {
    const bare = compile(['w{1+2}*3'], {
      bareMathMode: 'warn',
    });
    expect([
      bare.warnings,
      compile(['w{1*{1+2}*3}'], {
        bareMathMode: 'strict',
      }).css,
    ]).toEqual([
      ['bare-math: "w{1+2}*3" writes math without braces: write "w{1*{1+2}*3}"' + HINT_WARN],
      '.w\\{1\\*\\{1\\+2\\}\\*3\\}{width:calc(1 * (1px + 2px) * 3)}',
    ]);
  });

  test('strict: CSS нет, compile бросает MnForbiddenTokenError', () => {
    const out = compile([
      'w1/2+32',
      'w{1/2+32}',
    ], {
      bareMathMode: 'strict',
    });
    expect([
      out.css,
      out.error instanceof MnForbiddenTokenError,
      (out.error as MnForbiddenTokenError).tokens.map((w) => w.message),
    ]).toEqual([
      '.w\\{1\\/2\\+32\\}{width:calc(50% + 32px)}',
      true,
      [
        '"w1/2+32" writes math without braces: write "w{1/2+32}" (bareMathMode: \'strict\'), the token gives no CSS.'
        + ' To allow it: bareMathMode: \'silent\'.',
      ],
    ]);
  });

  test.each([
    'w{1/2+32}',
    'm-10',
    'm-$a',
    'w1/3',
    'w$a{10+5}',
    'wMin{10+5,20%}',
    'w10**2',
    'x{10+5}',
    'bxsh{10+5}x2',
  ])('strict: %s — не математика без скобок, CSS есть', (token) => {
    const out = compile([token], {
      bareMathMode: 'strict',
      specificityMode: 'silent',
    });
    expect([
      out.css === '',
      out.error,
    ]).toEqual([
      false,
      undefined,
    ]);
  });

  test('warningMode: \'error\' её не роняет — у режима своя опция', () => {
    expect(compile(['w1/2+32'], {
      bareMathMode: 'warn',
      warningMode: 'error',
    }).error).toBeUndefined();
  });

  test('значение — одна часть с ошибкой: только ошибка разбора', () => {
    expect(compile(['p10+5_zz'], {
      bareMathMode: 'warn',
    }).warnings.map((w) => w.split(':')[0])).toEqual(['parse-error']);
  });

  test.each([
    [
      'strickt',
      'option "bareMathMode" expects "warn", "silent" or "strict", got string "strickt"',
    ],
  ])('опция проверяется: %s', (value, message) => {
    expect(() => minotationProvider({
      bareMathMode: value as never,
    })).toThrow(message);
  });

  test('опечатка в имени — с ближайшим', () => {
    expect(() => minotationProvider({
      bareMathMod: 'strict',
    } as never)).toThrow('unknown option "bareMathMod". Did you mean "bareMathMode"?');
  });
});
