/**
 * `mn.css` (D-071): правило для любого селектора; селектор — элемент и контекст в записи классов,
 * приоритет и блок — `^N`, объявления одного селектора — одним правилом. Тот же разбор селектора —
 * у `mn.assign`.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import presetSynonyms from '../presets/synonyms';
import presetMedias from '../presets/medias';
import type {
  MnWarning,
} from '../core/types';
import type {
  MnInstance,
} from '../types';

function create() {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    onWarning: (w) => warnings.push(w),
  });
  mn.setPresets([
    presetStandard,
    presetSynonyms,
    presetMedias,
  ]);
  return {
    mn,
    warnings,
    styles: () => mn.styles$.getValue().map((s) => [s.priority, s.content]),
  };
}

describe('mn.css', () => {
  test('объявления одного селектора — одним правилом, значения как есть', () => {
    const {
      mn, styles,
    } = create();
    mn.css(':root', {
      '--spacing': '0.25rem',
    });
    mn.css(':root', {
      '--c': 'oklch(62.3% 0.214 259.815)',
      marginTop: 0,
    });
    mn.compile();
    expect(styles()).toEqual([[-2000, ':root{--spacing:0.25rem;--c:oklch(62.3% 0.214 259.815);margin-top:0}']]);
  });

  test('селектор в записи классов: группа, синоним, медиа, приоритет ^N — свой блок', () => {
    const {
      mn, styles,
    } = create();
    mn.css('.selector(:h|.active)@d^3', {
      '--some-color': '#F00',
    });
    mn.css(':root@^-3000', {
      '--a': '1',
    });
    mn.compile();
    expect(styles()).toEqual([
      [-3000, ':root{--a:1}'],
      [3, '@media (max-width: 991.98px) and (hover: hover){.selector:hover{--some-color:#F00}}'],
      [3, '@media (max-width: 991.98px){.selector.active{--some-color:#F00}}'],
    ]);
  });

  test('форма-карта; html, ::selection — то, до чего класс не дотянуться', () => {
    const {
      mn, styles,
    } = create();
    mn.css({
      html: {
        scrollbarGutter: 'stable',
      },
      '::selection': {
        background: 'yellow',
      },
    });
    mn.compile();
    expect(styles()).toEqual([[-2000, 'html{scrollbar-gutter:stable}::selection{background:yellow}']]);
  });

  test('из хендлера при компиляции и после неё — правило обновляется, и после recompile тоже', () => {
    const {
      mn, styles,
    } = create();
    (mn as MnInstance)(
      'lazy', () => {
        mn.css(':root', {
          '--lazy': '1px',
        });
        return {
          style: {
            margin: 'var(--lazy)',
          },
        };
      }, '', 1,
    );
    mn.getCompiler('class')('lazy');
    mn.compile();
    expect(styles()).toEqual([[-2000, ':root{--lazy:1px}.lazy{margin:var(--lazy)}']]);
    mn.css(':root', {
      '--late': '2px',
    });
    mn.compile();
    expect(styles()).toEqual([[-2000, '.lazy{margin:var(--lazy)}:root{--lazy:1px;--late:2px}']]);
    mn.recompile();
    expect(styles()[0][1]).toContain(':root{--lazy:1px;--late:2px}');
  });

  test.each([
    [[''], 'mn.css: the selector expects a non-empty string, got string ""'],
    [['.x', 'color:red'], 'mn.css: declarations of ".x" expect an object of strings or numbers, got string "color:red"'],
    [['.x', {
      color: {},
    }], 'mn.css: declarations of ".x" expect an object of strings or numbers, got object'],
  ])('%j — ошибка', (args, message) => {
    const {
      mn,
    } = create();
    expect(() => (mn.css as (...a: unknown[]) => unknown)(...args)).toThrow(message);
  });
});

describe('mn.assign: тот же разбор селектора (D-071)', () => {
  test.each([
    [
      '.x:h@d',
      'cF00',
      '@media (max-width: 991.98px) and (hover: hover){.x:hover{color:#f00}}',
    ],
    [
      ':root@dark',
      'cF00',
      '@media (prefers-color-scheme: dark){:root{color:#f00}}',
    ],
    [
      'html:has[dialog[open]]',
      'cF00',
      'html:has(dialog[open]){color:#f00}',
    ],
    // `>` в селекторе — ребёнок, как в CSS (в записи классов `>` — потомок).
    [
      '.menu<.page>li',
      'cF00',
      '.page .menu>li{color:#f00}',
    ],
    [
      '.btn@dark',
      'cF00@m4',
      '@media (max-width: 479.98px) and (prefers-color-scheme: dark){.btn{color:#f00}}',
    ],
    [
      '[type=(button|reset)]',
      'p10',
      '[type=button],[type=reset]{padding:10px}',
    ],
    [
      '(button|a)::-moz-focus-inner',
      'p10',
      'button::-moz-focus-inner,a::-moz-focus-inner{padding:10px}',
    ],
  ])('%s + %s → %s', (
    selector, tokens, css,
  ) => {
    const {
      mn, styles, warnings,
    } = create();
    mn.assign(selector, tokens);
    mn.compile();
    expect(styles().map((s) => s[1]).join('')).toBe(css);
    expect(warnings).toEqual([]);
  });

  test('запятая — независимые селекторы; общий контекст — группой', () => {
    const {
      mn, styles,
    } = create();
    mn.assign('h1, h2@d', 'cF00');
    mn.assign('(h3|h4)@d', 'c0F0');
    mn.compile();
    expect(styles().map((s) => s[1]).join('')).toBe('h1{color:#f00}@media (max-width: 991.98px){h2{color:#f00}'
      + 'h3,h4{color:#0f0}}');
  });
});

describe('псевдоэлемент после :: — без синонимов', () => {
  test('синоним before не превращает ::before в :::before', () => {
    const {
      mn, styles,
    } = create();
    mn.synonyms({
      before: '::before',
    });
    mn.css('::before', {
      content: '""',
    });
    mn.getCompiler('class')('cF00::before cF00:before');
    mn.compile();
    expect(styles().map((s) => s[1]).join('')).toBe('::before{content:""}.cF00\\:\\:before::before,'
      + '.cF00\\:before::before{color:#f00}');
  });
});

describe('селектор: кавычки, экранирование, приоритет токена и селектора', () => {
  test.each([
    [
      'a[href^="http:"]',
      'cF00',
      'a[href^="http:"]{color:#f00}',
    ],
    [
      '[data-x="a,b"]',
      'cF00',
      '[data-x="a,b"]{color:#f00}',
    ],
    [
      '.a\\:b',
      'cF00',
      '.a\\:b{color:#f00}',
    ],
  ])('%s — двоеточие, запятая, скобка в кавычках и экранированное — часть элемента', (
    selector, tokens, css,
  ) => {
    const {
      mn, styles,
    } = create();
    mn.assign(selector, tokens);
    mn.compile();
    expect(styles().map((s) => s[1]).join('')).toBe(css);
  });

  test.each([
    [
      '.x@d^3',
      'cF00@m4',
      3,
    ],
    [
      '.x@d',
      'cF00@m4^2',
      2,
    ],
    [
      '.x@d^3',
      'cF00@m4^2',
      2,
    ],
  ])('%s + %s — приоритет в конце, у токена — важнее', (
    selector, tokens, priority,
  ) => {
    const {
      mn, styles,
    } = create();
    mn.assign(selector, tokens);
    mn.compile();
    expect(styles()).toEqual([[priority, '@media (max-width: 479.98px) and (max-width: 991.98px){'
      + '.x{color:#f00}}']]);
  });

  test('скобка в кавычках значения атрибута — как и прежде, её нужно экранировать', () => {
    const {
      mn, styles,
    } = create();
    expect(() => mn.assign("[data-x='a(b']", 'cF00')).toThrow('Escape it');
    mn.assign("[data-x='a\\(b']", 'cF00');
    mn.compile();
    // В строке CSS обратная косая экранирует любой символ: `'a\\(b'` и `'a(b'` — одно значение.
    expect(styles().map((s) => s[1]).join('')).toBe("[data-x='a\\(b']{color:#f00}");
  });

  test('пустой вариант в синониме — ошибка при регистрации', () => {
    const {
      mn,
    } = create();
    expect(() => mn.synonyms('bad', '(h1|)')).toThrow('Empty selector among the variants of "(h1|)"');
  });

  test('пустой вариант в селекторе assign — ошибка при регистрации', () => {
    const {
      mn,
    } = create();
    expect(() => mn.assign('(h1|)', 'cF00')).toThrow('Empty selector among the variants of "(h1|)"');
  });
});

describe('медиа где угодно в селекторе, комбинаторы CSS (D-071)', () => {
  test.each([
    ['.class1, class2(:h|.active)@m .child', [
      [-2000, '.class1{color:#f00}'],
      [-992, '@media (max-width: 991.98px) and (hover: hover){class2:hover .child{color:#f00}}'],
      [-992, '@media (max-width: 991.98px){class2.active .child{color:#f00}}'],
    ]],
    ['.a@m^3>.b', [[3, '@media (max-width: 991.98px){.a>.b{color:#f00}}']]],
    ['.a@m .b@dark', [[-992, '@media (max-width: 991.98px) and (prefers-color-scheme: dark){.a .b{color:#f00}}']]],
    ['.a:h>.b', [[1, '@media (hover: hover){.a:hover>.b{color:#f00}}']]],
    ['.a > .b + .c ~ .d', [[-2000, '.a>.b+.c~.d{color:#f00}']]],
    ['a[href="x@y"]@m', [[-992, '@media (max-width: 991.98px){a[href="x@y"]{color:#f00}}']]],
  ])('%s', (selector, expected) => {
    const {
      mn, styles, warnings,
    } = create();
    mn.assign(selector, 'cF00');
    mn.compile();
    expect(styles()).toEqual(expected);
    expect(warnings).toEqual([]);
  });
});

describe('селектор: экранированный @ и приоритет из синонима', () => {
  test('экранированный @ — часть имени класса, а не медиа', () => {
    const {
      mn, styles,
    } = create();
    mn.assign('.a\\@b@m', 'cF00');
    mn.compile();
    expect(styles()).toEqual([[-992, '@media (max-width: 991.98px){.a\\@b{color:#f00}}']]);
  });

  test('приоритет из синонима — в конце, после медиа селектора', () => {
    const {
      mn, styles,
    } = create();
    mn.synonyms({
      hp: ':hover@hover^5',
    });
    mn.assign('.x:hp@m', 'cF00');
    mn.compile();
    expect(styles()).toEqual([[5, '@media (max-width: 991.98px) and (hover: hover){.x:hover{color:#f00}}']]);
  });
});

describe('> и < внутри скобок — аргумент псевдокласса, а не сегмент записи', () => {
  test.each([
    ['cF00:has[>a]', '.cF00\\:has\\[\\>a\\]:has(>a){color:#f00}'],
    ['cF00<.p:has[>i]', '.p:has(>i) .cF00\\<\\.p\\:has\\[\\>i\\]{color:#f00}'],
    ['cF00:not[a<b]', '.cF00\\:not\\[a\\<b\\]:not(a<b){color:#f00}'],
  ])('класс %s → %s', (token, css) => {
    const {
      mn, styles, warnings,
    } = create();
    mn.getCompiler('class')(token);
    mn.compile();
    expect(styles().map((s) => s[1]).join('')).toBe(css);
    expect(warnings.filter((w) => w.type === 'child-selector')).toEqual([]);
  });

  test('селектор html:has[>a]', () => {
    const {
      mn, styles,
    } = create();
    mn.assign('html:has[>a]', 'cF00');
    mn.compile();
    expect(styles().map((s) => s[1]).join('')).toBe('html:has(>a){color:#f00}');
  });
});
