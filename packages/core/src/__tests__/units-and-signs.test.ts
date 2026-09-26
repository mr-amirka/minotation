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

  test('обе недоступные единицы выразимы свободной формой', () => {
    expect(compile(['bxsh_0_0_10in_#000']).css).toContain('box-shadow:0 0 10in #000');
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
