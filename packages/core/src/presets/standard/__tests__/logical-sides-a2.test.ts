/**
 * Логические стороны A2 (D-097, RESEARCH/17 § 5.2) с именами K3 (D-103): `ps`/`pie`, `ms`/`me`, `ss`/`se`,
 * `bis`/`bie`, `bcs`/`bce`, `bss`/`bse` и `…bs`/`…be` по оси блока; логические углы `rss`…`ree`, `rs`/`re`;
 * размеры `iz`/`bz` с `min`/`max`. Пишут одно логическое свойство в любом `axisMode`.
 */
import minotationProvider from '../../../core/index';
import presetStandard from '../index';
import type {
  MnOptions,
  MnWarning,
} from '../../../core/types';

function compile(tokens: string, options: MnOptions = {}) {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    specificityMode: 'silent',
    onWarning: (w) => warnings.push(w),
    presets: [presetStandard],
    ...options,
  });
  mn.getCompiler('class')(tokens);
  mn.compile();
  return {
    css: mn.styles$.getValue().filter((s) => s.priority > -3000).map((s) => s.content).join(''),
    warnings: warnings.map((w) => w.message).join(' '),
  };
}

describe('logical sides A2 with K3 (D-097, D-103)', () => {
  test.each([
    [
      'ps10',
      '.ps10{padding-inline-start:10px}',
    ],
    [
      'pie10',
      '.pie10{padding-inline-end:10px}',
    ],
    [
      'pbs10',
      '.pbs10{padding-block-start:10px}',
    ],
    [
      'pbe1.5',
      '.pbe1\\.5{padding-block-end:1.5px}',
    ],
    [
      'ms8',
      '.ms8{margin-inline-start:8px}',
    ],
    [
      'meA',
      '.meA{margin-inline-end:auto}',
    ],
    [
      'mbs-4',
      '.mbs-4{margin-block-start:-4px}',
    ],
    [
      'mbe8',
      '.mbe8{margin-block-end:8px}',
    ],
    [
      'ss0',
      '.ss0{inset-inline-start:0}',
    ],
    [
      'se10',
      '.se10{inset-inline-end:10px}',
    ],
    [
      'sbs0',
      '.sbs0{inset-block-start:0}',
    ],
    [
      'sbeA',
      '.sbeA{inset-block-end:auto}',
    ],
    [
      'bis1',
      '.bis1{border-inline-start-width:1px}',
    ],
    [
      'bie2',
      '.bie2{border-inline-end-width:2px}',
    ],
    [
      'bbs1',
      '.bbs1{border-block-start-width:1px}',
    ],
    [
      'bbeTN',
      '.bbeTN{border-block-end-width:thin}',
    ],
    [
      'bcsF00',
      '.bcsF00{border-inline-start-color:#f00}',
    ],
    [
      'bce0',
      '.bce0{border-inline-end-color:#000}',
    ],
    [
      'bcbsF00',
      '.bcbsF00{border-block-start-color:#f00}',
    ],
    [
      'bcbe--line',
      '.bcbe--line{border-block-end-color:var(--line)}',
    ],
    [
      'bssS',
      '.bssS{border-inline-start-style:solid}',
    ],
    [
      'bseDS',
      '.bseDS{border-inline-end-style:dashed}',
    ],
    [
      'bsbsS',
      '.bsbsS{border-block-start-style:solid}',
    ],
    [
      'bsbeN',
      '.bsbeN{border-block-end-style:none}',
    ],
    [
      'rss4',
      '.rss4{border-start-start-radius:4px}',
    ],
    [
      'rse4',
      '.rse4{border-start-end-radius:4px}',
    ],
    [
      'res4',
      '.res4{border-end-start-radius:4px}',
    ],
    [
      'ree4',
      '.ree4{border-end-end-radius:4px}',
    ],
    [
      'rs8',
      '.rs8{border-start-start-radius:8px;border-end-start-radius:8px}',
    ],
    [
      're8',
      '.re8{border-start-end-radius:8px;border-end-end-radius:8px}',
    ],
    [
      'iz100',
      '.iz100{inline-size:100px}',
    ],
    [
      'bz50%',
      '.bz50\\%{block-size:50%}',
    ],
    [
      'izmin60',
      '.izmin60{min-inline-size:60px}',
    ],
    [
      'izmax100%',
      '.izmax100\\%{max-inline-size:100%}',
    ],
    [
      'bzmin60',
      '.bzmin60{min-block-size:60px}',
    ],
    [
      'bzmaxN',
      '.bzmaxN{max-block-size:none}',
    ],
  ])('%s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test.each([
    'ps10',
    'mbe8',
    'ss0',
    'bis1',
    'bcsF00',
    'bsbsS',
  ])('%s — the same in axisMode: \'physical\'', (token) => {
    expect(compile(token, {
      axisMode: 'physical',
    }).css).toBe(compile(token).css);
  });

  test.each([
    [
      'px16 ps0',
      'padding-inline:16px',
      'padding-inline-start:0',
    ],
    [
      'p16 pbs0',
      'padding:16px',
      'padding-block-start:0',
    ],
    [
      'bx1 bie0',
      'border-inline-width:1px',
      'border-inline-end-width:0',
    ],
    [
      'rs8 rss0',
      'border-start-start-radius:8px;',
      'border-start-start-radius:0',
    ],
    [
      'r8 re0',
      'border-radius:8px',
      'border-start-end-radius:0',
    ],
  ])('%s — the side comes later in the CSS than the wider form', (
    tokens, wide, side,
  ) => {
    const css = compile(tokens).css;
    expect(css.indexOf(wide)).toBeGreaterThan(-1);
    expect(css.indexOf(wide)).toBeLessThan(css.indexOf(side));
  });

  test.each([
    [
      'peN',
      '.peN{pointer-events:none}',
    ],
    [
      'bsS',
      '.bsS{border-style:solid}',
    ],
    [
      'bsbS',
      '.bsbS{border-bottom-style:solid}',
    ],
    [
      'pb10',
      '.pb10{padding-bottom:10px}',
    ],
    [
      'rlt4',
      '.rlt4{border-top-left-radius:4px}',
    ],
  ])('%s — the old owners keep their names (K3)', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test.each([
    [
      'pe10',
      'pie10',
      'padding-inline-end',
    ],
    [
      'bs1',
      'bis1',
      'border-inline-start-width',
    ],
  ])('%s — Tailwind\'s name gives no CSS and points to %s', (
    token, right, property,
  ) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain('did you mean "' + right + '" (' + property + ')?');
  });

  test.each([
    'be1',
    'bisN',
    'bieN',
  ])('%s — no border-image side and no `be`', (token) => {
    expect(compile(token).css).not.toContain('image');
  });
});
