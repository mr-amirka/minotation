/**
 * Единицы длины и знак значения.
 *
 * Оба списка проверяются арбитром — `css-tree` с `mdn-data`, то есть
 * официальной грамматикой, а не памятью автора. Так тест ловит расхождение в
 * обе стороны: и единицу, которую нотация зря не принимает, и знак, который
 * она зря пропускает в CSS.
 */
import {
  minotationProvider,
} from '../core/index';
import presetStandard from '../presets/standard';
import type {
  MnWarning,
} from '../core/types';
import {
  lexer,
} from 'css-tree';

/* eslint-disable @typescript-eslint/no-explicit-any */

function compile(tokens: string[]): { css: string;
  warnings: MnWarning[] } {
  const warnings: MnWarning[] = [];
  const mn: any = minotationProvider({
    onWarning: (w: MnWarning) => warnings.push(w),
  });
  mn.setPresets([presetStandard]);
  const c = mn.getCompiler('class');
  const tokensLength = tokens.length;
  for (let i = 0; i < tokensLength; i++) {
    c(tokens[i]);
  }
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n'),
    warnings,
  };
}

/**
 * Полный набор единиц длины из спецификации. До 2026-09-26 нотация знала 14 из
 * них — всё, что появилось после CSS2.1 и ранних viewport-единиц, давало
 * предупреждение «Unit is invalid»: `hmin100dvh` (высота viewport'а без
 * адресной строки — базовый приём мобильной вёрстки), `w50cqw`, `p1lh`.
 */
const LENGTH_UNITS = [
  'px',
  'em',
  'rem',
  'ex',
  'ch',
  'cap',
  'ic',
  'lh',
  'rlh',
  'rex',
  'rch',
  'ric',
  'vw',
  'vh',
  'vmin',
  'vmax',
  'vi',
  'vb',
  'svw',
  'svh',
  'svmin',
  'svmax',
  'lvw',
  'lvh',
  'lvmin',
  'lvmax',
  'dvw',
  'dvh',
  'dvmin',
  'dvmax',
  'cqw',
  'cqh',
  'cqi',
  'cqb',
  'cqmin',
  'cqmax',
  'cm',
  'mm',
  'q',
  'in',
  'pt',
  'pc',
  '%',
];

describe('единицы длины', () => {
  test.each(LENGTH_UNITS)('10%s принимается числовым путём (w) и путём свободного значения (ti)', (unit) => {
    // Сначала арбитр: единица обязана быть валидной по грамматике, иначе
    // тест закрепил бы нашу же ошибку.
    expect(lexer.matchProperty('width', '10' + unit).matched).toBeTruthy();
    expect(compile(['w10' + unit]).css).toContain('width:10' + unit);
    expect(compile(['ti10' + unit]).css).toContain('text-indent:10' + unit);
  });

  test('ходовые формы, ради которых список и расширялся', () => {
    expect(compile(['hmin100dvh']).css).toContain('min-height:100dvh');
    expect(compile(['w50cqw']).css).toContain('width:50cqw');
    expect(compile(['p1lh']).css).toContain('padding:1lh');
    expect(compile(['r10cqmin']).css).toContain('border-radius:10cqmin');
  });

  test.each([
    'w10zz',
    'p10zz',
    'ti10zz',
    'lh10zz',
    'bsp10zz',
    'fxb10zz',
  ])('%s — выдуманная единица бракуется', (token) => {
    const {
      css, warnings,
    } = compile([token]);
    expect(css).toBe('');
    expect(warnings.length).toBe(1);
  });

  test.each([
    [
      'ti10s',
      'время',
    ],
    [
      'ti10deg',
      'угол',
    ],
    [
      'ti10fr',
      'доля grid-дорожки',
    ],
  ])('%s — единица не того типа (%s) бракуется', (token) => {
    expect(compile([token]).css).toBe('');
  });

  test.each([
    [
      'tiF00',
      'text-indent:f00',
    ],
    [
      'ti1/2',
      'text-indent:1/2',
    ],
    [
      'ti10-5',
      'text-indent:10-5',
    ],
    [
      'ti100%-20px',
      'text-indent:100%-20px',
    ],
  ])('%s больше не даёт "%s"', (token) => {
    // Общий блок свободных значений кебабил суффикс и отдавал как есть;
    // свойства нет в таблице валидатора ядра, поэтому проходило молча.
    expect(compile([token]).css).toBe('');
  });

  test('подстановка и функция проходят: разбирать их содержимое тут нечем', () => {
    expect(compile(['ti--v']).css).toContain('text-indent:var(--v)');
  });
});

describe('единица в тенях идёт во все длины записи', () => {
  test.each([
    [
      'bxsh10',
      'box-shadow:0px 0px 10px 0px #000',
    ],
    [
      'bxsh1.5em',
      'box-shadow:0em 0em 1.5em 0em #000',
    ],
    [
      'bxsh10rem',
      'box-shadow:0rem 0rem 10rem 0rem #000',
    ],
    [
      'bxsh10dvh',
      'box-shadow:0dvh 0dvh 10dvh 0dvh #000',
    ],
    [
      'tsh10em',
      'text-shadow:0em 0em 10em #000',
    ],
  ])('%s → %s', (token, expected) => {
    // Склейка была жёстко `px`, и всё кроме него молча терялось. Мимо
    // валидатора ядра это проходило: `box-shadow` не в его таблице.
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'bxsh19r3c43F',
      'box-shadow:0px 0px 19px 3px #43f',
    ],
    [
      'bxsh10x2y4',
      'box-shadow:2px 4px 10px 0px #000',
    ],
    [
      'bxsh10emc43F',
      'box-shadow:0em 0em 10em 0em #43f',
    ],
  ])('%s → %s — модификаторы не путаются с единицей', (token, expected) => {
    // Единицу нельзя брать из `p.unit`: разбор значения в ядре считает
    // единицей любой буквенный хвост после числа, и туда попадает начало
    // модификаторов (`r` у `bxsh19r3c43F`).
    expect(compile([token]).css).toContain(expected);
  });

  test('in остаётся модификатором inset, а не дюймами', () => {
    expect(compile(['bxsh10in']).css).toContain('box-shadow:inset 0px 0px 10px 0px #000');
  });

  test('процент бракуется: тень принимает длину, а не проценты', () => {
    expect(lexer.matchProperty('box-shadow', '0% 0% 10% 0% #000').matched).toBeFalsy();
    expect(compile(['bxsh10%']).css).toBe('');
  });

  test('переменная в позиции blur — то, ради чего был сырой режим', () => {
    // Сырой режим у теней убран 2026-09-26: мини-язык покрывает всё, что он
    // давал, а на списке теней он ломался — запятая уходила внутрь `var(…)`.
    expect(compile(['bxshB--blur']).css)
      .toContain('box-shadow:0px 0px var(--blur) 0px #000');
    expect(compile(['bxshB--blur;c--shadow']).css)
      .toContain('box-shadow:0px 0px var(--blur) 0px var(--shadow)');
  });
});

describe('поворот измеряется углом', () => {
  test.each([
    [
      'rx',
      'rotateX(180deg)',
    ],
    [
      'rx45',
      'rotateX(45deg)',
    ],
    [
      'rx-45',
      'rotateX(-45deg)',
    ],
    [
      'rx45deg',
      'rotateX(45deg)',
    ],
    [
      'rx0.5turn',
      'rotateX(0.5turn)',
    ],
    [
      'rx1rad',
      'rotateX(1rad)',
    ],
    [
      'rx100grad',
      'rotateX(100grad)',
    ],
    [
      'ry90',
      'rotateY(90deg)',
    ],
    [
      'rz180',
      'rotateZ(180deg)',
    ],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain('transform:' + expected);
  });

  test.each([
    'rx10px',
    'rx10s',
    'rx10%',
    'rx10fr',
  ])('%s — единица не угловая, бракуется', (token) => {
    const {
      css, warnings,
    } = compile([token]);
    expect(css).toBe('');
    expect(warnings.length).toBe(1);
  });

  test('rxInherit больше не даёт rotateX(Inheritdeg)', () => {
    // Значение не проверялось вовсе: слово склеивалось с единицей буквально.
    expect(compile(['rxInherit']).css).toBe('');
  });

  test.each([
    [
      'x10y20rz45',
      'translate(10px,20px) rotateZ(45deg)',
    ],
    [
      'x10y20rz45deg',
      'translate(10px,20px) rotateZ(45deg)',
    ],
    [
      'x10y20rz0.5turn',
      'translate(10px,20px) rotateZ(0.5turn)',
    ],
  ])('%s → %s — в составной форме единица берётся из своего хвоста', (token, expected) => {
    // У составного суффикса `p.unit` заполняет ещё и generic-разбор ядра:
    // у `x10y20rz45` туда попадал `y` от `y20`, давая `rotateZ(45y)`.
    expect(compile([token]).css).toContain('transform:' + expected);
  });

  test('x10y20rz45px бракуется так же, как rx10px', () => {
    expect(compile(['x10y20rz45px']).css).toBe('');
  });
});

