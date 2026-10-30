/**
 * CSS-wide keywords буквами (D-125): `INH`, `INI`, `UNS`, `RV`, `RVL` — одни во всех хендлерах.
 *
 * Ядро отдаёт хендлеру метку-переменную вместо букв и ставит ключевое слово туда, куда хендлер поставил
 * переменную целым значением. Здесь — и стандартные хендлеры, и свои (`mn('kw', …)`): ветки ядра, до
 * которых стандартный пресет не доходит.
 */
import {
  minotationProvider,
} from '../core/index';
import presetStandard from '../presets/standard';
import {
  MnParseError,
} from '../core/types';
import type {
  MnOptions,
  MnWarning,
} from '../core/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function compile(tokens: string[], options: MnOptions = {}, setup?: (mn: any) => void): { css: string;
  warnings: string[];
  errors: string[]; } {
  const warnings: MnWarning[] = [];
  const errors: string[] = [];
  const mn: any = minotationProvider({
    importantMode: 'silent',
    onWarning: (w: MnWarning) => warnings.push(w),
    onError: (e: Error) => errors.push(e.message),
    ...options,
  });
  mn.setPresets([presetStandard]);
  setup && setup(mn);
  const c = mn.getCompiler('class');
  const l = tokens.length;
  for (let i = 0; i < l; i++) {
    c(tokens[i]);
  }
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n'),
    warnings: warnings.map((w) => w.message),
    errors,
  };
}

describe('буквы ключевых слов в стандартных хендлерах (D-125)', () => {
  test.each([
    ['cINH', '.cINH{color:inherit}'],
    ['cINI', '.cINI{color:initial}'],
    ['mUNS', '.mUNS{margin:unset}'],
    ['pRV', '.pRV{padding:revert}'],
    ['cRVL', '.cRVL{color:revert-layer}'],
    ['bgiINH', '.bgiINH{background-image:inherit}'],
    ['bgINH', '.bgINH{background:inherit}'],
    ['cnINH', '.cnINH{container-name:inherit}'],
    ['bcylINH', '.bcylINH{border-top-color:inherit;border-bottom-color:inherit;border-left-color:inherit}'],
    ['lclINH', '.lclINH{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:inherit}'],
    ['mUNS-i', '.mUNS-i{margin:unset!important}'],
  ])('%s → %s', (token, css) => {
    expect(compile([token])).toEqual({
      css,
      warnings: [],
      errors: [],
    });
  });

  test.each([
    ['cInherit', 'Write it shorter: "cINH" instead of "cInherit" — same value (D-125)'],
    ['bgiRevertLayer', 'Write it shorter: "bgiRVL" instead of "bgiRevertLayer" — same value (D-125)'],
    ['mUnset-i', 'Write it shorter: "mUNS-i" instead of "mUnset-i" — same value (D-125)'],
  ])('слово, где есть буквы, бракуется: %s', (token, message) => {
    expect(compile([token])).toEqual({
      css: '',
      warnings: [message],
      errors: [],
    });
  });

  test('режим property-value: буквы и подсказка на слово — с двоеточием', () => {
    const options: MnOptions = {
      notationMode: 'property-value',
    };
    expect(compile(['c:INH'], options).css).toBe('.c\\:INH{color:inherit}');
    expect(compile(['c:Inherit', 'c:inherit'], options).warnings).toEqual([
      'Write it shorter: "c:INH" instead of "c:Inherit" — same value (D-125)',
      'Write it shorter: "c:INH" instead of "c:inherit" — same value (D-125)',
    ]);
  });

  test('часть значения: rx пишет поворот, x — сборный transform', () => {
    expect(compile(['rx--a']).css).toBe('.rx--a{transform:rotateX(var(--a))}');
    expect(compile(['rxINH', 'xINH']).warnings).toEqual([
      '"rxINH" gives no CSS: a CSS-wide keyword is a whole value of a property, and handler "rx" writes a part of one'
      + ' (D-125)',
      'Value "INH" is invalid for "x": expected a shift, as "x10", "x10y20", "x10y20z5", with a scale "s50" and a turn'
      + ' "rz45" after it',
    ]);
  });

  test('сообщение хендлера, не принявшего метку, — с буквами из токена', () => {
    expect(compile(['spnrINH', 'mkiINH']).warnings).toEqual([
      'Value "INH" is invalid for "spnr": expected a period in milliseconds, as "spnr2000"',
      '"mkiINH" was renamed: write "mkINH" (D-127). The old spelling gives no CSS and is removed in the next release.',
    ]);
  });

  test('свои буквы словарей убраны — одна запись на значение', () => {
    const out = compile(['tdI', 'dirU', 'mktRL', 'tchaR']);
    expect(out.css).toBe('');
    expect(out.warnings).toHaveLength(4);
  });
});

