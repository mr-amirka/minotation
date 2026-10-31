/**
 * `border-image` по частям: `bi` — `border-image-source`, тот же читатель картинки, что у `bg` и `mk`;
 * слайс, ширина, вынос и повтор — свои хендлеры `bis`, `biw`, `bio`, `bir`. Сторон у свойства нет.
 *
 * Попутно — стопы градиента `bg`/`mk`/`bi` делятся по запятым верхнего уровня (`rgba(…)` больше не рвётся), с
 * `altColor` проверяется каждый градиент, `N` — `none` у всех трёх.
 */
import {
  lexer,
} from 'css-tree';
import minotationProvider from '../../../core/index';
import presetStandard from '../index';
import type {
  MnWarning,
} from '../../../core/types';

/** Компилирует токены через пробел; CSS без служебных правил и тексты предупреждений. */
function compile(tokens: string, altColor?: boolean): { css: string;
  warnings: string } {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    specificityMode: 'silent',
    presets: [presetStandard],
    altColor,
    onWarning: (w) => warnings.push(w),
  });
  const compileClass = mn.getCompiler('class');
  tokens.split(' ').forEach((token) => compileClass(token));
  mn.compile();
  return {
    css: mn.styles$.getValue().filter((s) => s.priority > -3000).map((s) => s.content).join(''),
    warnings: warnings.map((w) => w.message).join(' '),
  };
}

/** Объявления правила одного токена без селектора, с `altColor` — по одному на вариант. */
function declarations(token: string, altColor?: boolean): string[] {
  const css = compile(token, altColor).css;
  return css ? css.slice(css.indexOf('{') + 1, -1).split(';') : [];
}

/** Объявление валидно по грамматике CSS (`css-tree` + `mdn-data`). */
function isValid(decl: string): boolean {
  const at = decl.indexOf(':');
  return !!lexer.matchProperty(decl.slice(0, at), decl.slice(at + 1)).matched;
}

describe('bi is border-image-source, read as bg reads its image', () => {
  test.each([
    [
      'bi8D5524-6D3504',
      'border-image-source:linear-gradient(180deg,#8d5524 0%,#6d3504 100%)',
    ],
    [
      'bi8D5524-6D3504_g90',
      'border-image-source:linear-gradient(270deg,#8d5524 0%,#6d3504 100%)',
    ],
    [
      'biF00-00F-0F0',
      'border-image-source:linear-gradient(180deg,#f00 0%,#00f 50%,#0f0 100%)',
    ],
    [
      'biF00-00F_r',
      'border-image-source:radial-gradient(circle,#f00 0%,#00f 100%)',
    ],
    [
      'biF00-00F_rpt',
      'border-image-source:repeating-linear-gradient(180deg,#f00 0%,#00f 100%)',
    ],
    [
      'biF00-00F_r_rpt',
      'border-image-source:repeating-radial-gradient(circle,#f00 0%,#00f 100%)',
    ],
    [
      'biF00.5-00F',
      'border-image-source:linear-gradient(180deg,rgba(255,0,0,.5) 0%,#00f 100%)',
    ],
    // Градиент из переменных: прежняя копия разбора в `bi` давала `border-image:var(--a) var(--b)`.
    [
      'bi--a;--b',
      'border-image-source:linear-gradient(180deg,var(--a) 0%,var(--b) 100%)',
    ],
    // Картинка по пути — `_`-форма самого `bi`; `biUrl\\(a\\.png\\)` бракуется.
    [
      'bi_a\\.png',
      'border-image-source:url("a.png")',
    ],
    [
      'bi--img',
      'border-image-source:var(--img)',
    ],
    [
      'biN',
      'border-image-source:none',
    ],
  ])('%s → %s', (token, expected) => {
    expect(declarations(token)).toEqual([expected]);
    // css-tree не проверяет `var(…)`: подстановка известна только браузеру.
    expected.indexOf('var(') < 0 && expect(isValid(expected)).toBe(true);
  });

  test('the same token gives the same image in bg, mk and bi', () => {
    const image = (token: string) => declarations(token)[0].slice(declarations(token)[0].indexOf(':') + 1);
    expect(image('biF00-00F_g45')).toBe(image('bgF00-00F_g45'));
    expect(image('biF00-00F_g45')).toBe(image('mkF00-00F_g45'));
  });

  test('with altColor only gradients remain — a color is not a border image', () => {
    expect(declarations('bi8D5524-6D3504', true)).toEqual(['border-image-source:linear-gradient(180deg,#8d5524 0%,#6d3504 100%)']);
    expect(declarations('biF00.5-00F', true)).toEqual([
      'border-image-source:linear-gradient(180deg,#f00 0%,#00f 100%)',
      'border-image-source:linear-gradient(180deg,rgba(255,0,0,.5) 0%,#00f 100%)',
    ]);
  });
});