describe('процент и количество значений — по свойству, а не по семейству', () => {
  // Свойства делятся по этим двум признакам по-разному, поэтому одного флага
  // «это длина» мало. Каждая строка сверяется с арбитром.
  const PERCENT_OK: Array<[string, string]> = [
    [
      'p10%',
      'padding',
    ],
    [
      'm10%',
      'margin',
    ],
    [
      'r10%',
      'border-radius',
    ],
    [
      'f10%',
      'font-size',
    ],
    [
      'w10%',
      'width',
    ],
    [
      'ti10%',
      'text-indent',
    ],
    [
      'tdt10%',
      'text-decoration-thickness',
    ],
    [
      'fxb10%',
      'flex-basis',
    ],
    [
      'sw10%',
      'stroke-width',
    ],
  ];

  test.each(PERCENT_OK)('%s — у %s процент валиден', (token, prop) => {
    expect(lexer.matchProperty(prop, '10%').matched).toBeTruthy();
    expect(compile([token]).css).toContain(prop + ':10%');
  });

  const PERCENT_BAD: Array<[string, string]> = [
    [
      'b10%',
      'border-width',
    ],
    [
      'bt10%',
      'border-top-width',
    ],
    [
      'olw10%',
      'outline-width',
    ],
    [
      'wos10%',
      'word-spacing',
    ],
    [
      'bsp10%',
      'border-spacing',
    ],
  ];

  test.each(PERCENT_BAD)('%s бракуется — у %s процента нет', (token, prop) => {
    expect(lexer.matchProperty(prop, '10%').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test('дробь бракуется там же: она всегда разворачивается в процент', () => {
    expect(compile(['b1/2']).css).toBe('');
    expect(compile(['olw1/2']).css).toBe('');
    expect(compile(['p1/2']).css).toContain('padding:50%');
  });

  const MULTI_OK: Array<[string, string]> = [
    [
      'p10_20',
      'padding:10px 20px',
    ],
    [
      'm10_20',
      'margin:10px 20px',
    ],
    [
      'b10_20',
      'border-width:10px 20px',
    ],
    [
      'b1_2_3_4',
      'border-width:1px 2px 3px 4px',
    ],
    [
      'bsp10_20',
      'border-spacing:10px 20px',
    ],
    [
      'gg10_20',
      'grid-gap:10px 20px',
    ],
  ];

  test.each(MULTI_OK)('%s → %s — свойство берёт несколько значений', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  const MULTI_BAD: Array<[string, string]> = [
    [
      'bt10_20',
      'border-top-width',
    ],
    [
      'olw10_20',
      'outline-width',
    ],
    [
      'ti10_20',
      'text-indent',
    ],
    [
      'tdt10_20',
      'text-decoration-thickness',
    ],
    [
      'tuo10_20',
      'text-underline-offset',
    ],
    [
      'fxb10_20',
      'flex-basis',
    ],
    [
      'ggc10_20',
      'grid-column-gap',
    ],
    [
      'sw10_20',
      'stroke-width',
    ],
  ];

  test.each(MULTI_BAD)('%s бракуется — %s берёт одно значение', (token, prop) => {
    expect(lexer.matchProperty(prop, '10px 20px').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });
});

describe('одиночные свойства-длины со своим разбором', () => {
  // Эти хендлеры собирали значение вручную одной и той же строчкой
  // `camel ? toKebabCase(camel) : num + (p.unit || 'px')` — ни слово, ни
  // единица не проверялись, а валидатор ядра ни одного из свойств не знал.
  test.each([
    [
      'olo',
      'outline-offset:0',
    ],
    [
      'olo2',
      'outline-offset:2px',
    ],
    [
      'olo-2',
      'outline-offset:-2px',
    ],
    [
      'olo--v',
      'outline-offset:var(--v)',
    ],
    [
      'oloINH',
      'outline-offset:inherit',
    ],
    [
      'lts2',
      'letter-spacing:2px',
    ],
    [
      'lts0.06em',
      'letter-spacing:0.06em',
    ],
    [
      'lts-0.02em',
      'letter-spacing:-0.02em',
    ],
    [
      'lts10%',
      'letter-spacing:10%',
    ],
    [
      'ltsN',
      'letter-spacing:normal',
    ],
    [
      'ltsN',
      'letter-spacing:normal',
    ],
    [
      'lts--v',
      'letter-spacing:var(--v)',
    ],
    [
      'tsa',
      'text-size-adjust:100%',
    ],
    [
      'tsaA',
      'text-size-adjust:auto',
    ],
    [
      'tsaN',
      'text-size-adjust:none',
    ],
    [
      'fsa0.5',
      'font-size-adjust:0.5',
    ],
    [
      'fsaN',
      'font-size-adjust:none',
    ],
    [
      'fsaFF',
      'font-size-adjust:from-font',
    ],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    'olo10zz',
    'oloF00',
    'oloZzz',
    'oloA',
    'lts10zz',
    'ltsF00',
    'ltsZzz',
    'ltsA',
    'tsaZzz',
    'tsa10zz',
    'fsaZzz',
    'fsa10zz',
  ])('%s бракуется', (token) => {
    expect(compile([token]).css).toBe('');
  });

  test('olo10% бракуется: процентов это свойство не принимает', () => {
    expect(lexer.matchProperty('outline-offset', '10%').matched).toBeFalsy();
    expect(compile(['olo10%']).css).toBe('');
  });

  test('переменная в olo больше не теряется', () => {
    // Ветки `cssVarValue` у `olo` не было вовсе: `olo--v` давало
    // `outline-offset:0` — умолчание вместо подстановки.
    expect(compile(['olo--v']).css).toContain('outline-offset:var(--v)');
  });
});

describe('line-height, z-index, font-weight', () => {
  test.each([
    [
      'lh',
      'line-height:1',
    ],
    [
      'lh1.5',
      'line-height:1.5',
    ],
    [
      'lh10px',
      'line-height:10px',
    ],
    [
      'lh150%',
      'line-height:150%',
    ],
    [
      'lh1.2em',
      'line-height:1.2em',
    ],
    [
      'lh0',
      'line-height:0',
    ],
  ])('%s → %s — безразмерная форма сохраняется', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    'lh10zz',
    'lh10s',
    'lh10deg',
    'lh10fr',
  ])('%s — единица у line-height теперь проверяется', (token) => {
    expect(compile([token]).css).toBe('');
  });

  test.each([
    [
      'z',
      'z-index:1',
    ],
    [
      'z1',
      'z-index:1',
    ],
    [
      'z-5',
      'z-index:-5',
    ],
    [
      'z0',
      'z-index:0',
    ],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    'z1.5',
    'z10.5',
  ])('%s бракуется — z-index задаётся целым', (token) => {
    expect(lexer.matchProperty('z-index', '1.5').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test.each([
    [
      'fwN',
      'font-weight:normal',
    ],
    [
      'fwB',
      'font-weight:bold',
    ],
    [
      'fwBR',
      'font-weight:bolder',
    ],
    [
      'fwLR',
      'font-weight:lighter',
    ],
    [
      'fwB',
      'font-weight:bold',
    ],
    [
      'fwBR',
      'font-weight:bolder',
    ],
    [
      'fw6',
      'font-weight:600',
    ],
    [
      'fw600',
      'font-weight:600',
    ],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    'fwF00',
    'fwA',
    'fwZzz',
  ])('%s бракуется — список слов у font-weight закрытый', (token) => {
    expect(compile([token]).css).toBe('');
  });
});

describe('знак значения', () => {
  const NEGATIVE_OK: Array<[string, string, string]> = [
    [
      'm-5',
      'margin',
      '-5px',
    ],
    [
      'mt-5',
      'margin-top',
      '-5px',
    ],
    [
      'st-5',
      'top',
      '-5px',
    ],
    [
      'ti-5',
      'text-indent',
      '-5px',
    ],
    [
      'lts-5',
      'letter-spacing',
      '-5px',
    ],
    [
      'wos-5',
      'word-spacing',
      '-5px',
    ],
    [
      'z-5',
      'z-index',
      '-5',
    ],
  ];

  test.each(NEGATIVE_OK)('%s → %s:%s — свойство принимает отрицательные', (
    token, prop, value,
  ) => {
    expect(lexer.matchProperty(prop, value).matched).toBeTruthy();
    expect(compile([token]).css).toContain(prop + ':' + value);
  });

  const NEGATIVE_BAD: Array<[string, string]> = [
    [
      'p-5',
      'padding',
    ],
    [
      'pt-5',
      'padding-top',
    ],
    [
      'w-5',
      'width',
    ],
    [
      'h-5',
      'height',
    ],
    [
      'wmin-5',
      'min-width',
    ],
    [
      'sq-5',
      'width',
    ],
    [
      'f-5',
      'font-size',
    ],
    [
      'r-5',
      'border-radius',
    ],
  ];

  test.each(NEGATIVE_BAD)('%s бракуется: у %s минус недопустим', (token, prop) => {
    // Арбитр подтверждает, что отбраковка — не перестраховка.
    expect(lexer.matchProperty(prop, '-5px').matched).toBeFalsy();
    const {
      css, warnings,
    } = compile([token]);
    expect(css).toBe('');
    expect(warnings.length).toBe(1);
  });

  test('b-5 бракуется, хотя арбитр здесь неточен', () => {
    // `border-width: -5px` спецификация запрещает прозой («Negative values are
    // not allowed»), а в грамматике `<line-width>` это просто `<length>` —
    // `mdn-data` запрет не кодирует и значение принимает. Ограничение арбитра,
    // не наше: браузер такое правило отбрасывает.
    expect(lexer.matchProperty('border-width', '-5px').matched).toBeTruthy();
    expect(compile(['b-5']).css).toBe('');
    expect(compile(['bt-5']).css).toBe('');
  });

  test('знак дроби проверяется так же, как знак обычного числа', () => {
    expect(compile(['m-1/2']).css).toContain('margin:-50%');
    expect(compile(['w-1/2']).css).toBe('');
  });

  test('вычитание не трогаем: знак результата заранее не известен', () => {
    expect(compile(['w10-5']).css).toContain('width:calc(10px - 5px)');
    expect(compile(['p10-5']).css).toContain('padding:calc(10px - 5px)');
  });
});

describe('свойства с закрытым перечнем значений', () => {
  // Такие свойства принимали ЛЮБОЕ слово, и валидатор ядра ни одно из них не
  // знал (permissive pass-through), поэтому мусор уходил в CSS молча.
  const OK: Array<[string, string]> = [
    [
      'irP',
      'image-rendering:pixelated',
    ],
    [
      'irCE',
      'image-rendering:crisp-edges',
    ],
    [
      'apN',
      'appearance:none',
    ],
    [
      'apMB',
      'appearance:menulist-button',
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
      'gafR',
      'grid-auto-flow:row',
    ],
    [
      'tdsE',
      'text-decoration-skip:edges',
    ],
    [
      'tdsiAL',
      'text-decoration-skip-ink:all',
    ],
    [
      'tdstW',
      'text-decoration-style:wavy',
    ],
    [
      'tupFF',
      'text-underline-position:from-font',
    ],
    [
      'tsF',
      'transform-style:flat',
    ],
    [
      'mbmPL',
      'mix-blend-mode:plus-lighter',
    ],
    [
      'temsS',
      'text-emphasis-style:sesame',
    ],
    [
      'tempO',
      'text-emphasis-position:over',
    ],
  ];

  test.each(OK)('%s → %s', (token, expected) => {
    const [
      prop,
      value,
    ] = expected.split(':');
    expect(lexer.matchProperty(prop, value).matched).toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    'irF00',
    'irZzz',
    'ir10',
    'ir10px',
    'apZzz',
    'apF00',
    'ttfZzz',
    'gafZzz',
    'tdsZzz',
    'tdsiZzz',
    'tdstZzz',
    'tupZzz',
    'tsZzz',
    'mbmZzz',
    'temsZzz',
    'tempZzz',
    'ttfJumpNone',
    'ttfStart',
  ])('%s бракуется', (token) => {
    const {
      css, warnings,
    } = compile([token]);
    expect(css).toBe('');
    expect(warnings.length).toBe(1);
  });

  test.each([
    [
      'temsF_D',
      'text-emphasis-style:filled dot',
    ],
    [
      'tempO_R',
      'text-emphasis-position:over right',
    ],
    [
      'tdsO_S',
      'text-decoration-skip:objects spaces',
    ],
    [
      'gafR_D',
      'grid-auto-flow:row dense',
    ],
    [
      'tupU_L',
      'text-underline-position:under left',
    ],
  ])('%s → %s — свойство берёт несколько слов', (token, expected) => {
    // Буква — в каждой части; полные слова (`tems_filled_dot`) бракуются (D-113).
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'irA_Pixelated',
      'image-rendering',
    ],
    [
      'apN_Auto',
      'appearance',
    ],
    [
      'mbmNormal_Multiply',
      'mix-blend-mode',
    ],
    [
      'tdstS_Wavy',
      'text-decoration-style',
    ],
  ])('%s бракуется — %s берёт одно слово', (token, prop) => {
    expect(lexer.matchProperty(prop, 'auto pixelated').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test('второе слово проверяется наравне с первым', () => {
    expect(compile(['temsF_Zzz']).css).toBe('');
    expect(compile(['gafR_Zzz']).css).toBe('');
  });

  test.each([
    [
      'tsPreserve3d',
      'tsP',
      'transform-style:preserve-3d',
    ],
    [
      'tsPreserve3D',
      'tsP',
      'transform-style:preserve-3d',
    ],
    [
      'irOptimizeSpeed',
      'irOS',
      'image-rendering:optimizeSpeed',
    ],
    [
      'irOptimizeQuality',
      'irOQ',
      'image-rendering:optimizeQuality',
    ],
    [
      'irMozCrispEdges',
      'irMCE',
      'image-rendering:-moz-crisp-edges',
    ],
    [
      'irWebkitOptimizeContrast',
      'irWOC',
      'image-rendering:-webkit-optimize-contrast',
    ],
  ])('%s бракуется в пользу %s — буква даёт точное написание %s', (
    long, short, expected,
  ) => {
    // camelCase ломает эти слова: цифра не даёт дефиса (`preserve3d` вместо `preserve-3d`), ведущий дефис вендорной
    // формы теряется, а `optimizeSpeed` записан camelCase в самой спецификации — это legacy из SVG. Буква пишет
    // слово точно, а длинную форму разбор всё равно узнаёт, чтобы подсказать букву (D-113).
    const [
      prop,
      value,
    ] = expected.split(':');
    expect(lexer.matchProperty(prop, value).matched).toBeTruthy();
    expect(compile([short]).css).toContain(expected);
    const result = compile([long]);
    expect(result.css).toBe('');
    expect(result.warnings.map((w) => w.message).join('\n'))
      .toContain('Write it shorter: "' + short + '" instead of "' + long + '"');
  });

  test('подстановка проходит: её содержимое здесь разбирать нечем', () => {
    expect(compile(['ir--v']).css).toContain('image-rendering:var(--v)');
  });

  test('CSS-wide keywords проходят везде', () => {
    expect(compile(['irINH']).css).toContain('image-rendering:inherit');
    expect(compile(['apUNS']).css).toContain('appearance:unset');
  });
});

describe('у свойства с перечнем число недопустимо так же, как чужое слово', () => {
  // Раньше проверялось только слово — «числа словарём не перечислить». Но у
  // свойства с закрытым перечнем число невалидно само по себе. Сверка с
  // грамматикой показала, что из 38 свойств этого пути числа законны ровно у
  // двух, плюс у позиции фона.
  test.each([
    [
      'pos10',
      'position',
    ],
    [
      'ov10',
      'overflow',
    ],
    [
      'ovx1.5',
      'overflow-x',
    ],
    [
      'd10px',
      'display',
    ],
    [
      'of10',
      'object-fit',
    ],
    [
      'wb10',
      'word-break',
    ],
    [
      'us10',
      'user-select',
    ],
    [
      'vis10',
      'visibility',
    ],
  ])('%s бракуется — %s чисел не принимает', (token, prop) => {
    expect(lexer.matchProperty(prop, '10').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test.each([
    [
      'bgpx50%',
      'background-position-x:50%',
    ],
    [
      'bgpy10px',
      'background-position-y:10px',
    ],
    [
      'va-0.125em',
      'vertical-align:-0.125em',
    ],
    [
      'va10%',
      'vertical-align:10%',
    ],
    [
      'td2px',
      'text-decoration:2px',
    ],
  ])('%s → %s — там, где число законно, оно проходит', (token, expected) => {
    const [
      prop,
      value,
    ] = expected.split(':');
    expect(lexer.matchProperty(prop, value).matched).toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'posA',
      'position:absolute',
    ],
    [
      'posSK',
      'position:sticky',
    ],
    [
      'posWS',
      'position:-webkit-sticky',
    ],
    [
      'pos',
      'position:relative',
    ],
    [
      'posINH',
      'position:inherit',
    ],
    [
      'pos--v',
      'position:var(--v)',
    ],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    'posZzz',
    'posF00',
  ])('%s бракуется', (token) => {
    expect(compile([token]).css).toBe('');
  });
});

describe('стиль границы — закрытый перечень', () => {
  test.each([
    [
      'bs',
      'border-style:solid',
    ],
    [
      'bsS',
      'border-style:solid',
    ],
    [
      'bsN',
      'border-style:none',
    ],
    [
      'bsDT',
      'border-style:dotted',
    ],
    [
      'bsS',
      'border-style:solid',
    ],
    [
      'bstS',
      'border-top-style:solid',
    ],
    [
      'bslS',
      'border-left-style:solid',
    ],
    [
      'bsINH',
      'border-style:inherit',
    ],
    [
      'bs--v',
      'border-style:var(--v)',
    ],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    'bs10',
    'bs10px',
    'bsF00',
    'bsZzz',
    'bs1.5',
    'bst10',
  ])('%s бракуется', (token) => {
    const {
      css, warnings,
    } = compile([token]);
    expect(css).toBe('');
    expect(warnings.length).toBe(1);
  });

  test('без стороны берёт несколько значений, со стороной — одно', () => {
    expect(lexer.matchProperty('border-style', 'solid dotted').matched).toBeTruthy();
    expect(compile(['bsS_DT']).css).toContain('border-style:solid dotted');
    expect(lexer.matchProperty('border-top-style', 'solid dotted').matched).toBeFalsy();
    expect(compile(['bst10_20']).css).toBe('');
    expect(compile(['bstS_DT']).css).toBe('');
  });
});

describe('свойства, которые берут безразмерное число', () => {
  // Единица к такому значению приписывалась по общему правилу нотации
  // «число = px» или уходила как написана, а проверки не было вовсе.
  test.each([
    [
      'wid2',
      'widows:2',
    ],
    [
      'wid-2',
      'widows:-2',
    ],
    [
      'orp2',
      'orphans:2',
    ],
    [
      'or2',
      'order:2',
    ],
    [
      'or-2',
      'order:-2',
    ],
    [
      'fxg1',
      'flex-grow:1',
    ],
    [
      'fxg1.5',
      'flex-grow:1.5',
    ],
    [
      'fxs1',
      'flex-shrink:1',
    ],
    [
      'zm1.5',
      'zoom:1.5',
    ],
    [
      'zm150%',
      'zoom:150%',
    ],
    [
      'zmN',
      'zoom:normal',
    ],
    [
      'zmR',
      'zoom:reset',
    ],
    [
      'ar1.5',
      'aspect-ratio:1.5',
    ],
    [
      'arA',
      'aspect-ratio:auto',
    ],
    [
      'ar16/9',
      'aspect-ratio:16/9',
    ],
  ])('%s → %s', (token, expected) => {
    const [
      prop,
      value,
    ] = expected.split(':');
    expect(lexer.matchProperty(prop, value).matched).toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'wid10px',
      'widows',
    ],
    [
      'or2px',
      'order',
    ],
    [
      'fxg10px',
      'flex-grow',
    ],
    [
      'fxs10px',
      'flex-shrink',
    ],
    [
      'zm10px',
      'zoom',
    ],
    [
      'ar10px',
      'aspect-ratio',
    ],
  ])('%s бракуется — у %s единицы нет', (token, prop) => {
    expect(lexer.matchProperty(prop, '10px').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test.each([
    [
      'wid2.5',
      'widows',
    ],
    [
      'orp2.5',
      'orphans',
    ],
    [
      'or2.5',
      'order',
    ],
  ])('%s бракуется — %s берёт только целое', (token, prop) => {
    expect(lexer.matchProperty(prop, '2.5').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test('слово и подстановка проходят по своим правилам', () => {
    expect(compile(['arZzz']).css).toBe('');
    expect(compile(['wid--v']).css).toContain('widows:var(--v)');
  });
});

describe('уточнения там, где первая проверка оказалась слишком широкой', () => {
  // Первый заход по этим свойствам закрыл грубый случай (единица там, где её
  // быть не должно), но пропускал форму: знак, дробь, процент.
  test.each([
    [
      'zm-5',
      'zoom',
      '-5',
    ],
    [
      'zm1/2',
      'zoom',
      '1/2',
    ],
    [
      'ar10%',
      'aspect-ratio',
      '10%',
    ],
    [
      'ar-5',
      'aspect-ratio',
      '-5',
    ],
  ])('%s бракуется — %s не принимает "%s"', (
    token, prop, value,
  ) => {
    expect(lexer.matchProperty(prop, value).matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test('fsa10px бракуется: font-size-adjust безразмерный', () => {
    expect(lexer.matchProperty('font-size-adjust', '10px').matched).toBeFalsy();
    expect(compile(['fsa10px']).css).toBe('');
    expect(compile(['fsa0.5']).css).toContain('font-size-adjust:0.5');
  });

  test.each([
    [
      'bgpx10zz',
      'background-position-x',
    ],
    [
      'bgpx10s',
      'background-position-x',
    ],
    [
      'va10zz',
      'vertical-align',
    ],
    [
      'td10zz',
      'text-decoration',
    ],
  ])('%s бракуется — у %s число это длина, а не что угодно', (token, prop) => {
    expect(lexer.matchProperty(prop, '10zz').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test('годные формы у тех же свойств продолжают работать', () => {
    expect(compile(['bgpx10px']).css).toContain('background-position-x:10px');
    expect(compile(['bgpxL']).css).toContain('background-position-x:left');
    expect(compile(['va-0.125em']).css).toContain('vertical-align:-0.125em');
    expect(compile(['zm0.5']).css).toContain('zoom:0.5');
    expect(compile(['ar16/9']).css).toContain('aspect-ratio:16/9');
  });
});

describe('голое число у свойств-длин со словарём — px, как у прочих длин (D-104)', () => {
  test.each([
    [
      'bgs10',
      'background-size:10px',
    ],
    [
      'bgs10_20',
      'background-size:10px 20px',
    ],
    [
      'bgs0',
      'background-size:0',
    ],
    [
      'bgs50%_10',
      'background-size:50% 10px',
    ],
    [
      'mks10',
      'mask-size:10px',
    ],
    [
      'bgpx10',
      'background-position-x:10px',
    ],
    [
      'bgpy-10',
      'background-position-y:-10px',
    ],
    [
      'va-2',
      'vertical-align:-2px',
    ],
    [
      'tdU_2',
      'text-decoration:underline 2px',
    ],
    [
      'td2',
      'text-decoration:2px',
    ],
  ])('%s → %s', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty(expected.slice(0, at), expected.slice(at + 1)).matched).toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'bgs-10px',
      'background-size',
    ],
    [
      'bgs-10',
      'background-size',
    ],
    [
      'bgs10_-20',
      'background-size',
    ],
    [
      'mks-5',
      'mask-size',
    ],
  ])('%s бракуется — размер %s не бывает отрицательным', (token, prop) => {
    // `bgs-10px` давало `background-size:-10px`, и браузер отбрасывал правило.
    expect(lexer.matchProperty(prop, '-10px').matched).toBeFalsy();
    const result = compile([token]);
    expect(result.css).toBe('');
    expect(result.warnings.map((w) => w.message).join(' ')).toContain('expected a length, zero or positive');
  });

  test.each([
    [
      'bgs10_20_30',
      'background-size',
      '10px 20px 30px',
      'at most 2 lengths',
    ],
    [
      'mks10px_20px_30px_40px',
      'mask-size',
      '10px 20px 30px 40px',
      'at most 2 lengths',
    ],
    [
      'bgsCV_10',
      'background-size',
      'cover 10px',
      '"cover" stands alone',
    ],
    [
      'tdU_2_3',
      'text-decoration',
      'underline 2px 3px',
      'at most 1 length',
    ],
  ])('%s бракуется — %s не принимает "%s"', (
    token, prop, value, message,
  ) => {
    // До D-104 эти записи давали CSS как есть, и браузер отбрасывал правило.
    expect(lexer.matchProperty(prop, value).matched).toBeFalsy();
    const result = compile([token]);
    expect(result.css).toBe('');
    expect(result.warnings.map((w) => w.message).join(' ')).toContain(message);
  });

  test('`auto` в паре с длиной и `auto auto` — законные размеры', () => {
    expect(lexer.matchProperty('background-size', 'auto auto').matched).toBeTruthy();
    expect(compile(['bgsA_A']).css).toContain('background-size:auto auto');
    expect(compile(['bgsA_10']).css).toContain('background-size:auto 10px');
  });
});

describe('border-style: только то, что есть в спецификации', () => {
  test.each([
    'bsW',
    'bsDTDS',
    'bsDTDTDS',
    'bsWave',
    'bsDotDash',
  ])('%s бракуется — такого значения в CSS нет', (token) => {
    // `wave`, `dot-dash`, `dot-dot-dash` — проприетарный набор старой Mozilla
    // под `-moz-border-*-style`; в стандарт не вошёл ни один. Краткие записи
    // перешли из v1 и убраны 2026-09-26.
    expect(lexer.matchProperty('border-style', 'wave').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test.each([
    [
      'bsN',
      'none',
    ],
    [
      'bsH',
      'hidden',
    ],
    [
      'bsDT',
      'dotted',
    ],
    [
      'bsDS',
      'dashed',
    ],
    [
      'bsS',
      'solid',
    ],
    [
      'bsDB',
      'double',
    ],
    [
      'bsG',
      'groove',
    ],
    [
      'bsR',
      'ridge',
    ],
    [
      'bsI',
      'inset',
    ],
    [
      'bsO',
      'outset',
    ],
  ])('%s → border-style:%s — весь <line-style> на месте', (token, value) => {
    expect(lexer.matchProperty('border-style', value).matched).toBeTruthy();
    expect(compile([token]).css).toContain('border-style:' + value);
  });
});

describe('свойства-картинки: одна запись на значение (D-122)', () => {
  // `bgi`, `lisi`, `mk` (`mki` слит в `mk`, D-127): путь — только `_`-формой, переменная — `--x`, `none` — `N`, CSS-wide keyword — словом. До
  // D-122 обёртка в `url()` применялась ко всему, что не узнано: `bgiF00-00F` → `url("F00-00F")`, `bgi10px` →
  // `url("10px")`, а готовая функция (`bgi_url\\(a\\.png\\)`) проходила как есть.
  test.each([
    [
      'bgiN',
      'background-image:none',
    ],
    [
      'bgiINH',
      'background-image:inherit',
    ],
    [
      'bgiRVL',
      'background-image:revert-layer',
    ],
    [
      'lisiN',
      'list-style-image:none',
    ],
    [
      'mkN',
      'mask-image:none',
    ],
    [
      'bgi--v',
      'background-image:var(--v)',
    ],
    [
      'bgi_a\\.png',
      'background-image:url("a.png")',
    ],
    [
      'bgi_images/a\\.png',
      'background-image:url("images/a.png")',
    ],
    [
      'lisi_dot\\.svg',
      'list-style-image:url("dot.svg")',
    ],
    [
      'mk_a\\.png',
      'mask-image:url("a.png")',
    ],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'bgiF00-00F',
      'Value "F00-00F" is invalid for "bgi": a picture is its path (`bgi_a\\.png`), a variable (`bgi--x`) or `bgiN`;'
        + ' a gradient is written in `bg` (`bgF00-00F`)',
    ],
    [
      'mki_a\\.png',
      '"mki_a\\.png" was renamed: write "mk_a\\.png" (D-127)',
    ],
    [
      'bgi10px',
      'Value "10px" is invalid for "bgi": a picture is its path',
    ],
    [
      'bgiUrl\\(a\\.png\\)',
      'Value "Url(a.png)" is invalid for "bgi": a picture is its path',
    ],
    [
      'bgi_url\\(a\\.png\\)',
      'Value "_url(a.png)" is invalid for "bgi": a function is not written in a class — the path alone, as "bgi_a\\.png"',
    ],
    [
      'bgi_linear-gradient\\(red,blue\\)',
      'is invalid for "bgi": a function is not written in a class',
    ],
    [
      'bgi_--v',
      'Write the variable without "_": "bgi--v" instead of "bgi_--v" — same value',
    ],
    [
      'bgi_none',
      'Write it shorter: "bgiN" instead of "bgi_none" — same value',
    ],
    [
      'bgiNone',
      'Write it shorter: "bgiN" instead of "bgiNone" — same value',
    ],
    [
      'bgi_inherit',
      'Write it shorter: "bgiINH" instead of "bgi_inherit" — same value',
    ],
    [
      'bgi_',
      'the path after "_" is empty',
    ],
    [
      'bi_url\\(a\\.png\\)',
      'is invalid for "bi": a function is not written in a class — the path alone, as "bi_a\\.png"',
    ],
  ])('%s бракуется', (token, message) => {
    const {
      css, warnings,
    } = compile([token]);
    expect(css).toBe('');
    expect(warnings.map((w) => w.message).join(' ')).toContain(message);
  });

  test('у list-style-image нет хендлера градиента — подсказки на него нет', () => {
    const message = compile(['lisiF00-00F']).warnings.map((w) => w.message).join(' ');
    expect(message).toContain('a picture is its path (`lisi_a\\.png`)');
    expect(message).not.toContain('a gradient is written in');
  });

  test('без значения правила нет', () => {
    expect(compile(['bgi']).css).toBe('');
  });
});

describe('сырой режим не пропускает слов, у которых есть буква', () => {
  // Ведущий `_` означает «значение уже готово». У свойства с закрытым перечнем
  // готового значения, которого автор нотации не предусмотрел, не бывает — там
  // выход только пропускал мусор. У составного значения буквы пишутся в каждой
  // части (`dI_FR`), а полные слова бракуются с подсказкой (D-113).
  test.each([
    [
      'ov_solid',
      'overflow',
    ],
    [
      'ovx_solid',
      'overflow-x',
    ],
    [
      'of_solid',
      'object-fit',
    ],
    [
      'ta_solid',
      'text-align',
    ],
    [
      'wb_solid',
      'word-break',
    ],
    [
      'us_solid',
      'user-select',
    ],
    [
      'vis_solid',
      'visibility',
    ],
    [
      'bxz_solid',
      'box-sizing',
    ],
  ])('%s бракуется — у %s перечень закрыт', (token, prop) => {
    expect(lexer.matchProperty(prop, 'solid').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  const COMPOSITE: Array<[string, string]> = [
    [
      'dI_FR',
      'display:inline flow-root',
    ],
    [
      'lisD_I',
      'list-style:disc inside',
    ],
    [
      'ovbCT_A',
      'overscroll-behavior:contain auto',
    ],
    // Цвет в shorthand не выражается — он задаётся атомарным `tdc`
    // (`tdU tdcF00`), как и решено по `ol`: один способ на одно значение.
    [
      'tdU_W',
      'text-decoration:underline wavy',
    ],
    [
      'tchaPX_PY',
      'touch-action:pan-x pan-y',
    ],
    [
      'opL_T',
      'object-position:left top',
    ],
  ];

  test.each(COMPOSITE)('%s → %s — составное значение, буква в каждой части', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty(expected.slice(0, at), expected.slice(at + 1)).matched)
      .toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'd_inline_flow-root',
      'dI_FR',
    ],
    [
      'lis_disc_inside',
      'lisD_I',
    ],
    [
      'ovb_contain_auto',
      'ovbCT_A',
    ],
    [
      'td_underline_wavy',
      'tdU_W',
    ],
    [
      'tcha_pan-x_pan-y',
      'tchaPX_PY',
    ],
    [
      'op_left_top',
      'opL_T',
    ],
    [
      'dI_flow-root',
      'dI_FR',
    ],
  ])('%s бракуется — полные слова, есть "%s" (D-113)', (token, short) => {
    const result = compile([token]);
    expect(result.css).toBe('');
    expect(result.warnings.map((w) => w.message).join('\n'))
      .toContain('Write it shorter: "' + short + '" instead of "' + token + '"');
  });

  test.each([
    [
      'dB',
      'display:block',
    ],
    [
      'ovA',
      'overflow:auto',
    ],
    [
      'ofCT',
      'object-fit:contain',
    ],
    [
      'tdU',
      'text-decoration:underline',
    ],
    [
      'lisD',
      'list-style:disc',
    ],
    [
      'tchaA',
      'touch-action:auto',
    ],
    [
      'ovbCT',
      'overscroll-behavior:contain',
    ],
  ])('%s → %s — обычные записи не задеты', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });
});

describe('content: кавычки ставит хендлер', () => {
  // Ведущий `_` означает «дальше текст» и сам оборачивает его в кавычки.
  // Раньше кавычки писал автор, а их отсутствие не проверялось: `cntHello`
  // давало `content:hello`, которое браузер отбрасывает.
  test.each([
    [
      'cnt_Hello_World',
      'content:"Hello World"',
    ],
    [
      'cnt_a_b',
      'content:"a b"',
    ],
    [
      'cnt_a\\.b',
      'content:"a.b"',
    ],
  ])('%s → %s', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty('content', expected.slice(at + 1)).matched).toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test('cnt__ бракуется — у пробела одна запись', () => {
    // Иначе одно значение имело бы две формы записи.
    expect(compile(['cnt__']).css).toBe('');
    expect(compile(['cnt___']).css).toBe('');
    expect(compile(['cntS']).css).toContain('content:" "');
  });

  test('пробелы внутри текста не задеты', () => {
    expect(compile(['cnt_a_b']).css).toContain('content:"a b"');
    expect(compile(['cnt_a__b']).css).toContain('content:"a  b"');
  });

  test('пустая строка, пробел и none — три разных случая', () => {
    // `content:""` создаёт псевдоэлемент, `content:none` не создаёт вовсе.
    expect(lexer.matchProperty('content', '""').matched).toBeTruthy();
    expect(compile(['cnt_']).css).toContain('content:""');
    expect(compile(['cntS']).css).toContain('content:" "');
    expect(compile(['cntN']).css).toContain('content:none');
  });

  test.each([
    [
      'cnt',
      'content:none',
    ],
    [
      'cntN',
      'content:none',
    ],
    [
      'cntNormal',
      'content:normal',
    ],
    [
      'cntOQ',
      'content:open-quote',
    ],
    [
      'cntNCQ',
      'content:no-close-quote',
    ],
    [
      'cntINH',
      'content:inherit',
    ],
  ])('%s → %s — без `_` ожидается ключевое слово', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    'cntHello',
    'cnt10',
    'cntF00',
    'cntTrue',
  ])('%s бракуется — текст пишется как cnt_Hello', (token) => {
    const {
      css, warnings,
    } = compile([token]);
    expect(css).toBe('');
    expect(warnings.length).toBe(1);
  });

  // Функции — нативной формой (`cntAttr_href`, D-124): function-forms.test.ts.
  test.each([
    [
      'cnt--v',
      'content:var(--v)',
    ],
    [
      'cnt_--v',
      'content:var(--v)',
    ],
    [
      'cnt_see_\\(note\\)',
      'content:"see (note)"',
    ],
  ])('%s → %s — подстановка не кавычится, скобка в тексте — текст', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'cnt_he_said_"hi"',
      'content:"he said \\"hi\\""',
    ],
    [
      'cnt_a_"b"_c',
      'content:"a \\"b\\" c"',
    ],
  ])('%s → %s — кавычка внутри текста экранируется', (token, expected) => {
    // `content: a "b" c` по грамматике невалиден, поэтому трактовать кавычку
    // как «автор управляет сам» нельзя — она экранируется.
    const at = expected.indexOf(':');
    expect(lexer.matchProperty('content', expected.slice(at + 1)).matched).toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });
});

describe('transition: слоты в фиксированном порядке', () => {
  // Грамматика CSS порядок не фиксирует — `<single-transition>` это набор
  // `||`, и `all 0.2s` с `0.2s all` равноправны. Нотация фиксирует один:
  // проверка становится однозначной, а записей одного и того же не плодится.
  const OK: Array<[string, string]> = [
    [
      'tn0.2s',
      'transition:0.2s',
    ],
    [
      'tn200',
      'transition:200ms',
    ],
    [
      'tnA',
      'transition:all',
    ],
    [
      'tn_A_0.2s',
      'transition:all 0.2s',
    ],
    [
      'tn_color_0.2s_E',
      'transition:color 0.2s ease',
    ],
    [
      'tn_color_0.2s_E_0.1s',
      'transition:color 0.2s ease 0.1s',
    ],
    [
      'tn_0.2s_0.1s',
      'transition:0.2s 0.1s',
    ],
    [
      'tn_CubicBezier0_0_1_1',
      'transition:cubic-bezier(0,0,1,1)',
    ],
  ];

  test.each(OK)('%s → %s', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty('transition', expected.slice(at + 1)).matched).toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test('голое число получает ms, как у dn и delay', () => {
    expect(compile(['tn200']).css).toContain('transition:200ms');
    expect(compile(['dn200']).css).toContain('transition-duration:200ms');
  });

  test.each([
    [
      'tn_0.2s_A',
      'свойство идёт перед длительностью',
    ],
    [
      'tn_E_0.2s',
      'длительность идёт перед плавностью',
    ],
  ])('%s бракуется — %s', (token) => {
    // Обе записи по грамматике CSS валидны; нотация принимает одну.
    const {
      css, warnings,
    } = compile([token]);
    expect(css).toBe('');
    expect(warnings.length).toBe(1);
  });

  test('tn10zz бракуется — часть не подходит ни под один слот', () => {
    expect(compile(['tn10zz']).css).toBe('');
  });

  test('несколько переходов через запятую — то, ради чего shorthand остался', () => {
    // Атомарные `tp`/`dn`/`ttf`/`delay` пишут по одному значению на все
    // свойства сразу, поэтому разные параметры разным свойствам ими не задать.
    const css = compile(['tn_color_0.2s_E,transform_0.4s_L']).css;
    expect(css).toContain('transition:color 0.2s ease,transform 0.4s linear');
    expect(lexer.matchProperty('transition', 'color 0.2s ease,transform 0.4s linear').matched).toBeTruthy();
  });

  test('части функции плавности не путаются со слотами: за четырьмя числами — задержка (D-124)', () => {
    expect(compile(['tn_0.2s_CubicBezier0_0_1_1_0.1s']).css)
      .toContain('transition:0.2s cubic-bezier(0,0,1,1) 0.1s');
  });

  test('подстановка годится в любой слот', () => {
    expect(compile(['tn--v']).css).toContain('transition:var(--v)');
    expect(compile(['tn_A_--ease']).css).toContain('transition:all var(--ease)');
  });
});

describe('тени: список и переменная вместо сырого режима', () => {
  test('несколько РАЗНЫХ теней через запятую', () => {
    // Модификатор `m` повторяет одну и ту же тень; разные задаются списком.
    const css = compile(['bxsh10x0y2c0.1,5x0y1c0.05']).css;
    expect(css).toContain('box-shadow:0px 2px 10px 0px rgba(0,0,0,.1),0px 1px 5px 0px rgba(0,0,0,.05)');
  });

  test.each([
    [
      'bxshB--blur',
      'box-shadow:0px 0px var(--blur) 0px #000',
    ],
    [
      'bxshB--blur;c--shadow',
      'box-shadow:0px 0px var(--blur) 0px var(--shadow)',
    ],
    [
      'bxshB--my_blur;',
      'box-shadow:0px 0px var(--my_blur) 0px #000',
    ],
  ])('%s → %s — переменная в позиции blur', (token, expected) => {
    // `;` — терминатор имени: без него имя заберёт следующие модификаторы.
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'bxsh--shadow',
      'box-shadow:var(--shadow)',
    ],
    [
      'bxsh--shadow;',
      'box-shadow:var(--shadow)',
    ],
    [
      'bxsh--a,--b',
      'box-shadow:var(--a),var(--b)',
    ],
    [
      'tsh--shadow',
      'text-shadow:var(--shadow)',
    ],
  ])('%s → %s — переменная без буквы означает всю тень', (token, expected) => {
    // У любого другого свойства `--x` это значение целиком (`bg--panel`,
    // `tn--t`), и тень не исключение. До 2026-09-29 переменная молча попадала
    // в позицию blur, а прочие слоты добирались умолчаниями — автор получал
    // правило, которого не писал.
    expect(compile([token]).css).toContain(expected);
  });

  test('строчная буква слиплась бы с именем тега — потому форма заглавная', () => {
    // `bxshb…` ядро прочитает как тег `bxshb`, не найдёт хендлера и молча
    // пропустит токен как чужой класс. Сторож на случай, если кто-то решит
    // «для красоты» перевести модификатор в нижний регистр.
    expect(compile(['bxshb--blur']).css).not.toContain('box-shadow');
    expect(compile(['bxshB--blur']).css).toContain('var(--blur)');
  });

  test.each([
    [
      'bxshN',
      'box-shadow:none',
    ],
    [
      'bxshN',
      'box-shadow:none',
    ],
    [
      'bxsh',
      'box-shadow:none',
    ],
    [
      'bxsh10m0',
      'box-shadow:none',
    ],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    'bxsh_solid',
    'bxsh_0_2px_8px_--shadow',
    'tsh_solid',
  ])('%s бракуется — сырой режим у теней убран', (token) => {
    expect(compile([token]).css).toBe('');
  });

  test('bxshR3 бракуется — blur пишется первым', () => {
    // Раньше давало мусор `Rpx` в позиции blur, потом молча `none`.
    expect(compile(['bxshR3']).css).toBe('');
  });

  test('модификаторы и единица не задеты', () => {
    expect(compile(['bxsh19x5y5r3c43F']).css).toContain('box-shadow:5px 5px 19px 3px #43f');
    expect(compile(['bxsh1.5em']).css).toContain('box-shadow:0em 0em 1.5em 0em #000');
    expect(compile(['bxsh10in']).css).toContain('box-shadow:inset 0px 0px 10px 0px #000');
  });
});

describe('transition: список свойств с общими параметрами', () => {
  // Сокращение, которого в CSS нет: там каждое свойство пишется целым блоком.
  test.each([
    [
      'tn_color;background_0.2s',
      'transition:color 0.2s,background 0.2s',
    ],
    [
      'tn_color;background;border-color_0.2s',
      'transition:color 0.2s,background 0.2s,border-color 0.2s',
    ],
  ])('%s → %s', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty('transition', expected.slice(at + 1)).matched).toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test('список без остальных слотов — просто перечисление свойств', () => {
    // Длительность у них тогда по умолчанию (`0s`), как и в CSS.
    expect(compile(['tn_color;background']).css).toContain('transition:color,background');
  });

  test('список сочетается с обычными блоками через запятую', () => {
    expect(compile(['tn_color;background_0.2s,transform_0.4s']).css)
      .toContain('transition:color 0.2s,background 0.2s,transform 0.4s');
  });

  test.each([
    'tn_color;_0.2s',
    'tn_;color_0.2s',
  ])('%s бракуется — пустое имя в списке', (token) => {
    expect(compile([token]).css).toBe('');
  });

  test('`;` после имени переменной остаётся терминатором', () => {
    // Разбор различает их по началу токена: имя переменной начинается с `--`
    // и до этой проверки уже развёрнуто в `var(…)`.
    expect(compile(['tn_--prop_0.2s']).css).toContain('transition:var(--prop) 0.2s');
    expect(compile(['tn_--prop;_0.2s']).css).toContain('transition:var(--prop) 0.2s');
  });
});

describe('список переменных через `;` и запятую', () => {
  // `;` завершает имя переменной. Раньше он срабатывал перед `_` и в конце
  // значения, но не перед запятой: `g_--a;,--b` давало `grid:--a;,--b` —
  // переменные не разворачивались, а `;` уезжал в CSS литералом.
  test.each([
    [
      'g_--a;,--b',
      'grid:var(--a),var(--b)',
    ],
    [
      'g_--a;,--b;,--c',
      'grid:var(--a),var(--b),var(--c)',
    ],
    [
      'g_--my_a;,--my_b;',
      'grid:var(--my_a),var(--my_b)',
    ],
    [
      'tn_--a;,--b',
      'transition:var(--a),var(--b)',
    ],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test('в списке могут быть не только переменные', () => {
    expect(compile(['g_--a;,10px']).css).toContain('grid:var(--a),10px');
  });

  test('без `;` запятая после имени остаётся фолбэком', () => {
    // `var(--mono, serif)` — штатная конструкция CSS, и ломать её нельзя.
    expect(compile(['ff--mono,serif']).css).toContain('font-family:var(--mono,serif)');
    expect(compile(['gtc_--a,--b']).css)
      .toContain('grid-template-columns:var(--a,--b)');
  });

  test('пробел между переменными — через `_`, как и везде', () => {
    expect(compile(['gtc_--rows;_--cols']).css)
      .toContain('grid-template-columns:var(--rows) var(--cols)');
    expect(compile(['gtc_--a;_--b']).css)
      .toContain('grid-template-columns:var(--a) var(--b)');
  });
});

describe('`;` между переменными — разделитель частей', () => {
  // Писать `g--a;_--b` было лишним церемониалом: между двумя переменными
  // подряд другого смысла у `;` нет. Запятая по-прежнему пишется явно.
  test.each([
    [
      'gtc--a;--b',
      'grid-template-columns:var(--a) var(--b)',
    ],
    [
      'gtc--a;--b;--c',
      'grid-template-columns:var(--a) var(--b) var(--c)',
    ],
    [
      'col--a;--b',
      'columns:var(--a) var(--b)',
    ],
    [
      'tn--a;--b',
      'transition:var(--a) var(--b)',
    ],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test('ведущий `_` для этого не нужен, но и не мешает', () => {
    expect(compile(['gtc_--a;--b']).css)
      .toContain('grid-template-columns:var(--a) var(--b)');
    expect(compile(['gtc--a;_--b']).css)
      .toContain('grid-template-columns:var(--a) var(--b)');
  });

  test('запятая остаётся явной', () => {
    expect(compile(['gtc--a;,--b']).css)
      .toContain('grid-template-columns:var(--a),var(--b)');
  });

  test('три дефиса — это вычитание, а не разделитель', () => {
    // `w--a;---b` — минус перед переменной внутри calc. Пробел перед `env()`
    // пишется явно: `w--a;_---b`.
    expect(compile(['w--a;---b']).css).toContain('width:calc(var(--a) - var(--b))');
  });

  test('терминатор имени работает как раньше', () => {
    expect(compile(['w--my_var;']).css).toContain('width:var(--my_var)');
    expect(compile(['bxshB--blur;c--shadow']).css)
      .toContain('box-shadow:0px 0px var(--blur) 0px var(--shadow)');
  });
});

describe('тени: порядок модификаторов жёсткий', () => {
  // Свободный порядок был следствием реализации — независимые regex'ы искали
  // каждый свой фрагмент где угодно. Решение владельца 2026-09-27: одно
  // значение не должно записываться по-разному, как и у `tn`.
  test.each([
    'bxsh19c43Fx5y5r3',
    'bxsh19y5x5',
  ])('%s бракуется — порядок blur, x, y, r, m, c, in', (token) => {
    expect(compile([token]).css).toBe('');
  });

  test('канонический порядок даёт тот же CSS, что раньше свободный', () => {
    expect(compile(['bxsh19x5y5r3c43F']).css)
      .toContain('box-shadow:5px 5px 19px 3px #43f');
  });
});

describe('составные значения по слотам: fx, col, tem, coi, cor', () => {
  // Все пять были permissive pass-through: значение кебабилось и уходило в
  // CSS как есть, поэтому `fxN` давало `flex:n`, `colA` — `columns:a`.
  const OK: Array<[string, string]> = [
    [
      'fx1',
      'flex:1',
    ],
    [
      'fx_1_1',
      'flex:1 1',
    ],
    [
      'fx1_1_A',
      'flex:1 1 auto',
    ],
    [
      'fx_1_1_0%',
      'flex:1 1 0%',
    ],
    [
      'fxN',
      'flex:none',
    ],
    [
      'fxA',
      'flex:auto',
    ],
    [
      'fxC',
      'flex:content',
    ],
    [
      'col3',
      'columns:3',
    ],
    [
      'col_3_30em',
      'columns:3 30em',
    ],
    [
      'colA',
      'columns:auto',
    ],
    [
      'temF',
      'text-emphasis:filled',
    ],
    [
      'temF_D',
      'text-emphasis:filled dot',
    ],
    [
      'temN',
      'text-emphasis:none',
    ],
    [
      'coi_n_2',
      'counter-increment:n 2',
    ],
    [
      'coiNone',
      'counter-increment:none',
    ],
    [
      'cor_n_0',
      'counter-reset:n 0',
    ],
    [
      'corNone',
      'counter-reset:none',
    ],
  ];

  test.each(OK)('%s → %s', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty(expected.slice(0, at), expected.slice(at + 1)).matched)
      .toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'fxZzz',
      'flex:zzz',
    ],
    [
      'fx10zz',
      'flex:10zz',
    ],
    [
      'col10zz',
      'columns:10zz',
    ],
    [
      'temZzz',
      'text-emphasis:zzz',
    ],
    [
      'tem10',
      'text-emphasis:10',
    ],
    [
      'coi10',
      'counter-increment:10',
    ],
  ])('%s больше не даёт "%s"', (token, wasGiving) => {
    const at = wasGiving.indexOf(':');
    expect(lexer.matchProperty(wasGiving.slice(0, at), wasGiving.slice(at + 1)).matched)
      .toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test.each([
    [
      'fx_1_10px',
      'сжатие — число без единицы',
    ],
    [
      'fx_1_1_zzz',
      'база — длина или ключевое слово',
    ],
    [
      'fx_1_1_1_1',
      'у flex не больше трёх частей',
    ],
    [
      'col_30em_3',
      'у columns сначала число колонок',
    ],
    [
      'coi_2_n',
      'у счётчика сначала имя',
    ],
  ])('%s бракуется — %s', (token) => {
    expect(compile([token]).css).toBe('');
  });

  test('подстановка проходит: перечислить её в слотах нечем', () => {
    expect(compile(['coi--v']).css).toContain('counter-increment:var(--v)');
    expect(compile(['fx--v']).css).toContain('flex:var(--v)');
  });

  test('функция внутри составного значения тоже проходит', () => {
    // Содержимое функции слотами не описать, а валидна она в любом из них.
    expect(compile(['fx--g_1_A']).css).toContain('flex:var(--g) 1 auto');
    expect(compile(['coi_--name_2']).css).toContain('counter-increment:var(--name) 2');
    expect(compile(['col_--n_30em']).css).toContain('columns:var(--n) 30em');
  });
});

describe('дорожки и позиции сетки', () => {
  const TRACKS: Array<[string, string]> = [
    [
      'gtc1fr_1fr',
      'grid-template-columns:1fr 1fr',
    ],
    [
      'gtc50%',
      'grid-template-columns:50%',
    ],
    [
      'gtcN',
      'grid-template-columns:none',
    ],
    [
      'gtcA',
      'grid-template-columns:auto',
    ],
    [
      'gtcMinContent',
      'grid-template-columns:min-content',
    ],
    [
      'gtcS',
      'grid-template-columns:subgrid',
    ],
    // Функции — нативной формой, без скобок (D-124).
    [
      'gtc3x1fr',
      'grid-template-columns:repeat(3, 1fr)',
    ],
    [
      'gtrMinmax100px_1fr',
      'grid-template-rows:minmax(100px, 1fr)',
    ],
    [
      'gtc_\\[a\\]_1fr',
      'grid-template-columns:[a] 1fr',
    ],
    [
      'gac1fr',
      'grid-auto-columns:1fr',
    ],
    [
      'garA',
      'grid-auto-rows:auto',
    ],
  ];

  test.each(TRACKS)('%s → %s', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty(expected.slice(0, at), expected.slice(at + 1)).matched)
      .toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'gtcZzz',
      'grid-template-columns:zzz',
    ],
    [
      'gtc10zz',
      'grid-template-columns:10zz',
    ],
    [
      'gtc10',
      'grid-template-columns:10',
    ],
    [
      'gacZzz',
      'grid-auto-columns:zzz',
    ],
  ])('%s больше не даёт "%s"', (token, wasGiving) => {
    // Размер дорожки без единицы невалиден, в отличие от голого числа в
    // других местах нотации.
    const at = wasGiving.indexOf(':');
    expect(lexer.matchProperty(wasGiving.slice(0, at), wasGiving.slice(at + 1)).matched)
      .toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test('сокращение auto-repeat не задето', () => {
    expect(compile(['gtcAF240']).css)
      .toContain('grid-template-columns:repeat(auto-fit, minmax(240px, 1fr))');
  });

  test.each([
    [
      'gr1',
      'grid-row:1',
    ],
    [
      'gr1/3',
      'grid-row:1/3',
    ],
    [
      'gc1/-1',
      'grid-column:1/-1',
    ],
    [
      'grA',
      'grid-row:auto',
    ],
    [
      'grSpan2',
      'grid-row:span2',
    ],
  ])('%s → %s — позиция это номер или имя линии', (token, expected) => {
    // `<grid-line>` допускает почти любой идентификатор, поэтому `span2` и
    // `zzz` — законные имена линий, и проверять там почти нечего.
    expect(compile([token]).css).toContain(expected);
  });

  test('gr10px бракуется — длина в позиции бессмысленна', () => {
    expect(lexer.matchProperty('grid-row', '10px').matched).toBeFalsy();
    expect(compile(['gr10px']).css).toBe('');
  });
});

describe('flex-flow, transition-property, font-family', () => {
  test.each([
    [
      'fxfR',
      'flex-flow:row',
    ],
    [
      'fxfR_W',
      'flex-flow:row wrap',
    ],
    [
      'fxfCR',
      'flex-flow:column-reverse',
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
      'ffArial',
      'font-family:arial',
    ],
    [
      'ffSerif',
      'font-family:serif',
    ],
    [
      'ff_Times_New_Roman',
      'font-family:"Times New Roman"',
    ],
    [
      'ff_Arial,sans-serif',
      'font-family:Arial,sans-serif',
    ],
    [
      'ff--v',
      'font-family:var(--v)',
    ],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'fxf10px',
      'flex-flow:10px',
    ],
    [
      'fxfZzz',
      'flex-flow:zzz',
    ],
    [
      'tp10px',
      'transition-property:10px',
    ],
    [
      'ff10px',
      'font-family:10px',
    ],
  ])('%s больше не даёт "%s"', (token, wasGiving) => {
    const at = wasGiving.indexOf(':');
    expect(lexer.matchProperty(wasGiving.slice(0, at), wasGiving.slice(at + 1)).matched)
      .toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test('fxf_row_wrap_nowrap бракуется — у flex-flow две части', () => {
    expect(compile(['fxf_row_wrap_nowrap']).css).toBe('');
  });

  test('уже закавыченное имя шрифта не оборачивается второй раз', () => {
    // `ff_"My_Font"` давало `font-family:""My Font""` — вложенные кавычки,
    // правило браузер отбрасывает.
    expect(compile(['ff_"My_Font"']).css).toContain('font-family:"My Font"');
  });
});

describe('составное значение проверяется по частям', () => {
  // Сырой режим у составных свойств пропускал значение целиком, и мусор
  // проходил: `d_solid` давало `display:solid`. Перечень у них тоже закрыт,
  // просто значение из нескольких слов.
  test.each([
    'd_solid',
    'ovb_solid',
    'tcha_solid',
    'op_solid',
    'lis_solid',
    'd_inline_solid',
    'td_underline_zzz',
  ])('%s бракуется', (token) => {
    expect(compile([token]).css).toBe('');
  });

  test.each([
    [
      'dI_FR',
      'display:inline flow-root',
    ],
    [
      'lisD_I',
      'list-style:disc inside',
    ],
    [
      'ovbCT_A',
      'overscroll-behavior:contain auto',
    ],
    [
      'tchaPX_PY',
      'touch-action:pan-x pan-y',
    ],
    [
      'opL_T',
      'object-position:left top',
    ],
    [
      'tdU_2px',
      'text-decoration:underline 2px',
    ],
  ])('%s → %s — законные части не задеты', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });
});

describe('фильтры, text-size-adjust, позиции сетки', () => {
  test.each([
    [
      'ftBlur4',
      'filter:blur(4px)',
    ],
    [
      'ftbBlur8',
      'backdrop-filter:blur(8px)',
    ],
    [
      'ftGray50',
      'filter:grayscale(50%)',
    ],
    [
      'ftHue180',
      'filter:hue-rotate(180deg)',
    ],
    [
      'ftBlur3_Invert20',
      'filter:blur(3px) invert(20%)',
    ],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'ftbF00',
      'backdrop-filter:f(00)',
    ],
    [
      'ftb_solid',
      'backdrop-filter:solid()',
    ],
    [
      'ftbA',
      'backdrop-filter:a()',
    ],
    [
      'ftZzz10',
      'filter:zzz(10)',
    ],
  ])('%s больше не даёт "%s"', (token) => {
    // Арбитр здесь мягче спецификации: грамматика `filter` допускает `<url>`
    // и вендорные функции, поэтому `zzz(10)` он принимает. Список
    // `<filter-function>` при этом закрыт — десять функций, и выдуманное имя
    // в CSS просто ничего не делает.
    expect(compile([token]).css).toBe('');
  });

  test.each([
    [
      'tsa',
      'text-size-adjust:100%',
    ],
    [
      'tsa10',
      'text-size-adjust:10%',
    ],
    [
      'tsa100%',
      'text-size-adjust:100%',
    ],
    [
      'tsaA',
      'text-size-adjust:auto',
    ],
    [
      'tsaN',
      'text-size-adjust:none',
    ],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test('tsa10px бракуется — свойство задаётся процентом', () => {
    // Единица по умолчанию была `px`, поэтому `tsa10` давало `10px`.
    expect(lexer.matchProperty('text-size-adjust', '10px').matched).toBeFalsy();
    expect(compile(['tsa10px']).css).toBe('');
  });

  test.each([
    'gr1.5',
    'gr10-5',
    'gr100%-20px',
    'gr10zz',
    'gc1.5',
  ])('%s бракуется — номер линии это целое', (token) => {
    expect(compile([token]).css).toBe('');
  });

  test.each([
    [
      'gr1',
      'grid-row:1',
    ],
    [
      'gr1/3',
      'grid-row:1/3',
    ],
    [
      'gc1/-1',
      'grid-column:1/-1',
    ],
    [
      'grS_2',
      'grid-row:span 2',
    ],
    [
      'grA',
      'grid-row:auto',
    ],
  ])('%s → %s — законные позиции не задеты', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });
});

describe('фон и маска: только цвет, градиент или подстановка', () => {
  test.each([
    [
      'bgF00',
      'background:#f00',
    ],
    [
      'bgF00.5',
      'background:rgba(255,0,0,.5)',
    ],
    [
      'bgF00-00F',
      'background:linear-gradient(180deg,#f00 0%,#00f 100%)',
    ],
    [
      'bg--v',
      'background:var(--v)',
    ],
    [
      'bgCT',
      'background:currentColor',
    ],
    [
      'bgT',
      'background:transparent',
    ],
    [
      'bg0F0-00F_g90',
      'background:linear-gradient(270deg,#0f0 0%,#00f 100%)',
    ],
    [
      'bgF00-00F_r',
      'background:radial-gradient(circle,#f00 0%,#00f 100%)',
    ],
    [
      'mkF00-00F',
      'mask-image:linear-gradient(180deg,#f00 0%,#00f 100%)',
    ],
    [
      'mk--v',
      'mask-image:var(--v)',
    ],
  ])('%s → %s — мини-язык не задет', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'bg10zz',
      'background:10zz',
    ],
    [
      'bg1/2',
      'background:1/2',
    ],
    [
      'bg10_20',
      'background:10_20',
    ],
    [
      'bg+5',
      'background:+5',
    ],
    [
      'bg10s',
      'background:10s',
    ],
  ])('%s больше не даёт "%s"', (token, wasGiving) => {
    const at = wasGiving.indexOf(':');
    expect(lexer.matchProperty(wasGiving.slice(0, at), wasGiving.slice(at + 1)).matched)
      .toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test('bg100%-20px больше не собирается в градиент из мусора', () => {
    // Давало `linear-gradient(180deg,100% 0%,20px 100%)`.
    expect(compile(['bg100%-20px']).css).toBe('');
  });

  test.each([
    'mkF00',
    'mk10px',
    'mk',
  ])('%s бракуется — mask-image цвета не принимает', (token) => {
    expect(lexer.matchProperty('mask-image', '#f00').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });
});

// `border-image` — `presets/standard/__tests__/border-image.test.ts` (D-119: по частям, свои хендлеры).

describe('grid и grid-template', () => {
  const OK: Array<[string, string]> = [
    [
      'gN',
      'grid:none',
    ],
    [
      'g_1fr_/_1fr',
      'grid:1fr / 1fr',
    ],
    [
      'g_"a"_1fr',
      'grid:"a" 1fr',
    ],
    [
      'gAF_1fr_/_1fr',
      'grid:auto-flow 1fr / 1fr',
    ],
    [
      'gAF_/_1fr',
      'grid:auto-flow / 1fr',
    ],
    [
      'gt_"a_b"_1fr',
      'grid-template:"a b" 1fr',
    ],
    [
      'gt"a_b"_1fr_/_A',
      'grid-template:"a b" 1fr / auto',
    ],
  ];

  test.each(OK)('%s → %s', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty(expected.slice(0, at), expected.slice(at + 1)).matched)
      .toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    [
      'g10zz',
      'grid:10zz',
    ],
    [
      'gZzz',
      'grid:zzz',
    ],
    [
      'g10px',
      'grid:10px',
    ],
  ])('%s больше не даёт "%s"', (token, wasGiving) => {
    const at = wasGiving.indexOf(':');
    expect(lexer.matchProperty(wasGiving.slice(0, at), wasGiving.slice(at + 1)).matched)
      .toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test('подстановка проходит — арбитр её не разбирает, а по спецификации она валидна', () => {
    expect(compile(['g--v']).css).toContain('grid:var(--v)');
  });

  test('g_1fr_1fr бракуется — это не форма `grid`', () => {
    // Работало, но по грамматике невалидно: `grid` — либо `none`, либо
    // области в кавычках, либо «строки / столбцы». Один список дорожек
    // задаётся через `gtc`/`gtr`.
    expect(lexer.matchProperty('grid', '1fr 1fr').matched).toBeFalsy();
    expect(compile(['g_1fr_1fr']).css).toBe('');
    expect(compile(['gtc1fr_1fr']).css).toContain('grid-template-columns:1fr 1fr');
  });
});

describe('последние пограничные случаи', () => {
  test.each([
    [
      'gr10_20',
      'grid-row:10 20',
    ],
    [
      'gc10_20',
      'grid-column:10 20',
    ],
  ])('%s больше не даёт "%s" — вторая позиция через «/»', (token, wasGiving) => {
    const at = wasGiving.indexOf(':');
    expect(lexer.matchProperty(wasGiving.slice(0, at), wasGiving.slice(at + 1)).matched)
      .toBeFalsy();
    expect(compile([token]).css).toBe('');
    expect(compile(['gr1/3']).css).toContain('grid-row:1/3');
  });

  test('tsa0 бракуется — ноль без единицы тоже не процент', () => {
    // `lengthOrWord` отдаёт ноль без единицы, как и положено длинам, но
    // `text-size-adjust:0` невалиден.
    expect(lexer.matchProperty('text-size-adjust', '0').matched).toBeFalsy();
    expect(compile(['tsa0']).css).toBe('');
    expect(compile(['tsa10']).css).toContain('text-size-adjust:10%');
  });

  test.each([
    'mk1.5',
    'mk10.5',
  ])('%s бракуется — дробь разбиралась как цвет с альфой', (token) => {
    // Давало `mask-image:rgba(17,17,17,.5)`, а цвет `mask-image` не принимает.
    expect(compile([token]).css).toBe('');
  });
});

describe('свойства, принимающие числа и несколько значений', () => {
  // Найдены сплошной сверкой с грамматикой после того, как сборка сайта
  // упёрлась в `bgs100%_.16em`: помечать такие свойства по одному ненадёжно.
  test.each([
    [
      'bgs100%_.16em',
      'background-size:100% .16em',
    ],
    [
      'bgs10px_20px',
      'background-size:10px 20px',
    ],
    [
      'bgs100%',
      'background-size:100%',
    ],
    [
      'bgsCV',
      'background-size:cover',
    ],
    [
      'ovH_A',
      'overflow:hidden auto',
    ],
    [
      'tovE_C',
      'text-overflow:ellipsis clip',
    ],
    [
      'op50%_50%',
      'object-position:50% 50%',
    ],
    [
      'opL_T',
      'object-position:left top',
    ],
  ])('%s → %s', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty(expected.slice(0, at), expected.slice(at + 1)).matched)
      .toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    'bgsZzz',
    'bgs10zz',
    'ov_solid',
    'tov_solid',
    'op_solid',
    'op10zz',
  ])('%s бракуется', (token) => {
    expect(compile([token]).css).toBe('');
  });

  test('строка в кавычках — готовое значение, кебабить её нельзя', () => {
    // `qRU` давало `'\\00-a-b'` вместо `'\\00AB'`: заглавные буквы
    // escape-последовательности уходили в дефисы.
    expect(compile(['qRU']).css)
      .toContain("quotes:'\\00AB' '\\00BB' '\\201E' '\\201C'");
    expect(compile(['q_"a"_"b"']).css).toContain('quotes:"a" "b"');
    expect(compile(['qA']).css).toContain('quotes:auto');
  });
});
