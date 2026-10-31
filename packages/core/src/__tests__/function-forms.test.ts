/**
 * Нативная форма функций `Name…` (D-124): имя в CamelCase, первый аргумент слитно, остальные — через `_`, без
 * скобок. Общий читатель (`functionsValue`) — здесь на фильтрах `ft`/`ftb`, первых его потребителях.
 */
import {
  lexer,
} from 'css-tree';
import {
  minotationProvider,
} from '../core/index';
import presetStandard from '../presets/standard';
import type {
  MnOptions,
  MnWarning,
} from '../core/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function compile(tokens: string[], options: MnOptions = {}): { css: string;
  warnings: string[]; } {
  const warnings: MnWarning[] = [];
  const mn: any = minotationProvider({
    importantMode: 'silent',
    onWarning: (w: MnWarning) => warnings.push(w),
    ...options,
  });
  mn.setPresets([presetStandard]);
  const c = mn.getCompiler('class');
  const l = tokens.length;
  for (let i = 0; i < l; i++) {
    c(tokens[i]);
  }
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n'),
    warnings: warnings.map((w) => w.message),
  };
}

/** Брак: CSS нет, одно предупреждение. */
function rejected(token: string, options?: MnOptions): string {
  const out = compile([token], options);
  expect(out.css).toBe('');
  expect(out.warnings).toHaveLength(1);
  return out.warnings[0];
}

const FILTER_NAMES = 'Blur, Gray, Bright, Contrast, Hue, Invert, Opacity, Saturate, Sepia, DropShadow';

describe('функции фильтра в нативной форме (D-124)', () => {
  test.each([
    [
      'ftBlur2',
      'filter:blur(2px)',
    ],
    [
      'ftBlur.5',
      'filter:blur(.5px)',
    ],
    [
      'ftBlur2em',
      'filter:blur(2em)',
    ],
    [
      'ftBlur0',
      'filter:blur(0)',
    ],
    [
      'ftBlur--a',
      'filter:blur(var(--a))',
    ],
    [
      'ftBlur',
      'filter:blur(4px)',
    ],
    // Функция без аргумента — значение по умолчанию; следующая часть с именем — уже другая функция.
    [
      'ftBlur_Gray50',
      'filter:blur(4px) grayscale(50%)',
    ],
    [
      'ftGray50',
      'filter:grayscale(50%)',
    ],
    [
      'ftGray50%',
      'filter:grayscale(50%)',
    ],
    [
      'ftGray--g',
      'filter:grayscale(var(--g))',
    ],
    [
      'ftBright150',
      'filter:brightness(150%)',
    ],
    [
      'ftContrast',
      'filter:contrast(100%)',
    ],
    [
      'ftOpacity50',
      'filter:opacity(50%)',
    ],
    [
      'ftSaturate200',
      'filter:saturate(200%)',
    ],
    [
      'ftSepia',
      'filter:sepia(100%)',
    ],
    [
      'ftHue90',
      'filter:hue-rotate(90deg)',
    ],
    [
      'ftHue-90',
      'filter:hue-rotate(-90deg)',
    ],
    [
      'ftHue1turn',
      'filter:hue-rotate(1turn)',
    ],
    [
      'ftHue--h',
      'filter:hue-rotate(var(--h))',
    ],
    [
      'ftHue',
      'filter:hue-rotate(180deg)',
    ],
    [
      'ftBlur3_Invert20',
      'filter:blur(3px) invert(20%)',
    ],
    [
      'ftbBlur8',
      'backdrop-filter:blur(8px)',
    ],
    [
      'ft--v',
      'filter:var(--v)',
    ],
  ])('%s → %s', (token, css) => {
    expect(compile([token])).toEqual({
      css: '.' + token.replace(/[.%]/g, '\\$&') + '{' + css + '}',
      warnings: [],
    });
  });

  test.each([
    [
      'ftDropShadow2_4',
      'drop-shadow(2px 4px)',
    ],
    [
      'ftDropShadow2_4_6',
      'drop-shadow(2px 4px 6px)',
    ],
    [
      'ftDropShadow-2_4_6_000.5',
      'drop-shadow(-2px 4px 6px rgba(0,0,0,.5))',
    ],
    [
      'ftDropShadow2_4_F00',
      'drop-shadow(2px 4px #f00)',
    ],
    [
      'ftDropShadow2_4_1em_T',
      'drop-shadow(2px 4px 1em transparent)',
    ],
    [
      'ftDropShadow2_4_--c',
      'drop-shadow(2px 4px var(--c))',
    ],
    [
      'ftDropShadow2_4_--b_0',
      'drop-shadow(2px 4px var(--b) #000)',
    ],
    [
      'ftBlur2_DropShadow0_1',
      'blur(2px) drop-shadow(0 1px)',
    ],
  ])('drop-shadow: x, y, размытие, цвет — %s → %s', (token, value) => {
    expect(compile([token]).css).toContain('{filter:' + value + '}');
  });

  test('с altColor цвет с альфой даёт запасное значение и основное, как у sbc', () => {
    expect(compile(['ftDropShadow2_4_6_000.5'], {
      altColor: true,
    }).css).toContain('{filter:drop-shadow(2px 4px 6px #000);filter:drop-shadow(2px 4px 6px rgba(0,0,0,.5))}');
  });

  test('подсказка к цвету называет весь токен', () => {
    expect(rejected('ftDropShadow2_4_6_CC'))
      .toBe('Write the color as "ftDropShadow2_4_6_C.8" instead of "ftDropShadow2_4_6_CC" — same value');
  });
});

