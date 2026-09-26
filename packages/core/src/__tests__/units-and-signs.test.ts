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
  for (let i = 0; i < tokens.length; i++) {
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
    ['ti10s', 'время'],
    ['ti10deg', 'угол'],
    ['ti10fr', 'доля grid-дорожки'],
  ])('%s — единица не того типа (%s) бракуется', (token) => {
    expect(compile([token]).css).toBe('');
  });

  test.each([
    ['tiF00', 'text-indent:f00'],
    ['ti1/2', 'text-indent:1/2'],
    ['ti10-5', 'text-indent:10-5'],
    ['ti100%-20px', 'text-indent:100%-20px'],
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
    ['bxsh10', 'box-shadow:0px 0px 10px 0px #000'],
    ['bxsh1.5em', 'box-shadow:0em 0em 1.5em 0em #000'],
    ['bxsh10rem', 'box-shadow:0rem 0rem 10rem 0rem #000'],
    ['bxsh10dvh', 'box-shadow:0dvh 0dvh 10dvh 0dvh #000'],
    ['tsh10em', 'text-shadow:0em 0em 10em #000'],
  ])('%s → %s', (token, expected) => {
    // Склейка была жёстко `px`, и всё кроме него молча терялось. Мимо
    // валидатора ядра это проходило: `box-shadow` не в его таблице.
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    ['bxsh19r3c43F', 'box-shadow:0px 0px 19px 3px #43f'],
    ['bxsh10x2y4', 'box-shadow:2px 4px 10px 0px #000'],
    ['bxsh10emc43F', 'box-shadow:0em 0em 10em 0em #43f'],
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
    expect(compile(['bxsh--blur']).css)
      .toContain('box-shadow:0px 0px var(--blur) 0px #000');
    expect(compile(['bxsh--blur;c--shadow']).css)
      .toContain('box-shadow:0px 0px var(--blur) 0px var(--shadow)');
  });
});

