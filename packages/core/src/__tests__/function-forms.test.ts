/**
 * Нативная форма функций `Name…` (D-124): имя в CamelCase, первый аргумент слитно, остальные — через `_`, без
 * скобок. Общий читатель (`functionsValue`) — здесь на фильтрах `ft`/`ftb`, первых его потребителях.
 */
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