describe('что раньше молча давало сломанный CSS (D-124)', () => {
  test.each([
    // Было `blur(4(2px))`: хвост приклеивался к значению по умолчанию.
    [
      'ftBlur\\(2px\\)',
      'Value "Blur(2px)" is invalid for "ft": a function is not written in a class — write "ftBlur2"',
    ],
    [
      'ft_blur\\(2px\\)',
      'Value "_blur(2px)" is invalid for "ft": a function is not written in a class — write'
      + ' "ftBlur2"',
    ],
    [
      'ft_hue-rotate\\(90deg\\)',
      'Value "_hue-rotate(90deg)" is invalid for "ft": a function is not written in a class'
      + ' — write "ftHue90"',
    ],
    // Скобка внутри аргумента: подсказка — функция, которой аргумент принадлежит.
    [
      'ftDropShadow2_4_rgba\\(0,0,0\\)',
      'Value "DropShadow2_4_rgba(0,0,0)" is invalid for "ft": a function is not'
      + ' written in a class — write "ftDropShadow2_4_6_000.5"',
    ],
    [
      'ftb_\\(x\\)',
      'Value "_(x)" is invalid for "ftb": a function is not written in a class — write "ftbBlur2"',
    ],
    // Было `drop-shadow(2)`: одна длина вместо двух.
    [
      'ftDropShadow2',
      'Value "DropShadow2" is invalid for "ft": "DropShadow" takes at least 2 parts — as'
      + ' "ftDropShadow2_4_6_000.5"',
    ],
    // Было `blur(4.5)` и `blur(4--a)` без единицы и с мусором.
    [
      'ftBlur2zz',
      'Value "Blur2zz" is invalid for "ft": "Blur" expects a length — as "ftBlur2"',
    ],
    [
      'ftBlur-2',
      'Value "Blur-2" is invalid for "ft": "Blur" expects a length of zero or more — as "ftBlur2"',
    ],
    [
      'ftGray-5',
      'Value "Gray-5" is invalid for "ft": "Gray" expects a percentage of zero or more — as "ftGray50"',
    ],
    [
      'ftHue90zz',
      'Value "Hue90zz" is invalid for "ft": "Hue" expects an angle — as "ftHue90"',
    ],
    [
      'ftDropShadow2_4_6_7_8',
      'Value "DropShadow2_4_6_7_8" is invalid for "ft": "8" is extra: "DropShadow" takes at'
      + ' most 4 parts — as "ftDropShadow2_4_6_000.5"',
    ],
    [
      'ftBlur2_3',
      'Value "Blur2_3" is invalid for "ft": "3" is extra: "Blur" takes at most 1 part — as "ftBlur2"',
    ],
    [
      'ftBlur2__Gray',
      'Value "Blur2__Gray" is invalid for "ft": an empty part — one "_" between parts',
    ],
  ])('%s', (token, message) => {
    expect(rejected(token)).toBe(message);
  });

  test.each([
    [
      'ftbF00',
      'F00',
      'ftb',
    ],
    [
      'ftb_solid',
      '_solid',
      'ftb',
    ],
    [
      'ftZzz10',
      'Zzz10',
      'ft',
    ],
  ])('не функция фильтра: %s', (
    token, suffix, name,
  ) => {
    expect(rejected(token)).toBe('Value "' + suffix + '" is invalid for "' + name + '": expected a filter function by'
      + ' its name, as "' + name + 'Blur2": ' + FILTER_NAMES);
  });
});

describe('имя функции — одной формой (D-122)', () => {
  test.each([
    // `brightness(150)` было в сто раз ярче, чем `ftBright150`: полное имя шло без процентов.
    [
      'ftGrayscale100',
      'Write it shorter: "ftGray100" instead of "ftGrayscale100" — same value',
    ],
    [
      'ftBrightness150',
      'Write it shorter: "ftBright150" instead of "ftBrightness150" — same value',
    ],
    [
      'ftHueRotate90',
      'Write it shorter: "ftHue90" instead of "ftHueRotate90" — same value',
    ],
    // Исправлено не одно сокращение — и подсказка не «короче».
    [
      'ft_grayscale50',
      'Write "ftGray50" instead of "ft_grayscale50" — same value',
    ],
    [
      'ft_blur5',
      'Write "ftBlur5" instead of "ft_blur5" — same value',
    ],
    [
      'ft_Blur5',
      'Write "ftBlur5" instead of "ft_Blur5" — same value',
    ],
    [
      'ftBlur5_gray50',
      'Write "ftBlur5_Gray50" instead of "ftBlur5_gray50" — same value',
    ],
    // Первый аргумент — слитно с именем; отдельной частью за именем идёт только следующая функция (`ftBlur_Gray50`).
    [
      'ftBlur_5',
      'Write "ftBlur5" instead of "ftBlur_5" — same value',
    ],
    [
      'ftBlur_--x',
      'Write "ftBlur--x" instead of "ftBlur_--x" — same value',
    ],
    [
      'ftDropShadow_2_4',
      'Write "ftDropShadow2_4" instead of "ftDropShadow_2_4" — same value',
    ],
  ])('%s', (token, message) => {
    expect(rejected(token)).toBe(message);
  });
});

