/**
 * D-106: `tp` — список через запятую, как в CSS и в старой версии; буквы у `tp`/`ttf`/`mbm`; `ww` → `owr`;
 * опция `overflowWrapMode` для старого имени `word-wrap`; имя свойства из одной буквы у `tp`/`wc`/`tn` — ошибка.
 * D-107: заглавная после `,`/`;` не принимается — у элемента списка одно написание, со строчной.
 * D-109: `tn` берёт буквы плавности `ttf` и `A` — `all`; длинное слово отвечает буквой.
 * D-111: `tnN` — `transition:none`, длинная запись `none` — с подсказкой.
 */
import {
  lexer,
} from 'css-tree';
import minotationProvider from '../../../core/index';
import presetStandard from '../index';
import type {
  MnOptions,
  MnWarning,
} from '../../../core/types';

function createMn(options: MnOptions = {}, warnings: MnWarning[] = []) {
  return minotationProvider({
    specificityMode: 'silent',
    presets: [presetStandard],
    onWarning: (w) => warnings.push(w),
    ...options,
  });
}

function cssOf(mn: ReturnType<typeof createMn>): string {
  return mn.styles$.getValue().filter((s) => s.priority > -3000).map((s) => s.content).join('');
}

function compile(token: string, options?: MnOptions): { css: string;
  warnings: string } {
  const warnings: MnWarning[] = [];
  const mn = createMn(options, warnings);
  mn.getCompiler('class')(token);
  mn.compile();
  return {
    css: cssOf(mn),
    warnings: warnings.map((w) => w.message).join(' '),
  };
}

/** Объявления правила без селектора: `transition-property:all`. */
function declaration(token: string, options?: MnOptions): string {
  const css = compile(token, options).css;
  return css.slice(css.indexOf('{') + 1, -1);
}

describe('tp — a list with commas, letters for all/none (D-106)', () => {
  test.each([
    [
      'tp_color,opacity',
      'transition-property:color,opacity',
    ],
    [
      'tpColor,opacity',
      'transition-property:color,opacity',
    ],
    [
      'tpColor,backgroundColor',
      'transition-property:color,background-color',
    ],
    [
      'tpA',
      'transition-property:all',
    ],
    [
      'tpN',
      'transition-property:none',
    ],
    [
      'tp_color',
      'transition-property:color',
    ],
    [
      'tpBackgroundColor',
      'transition-property:background-color',
    ],
    [
      'tp_color,all',
      'transition-property:color,all',
    ],
  ])('%s → %s', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty(expected.slice(0, at), expected.slice(at + 1)).matched).toBeTruthy();
    expect(declaration(token)).toBe(expected);
  });

  test.each([
    [
      'tp_--x',
      'transition-property:var(--x)',
    ],
    [
      'tp_--a;,--b',
      'transition-property:var(--a),var(--b)',
    ],
  ])('%s → %s — variables pass', (token, expected) => {
    expect(declaration(token)).toBe(expected);
  });

  const LIST_HINT = '"A" (all), "N" (none) or CSS property names separated by commas, as "tp_color,opacity"';

  test.each([
    // `;` — сокращение `tn`; в CSS он обрывал объявление (`transition-property:color;opacity`).
    'tp_color;opacity',
    // Пробел в CSS — не разделитель списка: объявление отбрасывалось целиком, и анимировалось всё.
    'tpColor_Opacity',
    // Свойства из одной буквы нет: `tpB` давало `transition-property:b`.
    'tpB',
    'tp_color,none',
    'tp_color,',
    'tp1',
  ])('%s gives no CSS and a warning with the list form', (token) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(LIST_HINT);
  });

  test.each([
    [
      'tpAll',
      'Write it shorter: "tpA" instead of "tpAll" — same value',
    ],
    [
      'tp_all',
      'Write it shorter: "tpA" instead of "tp_all" — same value',
    ],
    [
      'tpNone',
      'Write it shorter: "tpN" instead of "tpNone" — same value',
    ],
  ])('%s — the long form is rejected (D-015)', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });
});

