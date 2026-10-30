/**
 * `border-image` (`bi`), 2026-10-30: источник-градиент пишется как у `bg` (`bi8D5524-6D3504`) и получает слайс `1`;
 * сторон у свойства нет (`bil5` давало несуществующее `border-left-image`); ошибка называет, что принимается.
 *
 * Попутно — стопы градиента `bg`/`mk`/`bi` делятся по запятым верхнего уровня (`rgba(…)` больше не рвётся), а с
 * `altColor` проверяется каждый градиент и `mk` не бракуется по цвету-fallback.
 */
import {
  lexer,
} from 'css-tree';
import minotationProvider from '../../../core/index';
import presetStandard from '../index';
import type {
  MnWarning,
} from '../../../core/types';

function compile(token: string, altColor?: boolean): { css: string;
  warnings: string } {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    specificityMode: 'silent',
    presets: [presetStandard],
    altColor,
    onWarning: (w) => warnings.push(w),
  });
  mn.getCompiler('class')(token);
  mn.compile();
  return {
    css: mn.styles$.getValue().filter((s) => s.priority > -3000).map((s) => s.content).join(''),
    warnings: warnings.map((w) => w.message).join(' '),
  };
}

/** Объявления правила без селектора: `border-image:…`, с `altColor` — по одному на вариант. */
function declarations(token: string, altColor?: boolean): string[] {
  const css = compile(token, altColor).css;
  return css ? css.slice(css.indexOf('{') + 1, -1).split(';') : [];
}

/** Объявление валидно по грамматике CSS (`css-tree` + `mdn-data`). */
function isValid(decl: string): boolean {
  const at = decl.indexOf(':');
  return !!lexer.matchProperty(decl.slice(0, at), decl.slice(at + 1)).matched;
}

describe('border-image: a gradient source as in bg', () => {
  test.each([
    [
      'bi8D5524-6D3504',
      'border-image:linear-gradient(180deg,#8d5524 0%,#6d3504 100%) 1',
    ],
    [
      'bi8D5524-6D3504_g90',
      'border-image:linear-gradient(270deg,#8d5524 0%,#6d3504 100%) 1',
    ],
    [
      'biF00-00F-0F0',
      'border-image:linear-gradient(180deg,#f00 0%,#00f 50%,#0f0 100%) 1',
    ],
    [
      'biF00-00F_r',
      'border-image:radial-gradient(circle,#f00 0%,#00f 100%) 1',
    ],
    [
      'biF00-00F_rpt',
      'border-image:repeating-linear-gradient(180deg,#f00 0%,#00f 100%) 1',
    ],
    [
      'biF00-00F_r_rpt',
      'border-image:repeating-radial-gradient(circle,#f00 0%,#00f 100%) 1',
    ],
    [
      'biF00.5-00F',
      'border-image:linear-gradient(180deg,rgba(255,0,0,.5) 0%,#00f 100%) 1',
    ],
    // Слайс написан — `1` не подставляется.
    [
      'biF00-00F_30_RD',
      'border-image:linear-gradient(180deg,#f00 0%,#00f 100%) 30 round',
    ],
    [
      'biF00-00F_30%',
      'border-image:linear-gradient(180deg,#f00 0%,#00f 100%) 30%',
    ],
    // Слайса нет — `1` встаёт перед шириной, `fill` и повтором.
    [
      'biF00-00F_/_4px',
      'border-image:linear-gradient(180deg,#f00 0%,#00f 100%) 1 / 4px',
    ],
    [
      'biF00-00F_F',
      'border-image:linear-gradient(180deg,#f00 0%,#00f 100%) 1 fill',
    ],
    // `R` — повтор рамки (буква, D-113), радиальный — строчное `_r`, как у `bg`.
    [
      'biF00-00F_R',
      'border-image:linear-gradient(180deg,#f00 0%,#00f 100%) 1 repeat',
    ],
    [
      'biF00-00F_g90_1_/_2px_/_1px_ST',
      'border-image:linear-gradient(270deg,#f00 0%,#00f 100%) 1 / 2px / 1px stretch',
    ],
  ])('%s → %s', (token, expected) => {
    expect(declarations(token)).toEqual([expected]);
    expect(isValid(expected)).toBe(true);
  });

  test('with altColor only gradients remain — a color is not a border image', () => {
    expect(declarations('bi8D5524-6D3504', true)).toEqual(['border-image:linear-gradient(180deg,#8d5524 0%,#6d3504 100%) 1']);
    // Прозрачный стоп: rgb-вариант и rgba-вариант, у каждого свой слайс.
    expect(declarations('biF00.5-00F_30', true)).toEqual([
      'border-image:linear-gradient(180deg,#f00 0%,#00f 100%) 30',
      'border-image:linear-gradient(180deg,rgba(255,0,0,.5) 0%,#00f 100%) 30',
    ]);
  });

  test('a full word after the gradient: the hint repeats the whole token', () => {
    const {
      css, warnings,
    } = compile('biF00-00F_1_round');
    expect(css).toBe('');
    expect(warnings).toContain('Write it shorter: "biF00-00F_1_RD" instead of "biF00-00F_1_round"');
  });
});