describe('ключевые слова и голое имя', () => {
  test('CSS-wide keyword — значение целиком (D-125)', () => {
    expect(compile([
      'ftINH',
      'ftbRV',
    ]).css).toBe('.ftINH{filter:inherit}.ftbRV{backdrop-filter:revert}');
  });

  test('голое ft — значения нет', () => {
    expect(compile(['ft']).warnings).toEqual(['"ft" produced no CSS: handler "ft" needs a value here']);
  });
});

describe('функции плавности в нативной форме: ttf, atf (D-124)', () => {
  test.each([
    [
      'ttfSteps4',
      '.ttfSteps4{transition-timing-function:steps(4)}',
    ],
    [
      'ttfSteps4_JE',
      '.ttfSteps4_JE{transition-timing-function:steps(4,jump-end)}',
    ],
    [
      'atfSteps4_JS',
      '.atfSteps4_JS{animation-timing-function:steps(4,jump-start)}',
    ],
    [
      'atfSteps2_JN',
      '.atfSteps2_JN{animation-timing-function:steps(2,jump-none)}',
    ],
    [
      'ttfSteps4_JB',
      '.ttfSteps4_JB{transition-timing-function:steps(4,jump-both)}',
    ],
    [
      'ttfSteps--n_JE',
      '.ttfSteps--n_JE{transition-timing-function:steps(var(--n),jump-end)}',
    ],
    [
      'ttfCubicBezier0.4_0_0.2_1',
      '.ttfCubicBezier0\\.4_0_0\\.2_1{transition-timing-function:cubic-bezier(0.4,0,0.2,1)}',
    ],
    [
      'ttfCubicBezier0.4_-0.5_0.2_1.5',
      '.ttfCubicBezier0\\.4_-0\\.5_0\\.2_1\\.5{transition-timing-function:cubic-bezier(0.4,-0.5,0.2,1.5)}',
    ],
    [
      'ttfCubicBezier--a_0_1_1',
      '.ttfCubicBezier--a_0_1_1{transition-timing-function:cubic-bezier(var(--a),0,1,1)}',
    ],
    [
      'ttfEIO',
      '.ttfEIO{transition-timing-function:ease-in-out}',
    ],
    [
      'ttfINH',
      '.ttfINH{transition-timing-function:inherit}',
    ],
  ])('%s → %s', (token, css) => {
    expect(compile([token])).toEqual({
      css,
      warnings: [],
    });
  });

  test.each([
    [
      'ttfSteps',
      'Value "Steps" is invalid for "ttf": "Steps" takes at least 1 part — as "ttfSteps4_JE"',
    ],
    [
      'ttfSteps0',
      'Value "Steps0" is invalid for "ttf": "Steps" expects a whole number of steps from 1 — as'
      + ' "ttfSteps4_JE"',
    ],
    [
      'ttfSteps4_JX',
      'Value "Steps4_JX" is invalid for "ttf": "Steps" expects a step position: JS (jump-start),'
      + ' JE (jump-end), JN (jump-none) or JB (jump-both) — as "ttfSteps4_JE"',
    ],
    // `steps(1, jump-none)` невалиден: один шаг без прыжков на концах — ни одного перехода.
    [
      'ttfSteps1_JN',
      'Value "Steps1_JN" is invalid for "ttf": "Steps" expects two steps or more with JN (jump-none)'
      + ' — as "ttfSteps4_JE"',
    ],
    [
      'ttfCubicBezier1.5_0_0.2_1',
      'Value "CubicBezier1.5_0_0.2_1" is invalid for "ttf": "CubicBezier" expects x1 and'
      + ' x2 from 0 to 1 — as "ttfCubicBezier0.4_0_0.2_1"',
    ],
    [
      'ttfCubicBezier0.4_a_0.2_1',
      'Value "CubicBezier0.4_a_0.2_1" is invalid for "ttf": "CubicBezier" expects four'
      + ' numbers — as "ttfCubicBezier0.4_0_0.2_1"',
    ],
    [
      'ttfCubicBezier0.4_0_0.2',
      'Value "CubicBezier0.4_0_0.2" is invalid for "ttf": "CubicBezier" takes at least 4'
      + ' parts — as "ttfCubicBezier0.4_0_0.2_1"',
    ],
    [
      'ttfSteps4_CubicBezier0_0_1_1',
      'Value "Steps4_CubicBezier0_0_1_1" is invalid for "ttf": one function is'
      + ' expected — as "ttfSteps4_JE"',
    ],
    [
      'ttfSteps\\(4,jump-end\\)',
      'Value "Steps(4,jump-end)" is invalid for "ttf": a function is not written in a'
      + ' class — write "ttfSteps4_JE"',
    ],
    [
      'atf_cubic-bezier\\(0,0,1,1\\)',
      'Value "_cubic-bezier(0,0,1,1)" is invalid for "atf": a function is not'
      + ' written in a class — write "atfCubicBezier0.4_0_0.2_1"',
    ],
    // У `linear(…)` с точками короткой записи нет — выход переменная.
    [
      'ttf_linear\\(0,1\\)',
      'Value "_linear(0,1)" is invalid for "ttf": a function is not written in a class —'
      + ' "linear" has no short form, write it through a variable — "ttf--x"',
    ],
    [
      'ttf_steps4',
      'Write "ttfSteps4" instead of "ttf_steps4" — same value',
    ],
    [
      'ttfSteps_4',
      'Write "ttfSteps4" instead of "ttfSteps_4" — same value',
    ],
    [
      'ttfEaseIn',
      'Write it shorter: "ttfEI" instead of "ttfEaseIn" — same value',
    ],
  ])('%s', (token, message) => {
    expect(rejected(token)).toBe(message);
  });

  test('у фильтра функция без нативной формы — тоже переменная', () => {
    expect(rejected('ft_url\\(a\\.svg\\)')).toBe('Value "_url(a.svg)" is invalid for "ft": a function is not written in'
      + ' a class — "url" has no short form, write it through a variable — "ft--x"');
  });
});

