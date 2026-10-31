/**
 * Группа D (RESEARCH/17): общий разбор `<position>` у `op`/`pspo`/`tfo` (буквы, углы, длины, порядок осей, z у
 * `transform-origin`), `psp` — perspective, `tfb` — transform-box, `bfv` — backface-visibility.
 */
import {
  lexer,
} from 'css-tree';
import minotationProvider from '../../../core/index';
import presetStandard from '../index';
import type {
  MnWarning,
} from '../../../core/types';

function compile(tokens: string): { css: string;
  warnings: string } {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    specificityMode: 'silent',
    presets: [presetStandard],
    onWarning: (w) => warnings.push(w),
  });
  mn.getCompiler('class')(tokens);
  mn.compile();
  return {
    css: mn.styles$.getValue().filter((s) => s.priority > -3000).map((s) => s.content).join(''),
    warnings: warnings.map((w) => w.message).join(' '),
  };
}

/** Объявление правила без селектора: `object-position:left top`. */
function declaration(token: string): string {
  const css = compile(token).css;
  return css.slice(css.indexOf('{') + 1, -1);
}

describe('positions: op, pspo, tfo (group D)', () => {
  test.each([
    [
      'opC',
      'object-position:center',
    ],
    [
      'opL_T',
      'object-position:left top',
    ],
    [
      'opT_L',
      'object-position:top left',
    ],
    [
      'opC_C',
      'object-position:center center',
    ],
    [
      'opTL',
      'object-position:top left',
    ],
    [
      'opBR',
      'object-position:bottom right',
    ],
    [
      'op50%_0',
      'object-position:50% 0',
    ],
    [
      'op10',
      'object-position:10px',
    ],
    [
      'op10_20',
      'object-position:10px 20px',
    ],
    [
      'op-10_.5em',
      'object-position:-10px .5em',
    ],
    [
      'opL_10',
      'object-position:left 10px',
    ],
    [
      'op10_T',
      'object-position:10px top',
    ],
    [
      'opC_10',
      'object-position:center 10px',
    ],
    [
      'opR_10_B_20',
      'object-position:right 10px bottom 20px',
    ],
    [
      'opB_20%_R_10',
      'object-position:bottom 20% right 10px',
    ],
    [
      'opL_T',
      'object-position:left top',
    ],
    [
      'opR_10px_T_20px',
      'object-position:right 10px top 20px',
    ],
    [
      'opINH',
      'object-position:inherit',
    ],
    [
      'pspoC',
      'perspective-origin:center',
    ],
    [
      'pspoL_B',
      'perspective-origin:left bottom',
    ],
    [
      'pspoR_10_T_5',
      'perspective-origin:right 10px top 5px',
    ],
    [
      'tfoTL',
      'transform-origin:top left',
    ],
    [
      'tfo50%_0',
      'transform-origin:50% 0',
    ],
    [
      'tfoC_C_10',
      'transform-origin:center center 10px',
    ],
    [
      'tfoTL_-10',
      'transform-origin:top left -10px',
    ],
    [
      'tfoL_20%_0',
      'transform-origin:left 20% 0',
    ],
    [
      'tfoB',
      'transform-origin:bottom',
    ],
  ])('%s → %s', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty(expected.slice(0, at), expected.slice(at + 1)).matched).toBeTruthy();
    expect(declaration(token)).toBe(expected);
  });

  test.each([
    [
      'op--a',
      'object-position:var(--a)',
    ],
    [
      'opT_--a',
      'object-position:top var(--a)',
    ],
    [
      'op--x_--y_--z_--w',
      'object-position:var(--x) var(--y) var(--z) var(--w)',
    ],
    [
      'tfoL_T_--z',
      'transform-origin:left top var(--z)',
    ],
  ])('%s → %s — a variable fits any part', (token, expected) => {
    expect(declaration(token)).toBe(expected);
  });

  test.each([
    // Функция в токене не пишется (D-124): вычисленное — через переменную.
    [
      'opCalc\\(1px+2px\\)_T',
      'a function is not written in a class; a computed value goes through a variable, as "op--x"',
    ],
    [
      'opL_R',
      'both parts are on one axis',
    ],
    [
      'opT_B',
      'both parts are on one axis',
    ],
    [
      'opT_10',
      'with a length the order is x, then y, as "op10_T"',
    ],
    [
      'op10_L',
      'with a length the order is x, then y',
    ],
    [
      'op10_20_30',
      'a position has 1, 2 or 4 parts, as "opL_T" or "opR_10_B_20"',
    ],
    [
      'opTL_10',
      'a position has 1, 2 or 4 parts',
    ],
    [
      'opR_10_R_20',
      'four parts are side_offset_side_offset with the sides on different axes, as "opR_10_B_20"',
    ],
    [
      'opC_10_T_20',
      'four parts are side_offset_side_offset',
    ],
    [
      'opR_T_B_20',
      'four parts are side_offset_side_offset',
    ],
    [
      'opR_10_B_T',
      'four parts are side_offset_side_offset',
    ],
    [
      'opCenter',
      'Write it shorter: "opC" instead of "opCenter"',
    ],
    [
      'opL_Top',
      'Write it shorter: "opL_T" instead of "opL_Top"',
    ],
    [
      'opQ',
      'Value "Q" is invalid for "op": a part is a side letter, a length or a percent. Available: opL (left), ',
    ],
    [
      'opQ',
      'opTL (top left)',
    ],
    [
      'op10zz',
      'expected a length or a percent',
    ],
    [
      'op_solid',
      'the "_" form takes CSS words — left, center, right, top, bottom — and lengths',
    ],
    [
      'op_L_T',
      'the "_" form takes CSS words',
    ],
    [
      'op',
      'a part is a side letter, a length or a percent',
    ],
    [
      'tfoL_T_10_20',
      'at most three parts — x, y and a z length, as "tfoL_T_10"',
    ],
    [
      'tfoR_10_B_20',
      'at most three parts',
    ],
    [
      'tfoL_T_50%',
      'the third part is z — a length without percent',
    ],
    [
      'tfoL_T_C',
      'the third part is z',
    ],
    [
      'tfoTop',
      'Write it shorter: "tfoT" instead of "tfoTop"',
    ],
  ])('%s is rejected', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });

  test('a corner is the first part only — elsewhere the hint has no corners', () => {
    const result = compile('opL_TL');
    expect(result.css).toBe('');
    expect(result.warnings).toContain('a part is a side letter, a length or a percent');
    expect(result.warnings).not.toContain('(top left)');
  });
});