describe('the other parts of border-image are their own handlers', () => {
  test.each([
    [
      'bis1',
      'border-image-slice:1',
    ],
    [
      'bis30',
      'border-image-slice:30',
    ],
    [
      'bis30%',
      'border-image-slice:30%',
    ],
    [
      'bis30_F',
      'border-image-slice:30 fill',
    ],
    [
      'bisF_30',
      'border-image-slice:fill 30',
    ],
    [
      'bis10_20_30_40',
      'border-image-slice:10 20 30 40',
    ],
    [
      'bis--s',
      'border-image-slice:var(--s)',
    ],
    // Голое число у `biw` — кратное ширины рамки, без `px`: `biw2` при `b10` — кольцо 20px.
    [
      'biw2',
      'border-image-width:2',
    ],
    [
      'biw0.5',
      'border-image-width:0.5',
    ],
    [
      'biw10px',
      'border-image-width:10px',
    ],
    [
      'biw1rem',
      'border-image-width:1rem',
    ],
    [
      'biw10%',
      'border-image-width:10%',
    ],
    [
      'biwA',
      'border-image-width:auto',
    ],
    [
      'biw1_A',
      'border-image-width:1 auto',
    ],
    [
      'biw10px_2',
      'border-image-width:10px 2',
    ],
    // У `bio` то же: голое число — кратное ширины рамки, пиксели — с единицей.
    [
      'bio2',
      'border-image-outset:2',
    ],
    [
      'bio0.5',
      'border-image-outset:0.5',
    ],
    [
      'bio10px',
      'border-image-outset:10px',
    ],
    [
      'bio1_2px',
      'border-image-outset:1 2px',
    ],
    [
      'birST',
      'border-image-repeat:stretch',
    ],
    [
      'birR',
      'border-image-repeat:repeat',
    ],
    [
      'birRD',
      'border-image-repeat:round',
    ],
    [
      'birSP',
      'border-image-repeat:space',
    ],
    [
      'birR_ST',
      'border-image-repeat:repeat stretch',
    ],
  ])('%s → %s', (token, expected) => {
    expect(declarations(token)).toEqual([expected]);
    expected.indexOf('var(') < 0 && expect(isValid(expected)).toBe(true);
  });

  test('a gradient frame: the image, slice 1, and the border it paints into', () => {
    expect(compile('bi8D5524-6D3504 bis1 b6 bsS').css).toBe('.bi8D5524-6D3504{border-image-source:linear-gradient(180deg,#8d5524 0%,#6d3504 100%)}'
      + '.bis1{border-image-slice:1}.b6{border-width:6px}.bsS{border-style:solid}');
  });
});