describe('функции плавности в слотах tn и an (D-124)', () => {
  test.each([
    [
      'tn_color_0.2s_CubicBezier0.4_0_0.2_1',
      'transition:color 0.2s cubic-bezier(0.4,0,0.2,1)',
    ],
    [
      'tnColor_0.2s_CubicBezier0.4_0_0.2_1',
      'transition:color 0.2s cubic-bezier(0.4,0,0.2,1)',
    ],
    // `JE` — ещё аргумент `Steps`, `100` — уже задержка.
    [
      'tn_opacity_200_Steps4_JE_100',
      'transition:opacity 200ms steps(4,jump-end) 100ms',
    ],
    [
      'tnOpacity_200_Steps4_JE',
      'transition:opacity 200ms steps(4,jump-end)',
    ],
    [
      'tnOpacity_200_Steps4_100',
      'transition:opacity 200ms steps(4) 100ms',
    ],
    [
      'tn_color_0.2s_CubicBezier0.4_0_0.2_1,transform_0.4s_L',
      'transition:color 0.2s cubic-bezier(0.4,0,0.2,1),transform 0.4s linear',
    ],
    [
      'an_fade_1s_Steps4_infinite',
      'animation:fade 1s steps(4) infinite',
    ],
    [
      'an_fade_1s_CubicBezier0.4_0_0.2_1_2',
      'animation:fade 1s cubic-bezier(0.4,0,0.2,1) 2ms',
    ],
    [
      'an_fade_Steps4_JE',
      'animation:fade steps(4,jump-end)',
    ],
    // Первая часть — всегда имя, как у букв.
    [
      'an_steps4_1s',
      'animation:steps4 1s',
    ],
  ])('%s → %s', (token, declaration) => {
    const out = compile([token]);
    expect(out.warnings).toEqual([]);
    expect(out.css).toContain('{' + declaration + '}');
  });

  test.each([
    [
      'tn_cubic-bezier\\(0,0,1,1\\)',
      'Value "_cubic-bezier(0,0,1,1)" is invalid for "tn": a function is not written'
      + ' in a class — write "CubicBezier0.4_0_0.2_1"',
    ],
    [
      'tn_0.2s_linear\\(0,1\\)',
      'Value "_0.2s_linear(0,1)" is invalid for "tn": a function is not written in a'
      + ' class — "linear" has no short form, write it through a variable — "--x"',
    ],
    [
      'an_fade_1s_steps\\(4\\)',
      'Value "_fade_1s_steps(4)" is invalid for "an": a function is not written in a'
      + ' class — write "Steps4_JE"',
    ],
    [
      'tn_color_0.2s_CubicBezier0.4_0',
      'Value "CubicBezier0.4_0" is invalid for "tn": "CubicBezier" takes at least 4'
      + ' parts — as "CubicBezier0.4_0_0.2_1"',
    ],
    [
      'tn_color_0.2s_Steps0',
      'Value "Steps0" is invalid for "tn": "Steps" expects a whole number of steps from 1 — as'
      + ' "Steps4_JE"',
    ],
    [
      'tn_opacity_Steps_4',
      'Write "Steps4" instead of "Steps_4" — same value',
    ],
    [
      'tn_opacity_Steps',
      'Value "Steps" is invalid for "tn": "Steps" takes at least 1 part — as "Steps4_JE"',
    ],
  ])('%s', (token, message) => {
    expect(rejected(token)).toBe(message);
  });

  test('подстановка в слоте по-прежнему проходит', () => {
    expect(compile(['tn_A_--ease']).css).toContain('{transition:all var(--ease)}');
  });
});

