/**
 * Слова свойств: закрытые перечни, буквы вместо полных слов, сырой режим, картинки одной записью.
 *
 * Значения проверяются арбитром — `css-tree` с `mdn-data`: тест ловит и слово, которое нотация зря пропускает
 * в CSS, и слово, которое она зря бракует.
 */
import {
  lexer,
} from 'css-tree';
import {
  compile,
} from './compile';

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
    // Буква — в каждой части; полные слова (`tems_filled_dot`) бракуются.
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
    // слово точно, а длинную форму разбор всё равно узнаёт, чтобы подсказать букву.
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
    // перешли из v1 и убраны: свойства, которое они задавали, в CSS нет.
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

describe('свойства-картинки: одна запись на значение', () => {
  // `bgi`, `lisi`, `mk` (`mki` слит в `mk`): путь — только `_`-формой, переменная — `--x`, `none` — `N`, CSS-wide keyword — словом. Раньше
  // обёртка в `url()` применялась ко всему, что не узнано: `bgiF00-00F` → `url("F00-00F")`, `bgi10px` →
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
      '"mki_a\\.png" was renamed: write "mk_a\\.png".',
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
  // части (`dI_FR`), а полные слова бракуются с подсказкой.
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
  ])('%s бракуется — полные слова, есть "%s"', (token, short) => {
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
