/**
 * Цвет и фон в записи нотации — `colorValue` / `gradientValue` ядра: коды, переменные `$`, градиенты из них,
 * угол, радиальная форма, повтор, стопы, запасной цвет без альфы, прежняя запись переменной.
 */
import {
  colorValue,
  colorVarValue,
  gradientValue,
} from '../core/colorValue';
import {
  cssVarValue,
} from '../core/mathValue';
import {
  MnParseError,
} from '../core/types';

const RED_TO_BLUE = 'linear-gradient(180deg,#f00 0%,#00f 100%)';

describe('colorValue', () => {
  it.each([
    [
      'F00',
      ['#f00'],
    ],
    [
      'F00.5',
      ['rgba(255,0,0,.5)'],
    ],
    [
      '$ink',
      ['var(--ink)'],
    ],
    [
      '$ink;',
      ['var(--ink)'],
    ],
    [
      '$ink{F00}',
      ['var(--ink, #f00)'],
    ],
    [
      '$$titlebar-area-color',
      ['env(titlebar-area-color)'],
    ],
  ])('%s → %j', (v, css) => {
    expect(colorValue(v)).toEqual(css);
  });

  it('a code with alpha and alt: the fallback without alpha first', () => {
    expect(colorValue('F00.5', true)).toEqual([
      '#f00',
      'rgba(255,0,0,.5)',
    ]);
  });

  it('the old spelling is renamed, with the new one in the message', () => {
    expect(() => colorValue('--ink')).toThrow(MnParseError);
    expect(() => colorValue('--ink')).toThrow('"--ink" was renamed: write "$ink"');
  });
});

describe('gradientValue', () => {
  it.each([
    [
      'F00-00F',
      RED_TO_BLUE,
    ],
    [
      '-F00-00F',
      RED_TO_BLUE,
    ],
    [
      'F00-00F_r',
      'radial-gradient(circle,#f00 0%,#00f 100%)',
    ],
    [
      'F00-00F_rpt',
      'repeating-linear-gradient(180deg,#f00 0%,#00f 100%)',
    ],
    [
      'F00-00F_g90',
      'linear-gradient(270deg,#f00 0%,#00f 100%)',
    ],
    [
      'F00-00F_g-270',
      'linear-gradient(270deg,#f00 0%,#00f 100%)',
    ],
    [
      'F00-00F_r_ellipse_closestSide',
      'radial-gradient(ellipse closest-side,#f00 0%,#00f 100%)',
    ],
    [
      'F00p20-00Fp40px',
      'linear-gradient(180deg,#f00 20%,#00f 40px)',
    ],
    [
      'F00-0F0-00F',
      'linear-gradient(180deg,#f00 0%,#0f0 50%,#00f 100%)',
    ],
    [
      'F00.5-00F.8',
      'linear-gradient(180deg,rgba(255,0,0,.5) 0%,rgba(0,0,255,.8) 100%)',
    ],
    [
      '$a$b',
      'linear-gradient(180deg,var(--a) 0%,var(--b) 100%)',
    ],
    [
      '$a;-F00-324',
      'linear-gradient(180deg,var(--a) 0%,#f00 50%,#324 100%)',
    ],
    [
      'F00-$b',
      'linear-gradient(180deg,#f00 0%,var(--b) 100%)',
    ],
    [
      'F00$b',
      'linear-gradient(180deg,#f00 0%,var(--b) 100%)',
    ],
    [
      '$$a;-F00',
      'linear-gradient(180deg,env(a) 0%,#f00 100%)',
    ],
    [
      '$Ab9ü;-F00',
      'linear-gradient(180deg,var(--Ab9ü) 0%,#f00 100%)',
    ],
    [
      '$my_a$my-b',
      'linear-gradient(180deg,var(--my_a) 0%,var(--my-b) 100%)',
    ],
    [
      '$a;p20-$b;p40px',
      'linear-gradient(180deg,var(--a) 20%,var(--b) 40px)',
    ],
    [
      '$a{F00}-$b{$c}',
      'linear-gradient(180deg,var(--a, #f00) 0%,var(--b, var(--c)) 100%)',
    ],
    [
      '$a$b_g90',
      'linear-gradient(270deg,var(--a) 0%,var(--b) 100%)',
    ],
    [
      'zz-00F',
      'linear-gradient(180deg,zz 0%,#00f 100%)',
    ],
  ])('%s → %s', (v, css) => {
    expect(gradientValue(v)).toEqual([css]);
  });

  it('one color is that color, nothing is nothing', () => {
    expect(gradientValue('F00')).toEqual(['#f00']);
    expect(gradientValue('$a')).toEqual(['var(--a)']);
    expect(gradientValue('T')).toEqual(['Transparent']);
    expect(gradientValue('')).toEqual([]);
  });

  it('with alt: the first color, the gradient without alpha, the gradient with it', () => {
    expect(gradientValue('F00-00F', true)).toEqual([
      '#f00',
      RED_TO_BLUE,
    ]);
    expect(gradientValue('F00.5-00F', true)).toEqual([
      '#f00',
      'rgba(255,0,0,.5)',
      RED_TO_BLUE,
      'linear-gradient(180deg,rgba(255,0,0,.5) 0%,#00f 100%)',
    ]);
    expect(gradientValue('$a;-00F', true)).toEqual([
      'var(--a)',
      'linear-gradient(180deg,var(--a) 0%,#00f 100%)',
    ]);
  });

  it.each([
    '--a;--b',
    '--a;-F00',
    'F00--b',
  ])('the old spelling %s is renamed', (v) => {
    expect(() => gradientValue(v)).toThrow(MnParseError);
    expect(() => gradientValue(v)).toThrow('" was renamed: write "');
  });
});

describe('colorVarValue', () => {
  it.each([
    [
      '$ink',
      'var(--ink)',
    ],
    [
      '$ink{F00}',
      'var(--ink, #f00)',
    ],
    [
      '$a{$b{F00.5}}',
      'var(--a, var(--b, rgba(255,0,0,.5)))',
    ],
    [
      '$ink{red}',
      'var(--ink, red)',
    ],
    [
      '$$safe{0}',
      'env(safe, #000)',
    ],
  ])('%s → %s: the fallback is read as a color', (v, expected) => {
    expect(colorVarValue(v)).toBe(expected);
  });

  it('a code is not a variable', () => {
    expect(colorVarValue('F00')).toBeUndefined();
  });
});

describe('cssVarValue — the fallback reader', () => {
  it('without a reader the fallback stays as written', () => {
    expect(cssVarValue('$a{F00}')).toBe('var(--a, F00)');
  });

  it('the reader gets only what is not a variable, at any depth', () => {
    const seen: string[] = [];
    expect(cssVarValue('$a{$b{x}}', (raw) => (seen.push(raw), raw.toUpperCase()))).toBe('var(--a, var(--b, X))');
    expect(seen).toEqual(['x']);
  });
});
