/**
 * Режим `'property-value'` — запись Master CSS (D-045 этап 5, D-051): `свойство:значение`,
 * состояния, селекторы, группы, медиа со сравнениями. Режим не привязан к пресету: здесь —
 * стандартные хендлеры minotation.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import type {
  MnOptions, MnWarning,
} from '../core/types';
import {
  selectorsCompileProvider,
} from '../selectorsCompileProvider';

function compile(tokens: string, options: MnOptions = {}) {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    notationMode: 'property-value',
    childSelectorMode: 'silent',
    importantMode: 'silent',
    media: {
      md: {
        query: '(width >= 1024px)',
        priority: 3,
      },
      tablet: {
        query: 'screen',
        priority: 1,
      },
      sel: {
        selector: '.sel',
      },
    } as never,
    onWarning: (w) => warnings.push(w),
    ...options,
  });
  mn.setPresets([presetStandard]);
  mn.getCompiler('class')(tokens);
  let error: unknown;
  try {
    mn.compile();
  } catch (ex) {
    error = ex;
  }
  return {
    css: mn.styles$.getValue().map((s) => s.content).join(' '),
    warnings,
    error,
  };
}

describe("'property-value' — объявление", () => {
  test.each([
    ['p:10', '.p\\:10{padding:10px}'],
    ['c:F00', '.c\\:F00{color:#f00}'],
    ['dB', '.dB{display:block}'],
    ['p:10!', '.p\\:10\\!{padding:10px!important}'],
    ['dB!', '.dB\\!{display:block!important}'],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test('не хендлер вне группы — шорткат с состоянием: чужой класс, молча', () => {
    const {
      css, warnings, 
    } = compile('pad:10');
    expect(css).toBe('');
    expect(warnings).toEqual([]);
  });

  test('свойство без хендлера в группе — предупреждение', () => {
    const {
      css, warnings, 
    } = compile('{pad:10}');
    expect(css).toBe('');
    expect(warnings.map((w) => w.message)).toEqual(['Property "pad" has no handler: the class gives no CSS']);
  });

  test('кавычки в значении: двоеточие внутри не обрывает значение', () => {
    // Хендлер `cnt` стандартного пресета ждёт свою форму, но значение до него доходит целиком.
    expect(compile('cnt:"a:b"').warnings[0].arg).toBe('"a:b"');
  });

  test('точка в конце и висячее двоеточие — без падения разбора', () => {
    expect(() => compile('p:10. c:F00:')).not.toThrow();
  });
});

describe("'property-value' — состояния и псевдоэлементы", () => {
  test.each([
    ['c:F00:hover', '.c\\:F00\\:hover:hover{color:#f00}'],
    ['c:F00:first', '.c\\:F00\\:first:first-child{color:#f00}'],
    ['c:F00:last', '.c\\:F00\\:last:last-child{color:#f00}'],
    ['c:F00:odd', '.c\\:F00\\:odd:nth-child(odd){color:#f00}'],
    ['c:F00:even', '.c\\:F00\\:even:nth-child(even){color:#f00}'],
    ['c:F00:nth(2)', '.c\\:F00\\:nth\\(2\\):nth-child(2){color:#f00}'],
    ['c:F00::before', '.c\\:F00\\:\\:before::before{color:#f00}'],
    ['c:F00:after', '.c\\:F00\\:after::after{color:#f00}'],
    ['dB:hover', '.dB\\:hover:hover{display:block}'],
    ['c:F00!:hover', '.c\\:F00\\!\\:hover:hover{color:#f00!important}'],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test('незарегистрированное состояние — без предупреждения (запись оригинала)', () => {
    expect(compile('c:F00:focus-within').warnings).toEqual([]);
  });

  test('зарегистрированный синоним важнее сокращения оригинала', () => {
    const mn = minotationProvider({
      warningMode: 'silent',
      notationMode: 'property-value',
    });
    mn.setPresets([presetStandard]);
    mn.synonyms({
      first: ':first-of-type',
    });
    mn.getCompiler('class')('c:F00:first');
    mn.compile();
    expect(mn.styles$.getValue().map((s) => s.content).join('')).toContain(':first-of-type{color:#f00}');
  });
});

describe("'property-value' — селекторы", () => {
  test.each([
    ['p:10>li:hover', '.p\\:10\\>li\\:hover>li:hover{padding:10px}'],
    ['p:10_h1', '.p\\:10_h1 h1{padding:10px}'],
    ['c:F00:checked+span', '.c\\:F00\\:checked\\+span:checked+span{color:#f00}'],
    ['p:10~div', '.p\\:10\\~div~div{padding:10px}'],
    ['p:10[open]', '.p\\:10\\[open\\][open]{padding:10px}'],
    ['c:F00.active', '.c\\:F00\\.active.active{color:#f00}'],
    ['c:rgba(0,0,0,.5)', '.c\\:rgba\\(0\\,0\\,0\\,\\.5\\){color:rgba(0,0,0,.5)}'],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test('дочерний селектор — childSelectorMode (по умолчанию warn)', () => {
    const {
      warnings, 
    } = compile('p:10>li p:10_h1', {
      childSelectorMode: 'warn',
    });
    expect(warnings.map((w) => w.type)).toEqual(['child-selector', 'child-selector']);
  });

  test('childSelectorMode: strict — брак', () => {
    const {
      error, 
    } = compile('p:10>li', {
      childSelectorMode: 'strict',
    });
    expect((error as Error).name).toBe('MnForbiddenTokenError');
  });

  test('importantMode: strict — брак', () => {
    const {
      error, 
    } = compile('p:10!', {
      importantMode: 'strict',
    });
    expect((error as Error).name).toBe('MnForbiddenTokenError');
  });
});

describe("'property-value' — группы", () => {
  test('{a;b} с общим контекстом и медиа; фигурные скобки экранированы', () => {
    // Класс в селекторе: `{` `}` `:` `;` `>` `@` экранированы обратной косой.
    const cls = '.' + [
      '\\{p',
      ':10',
      ';m',
      ':5',
      '}',
      '>li',
      ':hover',
      '@md',
    ].join('\\');
    expect(compile('{p:10;m:5}>li:hover@md').css).toBe('@media (width >= 1024px){'
      + cls + '>li:hover{padding:10px}' + cls + '>li:hover{margin:5px}}');
  });

  test('незакрытая группа — предупреждение', () => {
    const {
      css, warnings, 
    } = compile('{p:10');
    expect(css).toBe('');
    expect(warnings[0].message).toBe('"{p:10": the group "{" is not closed. The class gives no CSS.');
  });
});

describe("'property-value' — медиа", () => {
  test.each([
    ['p:10@md', '@media (width >= 1024px){.p\\:10\\@md{padding:10px}}'],
    ['p:10@<md', '@media (width < 1024px){.p\\:10\\@\\<md{padding:10px}}'],
    ['p:10@<=md', '@media (width <= 1024px){.p\\:10\\@\\<\\=md{padding:10px}}'],
    ['p:10@>md', '@media (width > 1024px){.p\\:10\\@\\>md{padding:10px}}'],
    ['p:10@>=768', '@media (width >= 768px){.p\\:10\\@\\>\\=768{padding:10px}}'],
    ['p:10@768', '@media (width >= 768px){.p\\:10\\@768{padding:10px}}'],
    ['p:10@768&<1024', '@media (width >= 768px) and (width < 1024px){.p\\:10\\@768\\&\\<1024{padding:10px}}'],
    ['p:10@dark', '@media (prefers-color-scheme: dark){.p\\:10\\@dark{padding:10px}}'],
    ['p:10@light', '@media (prefers-color-scheme: light){.p\\:10\\@light{padding:10px}}'],
    ['p:10@print', '@media print{.p\\:10\\@print{padding:10px}}'],
    ['p:10@landscape', '@media (orientation: landscape){.p\\:10\\@landscape{padding:10px}}'],
    ['p:10@portrait', '@media (orientation: portrait){.p\\:10\\@portrait{padding:10px}}'],
    ['p:10@motion', '@media (prefers-reduced-motion: no-preference){.p\\:10\\@motion{padding:10px}}'],
    ['p:10@reduced-motion', '@media (prefers-reduced-motion: reduce){.p\\:10\\@reduced-motion{padding:10px}}'],
    ['p:10@media(any-hover:hover)', '@media (any-hover:hover){.p\\:10\\@media\\(any-hover\\:hover\\){padding:10px}}'],
    ['p:10@md&dark', '@media (width >= 1024px) and (prefers-color-scheme: dark){.p\\:10\\@md\\&dark{padding:10px}}'],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test.each([
    ['p:10@xx', '"p:10@xx": media "xx" is unknown. The class gives no CSS.'],
    ['p:10@<xx', '"p:10@<xx": media "xx" has no width to compare with. The class gives no CSS.'],
    ['p:10@<tablet', '"p:10@<tablet": media "tablet" has no width to compare with. The class gives no CSS.'],
    ['p:10@<sel', '"p:10@<sel": media "sel" has no width to compare with. The class gives no CSS.'],
  ])('%s — предупреждение', (token, message) => {
    const {
      css, warnings, 
    } = compile(token);
    expect(css).toBe('');
    expect(warnings[0].message).toBe(message);
  });
});

test("selectorsCompileProvider отдельно, 'property-value': медиа нет", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- экземпляр провайдера нетипизирован снаружи
  const instance: any = Object.assign(() => undefined, {
    options: {
      notationMode: 'property-value',
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- то же
  const scp: any = selectorsCompileProvider(instance);
  expect(() => scp.parseClass('p:10@md')).toThrow('media "md" is unknown');
});
