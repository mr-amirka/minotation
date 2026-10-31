/**
 * Прокрутка: отступы прокрутки `sm`/`sp` со всеми сторонами, привязка `sst`/`ssa`/`sss`, полоса
 * прокрутки `sbw`/`sbg`/`sbc`.
 */
import minotationProvider from '../../../core/index';
import presetStandard from '../index';
import type {
  MnOptions,
  MnWarning,
} from '../../../core/types';

function compile(tokens: string, options: MnOptions = {}): { css: string;
  warnings: string } {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    specificityMode: 'silent',
    presets: [presetStandard],
    onWarning: (w) => warnings.push(w),
    ...options,
  });
  mn.getCompiler('class')(tokens);
  mn.compile();
  return {
    css: mn.styles$.getValue().filter((s) => s.priority > -3000).map((s) => s.content).join(''),
    warnings: warnings.map((w) => w.message).join(' '),
  };
}

describe('scroll margins and paddings (group B)', () => {
  test.each([
    [
      'sm10',
      '.sm10{scroll-margin:10px}',
    ],
    [
      'smt80',
      '.smt80{scroll-margin-top:80px}',
    ],
    [
      'smb8',
      '.smb8{scroll-margin-bottom:8px}',
    ],
    [
      'sml8',
      '.sml8{scroll-margin-left:8px}',
    ],
    [
      'smr8',
      '.smr8{scroll-margin-right:8px}',
    ],
    [
      'sm-8',
      '.sm-8{scroll-margin:-8px}',
    ],
    [
      'smx8',
      '.smx8{scroll-margin-inline:8px}',
    ],
    [
      'smy8',
      '.smy8{scroll-margin-block:8px}',
    ],
    [
      'sms8',
      '.sms8{scroll-margin-inline-start:8px}',
    ],
    [
      'sme8',
      '.sme8{scroll-margin-inline-end:8px}',
    ],
    [
      'smbs8',
      '.smbs8{scroll-margin-block-start:8px}',
    ],
    [
      'smbe8',
      '.smbe8{scroll-margin-block-end:8px}',
    ],
    [
      'sm--gap',
      '.sm--gap{scroll-margin:var(--gap)}',
    ],
    [
      'sp16',
      '.sp16{scroll-padding:16px}',
    ],
    [
      'spt4',
      '.spt4{scroll-padding-top:4px}',
    ],
    [
      'spA',
      '.spA{scroll-padding:auto}',
    ],
    [
      'sp10%',
      '.sp10\\%{scroll-padding:10%}',
    ],
    [
      'spx2',
      '.spx2{scroll-padding-inline:2px}',
    ],
    [
      'spy16',
      '.spy16{scroll-padding-block:16px}',
    ],
    [
      'sps4',
      '.sps4{scroll-padding-inline-start:4px}',
    ],
    [
      'spe4',
      '.spe4{scroll-padding-inline-end:4px}',
    ],
    [
      'spbs4',
      '.spbs4{scroll-padding-block-start:4px}',
    ],
    [
      'spbe4',
      '.spbe4{scroll-padding-block-end:4px}',
    ],
  ])('%s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test.each([
    [
      'sm10%',
      'percent is not allowed',
    ],
    [
      'smA',
      'expected a number with a unit',
    ],
    [
      'sp-4',
      'negative value is not allowed',
    ],
  ])('%s is rejected', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });

  test('a side comes later in the CSS than the axis it narrows', () => {
    const css = compile('spx16 sps0').css;
    expect(css.indexOf('scroll-padding-inline:16px')).toBeLessThan(css.indexOf('scroll-padding-inline-start:0'));
  });
});