describe('поворот измеряется углом', () => {
  test.each([
    ['rx', 'rotateX(180deg)'],
    ['rx45', 'rotateX(45deg)'],
    ['rx-45', 'rotateX(-45deg)'],
    ['rx45deg', 'rotateX(45deg)'],
    ['rx0.5turn', 'rotateX(0.5turn)'],
    ['rx1rad', 'rotateX(1rad)'],
    ['rx100grad', 'rotateX(100grad)'],
    ['ry90', 'rotateY(90deg)'],
    ['rz180', 'rotateZ(180deg)'],
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
    ['x10y20rz45', 'translate(10px,20px) rotateZ(45deg)'],
    ['x10y20rz45deg', 'translate(10px,20px) rotateZ(45deg)'],
    ['x10y20rz0.5turn', 'translate(10px,20px) rotateZ(0.5turn)'],
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
    ['p10%', 'padding'],
    ['m10%', 'margin'],
    ['r10%', 'border-radius'],
    ['f10%', 'font-size'],
    ['w10%', 'width'],
    ['ti10%', 'text-indent'],
    ['tdt10%', 'text-decoration-thickness'],
    ['fxb10%', 'flex-basis'],
    ['sw10%', 'stroke-width'],
  ];

  test.each(PERCENT_OK)('%s — у %s процент валиден', (token, prop) => {
    expect(lexer.matchProperty(prop, '10%').matched).toBeTruthy();
    expect(compile([token]).css).toContain(prop + ':10%');
  });

  const PERCENT_BAD: Array<[string, string]> = [
    ['b10%', 'border-width'],
    ['bt10%', 'border-top-width'],
    ['olw10%', 'outline-width'],
    ['wos10%', 'word-spacing'],
    ['bsp10%', 'border-spacing'],
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
    ['p10_20', 'padding:10px 20px'],
    ['m10_20', 'margin:10px 20px'],
    ['b10_20', 'border-width:10px 20px'],
    ['b1_2_3_4', 'border-width:1px 2px 3px 4px'],
    ['bsp10_20', 'border-spacing:10px 20px'],
    ['gg10_20', 'grid-gap:10px 20px'],
  ];

  test.each(MULTI_OK)('%s → %s — свойство берёт несколько значений', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  const MULTI_BAD: Array<[string, string]> = [
    ['bt10_20', 'border-top-width'],
    ['olw10_20', 'outline-width'],
    ['ti10_20', 'text-indent'],
    ['tdt10_20', 'text-decoration-thickness'],
    ['tuo10_20', 'text-underline-offset'],
    ['fxb10_20', 'flex-basis'],
    ['ggc10_20', 'grid-column-gap'],
    ['sw10_20', 'stroke-width'],
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
    ['olo', 'outline-offset:0'],
    ['olo2', 'outline-offset:2px'],
    ['olo-2', 'outline-offset:-2px'],
    ['olo--v', 'outline-offset:var(--v)'],
    ['oloInherit', 'outline-offset:inherit'],
    ['lts2', 'letter-spacing:2px'],
    ['lts0.06em', 'letter-spacing:0.06em'],
    ['lts-0.02em', 'letter-spacing:-0.02em'],
    ['lts10%', 'letter-spacing:10%'],
    ['ltsN', 'letter-spacing:normal'],
    ['ltsNormal', 'letter-spacing:normal'],
    ['lts--v', 'letter-spacing:var(--v)'],
    ['tsa', 'text-size-adjust:100%'],
    ['tsaA', 'text-size-adjust:auto'],
    ['tsaN', 'text-size-adjust:none'],
    ['fsa0.5', 'font-size-adjust:0.5'],
    ['fsaN', 'font-size-adjust:none'],
    ['fsaFromFont', 'font-size-adjust:from-font'],
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
    ['lh', 'line-height:1'],
    ['lh1.5', 'line-height:1.5'],
    ['lh10px', 'line-height:10px'],
    ['lh150%', 'line-height:150%'],
    ['lh1.2em', 'line-height:1.2em'],
    ['lh0', 'line-height:0'],
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
    ['z', 'z-index:1'],
    ['z1', 'z-index:1'],
    ['z-5', 'z-index:-5'],
    ['z0', 'z-index:0'],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each(['z1.5', 'z10.5'])('%s бракуется — z-index задаётся целым', (token) => {
    expect(lexer.matchProperty('z-index', '1.5').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test.each([
    ['fwN', 'font-weight:normal'],
    ['fwB', 'font-weight:bold'],
    ['fwBR', 'font-weight:bolder'],
    ['fwLR', 'font-weight:lighter'],
    ['fwBold', 'font-weight:bold'],
    ['fwBolder', 'font-weight:bolder'],
    ['fw6', 'font-weight:600'],
    ['fw600', 'font-weight:600'],
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
    ['p-5', 'padding'],
    ['pt-5', 'padding-top'],
    ['w-5', 'width'],
    ['h-5', 'height'],
    ['wmin-5', 'min-width'],
    ['sq-5', 'width'],
    ['f-5', 'font-size'],
    ['r-5', 'border-radius'],
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
    ['irPixelated', 'image-rendering:pixelated'],
    ['irCrispEdges', 'image-rendering:crisp-edges'],
    ['apcNone', 'appearance:none'],
    ['apcMenulistButton', 'appearance:menulist-button'],
    ['ttfEaseInOut', 'transition-timing-function:ease-in-out'],
    ['ttfStepEnd', 'transition-timing-function:step-end'],
    ['gafRow', 'grid-auto-flow:row'],
    ['tdsEdges', 'text-decoration-skip:edges'],
    ['tdsiAll', 'text-decoration-skip-ink:all'],
    ['tdstWavy', 'text-decoration-style:wavy'],
    ['tupFromFont', 'text-underline-position:from-font'],
    ['tsFlat', 'transform-style:flat'],
    ['mbmPlusLighter', 'mix-blend-mode:plus-lighter'],
    ['temsSesame', 'text-emphasis-style:sesame'],
    ['tempOver', 'text-emphasis-position:over'],
  ];

  test.each(OK)('%s → %s', (token, expected) => {
    const [prop, value] = expected.split(':');
    expect(lexer.matchProperty(prop, value).matched).toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    'irF00',
    'irZzz',
    'ir10',
    'ir10px',
    'apcZzz',
    'apcF00',
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
    ['tems_Filled_Dot', 'text-emphasis-style:Filled Dot'],
    ['tems_filled_dot', 'text-emphasis-style:filled dot'],
    ['tempOver_Right', 'text-emphasis-position:over right'],
    ['tdsObjects_Spaces', 'text-decoration-skip:objects spaces'],
    ['gafRow_Dense', 'grid-auto-flow:row dense'],
    ['tupUnder_Left', 'text-underline-position:under left'],
  ])('%s → %s — свойство берёт несколько слов', (token, expected) => {
    // Регистр не важен: ключевые слова в CSS регистронезависимы, а сырой режим
    // (`tems_Filled_Dot`) оставляет их как написано.
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    ['irAuto_Pixelated', 'image-rendering'],
    ['apcNone_Auto', 'appearance'],
    ['mbmNormal_Multiply', 'mix-blend-mode'],
    ['tdstSolid_Wavy', 'text-decoration-style'],
  ])('%s бракуется — %s берёт одно слово', (token, prop) => {
    expect(lexer.matchProperty(prop, 'auto pixelated').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test('второе слово проверяется наравне с первым', () => {
    expect(compile(['tems_Filled_Zzz']).css).toBe('');
    expect(compile(['gafRow_Zzz']).css).toBe('');
  });

  test.each([
    ['tsPreserve3d', 'transform-style:preserve-3d'],
    ['tsPreserve3D', 'transform-style:preserve-3d'],
    ['irOptimizeSpeed', 'image-rendering:optimizeSpeed'],
    ['irOptimizeQuality', 'image-rendering:optimizeQuality'],
    ['irMozCrispEdges', 'image-rendering:-moz-crisp-edges'],
    ['irWebkitOptimizeContrast', 'image-rendering:-webkit-optimize-contrast'],
  ])('%s → %s — запись, которую camelCase иначе ломает', (token, expected) => {
    // Цифра не даёт дефиса (`preserve3d` вместо `preserve-3d`), ведущий дефис
    // вендорной формы теряется, а `optimizeSpeed` записан camelCase в самой
    // спецификации — это legacy из SVG.
    const [prop, value] = expected.split(':');
    expect(lexer.matchProperty(prop, value).matched).toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test('подстановка проходит: её содержимое здесь разбирать нечем', () => {
    expect(compile(['ir--v']).css).toContain('image-rendering:var(--v)');
  });

  test('CSS-wide keywords проходят везде', () => {
    expect(compile(['irInherit']).css).toContain('image-rendering:inherit');
    expect(compile(['apcUnset']).css).toContain('appearance:unset');
  });
});

describe('у свойства с перечнем число недопустимо так же, как чужое слово', () => {
  // Раньше проверялось только слово — «числа словарём не перечислить». Но у
  // свойства с закрытым перечнем число невалидно само по себе. Сверка с
  // грамматикой показала, что из 38 свойств этого пути числа законны ровно у
  // двух, плюс у позиции фона.
  test.each([
    ['pos10', 'position'],
    ['ov10', 'overflow'],
    ['ovx1.5', 'overflow-x'],
    ['d10px', 'display'],
    ['of10', 'object-fit'],
    ['wb10', 'word-break'],
    ['us10', 'user-select'],
    ['vis10', 'visibility'],
  ])('%s бракуется — %s чисел не принимает', (token, prop) => {
    expect(lexer.matchProperty(prop, '10').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test.each([
    ['bgpx50%', 'background-position-x:50%'],
    ['bgpy10px', 'background-position-y:10px'],
    ['va-0.125em', 'vertical-align:-0.125em'],
    ['va10%', 'vertical-align:10%'],
    ['td2px', 'text-decoration:2px'],
  ])('%s → %s — там, где число законно, оно проходит', (token, expected) => {
    const [prop, value] = expected.split(':');
    expect(lexer.matchProperty(prop, value).matched).toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    ['posA', 'position:absolute'],
    ['posSticky', 'position:sticky'],
    ['posWebkitSticky', 'position:-webkit-sticky'],
    ['pos', 'position:relative'],
    ['posInherit', 'position:inherit'],
    ['pos--v', 'position:var(--v)'],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each(['posZzz', 'posF00'])('%s бракуется', (token) => {
    expect(compile([token]).css).toBe('');
  });
});

describe('стиль границы — закрытый перечень', () => {
  test.each([
    ['bs', 'border-style:solid'],
    ['bsS', 'border-style:solid'],
    ['bsN', 'border-style:none'],
    ['bsDT', 'border-style:dotted'],
    ['bsSolid', 'border-style:solid'],
    ['bstS', 'border-top-style:solid'],
    ['bslS', 'border-left-style:solid'],
    ['bsInherit', 'border-style:inherit'],
    ['bs--v', 'border-style:var(--v)'],
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
    expect(compile(['bsSolid_Dotted']).css).toContain('border-style:solid dotted');
    expect(lexer.matchProperty('border-top-style', 'solid dotted').matched).toBeFalsy();
    expect(compile(['bst10_20']).css).toBe('');
  });
});

describe('свойства, которые берут безразмерное число', () => {
  // Единица к такому значению приписывалась по общему правилу нотации
  // «число = px» или уходила как написана, а проверки не было вовсе.
  test.each([
    ['wid2', 'widows:2'],
    ['wid-2', 'widows:-2'],
    ['orp2', 'orphans:2'],
    ['or2', 'order:2'],
    ['or-2', 'order:-2'],
    ['fxg1', 'flex-grow:1'],
    ['fxg1.5', 'flex-grow:1.5'],
    ['fxs1', 'flex-shrink:1'],
    ['zm1.5', 'zoom:1.5'],
    ['zm150%', 'zoom:150%'],
    ['zmNormal', 'zoom:normal'],
    ['zmReset', 'zoom:reset'],
    ['ar1.5', 'aspect-ratio:1.5'],
    ['arAuto', 'aspect-ratio:auto'],
    ['ar16/9', 'aspect-ratio:16/9'],
  ])('%s → %s', (token, expected) => {
    const [prop, value] = expected.split(':');
    expect(lexer.matchProperty(prop, value).matched).toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    ['wid10px', 'widows'],
    ['or2px', 'order'],
    ['fxg10px', 'flex-grow'],
    ['fxs10px', 'flex-shrink'],
    ['zm10px', 'zoom'],
    ['ar10px', 'aspect-ratio'],
  ])('%s бракуется — у %s единицы нет', (token, prop) => {
    expect(lexer.matchProperty(prop, '10px').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  test.each([
    ['wid2.5', 'widows'],
    ['orp2.5', 'orphans'],
    ['or2.5', 'order'],
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
    ['bgpx10zz', 'background-position-x'],
    ['bgpx10s', 'background-position-x'],
    ['va10zz', 'vertical-align'],
    ['td10zz', 'text-decoration'],
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
    ['bsN', 'none'],
    ['bsH', 'hidden'],
    ['bsDT', 'dotted'],
    ['bsDS', 'dashed'],
    ['bsS', 'solid'],
    ['bsDB', 'double'],
    ['bsG', 'groove'],
    ['bsR', 'ridge'],
    ['bsI', 'inset'],
    ['bsO', 'outset'],
  ])('%s → border-style:%s — весь <line-style> на месте', (token, value) => {
    expect(lexer.matchProperty('border-style', value).matched).toBeTruthy();
    expect(compile([token]).css).toContain('border-style:' + value);
  });
});

describe('свойства-картинки оборачивают в url() только голый путь', () => {
  // Обёртка была безусловной, поэтому готовое значение заворачивалось второй
  // раз, а ключевое слово превращалось в имя файла.
  test.each([
    ['bgi', 'background-image:none'],
    ['bgiN', 'background-image:none'],
    ['bgi_none', 'background-image:none'],
    ['bgiInherit', 'background-image:inherit'],
    ['lisiN', 'list-style-image:none'],
    ['maskiN', 'mask-image:none'],
  ])('%s → %s — ключевое слово не заворачивается', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([['bgi_a\\.png', 'background-image:url("a.png")'], ['bgi_images/a\\.png', 'background-image:url("images/a.png")']])('%s → %s — голый путь заворачивается', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([['bgi_url\\(a\\.png\\)', 'background-image:url(a.png)'], ['bgi_linear-gradient\\(red,blue\\)', 'background-image:linear-gradient(red,blue)']])('%s → %s — готовая функция проходит как есть', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test('переменная подставляется целиком, а не как путь', () => {
    expect(compile(['bgi--v']).css).toContain('background-image:var(--v)');
  });
});

describe('сырой режим только там, где значение составное', () => {
  // Ведущий `_` означает «значение уже готово» и отключает проверку. У
  // свойства с закрытым перечнем готового значения, которого автор нотации не
  // предусмотрел, не бывает — там выход только пропускал мусор.
  test.each([
    ['ov_solid', 'overflow'],
    ['ovx_solid', 'overflow-x'],
    ['of_solid', 'object-fit'],
    ['ta_solid', 'text-align'],
    ['wb_solid', 'word-break'],
    ['us_solid', 'user-select'],
    ['vis_solid', 'visibility'],
    ['bxz_solid', 'box-sizing'],
  ])('%s бракуется — у %s перечень закрыт', (token, prop) => {
    expect(lexer.matchProperty(prop, 'solid').matched).toBeFalsy();
    expect(compile([token]).css).toBe('');
  });

  const COMPOSITE: Array<[string, string]> = [
    ['d_inline_flow-root', 'display:inline flow-root'],
    ['lis_disc_inside', 'list-style:disc inside'],
    ['ovb_contain_auto', 'overscroll-behavior:contain auto'],
    ['td_underline_wavy_red', 'text-decoration:underline wavy red'],
    ['tcha_pan-x_pan-y', 'touch-action:pan-x pan-y'],
    ['op_left_top', 'object-position:left top'],
  ];

  test.each(COMPOSITE)('%s → %s — составное значение, выход остаётся', (token, expected) => {
    const at = expected.indexOf(':');
    expect(lexer.matchProperty(expected.slice(0, at), expected.slice(at + 1)).matched)
      .toBeTruthy();
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    ['dB', 'display:block'],
    ['ovA', 'overflow:auto'],
    ['ofCT', 'object-fit:contain'],
    ['tdU', 'text-decoration:underline'],
    ['lisD', 'list-style:disc'],
    ['tchaA', 'touch-action:auto'],
    ['ovbCT', 'overscroll-behavior:contain'],
  ])('%s → %s — обычные записи не задеты', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });
});

describe('content: кавычки ставит хендлер', () => {
  // Ведущий `_` означает «дальше текст» и сам оборачивает его в кавычки.
  // Раньше кавычки писал автор, а их отсутствие не проверялось: `cntHello`
  // давало `content:hello`, которое браузер отбрасывает.
  test.each([
    ['cnt_Hello_World', 'content:"Hello World"'],
    ['cnt_a_b', 'content:"a b"'],
    ['cnt_a\\.b', 'content:"a.b"'],
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
    ['cnt', 'content:none'],
    ['cntNone', 'content:none'],
    ['cntNormal', 'content:normal'],
    ['cntOpenQuote', 'content:open-quote'],
    ['cntNoCloseQuote', 'content:no-close-quote'],
    ['cntInherit', 'content:inherit'],
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

  test.each([
    ['cnt_attr\\(href\\)', 'content:attr(href)'],
    ['cnt_counter\\(n\\)', 'content:counter(n)'],
    ['cnt_url\\(a\\.png\\)', 'content:url(a.png)'],
    ['cnt--v', 'content:var(--v)'],
  ])('%s → %s — функция и подстановка не кавычатся', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test.each([['cnt_he_said_"hi"', 'content:"he said \\"hi\\""'], ['cnt_a_"b"_c', 'content:"a \\"b\\" c"']])('%s → %s — кавычка внутри текста экранируется', (token, expected) => {
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
    ['tn0.2s', 'transition:0.2s'],
    ['tn200', 'transition:200ms'],
    ['tnAll', 'transition:all'],
    ['tn_all_0.2s', 'transition:all 0.2s'],
    ['tn_color_0.2s_ease', 'transition:color 0.2s ease'],
    ['tn_color_0.2s_ease_0.1s', 'transition:color 0.2s ease 0.1s'],
    ['tn_0.2s_0.1s', 'transition:0.2s 0.1s'],
    ['tn_cubic-bezier\\(0,0,1,1\\)', 'transition:cubic-bezier(0,0,1,1)'],
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

  test.each([['tn_0.2s_all', 'свойство идёт перед длительностью'], ['tn_ease_0.2s', 'длительность идёт перед плавностью']])('%s бракуется — %s', (token) => {
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
    const css = compile(['tn_color_0.2s_ease,transform_0.4s_linear']).css;
    expect(css).toContain('transition:color 0.2s ease,transform 0.4s linear');
    expect(lexer.matchProperty('transition', 'color 0.2s ease,transform 0.4s linear').matched).toBeTruthy();
  });

  test('запятая внутри скобок не делит переходы', () => {
    expect(compile(['tn_0.2s_cubic-bezier\\(0,0,1,1\\)']).css)
      .toContain('transition:0.2s cubic-bezier(0,0,1,1)');
  });

  test('подстановка годится в любой слот', () => {
    expect(compile(['tn--v']).css).toContain('transition:var(--v)');
    expect(compile(['tn_all_--ease']).css).toContain('transition:all var(--ease)');
  });
});

describe('тени: список и переменная вместо сырого режима', () => {
  test('несколько РАЗНЫХ теней через запятую', () => {
    // Модификатор `m` повторяет одну и ту же тень; разные задаются списком.
    const css = compile(['bxsh10x0y2c0.1,5x0y1c0.05']).css;
    expect(css).toContain('box-shadow:0px 2px 10px 0px rgba(0,0,0,.1),0px 1px 5px 0px rgba(0,0,0,.05)');
  });

  test.each([
    ['bxsh--blur', 'box-shadow:0px 0px var(--blur) 0px #000'],
    ['bxsh--blur;c--shadow', 'box-shadow:0px 0px var(--blur) 0px var(--shadow)'],
    ['bxsh--my_blur;', 'box-shadow:0px 0px var(--my_blur) 0px #000'],
  ])('%s → %s — переменная в позиции blur', (token, expected) => {
    // `;` — терминатор имени: без него имя заберёт следующие модификаторы.
    expect(compile([token]).css).toContain(expected);
  });

  test.each([
    ['bxshN', 'box-shadow:none'],
    ['bxshNone', 'box-shadow:none'],
    ['bxsh', 'box-shadow:none'],
    ['bxsh10m0', 'box-shadow:none'],
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
  test.each([['tn_color;background_0.2s', 'transition:color 0.2s,background 0.2s'], ['tn_color;background;border-color_0.2s', 'transition:color 0.2s,background 0.2s,border-color 0.2s']])('%s → %s', (token, expected) => {
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

  test.each(['tn_color;_0.2s', 'tn_;color_0.2s'])('%s бракуется — пустое имя в списке', (token) => {
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
    ['g_--a;,--b', 'grid:var(--a),var(--b)'],
    ['g_--a;,--b;,--c', 'grid:var(--a),var(--b),var(--c)'],
    ['g_--my_a;,--my_b;', 'grid:var(--my_a),var(--my_b)'],
    ['tn_--a;,--b', 'transition:var(--a),var(--b)'],
  ])('%s → %s', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test('в списке могут быть не только переменные', () => {
    expect(compile(['g_--a;,10px']).css).toContain('grid:var(--a),10px');
  });

  test('без `;` запятая после имени остаётся фолбэком', () => {
    // `var(--mono, serif)` — штатная конструкция CSS, и ломать её нельзя.
    expect(compile(['ff--mono,serif']).css).toContain('font-family:var(--mono,serif)');
    expect(compile(['g_--a,--b']).css).toContain('grid:var(--a,--b)');
  });

  test('пробел между переменными — через `_`, как и везде', () => {
    expect(compile(['g_--rows;_--cols']).css).toContain('grid:var(--rows) var(--cols)');
    expect(compile(['gtc_--a;_--b']).css)
      .toContain('grid-template-columns:var(--a) var(--b)');
  });
});