describe('ttf and mbm take letters, as atf and bgbm (D-106)', () => {
  test.each([
    [
      'ttfEI',
      'transition-timing-function:ease-in',
    ],
    [
      'ttfEIO',
      'transition-timing-function:ease-in-out',
    ],
    [
      'ttfSE',
      'transition-timing-function:step-end',
    ],
    [
      'ttfSteps\\(4,jump-end\\)',
      'transition-timing-function:steps(4,jump-end)',
    ],
    [
      'mbmM',
      'mix-blend-mode:multiply',
    ],
    [
      'mbmCD',
      'mix-blend-mode:color-dodge',
    ],
    [
      'mbmPD',
      'mix-blend-mode:plus-darker',
    ],
    [
      'mbmPL',
      'mix-blend-mode:plus-lighter',
    ],
  ])('%s → %s', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty(expected.slice(0, at), expected.slice(at + 1)).matched).toBeTruthy();
    expect(declaration(token)).toBe(expected);
  });

  test.each([
    [
      'ttfEaseIn',
      'Write it shorter: "ttfEI" instead of "ttfEaseIn"',
    ],
    [
      'ttfLinear',
      'Write it shorter: "ttfL" instead of "ttfLinear"',
    ],
    [
      'mbmMultiply',
      'Write it shorter: "mbmM" instead of "mbmMultiply"',
    ],
    [
      'mbmPlusLighter',
      'Write it shorter: "mbmPL" instead of "mbmPlusLighter"',
    ],
    [
      'ttfJumpNone',
      'no such abbreviation',
    ],
    [
      'bgbmPL',
      'no such abbreviation',
    ],
  ])('%s gives no CSS: %s', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });

  test('ttf outranks tn, as before', () => {
    const css = compile('tn_opacity_200_E ttfEI').css;
    expect(css.indexOf('.tn_opacity_200_E')).toBeLessThan(css.indexOf('.ttfEI'));
  });
});

describe('ww was renamed to owr (D-106)', () => {
  test.each([
    [
      'wwBW',
      'owrBW',
    ],
    [
      'wwB',
      'owrBW',
    ],
    [
      'wwN',
      'owrN',
    ],
    [
      'wwNM',
      'owrN',
    ],
    [
      'wwA',
      'owrA',
    ],
    [
      'ww',
      'owr',
    ],
  ])('%s gives no CSS and answers «write %s»', (token, replacement) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain('"' + token + '" was renamed: write "' + replacement + '" (D-106)');
  });
});

describe('overflowWrapMode — the old name word-wrap for old browsers (D-106)', () => {
  test.each([
    [
      'owrBW',
      'overflow-wrap:break-word',
      'word-wrap:break-word',
      'word-wrap:break-word;overflow-wrap:break-word',
    ],
    [
      'owrA',
      'overflow-wrap:anywhere',
      'word-wrap:anywhere',
      'word-wrap:anywhere;overflow-wrap:anywhere',
    ],
  ])('%s — standard by default, legacy, both', (
    token, standard, legacy, both,
  ) => {
    expect(declaration(token)).toBe(standard);
    expect(declaration(token, {
      overflowWrapMode: 'standard',
    })).toBe(standard);
    expect(declaration(token, {
      overflowWrapMode: 'legacy',
    })).toBe(legacy);
    expect(declaration(token, {
      overflowWrapMode: 'both',
    })).toBe(both);
  });

  test('the letters are checked in every mode', () => {
    const result = compile('owrBreakWord', {
      overflowWrapMode: 'both',
    });
    expect(result.css).toBe('');
    expect(result.warnings).toContain('Write it shorter: "owrBW" instead of "owrBreakWord"');
  });

  test('setOptions + recompile switch a live instance', () => {
    const mn = createMn();
    mn.getCompiler('class')('owrBW');
    mn.compile();
    expect(cssOf(mn)).toBe('.owrBW{overflow-wrap:break-word}');
    mn.setOptions({
      overflowWrapMode: 'both',
    });
    mn.recompile();
    expect(cssOf(mn)).toBe('.owrBW{word-wrap:break-word;overflow-wrap:break-word}');
  });

  test('the value is validated', () => {
    expect(() => createMn({
      overflowWrapMode: 'old' as never,
    }))
      .toThrow('option "overflowWrapMode" expects "standard", "legacy" or "both"');
    expect(() => createMn({
      overflowWrapMod: 'both',
    } as never))
      .toThrow('Did you mean "overflowWrapMode"?');
  });
});