describe('ядро: метка в эссенции своего хендлера (D-125)', () => {
  const mark = (p: any) => 'var(' + p.suffix + ')';

  test('вложенные childs и media получают ключевое слово', () => {
    const out = compile(['kwINH'], {
      media: {
        sm: {
          query: '(width < 600px)',
        },
      } as never,
    }, (mn) => mn('kw', (p: any) => ({
      style: {
        color: mark(p),
      },
      childs: {
        inner: {
          selectors: ['>*'],
          style: {
            borderColor: [mark(p)],
          },
        },
      },
    })));
    expect(out.warnings).toEqual([]);
    expect(out.css).toContain('color:inherit');
    expect(out.css).toContain('border-color:inherit');
  });

  test('метка внутри значения во вложенной эссенции — часть значения', () => {
    expect(compile(['kwINH'], {}, (mn) => mn('kw', (p: any) => ({
      style: {
        color: 'red',
      },
      childs: {
        inner: {
          selectors: ['>*'],
          style: {
            transform: 'scale(' + mark(p) + ')',
          },
        },
      },
    }))).warnings).toEqual([
      '"kwINH" gives no CSS: a CSS-wide keyword is a whole value of a property, and handler "kw" writes a part of one'
      + ' (D-125)',
    ]);
  });

  test('хендлер не поставил метку или не дал стиля — ключевому слову некуда встать', () => {
    const noWhole = (name: string) => '"' + name + 'INH" gives no CSS: handler "' + name + '" puts no whole value into a'
      + ' property, so a CSS-wide keyword has nowhere to go (D-125)';
    expect(compile(['kwINH', 'nilINH'], {}, (mn) => {
      mn('kw', () => ({
        style: {
          color: 'red',
        },
      }));
      mn('nil', () => undefined);
    }).warnings).toEqual([
      noWhole('kw'),
      noWhole('nil'),
    ]);
  });

  test('ошибка разбора хендлера: метка в сообщении, токене и аргументе — буквами', () => {
    const warnings: MnWarning[] = [];
    const mn: any = minotationProvider({
      onWarning: (w: MnWarning) => warnings.push(w),
    });
    mn('kw', (p: any) => {
      throw new MnParseError('Value "' + p.suffix + '" is invalid for "kw"', {
        token: 'kw' + p.suffix,
        handler: 'kw',
        arg: p.suffix,
      });
    });
    mn('bare', (p: any) => {
      throw new MnParseError('Value "' + p.suffix + '" is invalid for "bare"', {
        token: '',
        handler: '',
        arg: '',
      });
    });
    mn.getCompiler('class')('kwRV bareRV');
    mn.compile();
    expect(warnings.map((w) => [w.message, w.token, w.arg])).toEqual([
      ['Value "RV" is invalid for "kw"', 'kwRV', 'RV'],
      ['Value "RV" is invalid for "bare"', 'bareRV', 'RV'],
    ]);
  });

  test('не ошибка разбора — уходит ошибкой как есть', () => {
    expect(compile(['kwINH'], {}, (mn) => mn('kw', () => {
      throw new Error('boom');
    })).errors).toEqual(['MN parsing error for essence "kwINH": boom']);
  });
});

describe('переменная целым значением — там, где её молча теряли (D-125)', () => {
  test.each([
    ['z--v', '.z--v{z-index:var(--v)}'],
    ['dn--v', '.dn--v{transition-duration:var(--v)}'],
    ['delay--v', '.delay--v{transition-delay:var(--v)}'],
    ['fw--v', '.fw--v{font-weight:var(--v)}'],
    ['ft--v', '.ft--v{filter:var(--v)}'],
    ['ftb--v', '.ftb--v{backdrop-filter:var(--v)}'],
    ['fxa--v', '.fxa--v{box-pack:var(--v);justify-content:var(--v)}'],
    ['zINH', '.zINH{z-index:inherit}'],
    ['fwINH', '.fwINH{font-weight:inherit}'],
    ['dnRV', '.dnRV{transition-duration:revert}'],
    ['ftUNS', '.ftUNS{filter:unset}'],
  ])('%s → %s', (token, css) => {
    expect(compile([token])).toEqual({
      css,
      warnings: [],
      errors: [],
    });
  });

  test.each([
    ['z_x', 'Value "_x" is invalid for "z"'],
    ['dn_x', 'Value "_x" is invalid for "dn"'],
    ['rx_x', 'Value "_x" is invalid for "rx"'],
    ['fw_x', 'Value "_x" is invalid for "fw": expected a digit (`fw6`), a weight (`fw600`), a letter (`fwB`) or a'
      + ' variable'],
    ['x--v', 'Value "--v" is invalid for "x": expected a shift, as "x10", "x10y20", "x10y20z5", with a scale "s50" and'
      + ' a turn "rz45" after it'],
  ])('нераспознанный суффикс — брак, а не значение по умолчанию: %s', (token, message) => {
    expect(compile([token])).toEqual({
      css: '',
      warnings: [message],
      errors: [],
    });
  });

  test('голое имя по-прежнему даёт значение по умолчанию', () => {
    const css = compile(['z', 'dn', 'rx', 'fw']).css;
    expect(css).toContain('.z{z-index:1}');
    expect(css).toContain('.dn{transition-duration:250ms}');
    expect(css).toContain('.rx{transform:rotateX(180deg)}');
    expect(css).toContain('.fw{font-weight:100}');
  });
});