describe('функции content в нативной форме: cnt (D-124)', () => {
  test.each([
    [
      'cntAttr_href',
      'content:attr(href)',
    ],
    [
      'cntAttr_data-label',
      'content:attr(data-label)',
    ],
    // `item` — `it` + `em`: эвристика битого значения в ядре браковала такие имена до 2026-10-31.
    [
      'cntCounter_item',
      'content:counter(item)',
    ],
    [
      'cntCounter_item_UR',
      'content:counter(item,upper-roman)',
    ],
    [
      'cntCounter_item_N',
      'content:counter(item,none)',
    ],
    [
      'cntCounter_item_--s',
      'content:counter(item,var(--s))',
    ],
    // `_` — текст: имя функции после него — слово текста.
    [
      'cnt_Attr_href',
      'content:"Attr href"',
    ],
  ])('%s → %s', (token, declaration) => {
    const out = compile([token]);
    expect(out.warnings).toEqual([]);
    expect(out.css).toContain('{' + declaration + '}');
  });

  test.each([
    [
      'cnt_attr\\(href\\)',
      'Value "_attr(href)" is invalid for "cnt": a function is not written in a class — write "cntAttr_href"',
    ],
    [
      'cntAttr\\(href\\)',
      'Value "Attr(href)" is invalid for "cnt": a function is not written in a class — write "cntAttr_href"',
    ],
    [
      'cnt_counter\\(n\\)',
      'Value "_counter(n)" is invalid for "cnt": a function is not written in a class — write'
      + ' "cntCounter_item_UR"',
    ],
    [
      'cnt_url\\(a\\.png\\)',
      'Value "_url(a.png)" is invalid for "cnt": a function is not written in a class — "url" has no short'
      + ' form, write it through a variable — "cnt--x"',
    ],
    [
      'cntAttr',
      'Value "Attr" is invalid for "cnt": "Attr" takes at least 1 part — as "cntAttr_href"',
    ],
    [
      'cntAttr_a_b',
      'Value "Attr_a_b" is invalid for "cnt": "b" is extra: "Attr" takes at most 1 part — as "cntAttr_href"',
    ],
    // Имя пишется отдельной частью — склеивать его с функцией подсказка не предлагает.
    [
      'cntAttr_1a',
      'Value "Attr_1a" is invalid for "cnt": "Attr" expects an attribute name — as "cntAttr_href"',
    ],
    [
      'cntCounter_1',
      'Value "Counter_1" is invalid for "cnt": "Counter" expects a counter name — as "cntCounter_item_UR"',
    ],
    [
      'cntCounter_item_UpperRoman',
      'Value "Counter_item_UpperRoman" is invalid for "cnt": "Counter" expects a list style letter: N, S, D, DC,'
      + ' DCLZ, LR, UR, C — as "cntCounter_item_UR"',
    ],
    [
      'cntAttr_href_Counter_n',
      'Value "Attr_href_Counter_n" is invalid for "cnt": one function is expected — as "cntAttr_href"',
    ],
  ])('%s', (token, message) => {
    expect(rejected(token)).toBe(message);
  });
});

describe('курсор-картинка: cr, запятая владельца (D-124)', () => {
  test.each([
    [
      'cr_a\\.png',
      'cursor:url("a.png"),auto',
    ],
    [
      'cr_a\\.png,P',
      'cursor:url("a.png"),pointer',
    ],
    [
      'cr_a\\.svg,b\\.png,P',
      'cursor:url("a.svg"),url("b.png"),pointer',
    ],
    [
      'cr_a\\.png_4_4,P',
      'cursor:url("a.png") 4 4,pointer',
    ],
    [
      'cr_a\\.png_4_4',
      'cursor:url("a.png") 4 4,auto',
    ],
    // `_` в имени файла — как написан.
    [
      'cr_my_img\\.png',
      'cursor:url("my_img.png"),auto',
    ],
    [
      'cr_img/hand\\.svg,b\\.png_2_2,G',
      'cursor:url("img/hand.svg"),url("b.png") 2 2,grab',
    ],
    [
      'crNWR',
      'cursor:nw-resize',
    ],
    [
      'cr--x',
      'cursor:var(--x)',
    ],
  ])('%s → %s', (token, declaration) => {
    const out = compile([token]);
    expect(out.warnings).toEqual([]);
    expect(out.css).toContain('{' + declaration + '}');
  });

  test.each([
    [
      'crUrl\\(a\\.png\\)',
      'Value "Url(a.png)" is invalid for "cr": a function is not written in a class — the picture by its path, as'
      + ' "cr_a\\.png,P"',
    ],
    [
      'cr_url\\(a\\.png\\)',
      'Value "_url(a.png)" is invalid for "cr": a function is not written in a class — the path alone, as "cr_a\\.png"',
    ],
    [
      'cr_a\\.png,pointer',
      'Write it shorter: "cr_a.png,P" instead of "cr_a.png,pointer" — same value',
    ],
    [
      'cr_a\\.png,NotAllowed',
      'Write it shorter: "cr_a.png,NA" instead of "cr_a.png,NotAllowed" — same value',
    ],
    [
      'cr_pointer',
      'Write it shorter: "crP" instead of "cr_pointer" — same value',
    ],
    [
      'cr_none',
      'Write it shorter: "crN" instead of "cr_none" — same value',
    ],
    [
      'cr_a\\.png,ZZ',
      'Value "_a.png,ZZ" is invalid for "cr": "ZZ" is not a cursor letter — as "cr_a\\.png,P"',
    ],
    [
      'cr_P',
      'Value "_P" is invalid for "cr": a picture goes before the fallback — as "cr_a\\.png,P", or the letter alone,'
      + ' "crP"',
    ],
    [
      'cr_a\\.png_4,P',
      'Value "_a.png_4,P" is invalid for "cr": the hot spot is two numbers, x and y — as "cr_a\\.png_4_4,P"',
    ],
    [
      'cr_--x',
      'Write the variable without "_": "cr--x" instead of "cr_--x" — same value',
    ],
  ])('%s', (token, message) => {
    expect(rejected(token)).toBe(message);
  });
});

