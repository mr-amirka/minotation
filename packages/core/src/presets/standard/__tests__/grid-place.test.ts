/**
 * Сетка и выравнивание: одна линия сетки `grs`/`gre`/`gcs`/`gce`, `A` — `auto` и у `gr`/`gc`; пары выравнивания
 * `plc`/`pli`/`pls` на буквах `ac`+`jc`, `ai`+`ji`, `as`+`js`.
 */
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

describe('grid lines (group C)', () => {
  test.each([
    [
      'gcs2',
      '.gcs2{grid-column-start:2}',
    ],
    [
      'gce-1',
      '.gce-1{grid-column-end:-1}',
    ],
    [
      'grs3',
      '.grs3{grid-row-start:3}',
    ],
    [
      'gre+4',
      '.gre\\+4{grid-row-end:+4}',
    ],
    [
      'greA',
      '.greA{grid-row-end:auto}',
    ],
    [
      'grsS_2',
      '.grsS_2{grid-row-start:span 2}',
    ],
    [
      'gcsHeader',
      '.gcsHeader{grid-column-start:header}',
    ],
    [
      'gcs2_Header',
      '.gcs2_Header{grid-column-start:2 header}',
    ],
    [
      'gceS_2_Header',
      '.gceS_2_Header{grid-column-end:span 2 header}',
    ],
    [
      'gceS_Side',
      '.gceS_Side{grid-column-end:span side}',
    ],
    [
      'gcs--l',
      '.gcs--l{grid-column-start:var(--l)}',
    ],
    [
      'gcsS_--n',
      '.gcsS_--n{grid-column-start:span var(--n)}',
    ],
    [
      'grsINH',
      '.grsINH{grid-row-start:inherit}',
    ],
    [
      'gcA',
      '.gcA{grid-column:auto}',
    ],
    [
      'grA',
      '.grA{grid-row:auto}',
    ],
  ])('%s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test.each([
    [
      'gcsAuto',
      'Write it shorter: "gcsA" instead of "gcsAuto" — same value',
    ],
    [
      'gcAuto',
      'Write it shorter: "gcA" instead of "gcAuto" — same value',
    ],
    [
      'gcs1/3',
      'one line only — both ends are written with "gc1/3"',
    ],
    [
      'gre1_/_3',
      'one line only — both ends are written with "gr1_/_3"',
    ],
    [
      'gcs0',
      'a line is "A" (auto), a number (not 0), a name or "span"',
    ],
    [
      'gcs1.5',
      'a line is "A" (auto), a number (not 0), a name or "span"',
    ],
    [
      'gcs2_A',
      'a line is "A" (auto), a number (not 0), a name or "span"',
    ],
    [
      'grs2_3',
      'at most one number, one name and one "span"',
    ],
    [
      'grsHeader_Side',
      'at most one number, one name and one "span"',
    ],
    // Функция в токене не пишется: вычисленное — через переменную, `gcsS_--n`.
    [
      'gcsS_Calc\\(1+1\\)',
      'a function is not written in a class; a computed value goes through a variable, as "gcs--x"',
    ],
    [
      'grsS_S_2',
      'at most one number, one name and one "span"',
    ],
    [
      'gcsS',
      '"span" needs a number or a name — "gcsS_2"',
    ],
    [
      'gcsS_-2',
      'a "span" counts lines forward — its number is positive',
    ],
  ])('%s is rejected', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });
});

describe('place-* (group C)', () => {
  test.each([
    [
      'plcC',
      '.plcC{place-content:center}',
    ],
    [
      'plcSB_C',
      '.plcSB_C{place-content:space-between center}',
    ],
    [
      'plcC_L',
      '.plcC_L{place-content:center left}',
    ],
    [
      'pliC',
      '.pliC{place-items:center}',
    ],
    [
      'pliC_S',
      '.pliC_S{place-items:center start}',
    ],
    [
      'pliFB',
      '.pliFB{place-items:first baseline}',
    ],
    [
      'pliST_LG',
      '.pliST_LG{place-items:stretch legacy}',
    ],
    [
      'plsA_E',
      '.plsA_E{place-self:auto end}',
    ],
    [
      'plsE',
      '.plsE{place-self:end}',
    ],
    [
      'plc--a',
      '.plc--a{place-content:var(--a)}',
    ],
    [
      'plc--a_C',
      '.plc--a_C{place-content:var(--a) center}',
    ],
    [
      'plc--my_gap;_C',
      '.plc--my_gap\\;_C{place-content:var(--my_gap) center}',
    ],
    [
      'plcINH',
      '.plcINH{place-content:inherit}',
    ],
  ])('%s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test.each([
    [
      'plcL',
      'Value "L" is invalid for "plc": the first part is align-content. Available: plcS (start)',
    ],
    [
      'pliC_Q',
      'Value "Q" is invalid for "pli": the second part is justify-items. Available: pliC_N (normal)',
    ],
    [
      'pli10',
      'the first part is align-items',
    ],
    [
      'pli',
      'the first part is align-items',
    ],
    [
      'pliCenter',
      'Write it shorter: "pliC" instead of "pliCenter"',
    ],
    [
      'pliC_Start',
      'Write it shorter: "pliC_S" instead of "pliC_Start"',
    ],
    [
      'plsAuto_E',
      'Write it shorter: "plsA_E" instead of "plsAuto_E"',
    ],
    [
      'pliC_S_E',
      'at most two parts — align-items_justify-items, as "pliC_S"',
    ],
  ])('%s is rejected', (token, message) => {
    const result = compile(token);
    expect(result.css).toBe('');
    expect(result.warnings).toContain(message);
  });

  test('the letters are the ones of the single-axis handlers', () => {
    expect(compile('aiFB jiLG acSE jcL asAC jsR').css).toBe('.aiFB{align-items:first baseline}'
      + '.jiLG{justify-items:legacy}.acSE{align-content:space-evenly}.jcL{justify-content:left}'
      + '.asAC{align-self:anchor-center}.jsR{justify-self:right}');
    expect(compile('ai jc').css).toBe('.ai{align-items:center}.jc{justify-content:center}');
  });
});
