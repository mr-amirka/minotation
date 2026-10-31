/**
 * Маски, E2 (D-097, RESEARCH/17 § 5.6): семейство `mk…` зеркалит `bg…` — `mk` картинка (градиент, путь `mk_a\.png`, D-127), `mks`, `mkp`,
 * `mkr`, `mko`, `mkcp`, `mkc`, `mkt`, `mkm`; старых `maskbg`/`maski`/`maskt`/`maskm` больше нет (D-104).
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

/** Объявление правила без селектора: `mask-size:cover`. */
function declaration(token: string): string {
  const css = compile(token).css;
  return css.slice(css.indexOf('{') + 1, -1);
}

describe('masks: the mk… family (E2)', () => {
  test.each([
    [
      'mkF00-00F',
      'mask-image:linear-gradient(180deg,#f00 0%,#00f 100%)',
    ],
    [
      'mk_a\\.png',
      'mask-image:url("a.png")',
    ],
    [
      'mkN',
      'mask-image:none',
    ],
    [
      'mksCV',
      'mask-size:cover',
    ],
    [
      'mksCT',
      'mask-size:contain',
    ],
    [
      'mks50%_A',
      'mask-size:50% auto',
    ],
    [
      'mkpC',
      'mask-position:center',
    ],
    [
      'mkpTL',
      'mask-position:top left',
    ],
    [
      'mkpR_10_B_20',
      'mask-position:right 10px bottom 20px',
    ],
    [
      'mkr',
      'mask-repeat:repeat',
    ],
    [
      'mkrN',
      'mask-repeat:no-repeat',
    ],
    [
      'mkrX',
      'mask-repeat:repeat-x',
    ],
    [
      'mkrRD',
      'mask-repeat:round',
    ],
    [
      'mkoBB',
      'mask-origin:border-box',
    ],
    [
      'mkoCB',
      'mask-origin:content-box',
    ],
    [
      'mkoVB',
      'mask-origin:view-box',
    ],
    [
      'mkcpPB',
      'mask-clip:padding-box',
    ],
    [
      'mkcpFB',
      'mask-clip:fill-box',
    ],
    [
      'mkcpNC',
      'mask-clip:no-clip',
    ],
    [
      'mkcA',
      'mask-composite:add',
    ],
    [
      'mkcS',
      'mask-composite:subtract',
    ],
    [
      'mkcI',
      'mask-composite:intersect',
    ],
    [
      'mkcE',
      'mask-composite:exclude',
    ],
    [
      'mktA',
      'mask-type:alpha',
    ],
    [
      'mkmMS',
      'mask-mode:match-source',
    ],
  ])('%s → %s', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty(expected.slice(0, at), expected.slice(at + 1)).matched).toBeTruthy();
    expect(declaration(token)).toBe(expected);
  });

  test.each([
    [
      'mk--v',
      'mask-image:var(--v)',
    ],
    [
      'mkp--x_T',
      'mask-position:var(--x) top',
    ],
  ])('%s → %s — a variable', (token, expected) => {
    expect(declaration(token)).toBe(expected);
  });

  test.each([
    [
      'mkF00',
      'an image is a gradient (`mkF00-00F`), a variable or `mkN`; a picture by its path is `mk_a\\.png`; `mask-image`'
        + ' does not accept a single color',
    ],
    [
      'mksCover',
      'Write it shorter: "mksCV" instead of "mksCover"',
    ],
    [
      'mkcpT',
      'no such abbreviation',
    ],
    [
      'mkcQ',
      'no such abbreviation',
    ],
    [
      'mkoNC',
      'no such abbreviation',
    ],
    [
      'mkpL_R',
      'both parts are on one axis',
    ],
    [
      'mkpCenter',
      'Write it shorter: "mkpC" instead of "mkpCenter"',
    ],
  ])('%s is rejected', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });

  test.each([
    'maskbgF00-00F',
    'maski--v',
    'masktA',
    'maskmL',
  ])('the old %s gives no CSS — the names are gone (D-104)', (token) => {
    expect(compile(token).css).toBe('');
  });

  test.each([
    [
      'mks10',
      'mask-size:10px',
    ],
    [
      'mks10_20',
      'mask-size:10px 20px',
    ],
  ])('%s → %s — a bare number is px', (token, expected) => {
    expect(declaration(token)).toBe(expected);
  });
});