describe('фигуры clip-path в нативной форме: cpth (D-124)', () => {
  test.each([
    [
      'cpthCircle50%',
      'clip-path:circle(50%)',
    ],
    [
      'cpthCircle',
      'clip-path:circle()',
    ],
    // Позиция после радиуса — тот же читатель, что у `op`.
    [
      'cpthCircle50%_R_T',
      'clip-path:circle(50% at right top)',
    ],
    [
      'cpthCircle50%_TL',
      'clip-path:circle(50% at top left)',
    ],
    [
      'cpthCircle_R_T',
      'clip-path:circle(at right top)',
    ],
    [
      'cpthCircle20_C',
      'clip-path:circle(20px at center)',
    ],
    [
      'cpthCircle--r_C',
      'clip-path:circle(var(--r) at center)',
    ],
    [
      'cpthEllipse30%_50%_C',
      'clip-path:ellipse(30% 50% at center)',
    ],
    [
      'cpthInset10',
      'clip-path:inset(10px)',
    ],
    [
      'cpthInset10_20_R5',
      'clip-path:inset(10px 20px round 5px)',
    ],
    [
      'cpthInset10_R5_10',
      'clip-path:inset(10px round 5px 10px)',
    ],
    [
      'cpthInset-5',
      'clip-path:inset(-5px)',
    ],
    [
      'cpthPolygon50%_0,100%_100%,0_100%',
      'clip-path:polygon(50% 0,100% 100%,0 100%)',
    ],
    [
      'cpth_\\#wave',
      'clip-path:url("#wave")',
    ],
    [
      'cpthBB',
      'clip-path:border-box',
    ],
  ])('%s → %s', (token, declaration) => {
    const out = compile([token]);
    expect(out.warnings).toEqual([]);
    expect(out.css).toContain('{' + declaration + '}');
  });

  test.each([
    [
      'cpthCircle\\(50%\\)',
      'Value "Circle(50%)" is invalid for "cpth": a function is not written in a class — write "cpthCircle50%_R_T"',
    ],
    [
      'cpth_circle\\(50%\\)',
      'Value "_circle(50%)" is invalid for "cpth": a function is not written in a class — write "cpthCircle50%_R_T"',
    ],
    [
      'cpthPath\\(M0\\)',
      'Value "Path(M0)" is invalid for "cpth": a function is not written in a class — "Path" has no short form, write'
      + ' it through a variable — "cpth--x"',
    ],
    [
      'cpthCircle_50%',
      'Write "cpthCircle50%" instead of "cpthCircle_50%" — same value',
    ],
    [
      'cpthCircle-5',
      'Value "Circle-5" is invalid for "cpth": "Circle" expects a length of zero or more — as "cpthCircle50%_R_T"',
    ],
    [
      'cpthCircle50%_R_Z',
      'Value "R_Z" is invalid for "cpth": a part is a side letter, a length or a percent. Available: L (left),'
      + ' C (center), R (right), T (top), B (bottom)',
    ],
    [
      'cpthCircle50%_L_R',
      'Value "L_R" is invalid for "cpth": both parts are on one axis — one is x (L, C, R), the other y (T, C, B)',
    ],
    [
      'cpthEllipse30%_C',
      'Value "Ellipse30%_C" is invalid for "cpth": "Ellipse" expects two radii, x and y — as "cpthEllipse30%_50%_C"',
    ],
    [
      'cpthInset10_R-5',
      'Value "Inset10_R-5" is invalid for "cpth": "Inset" expects a length of zero or more — as "cpthInset10_20_R5"',
    ],
    [
      'cpthInset1_2_3_4_5',
      'Value "Inset1_2_3_4_5" is invalid for "cpth": "Inset" expects one to four insets, then R and the radius — as'
      + ' "cpthInset10_20_R5"',
    ],
    [
      'cpthInset1_R1_2_3_4_5',
      'Value "Inset1_R1_2_3_4_5" is invalid for "cpth": "Inset" expects one to four radii after R — as'
      + ' "cpthInset10_20_R5"',
    ],
    [
      'cpthInset10zz',
      'Value "Inset10zz" is invalid for "cpth": "Inset" expects a length or a percent — as "cpthInset10_20_R5"',
    ],
    [
      'cpthPolygon50%_0,100%',
      'Value "Polygon50%_0,100%" is invalid for "cpth": "Polygon" expects points of two coordinates, x_y, with ","'
      + ' between points — as "cpthPolygon50%_0,100%_100%,0_100%"',
    ],
    [
      'cpth_border-box',
      'Write it shorter: "cpthBB" instead of "cpth_border-box" — same value',
    ],
  ])('%s', (token, message) => {
    expect(rejected(token)).toBe(message);
  });
});