describe('scroll snapping and the scrollbar (group B)', () => {
  test.each([
    [
      'sstN',
      '.sstN{scroll-snap-type:none}',
    ],
    [
      'sstX',
      '.sstX{scroll-snap-type:x}',
    ],
    [
      'sstY',
      '.sstY{scroll-snap-type:y}',
    ],
    [
      'sstB',
      '.sstB{scroll-snap-type:block}',
    ],
    [
      'sstI',
      '.sstI{scroll-snap-type:inline}',
    ],
    [
      'sstBH',
      '.sstBH{scroll-snap-type:both}',
    ],
    [
      'sstX_M',
      '.sstX_M{scroll-snap-type:x mandatory}',
    ],
    [
      'sstY_P',
      '.sstY_P{scroll-snap-type:y proximity}',
    ],
    [
      'sstBH_M',
      '.sstBH_M{scroll-snap-type:both mandatory}',
    ],
    [
      'sstINH',
      '.sstINH{scroll-snap-type:inherit}',
    ],
    [
      'ssaN',
      '.ssaN{scroll-snap-align:none}',
    ],
    [
      'ssaS',
      '.ssaS{scroll-snap-align:start}',
    ],
    [
      'ssaE',
      '.ssaE{scroll-snap-align:end}',
    ],
    [
      'ssaC',
      '.ssaC{scroll-snap-align:center}',
    ],
    [
      'ssaC_S',
      '.ssaC_S{scroll-snap-align:center start}',
    ],
    [
      'ssaN_E',
      '.ssaN_E{scroll-snap-align:none end}',
    ],
    [
      'sssN',
      '.sssN{scroll-snap-stop:normal}',
    ],
    [
      'sssA',
      '.sssA{scroll-snap-stop:always}',
    ],
    [
      'sbwA',
      '.sbwA{scrollbar-width:auto}',
    ],
    [
      'sbwT',
      '.sbwT{scrollbar-width:thin}',
    ],
    [
      'sbwN',
      '.sbwN{scrollbar-width:none}',
    ],
    [
      'sbgA',
      '.sbgA{scrollbar-gutter:auto}',
    ],
    [
      'sbgS',
      '.sbgS{scrollbar-gutter:stable}',
    ],
    [
      'sbgSB',
      '.sbgSB{scrollbar-gutter:stable both-edges}',
    ],
  ])('%s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test.each([
    [
      'sst_x_mandatory',
      'Write it shorter: "sstX_M" instead of "sst_x_mandatory"',
    ],
    [
      'sstN_M',
      'Available: sstN (none)',
    ],
    [
      'sstM',
      'Available: sstN (none)',
    ],
    [
      'ssa_start',
      'Write it shorter: "ssaS" instead of "ssa_start"',
    ],
    [
      'ssaS_S',
      'ssaC_S (center start)',
    ],
    [
      'sbwThin',
      'Write it shorter: "sbwT" instead of "sbwThin"',
    ],
    [
      'sbg_stable_both-edges',
      'Write it shorter: "sbgSB" instead of "sbg_stable_both-edges"',
    ],
    [
      'sss10',
      'the set of values is closed',
    ],
  ])('%s is rejected', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });
});

describe('sbc — scrollbar-color (group B)', () => {
  test.each([
    [
      'sbcA',
      '.sbcA{scrollbar-color:auto}',
    ],
    [
      'sbcF00_0',
      '.sbcF00_0{scrollbar-color:#f00 #000}',
    ],
    [
      'sbcCT_T',
      '.sbcCT_T{scrollbar-color:currentColor transparent}',
    ],
    [
      'sbcF00.5_0',
      '.sbcF00\\.5_0{scrollbar-color:rgba(255,0,0,.5) #000}',
    ],
    [
      'sbc--a_--b',
      '.sbc--a_--b{scrollbar-color:var(--a) var(--b)}',
    ],
    [
      'sbc--a.3_F',
      '.sbc--a\\.3_F{scrollbar-color:color-mix(in srgb, var(--a) 30%, transparent) #fff}',
    ],
    [
      'sbc--my_ink;_F',
      '.sbc--my_ink\\;_F{scrollbar-color:var(--my_ink) #fff}',
    ],
    [
      'sbc--bar',
      '.sbc--bar{scrollbar-color:var(--bar)}',
    ],
    [
      'sbcINH',
      '.sbcINH{scrollbar-color:inherit}',
    ],
  ])('%s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test.each([
    [
      'sbcF00',
      'expected "A" (auto), two colors — thumb_track',
    ],
    [
      'sbc',
      'expected "A" (auto), two colors — thumb_track',
    ],
    [
      'sbcF00_0_0',
      'two colors are expected — thumb_track',
    ],
    [
      'sbcZzz_0',
      'Value "Zzz" is not a color',
    ],
    [
      'sbcCurrentColor_0',
      'Write the color shorter: "sbcCT_0" instead of "sbcCurrentColor_0"',
    ],
    [
      'sbc0_CurrentColor',
      'Write the color shorter: "sbc0_CT" instead of "sbc0_CurrentColor"',
    ],
    [
      'sbcF00_0000',
      'Write the color as "sbcF00_0.0" instead of "sbcF00_0000"',
    ],
    [
      'sbcFF0000_0',
      'Write the color as "sbcF00_0" instead of "sbcFF0000_0"',
    ],
    [
      'sbc-F00_0',
      'Value "-F00" is not a color',
    ],
  ])('%s is rejected', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });

  test('altColor: the fallback pair first, then the main one', () => {
    expect(compile('sbcF00.5_0', {
      altColor: true,
    }).css).toBe('.sbcF00\\.5_0{scrollbar-color:#f00 #000;scrollbar-color:rgba(255,0,0,.5) #000}');
    expect(compile('sbcF00_0', {
      altColor: true,
    }).css).toBe('.sbcF00_0{scrollbar-color:#f00 #000}');
  });
});