describe('a list item starts with a lower-case letter (D-107)', () => {
  test.each([
    [
      'tnColor;opacity_200',
      'transition:color 200ms,opacity 200ms',
    ],
    [
      'tnColor_200,opacity_300',
      'transition:color 200ms,opacity 300ms',
    ],
    [
      'wcTransform,opacity',
      'will-change:transform,opacity',
    ],
    [
      'wcTransform,-webkitTransform',
      'will-change:transform,-webkit-transform',
    ],
    [
      'ffArial,sansSerif',
      'font-family:arial,sans-serif',
    ],
  ])('%s → %s', (token, expected) => {
    expect(declaration(token)).toBe(expected);
  });

  test.each([
    [
      'tnColor;Opacity_200',
      'Value "Color;Opacity": after "," and ";" a list item starts with a lower-case letter — write "Color;opacity"',
    ],
    [
      'tnColor_200,Opacity_300',
      'write "200,opacity"',
    ],
    [
      'tpColor,Opacity',
      'write "Color,opacity"',
    ],
    [
      'wcTransform,Opacity',
      'write "Transform,opacity"',
    ],
    [
      'ffArial,SansSerif',
      'write "Arial,sansSerif"',
    ],
    [
      'ttfSteps\\(4,JumpEnd\\)',
      'write "Steps(4,jumpEnd)"',
    ],
  ])('%s gives no CSS: %s', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });
});

describe('a one-letter property name is an error (D-106)', () => {
  test.each([
    [
      'wcB',
      'property names separated by commas',
    ],
    [
      'tn_b_200',
      '"b" fits none of them',
    ],
  ])('%s gives no CSS: %s', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });
});

describe('tn takes the letters of ttf and A for all (D-109)', () => {
  test.each([
    [
      'tn_opacity_200_EI',
      'transition:opacity 200ms ease-in',
    ],
    [
      'tnOpacity_200_EIO',
      'transition:opacity 200ms ease-in-out',
    ],
    [
      'tn_opacity_200_L_100',
      'transition:opacity 200ms linear 100ms',
    ],
    [
      'tn_opacity_200_SS,color_100_SE',
      'transition:opacity 200ms step-start,color 100ms step-end',
    ],
    [
      'tnColor;opacity_200_EO',
      'transition:color 200ms ease-out,opacity 200ms ease-out',
    ],
    [
      'tnA_200',
      'transition:all 200ms',
    ],
    [
      'tnA_200_E',
      'transition:all 200ms ease',
    ],
    [
      'tnA',
      'transition:all',
    ],
    [
      'tn_opacity_200_steps\\(4,jump-end\\)',
      'transition:opacity 200ms steps(4,jump-end)',
    ],
  ])('%s → %s', (token, expected) => {
    expect(lexer.matchProperty('transition', expected.slice(expected.indexOf(':') + 1)).matched).toBeTruthy();
    expect(declaration(token)).toBe(expected);
  });

  test.each([
    [
      'tn_opacity_200_ease-in',
      'write it shorter — "EI" instead of "ease-in"',
    ],
    [
      'tnOpacity_200_easeOut',
      'write it shorter — "EO" instead of "ease-out"',
    ],
    [
      'tn_opacity_200_linear',
      'write it shorter — "L" instead of "linear"',
    ],
    [
      'tn_opacity_200_step-start',
      'write it shorter — "SS" instead of "step-start"',
    ],
    [
      'tn_all_200',
      'write it shorter — "A" instead of "all"',
    ],
    [
      'tnAll_200',
      'write it shorter — "A" instead of "all"',
    ],
    [
      'tn_opacity_200_A',
      '"A" is out of place',
    ],
    [
      'tn_EI_opacity',
      '"opacity" is out of place',
    ],
    [
      'tn_opacity_200_EX',
      '"EX" fits none of them',
    ],
  ])('%s gives no CSS: %s', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });
});

describe('tnN is transition:none (D-111)', () => {
  test('tnN', () => {
    expect(lexer.matchProperty('transition', 'none').matched).toBeTruthy();
    expect(declaration('tnN')).toBe('transition:none');
  });

  test.each([
    [
      'tnNone',
      'Write it shorter: "tnN" instead of "tnNone" — same value',
    ],
    [
      'tn_none',
      'Write it shorter: "tnN" instead of "tn_none" — same value',
    ],
  ])('%s — the long form is rejected (D-015)', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });
});