describe('повтор и функции дорожек сетки в нативной форме: gtc, gtr, gac, gar, g (D-124)', () => {
  test.each([
    [
      'gtc3x1fr',
      'grid-template-columns:repeat(3, 1fr)',
    ],
    [
      'gtc3x1fr_200px',
      'grid-template-columns:repeat(3, 1fr) 200px',
    ],
    [
      'gtc2x1fr;2fr',
      'grid-template-columns:repeat(2, 1fr 2fr)',
    ],
    [
      'gtc200px_4x10%_A',
      'grid-template-columns:200px repeat(4, 10%) auto',
    ],
    [
      'gtr2x--row',
      'grid-template-rows:repeat(2, var(--row))',
    ],
    [
      'gtcMinmax100px_1fr',
      'grid-template-columns:minmax(100px, 1fr)',
    ],
    [
      'gtcMinmax0_1fr',
      'grid-template-columns:minmax(0, 1fr)',
    ],
    [
      'garMinmax100_A',
      'grid-auto-rows:minmax(100px, auto)',
    ],
    [
      'gacMinmaxMinContent_MaxContent',
      'grid-auto-columns:minmax(min-content, max-content)',
    ],
    [
      'gtcMinmax--min_1fr',
      'grid-template-columns:minmax(var(--min), 1fr)',
    ],
    [
      'gtcFitContent200px',
      'grid-template-columns:fit-content(200px)',
    ],
    [
      'gacFitContent50%',
      'grid-auto-columns:fit-content(50%)',
    ],
    [
      'g1fr_/_3x1fr',
      'grid:1fr / repeat(3, 1fr)',
    ],
    // Не задеты: слово, сокращение auto-repeat, переменная.
    [
      'gacMinContent',
      'grid-auto-columns:min-content',
    ],
    [
      'gtcAF240',
      'grid-template-columns:repeat(auto-fit, minmax(240px, 1fr))',
    ],
    [
      'gtc1fr_--x',
      'grid-template-columns:1fr var(--x)',
    ],
  ])('%s → %s', (token, declaration) => {
    const out = compile([token]);
    expect(out.warnings).toEqual([]);
    expect(out.css).toContain('{' + declaration + '}');
    // Переменную арбитр (css-tree) не разбирает — для неё сверяется только вывод.
    const at = declaration.indexOf(':');
    declaration.indexOf('var(') > -1
      || expect(lexer.matchProperty(declaration.slice(0, at), declaration.slice(at + 1)).matched).toBeTruthy();
  });

  test.each([
    [
      'gtc_repeat\\(3,1fr\\)',
      'Value "_repeat(3,1fr)" is invalid for "gtc": a function is not written in a class — write "gtc3x1fr"'
      + ' or "gtcAF240"',
    ],
    [
      'gtcRepeat\\(auto-fit,minmax\\(240px,1fr\\)\\)',
      'Value "Repeat(auto-fit,minmax(240px,1fr))" is invalid for "gtc": a function is not written in a'
      + ' class — write "gtc3x1fr" or "gtcAF240"',
    ],
    [
      'gtr_minmax\\(100px,1fr\\)',
      'Value "_minmax(100px,1fr)" is invalid for "gtr": a function is not written in a class — write'
      + ' "gtrMinmax100px_1fr"',
    ],
    [
      'gac_repeat\\(3,1fr\\)',
      'Value "_repeat(3,1fr)" is invalid for "gac": a function is not written in a class — "repeat" has no'
      + ' short form, write it through a variable — "gac--x"',
    ],
    [
      'gtc_fit-content\\(100px\\)',
      'Value "_fit-content(100px)" is invalid for "gtc": a function is not written in a class — write'
      + ' "gtcFitContent200px"',
    ],
    [
      'gtc_minmax100px_1fr',
      'Write "gtcMinmax100px_1fr" instead of "gtc_minmax100px_1fr" — same value',
    ],
    [
      'gtcMinmax_100px_1fr',
      'Write "gtcMinmax100px_1fr" instead of "gtcMinmax_100px_1fr" — same value',
    ],
    [
      'gtcMinmax1fr_1fr',
      'Value "Minmax1fr_1fr" is invalid for "gtc": "Minmax" expects a length, a percent, "A" (auto),'
      + ' "MinContent" or "MaxContent" — as "gtcMinmax100px_1fr"',
    ],
    [
      'gtcMinmax100px',
      'Value "Minmax100px" is invalid for "gtc": "Minmax" takes at least 2 parts — as "gtcMinmax100px_1fr"',
    ],
    [
      'gtcMinmax100px_1fr_200px',
      'Value "Minmax100px_1fr_200px" is invalid for "gtc": "200px" is extra: "Minmax" takes at most 2 parts'
      + ' — as "gtcMinmax100px_1fr"',
    ],
    [
      'gtcMinmax-5_1fr',
      'Value "Minmax-5_1fr" is invalid for "gtc": "Minmax" expects a length, a percent, "A" (auto),'
      + ' "MinContent" or "MaxContent" — as "gtcMinmax100px_1fr"',
    ],
    [
      'gtcMinmax100px_zz',
      'Value "Minmax100px_zz" is invalid for "gtc": "Minmax" expects a length, a percent, a fraction ("1fr"), "A"'
      + ' (auto), "MinContent" or "MaxContent" — as "gtcMinmax100px_1fr"',
    ],
    [
      'cntAttrHref',
      'Write "cntAttr_href" instead of "cntAttrHref" — same value',
    ],
    [
      'gtcMinmaxAuto_1fr',
      'Value "MinmaxAuto_1fr" is invalid for "gtc": "Minmax" expects a length, a percent, "A" (auto),'
      + ' "MinContent" or "MaxContent" — as "gtcMinmax100px_1fr"',
    ],
    [
      'gtc0x1fr',
      'Value "0x1fr" is invalid for "gtc": the count of a repeat is a whole number from 1 — as "gtc3x1fr"',
    ],
    [
      'gtc3x200',
      'Value "3x200" is invalid for "gtc": a repeated track is a size (length, percent, fr) or a variable,'
      + ' ";" between tracks — as "gtc3x1fr"',
    ],
    [
      'gtc3xA',
      'Value "3xA" is invalid for "gtc": a repeated track is a size (length, percent, fr) or a variable,'
      + ' ";" between tracks — as "gtc3x1fr"',
    ],
    [
      'gtc3x',
      'Value "3x" is invalid for "gtc": a repeated track is a size (length, percent, fr) or a variable, ";"'
      + ' between tracks — as "gtc3x1fr"',
    ],
    [
      'gac3x1fr',
      'Value "3x1fr" is invalid for "gac": a track is a size (length, percent, fr), a keyword or a'
      + ' variable; a function is the whole value, as "gacMinmax100px_1fr"',
    ],
    [
      'gtc1fr_minmax100px',
      'Value "1fr_minmax100px" is invalid for "gtc": a track is a size (length, percent, fr), a keyword, a'
      + ' repeat as "gtc3x1fr" or a variable; a function is the whole value, as "gtcMinmax100px_1fr"',
    ],
    [
      'g_repeat\\(2,1fr\\)_/_1fr',
      'Value "_repeat(2,1fr)_/_1fr" is invalid for "g": a function is not written in a class; a computed value'
      + ' goes through a variable, as "g--x". A repeat of tracks is "3x1fr", as "g1fr_/_3x1fr"',
    ],
    [
      'g1fr_/_3x2',
      'Value "1fr_/_3x2" is invalid for "g": a repeated track is a size (length, percent, fr) or a'
      + ' variable, ";" between tracks — as "g1fr_/_3x1fr"',
    ],
  ])('%s', (token, message) => {
    expect(rejected(token)).toBe(message);
  });
});

