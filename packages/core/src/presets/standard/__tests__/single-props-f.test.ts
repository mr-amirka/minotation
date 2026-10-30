/**
 * Группа F (RESEARCH/17): одиночные свойства — `acc`, `cc`, `csch`, `wc`, `cpth`, `fca`, `hy`, `owr`, `tbs`, `fvn`,
 * `bdb`, `lcl`, `fsz`, `tnb`, `atf`, `bgbm`.
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

/** Объявления правила без селектора: `hyphens:auto`. */
function declaration(token: string): string {
  const css = compile(token).css;
  return css.slice(css.indexOf('{') + 1, -1);
}

describe('single properties (group F)', () => {
  test.each([
    [
      'accF00',
      'accent-color:#f00',
    ],
    [
      'accAuto',
      'accent-color:auto',
    ],
    [
      'ccF00',
      'caret-color:#f00',
    ],
    [
      'ccAuto',
      'caret-color:auto',
    ],
    [
      'ccA',
      'caret-color:#aaa',
    ],
    [
      'cschN',
      'color-scheme:normal',
    ],
    [
      'cschL',
      'color-scheme:light',
    ],
    [
      'cschL_D',
      'color-scheme:light dark',
    ],
    [
      'cschD_O',
      'color-scheme:dark only',
    ],
    [
      'wcT',
      'will-change:transform',
    ],
    [
      'wcSP',
      'will-change:scroll-position',
    ],
    [
      'wcA',
      'will-change:auto',
    ],
    [
      'wcBackgroundColor',
      'will-change:background-color',
    ],
    [
      'wc_transform,opacity',
      'will-change:transform,opacity',
    ],
    [
      'cpthN',
      'clip-path:none',
    ],
    [
      'cpthBB',
      'clip-path:border-box',
    ],
    [
      'cpthInset\\(10px\\)',
      'clip-path:inset(10px)',
    ],
    [
      'fcaN',
      'forced-color-adjust:none',
    ],
    [
      'fcaPPC',
      'forced-color-adjust:preserve-parent-color',
    ],
    [
      'hyA',
      'hyphens:auto',
    ],
    [
      'hyM',
      'hyphens:manual',
    ],
    [
      'owrA',
      'overflow-wrap:anywhere',
    ],
    [
      'owrBW',
      'overflow-wrap:break-word',
    ],
    [
      'tbs4',
      'tab-size:4',
    ],
    [
      'tbs2em',
      'tab-size:2em',
    ],
    [
      'fvnTN',
      'font-variant-numeric:tabular-nums',
    ],
    [
      'fvnTN_SZ',
      'font-variant-numeric:tabular-nums slashed-zero',
    ],
    [
      'fvnLN_DF',
      'font-variant-numeric:lining-nums diagonal-fractions',
    ],
    [
      'fvnO',
      'font-variant-numeric:ordinal',
    ],
    [
      'fvnLN_TN_SZ',
      'font-variant-numeric:lining-nums tabular-nums slashed-zero',
    ],
    [
      'fvnLN_PN_DF_O_SZ',
      'font-variant-numeric:lining-nums proportional-nums diagonal-fractions ordinal slashed-zero',
    ],
    [
      'fszC',
      'field-sizing:content',
    ],
    [
      'tnbAD',
      'transition-behavior:allow-discrete',
    ],
    [
      'atfL',
      'animation-timing-function:linear',
    ],
    [
      'atfEIO',
      'animation-timing-function:ease-in-out',
    ],
    [
      'atfSteps4',
      'animation-timing-function:steps(4)',
    ],
    [
      'bgbmM',
      'background-blend-mode:multiply',
    ],
    [
      'bgbmCD',
      'background-blend-mode:color-dodge',
    ],
    [
      'bgbmLM',
      'background-blend-mode:luminosity',
    ],
  ])('%s → %s', (token, expected) => {
    const at = expected.indexOf(':');
    const property = expected.slice(0, at);
    // `field-sizing` и `transition-behavior` арбитру (mdn-data) пока неизвестны — для них сверяется только вывод.
    property === 'field-sizing' || property === 'transition-behavior'
      || expect(lexer.matchProperty(property, expected.slice(at + 1)).matched).toBeTruthy();
    expect(declaration(token)).toBe(expected);
  });

  test.each([
    [
      'bdbC',
      '-webkit-box-decoration-break:clone;box-decoration-break:clone',
    ],
    [
      'bdbS',
      '-webkit-box-decoration-break:slice;box-decoration-break:slice',
    ],
    [
      'lcl3',
      'overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3',
    ],
    [
      'lcl--lines',
      'overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:var(--lines)',
    ],
    [
      'lclN',
      'overflow:visible;display:block;-webkit-box-orient:horizontal;-webkit-line-clamp:unset',
    ],
    // `circle(50%)` валиден, но грамматика `circle()` у арбитра устарела и не принимает его.
    [
      'cpthCircle\\(50%\\)',
      'clip-path:circle(50%)',
    ],
  ])('%s → %s — several declarations or past the arbiter', (token, expected) => {
    expect(declaration(token)).toBe(expected);
  });

  test.each([
    [
      'ccAutoo',
      'is not a color',
    ],
    [
      'cschO',
      'no such abbreviation',
    ],
    [
      'csch_light_dark',
      'Write it shorter: "cschL_D" instead of "csch_light_dark"',
    ],
    [
      'wcTransform',
      'Write it shorter: "wcT" instead of "wcTransform" — same value',
    ],
    [
      'wc10',
      'Value "10" is invalid for "wc": "A" (auto) or property names separated by commas, as "wcT"',
    ],
    [
      'wc10_20',
      'property names separated by commas',
    ],
    [
      'wc_none',
      'property names separated by commas',
    ],
    [
      'wc_auto,transform',
      'property names separated by commas',
    ],
    [
      'wcF00.5',
      'property names separated by commas',
    ],
    [
      'tbs1.5',
      'a whole number of spaces or a length',
    ],
    [
      'cpthQ',
      'the set of values is closed. Available: ',
    ],
    [
      'cpthBorderBox',
      'Write it shorter: "cpthBB" instead of "cpthBorderBox"',
    ],
    [
      'hyAuto',
      'Write it shorter: "hyA" instead of "hyAuto"',
    ],
    [
      'owrB',
      'no such abbreviation',
    ],
    [
      'tbs-1',
      'a whole number of spaces or a length — not negative, not a percent',
    ],
    [
      'tbs50%',
      'a whole number of spaces or a length — not negative, not a percent',
    ],
    [
      'tbs2_4',
      'a whole number of spaces or a length',
    ],
    [
      'fvnSZ_TN',
      'Write "fvnTN_SZ" instead of "fvnSZ_TN" — same value: the order of the specification',
    ],
    [
      'fvnSZ_LN_TN',
      'Write "fvnLN_TN_SZ" instead of "fvnSZ_LN_TN" — same value: the order of the specification',
    ],
    [
      'fvnLN_ON',
      'one letter of a group — "LN" or "ON"',
    ],
    [
      'fvnN_TN',
      '"N" (normal) stands alone',
    ],
    [
      'fvnTN_Q',
      'no such abbreviation',
    ],
    [
      'fvn_lining-nums_tabular-nums',
      'Write it shorter: "fvnLN_TN" instead of "fvn_lining-nums_tabular-nums" — same value',
    ],
    [
      'lcl0',
      'the number of lines is a whole number from 1, as "lcl3", or "N" to lift the clamp',
    ],
    [
      'lclA',
      'the number of lines is a whole number from 1',
    ],
    [
      'lcl1.5',
      'the number of lines is a whole number from 1',
    ],
    [
      'atfLinear',
      'Write it shorter: "atfL" instead of "atfLinear"',
    ],
    [
      'bgbmMultiply',
      'Write it shorter: "bgbmM" instead of "bgbmMultiply"',
    ],
    [
      'bgbmPL',
      'no such abbreviation',
    ],
  ])('%s is rejected', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });

  test('a function or a variable passes the closed sets', () => {
    expect(declaration('tbsCalc\\(2+2\\)')).toBe('tab-size:calc(2+2)');
    expect(declaration('tbs--t')).toBe('tab-size:var(--t)');
    expect(declaration('fvnINH')).toBe('font-variant-numeric:inherit');
  });
});
