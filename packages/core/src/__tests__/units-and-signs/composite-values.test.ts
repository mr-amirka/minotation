/**
 * Составные значения: части по слотам, списки, тени, переходы, сетка, фон и маска.
 *
 * Значения проверяются арбитром — `css-tree` с `mdn-data`, как и в остальных тестах папки.
 */
import {
  lexer,
} from 'css-tree';
import {
  compile,
} from './compile';

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

  // Функции — нативной формой (`cntAttr_href`): function-forms.test.ts.
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

  test('части функции плавности не путаются со слотами: за четырьмя числами — задержка', () => {
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
    // `tn--t`), и тень не исключение. Раньше переменная молча попадала
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
  // каждый свой фрагмент где угодно. Порядок закреплён: одно
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
    // Функции — нативной формой, без скобок.
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

// `border-image` — `presets/standard/__tests__/border-image.test.ts`: по частям, у каждой свой хендлер.

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