describe('функция в токене бракуется у хендлеров без нативных форм (D-124, шаг 3)', () => {
  const COMPUTED = 'a function is not written in a class; a computed value goes through a variable, as ';
  test.each([
    // Закрытые списки: подсказка — буквы хендлера.
    [
      'dUrl\\(a\\.png\\)',
      'Value "Url(a.png)" is invalid for "d": ' + COMPUTED + '"d--x". Available: dB (block), dN (none),',
    ],
    [
      'taCalc\\(1\\)',
      'Value "Calc(1)" is invalid for "ta": ' + COMPUTED + '"ta--x". Available: taL (left),',
    ],
    [
      'ar_min\\(1,2\\)',
      'Value "_min(1,2)" is invalid for "ar": ' + COMPUTED + '"ar--x". Available: arA (auto)',
    ],
    // Массивная форма `synonymProvider` (page-break-*).
    [
      'pgbaUrl\\(a\\)',
      'Value "Url(a)" is invalid for "pgba": ' + COMPUTED + '"pgba--x". Available: pgbaA (auto),',
    ],
    // `assertEnumValue` — его зовут `pos` и `bs*`.
    [
      'posUrl\\(a\\)',
      'Value "Url(a)" is invalid for "pos": ' + COMPUTED + '"pos--x". Available: posWS (-webkit-sticky),',
    ],
    [
      'bstUrl\\(a\\)',
      'Value "Url(a)" is invalid for "bst": ' + COMPUTED + '"bst--x". Available: bstO (outset),',
    ],
    // Число без букв — без списка.
    [
      'tbsCalc\\(2+2\\)',
      'Value "Calc(2+2)" is invalid for "tbs": ' + COMPUTED + '"tbs--x"',
    ],
    // Свои читатели: позиция, `font`, `ff`.
    [
      'tfoUrl\\(a\\)',
      'Value "Url(a)" is invalid for "tfo": ' + COMPUTED + '"tfo--x"',
    ],
    [
      'opUrl\\(a\\)',
      'Value "Url(a)" is invalid for "op": ' + COMPUTED + '"op--x"',
    ],
    [
      'fontUrl\\(a\\)',
      'Value "Url(a)" is invalid for "font": ' + COMPUTED + '"font--x"',
    ],
    [
      'ffUrl\\(a\\)',
      'Value "Url(a)" is invalid for "ff": ' + COMPUTED + '"ff--x"',
    ],
  ])('%s', (token, message) => {
    expect(rejected(token).indexOf(message)).toBe(0);
  });

  test.each([
    [
      'd_var\\(--x\\)',
      'd',
    ],
    [
      'tnEnv\\(x\\)',
      'tn',
    ],
    [
      'tn_var\\(--x\\)',
      'tn',
    ],
    [
      'anEnv\\(x\\)',
      'an',
    ],
    [
      'gEnv\\(x\\)',
      'g',
    ],
    [
      'ttf_var\\(--x\\)',
      'ttf',
    ],
    [
      'cnt_var\\(--x\\)',
      'cnt',
    ],
  ])('подстановка словом: %s — своя запись', (token, name) => {
    expect(rejected(token)).toContain('a variable is written without "var()": "' + name + '--x" → var(--x), "' + name
      + '---x" → env(--x)');
  });

  test.each([
    [
      'd--v',
      'display:var(--v)',
    ],
    [
      'dINH',
      'display:inherit',
    ],
    [
      'pos--p',
      'position:var(--p)',
    ],
    [
      'bs--s',
      'border-style:var(--s)',
    ],
    [
      'font--f',
      'font:var(--f)',
    ],
    [
      'ff--f',
      'font-family:var(--f)',
    ],
    [
      'tn--x',
      'transition:var(--x)',
    ],
    [
      'g---x',
      'grid:env(--x)',
    ],
    [
      'pgba--v',
      'page-break-after:var(--v);break-after:var(--v)',
    ],
    // Скобка в кавычках — текст, не функция.
    [
      'q_"\\("_"\\)"',
      'quotes:"(" ")"',
    ],
    [
      "q_'\\('_'\\)'",
      "quotes:'(' ')'",
    ],
  ])('%s проходит', (token, declaration) => {
    const out = compile([token]);
    expect(out.warnings).toEqual([]);
    expect(out.css).toContain('{' + declaration + '}');
  });
});
