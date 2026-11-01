/**
 * Единицы длины и знак значения.
 *
 * Оба списка проверяются арбитром — `css-tree` с `mdn-data`, то есть
 * официальной грамматикой, а не памятью автора. Так тест ловит расхождение в
 * обе стороны: и единицу, которую нотация зря не принимает, и знак, который
 * она зря пропускает в CSS.
 */
import {
  lexer,
} from 'css-tree';
import {
  compile,
} from './compile';

/**
 * Полный набор единиц длины из спецификации. Раньше нотация знала 14 из
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

  test('tiF00 больше не даёт "text-indent:f00"', () => {
    // Общий блок свободных значений кебабил суффикс и отдавал как есть;
    // свойства нет в таблице валидатора ядра, поэтому проходило молча.
    expect(compile(['tiF00']).css).toBe('');
  });

  // Раньше `ti1/2` давало `text-indent:1/2`, затем браковалось целиком; теперь это математика, как у `w`.
  test.each([
    [
      'ti1/2',
      '.ti1\\/2{text-indent:50%}',
    ],
    [
      'ti10-5',
      '.ti10-5{text-indent:calc(10px - 5px)}',
    ],
    [
      'ti100%-20px',
      '.ti100\\%-20px{text-indent:calc(100% - 20px)}',
    ],
    [
      'ti$v',
      '.ti\\$v{text-indent:var(--v)}',
    ],
    [
      'ti$a{10}',
      '.ti\\$a\\{10\\}{text-indent:var(--a, 10px)}',
    ],
    [
      'bsp2_$a*2',
      '.bsp2_\\$a\\*2{border-spacing:2px calc(var(--a) * 2)}',
    ],
  ])('%s — длина читается как математика: %s', (token, css) => {
    expect(compile([token])).toEqual(expect.objectContaining({
      css,
      warnings: [],
    }));
  });
});

describe('длины позиций и аргументов функций — математика', () => {
  test.each([
    [
      'op10+5_T',
      '.op10\\+5_T{object-position:calc(10px + 5px) top}',
    ],
    [
      'op$a*2_T',
      '.op\\$a\\*2_T{object-position:calc(var(--a) * 2) top}',
    ],
    [
      'opMin{10,5%}_T',
      '.opMin\\{10\\,5\\%\\}_T{object-position:min(10px, 5%) top}',
    ],
    [
      'tfo10+5_T',
      '.tfo10\\+5_T{transform-origin:calc(10px + 5px) top}',
    ],
    [
      'mkp10+5',
      '.mkp10\\+5{mask-position:calc(10px + 5px)}',
    ],
    [
      'ftBlur2+1',
      '.ftBlur2\\+1{filter:blur(calc(2px + 1px))}',
    ],
    [
      'ftBlur$a*2',
      '.ftBlur\\$a\\*2{filter:blur(calc(var(--a) * 2))}',
    ],
    [
      'ftBlur0',
      '.ftBlur0{filter:blur(0)}',
    ],
    [
      'ftDropShadow2_-3+1_4_F00',
      '.ftDropShadow2_-3\\+1_4_F00{filter:drop-shadow(2px calc(-3px + 1px) 4px #f00)}',
    ],
    [
      'cpthCircle50%_10+5_T',
      '.cpthCircle50\\%_10\\+5_T{clip-path:circle(50% at calc(10px + 5px) top)}',
    ],
    [
      'cpthInset10+5',
      '.cpthInset10\\+5{clip-path:inset(calc(10px + 5px))}',
    ],
  ])('%s → %s', (token, css) => {
    expect(compile([token])).toEqual(expect.objectContaining({
      css,
      warnings: [],
    }));
  });

  test.each([
    // `+` перед `+` — часть значения, а не сосед `+5`: раньше давало `.w10\\+\\+5++5{width:10px}` молча.
    [
      'w10++5',
      'Value "10++5" is invalid for "w": "+" after "10+" is not expected',
    ],
    [
      'w$a++$b',
      'Value "$a++$b" is invalid for "w": "+" after "$a+" is not expected',
    ],
    [
      'ftBlur-1',
      'Value "Blur-1" is invalid for "ft": "Blur" expects a length of zero or more — as "ftBlur2"',
    ],
    [
      'ftBlurZzz',
      'Value "BlurZzz" is invalid for "ft": "Blur" expects a length — as "ftBlur2"',
    ],
    [
      'ftBlur10%',
      'Value "10%" is invalid: this property takes a length, percent is not allowed',
    ],
    [
      'opZzz',
      'Value "Zzz" is invalid for "op": a part is a side letter, a length or a percent. Available: opL (left), opC'
      + ' (center), opR (right), opT (top), opB (bottom), opTL (top left), opTR (top right), opBL (bottom left), opBR'
      + ' (bottom right)',
    ],
  ])('%s — брак со своей подсказкой', (token, message) => {
    const out = compile([token]);
    expect([
      out.css,
      out.warnings.map((w) => w.message),
    ]).toEqual([
      '',
      [message],
    ]);
  });
});

describe('математика в буквенной записи — в скобках', () => {
  test.each([
    [
      'x{10+5}',
      'transform:translate(calc(10px + 5px),0px)',
    ],
    [
      'x{100%-20}y$a*2',
      'transform:translate(calc(100% - 20px),calc(var(--a) * 2))',
    ],
    [
      'x$a;y10',
      'transform:translate(var(--a),10px)',
    ],
    [
      'x$a*2;y3',
      'transform:translate(calc(var(--a) * 2),3px)',
    ],
    [
      'x10y{-$a}z{1+2}',
      'transform:translate(10px,calc(var(--a) * -1)) translateZ(calc(1px + 2px))',
    ],
    [
      'x{Min{10,5%}}y5',
      'transform:translate(min(10px, 5%),5px)',
    ],
    [
      'x{3*{1+2}}',
      'transform:translate(calc(3 * (1px + 2px)),0px)',
    ],
    [
      'x10y20z5',
      'transform:translate(10px,20px) translateZ(5px)',
    ],
    [
      'bxsh{10+5}x2',
      'box-shadow:2px 0px calc(10px + 5px) 0px #000',
    ],
    [
      'bxsh{10}',
      'box-shadow:0px 0px 10px 0px #000',
    ],
    [
      'bxsh10x{-$a}y4',
      'box-shadow:calc(var(--a) * -1) 4px 10px 0px #000',
    ],
    [
      'bxsh10x$a;y4',
      'box-shadow:var(--a) 4px 10px 0px #000',
    ],
    [
      'bxsh10x$a*2;y{1+1}r{2}',
      'box-shadow:calc(var(--a) * 2) calc(1px + 1px) 10px 2px #000',
    ],
    [
      'tsh{2+1}x1',
      'text-shadow:1px 0px calc(2px + 1px) #000',
    ],
  ])('%s → %s', (token, expected) => {
    // Буква следующего слота не кончает выражение без скобок (`bxsh10+5x2`: `x` — и слот, и продолжение), скобки —
    // кончают. Переменная — как есть, `;` закрывает имя перед буквой.
    const out = compile([token]);
    expect([
      out.css,
      out.warnings,
    ]).toEqual([
      expect.stringContaining(expected),
      [],
    ]);
  });

  test('единица записи тени не входит в скобки: у математики свои единицы', () => {
    // `em` у blur достаётся голым числам; `{1+2}` — значение читателя, его единица по умолчанию `px`.
    expect(compile(['bxsh10emx{1+2}']).css).toContain('box-shadow:calc(1px + 2px) 0em 10em 0em #000');
  });

  test.each([
    [
      'x10+5',
      'Value "10+5" is invalid for "x": math in a shift goes in braces, as "x{10+5}", "x10y{100%-20}"',
    ],
    [
      'x{10}%',
      '"x{10}%" puts "%" after math: write it inside, as "x{10%+5}"',
    ],
    [
      'x0z{5%}',
      'Value "5%" is invalid: this property takes a length, percent is not allowed',
    ],
    [
      'bxsh10+5x2',
      '"bxsh10+5x2" puts math without braces: a shadow slot holds it in braces, as "bxsh{10+5}x2", "bxsh10x{-$a}"',
    ],
    [
      'tsh10x2-3',
      '"tsh10x2-3" puts math without braces: a shadow slot holds it in braces, as "tsh{10+5}x2", "tsh10x{-$a}"',
    ],
    [
      'bxsh{-1}',
      'Value "-1" is invalid: negative value is not allowed for this property',
    ],
    [
      'bxsh10x{5%}',
      'Value "5%" is invalid: this property takes a length, percent is not allowed',
    ],
  ])('%s — брак со своей подсказкой', (token, message) => {
    const out = compile([token]);
    expect([
      out.css,
      out.warnings.map((w) => w.message),
    ]).toEqual([
      '',
      [message],
    ]);
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
    // Сырого режима у теней нет: мини-язык покрывает всё, что он
    // давал, а на списке теней он ломался — запятая уходила внутрь `var(…)`.
    expect(compile(['bxshB$blur']).css)
      .toContain('box-shadow:0px 0px var(--blur) 0px #000');
    expect(compile(['bxshB$blur;c$shadow']).css)
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

  test('число с двумя точками в сдвиге бракуется, а не обрезается до 1.2', () => {
    expect(compile([
      'x1.2.3',
      'x10y1.2.3',
    ]).css).toBe('');
  });

  test('пустая часть длины названа: голое имя и лишний "_"', () => {
    expect(compile([
      'f',
      'r10__20',
      'p10__5',
    ]).warnings.map((w) => w.message)).toEqual([
      '"f" needs a value',
      'Value "10__20" is invalid for "r": a part between "_" is empty',
      'Value "10__5" is invalid for "p": a part between "_" is empty',
    ]);
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
      'olo$v',
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
      'letter-spacing:.06em',
    ],
    [
      'lts-0.02em',
      'letter-spacing:-.02em',
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
      'lts$v',
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
      'font-size-adjust:.5',
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
    // Ветки `cssVarValue` у `olo` не было вовсе: `olo$v` давало
    // `outline-offset:0` — умолчание вместо подстановки.
    expect(compile(['olo$v']).css).toContain('outline-offset:var(--v)');
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

  // Читался только первый номер: `lts1-2` давало `1px`, `lh1.5+2` — `1.5`, хвост терялся молча.
  test.each([
    [
      'lts1-2',
      '.lts1-2{letter-spacing:calc(1px - 2px)}',
    ],
    [
      'lts$a*2',
      '.lts\\$a\\*2{letter-spacing:calc(var(--a) * 2)}',
    ],
    [
      'lh1.5+2',
      '.lh1\\.5\\+2{line-height:calc(1.5 + 2)}',
    ],
    [
      'lh1/2',
      '.lh1\\/2{line-height:50%}',
    ],
    [
      'olo2-1',
      '.olo2-1{outline-offset:calc(2px - 1px)}',
    ],
    [
      'tsa50+10',
      '.tsa50\\+10{text-size-adjust:calc(50% + 10%)}',
    ],
    [
      'fsa.5',
      '.fsa\\.5{font-size-adjust:.5}',
    ],
  ])('%s — значение читается целиком: %s', (token, css) => {
    expect(compile([token])).toEqual(expect.objectContaining({
      css,
      warnings: [],
    }));
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
    expect(compile(['wid$v']).css).toContain('widows:var(--v)');
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
    expect(compile(['fsa0.5']).css).toContain('font-size-adjust:.5');
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

describe('голое число у свойств-длин со словарём — px, как у прочих длин', () => {
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
    // Раньше эти записи давали CSS как есть, и браузер отбрасывал правило.
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