describe('psp, tfb, bfv (group D)', () => {
  test.each([
    [
      'psp500',
      'perspective:500px',
    ],
    [
      'psp20em',
      'perspective:20em',
    ],
    [
      'psp0',
      'perspective:0',
    ],
    [
      'pspN',
      'perspective:none',
    ],
    [
      'tfbCB',
      'transform-box:content-box',
    ],
    [
      'tfbBB',
      'transform-box:border-box',
    ],
    [
      'tfbFB',
      'transform-box:fill-box',
    ],
    [
      'tfbSB',
      'transform-box:stroke-box',
    ],
    [
      'tfbVB',
      'transform-box:view-box',
    ],
    [
      'bfvV',
      'backface-visibility:visible',
    ],
    [
      'bfvH',
      'backface-visibility:hidden',
    ],
  ])('%s → %s', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty(expected.slice(0, at), expected.slice(at + 1)).matched).toBeTruthy();
    expect(declaration(token)).toBe(expected);
  });

  test.each([
    [
      'psp-10',
      'negative value is not allowed',
    ],
    [
      'psp50%',
      'percent is not allowed',
    ],
    [
      'psp10_20',
      'expected a single value',
    ],
    [
      'pspNone',
      'Write it shorter: "pspN" instead of "pspNone"',
    ],
    [
      'pspA',
      'expected a length or a keyword of this property',
    ],
    [
      'tfbFillBox',
      'Write it shorter: "tfbFB" instead of "tfbFillBox"',
    ],
    [
      'tfbQ',
      'no such abbreviation',
    ],
    [
      'bfvHidden',
      'Write it shorter: "bfvH" instead of "bfvHidden"',
    ],
  ])('%s is rejected', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });
});