describe('border-image: errors say what is accepted', () => {
  test.each([
    [
      'biF00',
      'Value "F00" is invalid for "bi": an image is a gradient (`biF00-00F`), a variable or `biN`; a picture by its'
        + ' path is `bi_a\\.png`; `border-image-source` does not accept a single color',
    ],
    [
      'biT',
      'Value "T" is invalid for "bi": an image is a gradient',
    ],
    [
      'bi10px',
      'Value "10px" is invalid for "bi": expected a gradient (`biF00-00F`), a variable or `biN`; a picture by its'
        + ' path is `bi_a\\.png`',
    ],
    [
      'bi100%-20px',
      'Value "100%-20px" is invalid for "bi": gradient stops must be colors or variables',
    ],
    [
      'bi',
      '"bi" produced no CSS: handler "bi" needs a value here',
    ],
    [
      'bis30px',
      'Value "30px" is invalid for "bis": expected a slice: a number without a unit (pixels of the image)'
        + ' or a percentage, zero or positive',
    ],
    [
      'bis-1',
      'Value "-1" is invalid for "bis": expected a slice',
    ],
    [
      'bisF',
      'Value "F" is invalid for "bis": "fill" does not stand alone — add a slice',
    ],
    [
      'bis1_2_3_4_5',
      'Value "1_2_3_4_5" is invalid for "bis": at most 4 slices',
    ],
    [
      'bis_fill',
      'Write it shorter: "bisF" instead of "bis_fill" — same value',
    ],
    [
      'biw-1',
      'Value "-1" is invalid for "biw": expected a length with a unit (`10px`), a percentage or a number — multiples'
        + ' of the border width (`2`), zero or positive',
    ],
    [
      'bio5%',
      'Value "5%" is invalid for "bio": expected a length with a unit (`10px`) or a number — multiples of the'
        + ' border width (`2`); no percentage, zero or positive',
    ],
    [
      'birRound',
      'Write it shorter: "birRD" instead of "birRound" — same value',
    ],
    [
      'bir1',
      'Value "1" is invalid for "bir": the set of values is closed, a number is not allowed',
    ],
    // У `bio` букв нет — слово бракуется тем, что ожидалось, без пустого «Available:».
    [
      'bioQqz',
      'Value "Qqz" is invalid for "bio": expected a length with a unit (`10px`) or a number — multiples of the'
        + ' border width (`2`); no percentage, zero or positive',
    ],
    // Подсказка показывает `fill` со слайсом: `bisF` сам бракуется.
    [
      'bisQqz',
      'Available: bis1_F (fill)',
    ],
  ])('%s', (token, message) => {
    const {
      css, warnings,
    } = compile(token);
    expect(css).toBe('');
    expect(warnings).toContain(message);
  });

  // Сборной записи `border-image` одним токеном нет — части пишутся своими классами.
  test.each([
    'biF00-00F_30_RD',
    'biUrl\\(a\\.png\\)_30_F_RD',
    'bi_url\\(a\\.png\\)_30',
    'bi30_RD',
    'bi10',
    'biST',
  ])('the one-token form %s gives no CSS', (token) => {
    expect(compile(token).css).toBe('');
  });

  // Функция в токене не пишется: ни цвет (`cRgb\\(0,0,0\\)` — это `c0`), ни картинка (`bgUrl\\(a\\.png\\)` —
  // это `bgi_a\\.png`). Ошибка называет запись, которой пишется то же самое.
  test.each([
    [
      'cRgb\\(0,0,0\\)',
      'Value "Rgb(0,0,0)" is invalid for "c": a function is not written in a class — a color is a code (`c0`, `cF00.5`),'
        + ' a letter (`cT`) or a variable (`c--x`, `c--x.3`)',
    ],
    [
      'cOklch\\(0.7_0.1_200\\)',
      'is invalid for "c": a function is not written in a class',
    ],
    [
      'bcColor-mix\\(in_srgb,var\\(--warn\\)_30%,transparent\\)',
      'is invalid for "bc": a function is not written in a class',
    ],
    [
      'bctRgb\\(0,0,0\\)',
      'is invalid for "bct": a function is not written in a class',
    ],
    [
      'bgcRgb\\(0,0,0\\)',
      'is invalid for "bgc": a function is not written in a class',
    ],
    [
      'sbcRgb\\(0,0,0\\)_0',
      'is invalid for "sbc": a function is not written in a class',
    ],
    [
      'bgUrl\\(a\\.png\\)',
      'Value "Url(a.png)" is invalid for "bg": a function is not written in a class — an image is a gradient'
        + ' (`bgF00-00F`), a variable or `bgN`; a picture by its path is `bgi_a\\.png`',
    ],
    [
      'mkUrl\\(a\\.png\\)',
      'a picture by its path is `mk_a\\.png`',
    ],
    [
      'biUrl\\(a\\.png\\)',
      'a picture by its path is `bi_a\\.png`',
    ],
    [
      'bgLinear-gradient\\(red,blue\\)',
      'is invalid for "bg": a function is not written in a class',
    ],
  ])('%s — a function is not written in a class', (token, message) => {
    const {
      css, warnings,
    } = compile(token);
    expect(css).toBe('');
    expect(warnings).toContain(message);
  });

  test('the old one-token outputs were invalid or are now other classes', () => {
    expect(isValid('border-image:10px')).toBe(false);
    expect(isValid('border-image-source:10px')).toBe(false);
  });
});

describe('border-image has no sides', () => {
  test.each([
    'bil5',
    'bit5',
    'bib5',
    'bilt5',
  ])('%s gives no rule', (token) => {
    expect(compile(token).css).toBe('');
  });

  test('the property it used to give does not exist', () => {
    expect(isValid('border-left-image:5')).toBe(false);
  });
});

describe('the image reader of bg / mk', () => {
  test.each([
    [
      'bgF00.5-00F',
      'background:linear-gradient(180deg,rgba(255,0,0,.5) 0%,#00f 100%)',
    ],
    [
      'mkF00.5-00F',
      'mask-image:linear-gradient(180deg,rgba(255,0,0,.5) 0%,#00f 100%)',
    ],
    // `N` — `none`, как у остальных хендлеров (раньше — «"N" is not a color»).
    [
      'bgN',
      'background:none',
    ],
    [
      'mkN',
      'mask-image:none',
    ],
  ])('%s → %s', (token, expected) => {
    expect(declarations(token)).toEqual([expected]);
    expect(isValid(expected)).toBe(true);
  });

  test('with altColor a bad stop is caught in every gradient', () => {
    const {
      css, warnings,
    } = compile('bgF00-zz', true);
    expect(css).toBe('');
    expect(warnings).toContain('gradient stops must be colors or variables');
  });

  test('with altColor mk keeps its gradients and drops the color fallback', () => {
    expect(declarations('mkF00-00F', true)).toEqual(['mask-image:linear-gradient(180deg,#f00 0%,#00f 100%)']);
    expect(declarations('mkF00.5-00F', true)).toEqual([
      'mask-image:linear-gradient(180deg,#f00 0%,#00f 100%)',
      'mask-image:linear-gradient(180deg,rgba(255,0,0,.5) 0%,#00f 100%)',
    ]);
  });

  test.each([
    'mkF00',
    'mkT',
  ])('%s — a single color is not a mask, with altColor too', (token) => {
    expect(compile(token, true).warnings).toContain('`mask-image` does not accept a single color');
    expect(compile(token).css).toBe('');
  });

  test('bg keeps its colors', () => {
    expect(declarations('bgT')).toEqual(['background:transparent']);
  });
});