describe('border-image: the other sources stay', () => {
  test.each([
    [
      'bi',
      'border-image:none',
    ],
    [
      'biN',
      'border-image:none',
    ],
    [
      'bi10',
      'border-image:10',
    ],
    [
      'biUrl\\(a\\.png\\)_30_F_RD',
      'border-image:url(a.png) 30 fill round',
    ],
    [
      'bi_url\\(a\\.png\\)_30',
      'border-image:url(a.png) 30',
    ],
    [
      'bi--img_30',
      'border-image:var(--img) 30',
    ],
  ])('%s → %s', (token, expected) => {
    expect(declarations(token)).toEqual([expected]);
  });
});

describe('border-image: errors say what is accepted', () => {
  test.each([
    [
      'biF00',
      'Value "F00" is invalid for "bi": a single color is not an image — write a gradient ("biF00-00F") '
        + 'or set the border color with "bc"',
    ],
    [
      'bi8D5524',
      'Value "8D5524" is invalid for "bi": a single color is not an image',
    ],
    [
      'bi8D5524_30',
      'Value "8D5524_30" is invalid for "bi": a single color is not an image',
    ],
    [
      'bi10px',
      'Value "10px" is invalid for "bi": expected a gradient ("bi8D5524-6D3504"), an image ("biUrl\\(a\\.png\\)")'
        + ' or a variable ("bi--img"), then slices (numbers), "/" and a width, a repeat ("ST", "R", "RD", "SP")',
    ],
    [
      'biF00-00F_10px',
      'Value "F00-00F_10px" is invalid for "bi": expected a gradient',
    ],
    [
      'bi100%-20px',
      'Value "100%-20px" is invalid for "bi": gradient stops must be colors or variables',
    ],
  ])('%s', (token, message) => {
    const {
      css, warnings,
    } = compile(token);
    expect(css).toBe('');
    expect(warnings).toContain(message);
  });
});

describe('border-image has no sides', () => {
  test.each([
    'bil5',
    'bit5',
    'bir5',
    'bib5',
    'bilt5',
  ])('%s gives no rule', (token) => {
    expect(compile(token).css).toBe('');
  });

  test('the property it used to give does not exist', () => {
    expect(isValid('border-left-image:5')).toBe(false);
  });
});

describe('gradient stops of bg / mk', () => {
  test.each([
    [
      'bgF00.5-00F',
      'background:linear-gradient(180deg,rgba(255,0,0,.5) 0%,#00f 100%)',
    ],
    [
      'mkF00.5-00F',
      'mask-image:linear-gradient(180deg,rgba(255,0,0,.5) 0%,#00f 100%)',
    ],
  ])('a transparent stop: %s → %s', (token, expected) => {
    expect(declarations(token)).toEqual([expected]);
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

  test('with altColor mk still rejects a single color', () => {
    expect(compile('mkF00', true).warnings).toContain('`mask-image` does not accept a single color');
  });
});
