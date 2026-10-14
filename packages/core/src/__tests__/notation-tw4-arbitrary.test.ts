/**
 * Режим `'tw4-compatible'`: произвольные значения и варианты Tailwind (D-049, D-055) —
 * `[свойство:значение]`, `-[…]` в утилите, `[&…]:`, `data-*`, `aria-*`, `min-*`/`max-*`,
 * `has-[…]`, `not-[…]`, `nth-[…]`, `in-[…]`, `group-[…]`, `*:`, `**:`, `!` в конце.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import presetMedias from '../presets/medias';
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
    notationMode: 'tw4-compatible',
    childSelectorMode: 'silent',
    onWarning: (w) => warnings.push(w),
    ...options,
  });
  mn.setPresets([presetStandard, presetMedias]);
  mn.synonyms({
    hover: ':hover',
  });
  mn.variantPrefixedSynonyms({
    group: '.group',
    peer: '.peer~',
  });
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

describe('произвольное свойство [свойство:значение] (D-055)', () => {
  test.each([
    ['[mask-type:luminance]', '.\\[mask-type\\:luminance\\]{mask-type:luminance}'],
    ['[--brand:#f00]', '.\\[--brand\\:\\#f00\\]{--brand:#f00}'],
    ['[margin:1px_2px]', '.\\[margin\\:1px_2px\\]{margin:1px 2px}'],
    ['[content:a\\_b]', '.\\[content\\:a\\\\_b\\]{content:a_b}'],
    ['[mask-type:luminance]!', '.\\[mask-type\\:luminance\\]\\!{mask-type:luminance!important}'],
    ['hover:[mask-type:luminance]', '.hover\\:\\[mask-type\\:luminance\\]:hover{mask-type:luminance}'],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test.each([['[1bad:x]', 'Arbitrary property "[1bad:x]" expects "[property:value]"'], ['[a:_]', 'Arbitrary property "[a: ]" expects "[property:value]"']])('%s — предупреждение', (token, message) => {
    const {
      css, warnings,
    } = compile(token);
    expect(css).toBe('');
    expect(warnings.map((w) => w.message)).toEqual([message]);
  });

  test('утилита с -[…] доходит до хендлера целиком: стандартный w не понимает — предупреждение', () => {
    expect(compile('w-[37px]').warnings.map((w) => w.arg)).toEqual(['-[37px]']);
  });
});

describe('произвольные варианты и семейства', () => {
  test.each([
    ['[&>li]:cF00', '.\\[\\&\\>li\\]\\:cF00>li{color:#f00}'],
    ['[&_li]:cF00', '.\\[\\&_li\\]\\:cF00 li{color:#f00}'],
    ['[&:nth-child(3)]:cF00', '.\\[\\&\\:nth-child\\(3\\)\\]\\:cF00:nth-child(3){color:#f00}'],
    ['[.dark_&]:cF00', '.dark .\\[\\.dark_\\&\\]\\:cF00{color:#f00}'],
    ['[.a>&]:cF00', '.a>.\\[\\.a\\>\\&\\]\\:cF00{color:#f00}'],
    ['data-[state=open]:cF00', '.data-\\[state\\=open\\]\\:cF00[data-state=open]{color:#f00}'],
    ['data-active:cF00', '.data-active\\:cF00[data-active]{color:#f00}'],
    ['aria-[sort=ascending]:cF00', '.aria-\\[sort\\=ascending\\]\\:cF00[aria-sort=ascending]{color:#f00}'],
    ['aria-checked:cF00', '.aria-checked\\:cF00[aria-checked="true"]{color:#f00}'],
    ['data-[a]:hover:cF00', '.data-\\[a\\]\\:hover\\:cF00[data-a]:hover{color:#f00}'],
    ['has-[img]:cF00', '.has-\\[img\\]\\:cF00:has(img){color:#f00}'],
    ['not-[.x]:cF00', '.not-\\[\\.x\\]\\:cF00:not(.x){color:#f00}'],
    ['nth-[3n+1]:cF00', '.nth-\\[3n\\+1\\]\\:cF00:nth-child(3n+1){color:#f00}'],
    ['nth-last-[2]:cF00', '.nth-last-\\[2\\]\\:cF00:nth-last-child(2){color:#f00}'],
    ['in-[.card]:cF00', ':where(.card) .in-\\[\\.card\\]\\:cF00{color:#f00}'],
    ['group-[.open]:cF00', '.group.open .group-\\[\\.open\\]\\:cF00{color:#f00}'],
    ['peer-[.open]:cF00', '.peer.open~.peer-\\[\\.open\\]\\:cF00{color:#f00}'],
    ['*:cF00', '.\\*\\:cF00>*{color:#f00}'],
    ['**:cF00', '.\\*\\*\\:cF00 *{color:#f00}'],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test.each([
    ['min-[600px]:cF00', '@media (width >= 600px){.min-\\[600px\\]\\:cF00{color:#f00}}'],
    ['max-[600px]:cF00', '@media (width < 600px){.max-\\[600px\\]\\:cF00{color:#f00}}'],
    ['min-d:cF00', '@media (width >= 992px){.min-d\\:cF00{color:#f00}}'],
    ['max-m4:cF00', '@media (width < 480px){.max-m4\\:cF00{color:#f00}}'],
    // Голая точка — «от точки», как в Tailwind (D-060).
    ['d:cF00', '@media (width >= 992px){.d\\:cF00{color:#f00}}'],
    ['d:max-d2:cF00', '@media (width >= 992px) and (width < 1200px){.d\\:max-d2\\:cF00{color:#f00}}'],
    ['dark:cF00', '@media (prefers-color-scheme: dark){.dark\\:cF00{color:#f00}}'],
  ])('медиа: %s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test.each([['cF00!', '.cF00\\!{color:#f00!important}'], ['!cF00', '.\\!cF00{color:#f00!important}']])('важность в конце (v4) и в начале (v3): %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test.each([['[.x]:cF00', 'Variant "[.x]:" is not supported: an arbitrary variant needs "&" for the element'], ['max-zz:cF00', 'Variant "max-zz:" is unknown']])('%s — предупреждение', (token, message) => {
    const {
      css, warnings,
    } = compile(token);
    expect(css).toBe('');
    expect(warnings[0].message).toContain(message);
  });
});

describe('childSelectorMode — стили дочерних элементов', () => {
  test.each([
    ['*:cF00', '*'],
    ['**:cF00', '**'],
    ['[&>li]:cF00', '[&>li]'],
    ['[&_li]:cF00', '[&_li]'],
  ])('%s — предупреждение', (token, mark) => {
    const {
      css, warnings,
    } = compile(token, {
      childSelectorMode: 'warn',
    });
    expect(css).not.toBe('');
    expect(warnings.map((w) => w.type)).toEqual(['child-selector']);
    expect(warnings[0].message).toContain('("' + mark + '")');
  });

  test('[&:has(>a)] — скобки не считаются', () => {
    expect(compile('[&:has(>a)]:cF00', {
      childSelectorMode: 'warn',
    }).warnings).toEqual([]);
  });

  test('strict — брак', () => {
    expect((compile('*:cF00', {
      childSelectorMode: 'strict',
    }).error as Error).name).toBe('MnForbiddenTokenError');
  });
});

describe('пограничные случаи', () => {
  test('метка с комбинатором + и >: group-[…] берёт отношение из селектора метки', () => {
    const mn = minotationProvider({
      warningMode: 'silent',
      notationMode: 'tw4-compatible',
    });
    mn.setPresets([presetStandard]);
    mn.variantPrefixedSynonyms({
      next: '.a+',
      parent: '.b>',
    });
    mn.getCompiler('class')('next-[.x]:cF00 parent-[.y]:cF00');
    mn.compile();
    expect(mn.styles$.getValue().map((s) => s.content).join(' ')).toBe('.a.x+.next-\\[\\.x\\]\\:cF00,.b.y>.parent-\\[\\.y\\]\\:cF00{color:#f00}');
  });

  test('точка по высоте', () => {
    const mn = minotationProvider({
      warningMode: 'silent',
      notationMode: 'tw4-compatible',
    });
    mn.setPresets([presetStandard]);
    mn.media.tall = {
      height: 800,
    };
    mn.getCompiler('class')('tall:cF00 max-tall:c0F0');
    mn.compile();
    expect(mn.styles$.getValue().map((s) => s.content)).toEqual(['@media (height >= 800px){.tall\\:cF00{color:#f00}}', '@media (height < 800px){.max-tall\\:c0F0{color:#0f0}}']);
  });

  test('max-{медиа без width} — неизвестный вариант', () => {
    const {
      css, warnings,
    } = compile('max-mouse:cF00');
    expect(css).toBe('');
    expect(warnings[0].message).toContain('Variant "max-mouse:" is unknown');
  });

  test('selectorsCompileProvider отдельно: без mn.media и меток', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- экземпляр провайдера нетипизирован снаружи
    const instance: any = Object.assign(() => undefined, {
      options: {
        notationMode: 'tw4-compatible',
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- то же
    const scp: any = selectorsCompileProvider(instance);
    expect(scp.parseClass('min-[1px]:cF00')[0][1]).toEqual({
      '.min-\\[1px\\]\\:cF00': '(width >= 1px)',
    });
    expect(() => scp.parseClass('group-[.x]:cF00')).toThrow('Variant "group-[.x]:" is unknown');
    expect(() => scp.parseClass('min-d:cF00')).toThrow('Variant "min-d:" is unknown');
  });
});

describe('at-правила: @supports, @container (D-057)', () => {
  test.each([
    ['supports-[display:grid]:cF00', '@supports (display:grid){.supports-\\[display\\:grid\\]\\:cF00{color:#f00}}'],
    ['supports-[not_(display:grid)]:cF00', '@supports not (display:grid){.supports-\\[not_\\(display\\:grid\\)\\]\\:cF00{color:#f00}}'],
    ['[@supports(display:grid)]:cF00', '@supports (display:grid){.\\[\\@supports\\(display\\:grid\\)\\]\\:cF00{color:#f00}}'],
    ['[@media(any-hover:hover)]:cF00', '@media (any-hover:hover){.\\[\\@media\\(any-hover\\:hover\\)\\]\\:cF00{color:#f00}}'],
    ['[@container_(width>=20rem)]:cF00', '@container (width>=20rem){.\\[\\@container_\\(width\\>\\=20rem\\)\\]\\:cF00{color:#f00}}'],
    ['@min-[400px]:cF00', '@container (width >= 400px){.\\@min-\\[400px\\]\\:cF00{color:#f00}}'],
    ['@max-[400px]:cF00', '@container (width < 400px){.\\@max-\\[400px\\]\\:cF00{color:#f00}}'],
    ['@d:cF00', '@container (width >= 992px){.\\@d\\:cF00{color:#f00}}'],
    ['@d/sidebar:cF00', '@container sidebar (width >= 992px){.\\@d\\/sidebar\\:cF00{color:#f00}}'],
    ['dark:supports-[display:grid]:cF00', '@media (prefers-color-scheme: dark){@supports (display:grid){'
      + '.dark\\:supports-\\[display\\:grid\\]\\:cF00{color:#f00}}}'],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test.each([
    ['[@layer_x]:cF00', 'Variant "[@layer_x]:" is not supported: only @media, @supports and @container exist in the output'],
    ['@zz:cF00', 'Variant "@zz:" is unknown'],
    ['@mouse:cF00', 'Variant "@mouse:" is unknown'],
  ])('%s — предупреждение', (token, message) => {
    const {
      css, warnings,
    } = compile(token);
    expect(css).toBe('');
    expect(warnings[0].message).toContain(message);
  });

  test('selectorsCompileProvider отдельно: без mn.media', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- экземпляр провайдера нетипизирован снаружи
    const instance: any = Object.assign(() => undefined, {
      options: {
        notationMode: 'tw4-compatible',
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- то же
    const scp: any = selectorsCompileProvider(instance);
    expect(scp.parseClass('supports-[a:b]:cF00')[0][1]).toEqual({
      '.supports-\\[a\\:b\\]\\:cF00': '@supports (a:b)',
    });
    expect(() => scp.parseClass('@d:cF00')).toThrow('Variant "@d:" is unknown');
    expect(scp.parseClass('[@media_print]:cF00')[0][1]).toEqual({
      '.\\[\\@media_print\\]\\:cF00': 'print',
    });
  });
});

describe('переменная CSS --имя=значение в записи Tailwind', () => {
  test('ведущий -- — не минус: переменная, как в записи minotation', () => {
    const {
      css, warnings,
    } = compile('--gap=4px --c=oklch\\(62%_0.2_259\\)');
    expect(css).toBe('.--gap\\=4px{--gap:4px}.--c\\=oklch\\\\\\(62\\%_0\\.2_259\\\\\\){--c:oklch(62% 0.2 259)}');
    expect(warnings).toEqual([]);
  });
});
