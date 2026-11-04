/**
 * Цвет и фон в записи нотации — `mnCss.color` / `mnCss.gradient` (`fundamentool/css` с записью нотации): коды, переменные `$`, градиенты из них,
 * угол, радиальная форма, повтор, стопы, запасной цвет без альфы, прежняя запись переменной.
 */
import {
  color,
} from 'fundamentool';
import {
  mnCss,
} from '../core/mathValue';
import {
  MnParseError,
} from '../core/types';

/** Запасной вариант переменной-цвета — как у хендлеров цвета: код — цвет, слово — как есть. */
const colorFallback = (raw: string): string => color(raw)[0];

const RED_TO_BLUE = 'linear-gradient(180deg,#f00 0%,#00f 100%)';

describe('mnCss.color', () => {
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
    expect(mnCss.color(v)).toEqual(css);
  });

  it('a code with alpha and alt: the fallback without alpha first', () => {
    expect(mnCss.color('F00.5', true)).toEqual([
      '#f00',
      'rgba(255,0,0,.5)',
    ]);
  });

  it('the old spelling is renamed, with the new one in the message', () => {
    expect(() => mnCss.color('--ink')).toThrow(MnParseError);
    expect(() => mnCss.color('--ink')).toThrow('"--ink" was renamed: write "$ink"');
  });
});

describe('mnCss.gradient', () => {
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
    expect(mnCss.gradient(v)).toEqual([css]);
  });

  it('one color is that color, nothing is nothing', () => {
    expect(mnCss.gradient('F00')).toEqual(['#f00']);
    expect(mnCss.gradient('$a')).toEqual(['var(--a)']);
    expect(mnCss.gradient('T')).toEqual(['Transparent']);
    expect(mnCss.gradient('')).toEqual([]);
  });

  it('with alt: the first color, the gradient without alpha, the gradient with it', () => {
    expect(mnCss.gradient('F00-00F', true)).toEqual([
      '#f00',
      RED_TO_BLUE,
    ]);
    expect(mnCss.gradient('F00.5-00F', true)).toEqual([
      '#f00',
      'rgba(255,0,0,.5)',
      RED_TO_BLUE,
      'linear-gradient(180deg,rgba(255,0,0,.5) 0%,#00f 100%)',
    ]);
    expect(mnCss.gradient('$a;-00F', true)).toEqual([
      'var(--a)',
      'linear-gradient(180deg,var(--a) 0%,#00f 100%)',
    ]);
  });

  it.each([
    '--a;--b',
    '--a;-F00',
    'F00--b',
  ])('the old spelling %s is renamed', (v) => {
    expect(() => mnCss.gradient(v)).toThrow(MnParseError);
    expect(() => mnCss.gradient(v)).toThrow('" was renamed: write "');
  });
});

describe('mnCss.variable with a colour fallback', () => {
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
    expect(mnCss.variable(v, colorFallback)).toBe(expected);
  });

  it('a code is not a variable', () => {
    expect(mnCss.variable('F00', colorFallback)).toBeUndefined();
  });
});

describe('mnCss.variable — the fallback reader', () => {
  it('without a reader the fallback stays as written', () => {
    expect(mnCss.variable('$a{F00}')).toBe('var(--a, F00)');
  });

  it('the reader gets only what is not a variable, at any depth', () => {
    const seen: string[] = [];
    expect(mnCss.variable('$a{$b{x}}', (raw: string) => (seen.push(raw), raw.toUpperCase()))).toBe('var(--a, var(--b, X))');
    expect(seen).toEqual(['x']);
  });
});
