/**
 * Точки медиа `width`/`height` (D-054): `@имя` — до точки, `@имя-` — от точки, `@a-b` — между.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import presetMedias from '../presets/medias';
import type {
  MnWarning,
} from '../core/types';

function compile(token: string, media?: Record<string, unknown>) {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    onWarning: (w) => warnings.push(w),
    ...(media ? {
      media: media as never,
    } : {}),
  });
  mn.setPresets(media ? [presetStandard] : [presetStandard, presetMedias]);
  mn.getCompiler('class')(token);
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s) => s.content).join(' '),
    warnings,
  };
}

describe('presetMedias — точки (примеры владельца)', () => {
  test.each([
    ['p10@d', '@media (max-width: 991.98px){.p10\\@d{padding:10px}}'],
    ['p10@d-', '@media (min-width: 992px){.p10\\@d-{padding:10px}}'],
    ['p10@m4-d', '@media (min-width: 480px) and (max-width: 991.98px){.p10\\@m4-d{padding:10px}}'],
    ['p10@m4', '@media (max-width: 479.98px){.p10\\@m4{padding:10px}}'],
    ['p10@d-d2', '@media (min-width: 992px) and (max-width: 1199.98px){.p10\\@d-d2{padding:10px}}'],
    ['p10@480-d', '@media (min-width: 480px) and (max-width: 991.98px){.p10\\@480-d{padding:10px}}'],
    ['p10@m4-1000', '@media (min-width: 480px) and (max-width: 1000px){.p10\\@m4-1000{padding:10px}}'],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test('числовые шаблоны — как раньше', () => {
    expect(compile('p10@768').css).toBe('@media (max-width: 768px){.p10\\@768{padding:10px}}');
    expect(compile('p10@768-992').css).toBe('@media (min-width: 768px) and (max-width: 992px){.p10\\@768-992{padding:10px}}');
  });

  test('готовых диапазонов больше нет: m4- — это «от точки m4»', () => {
    expect(compile('p10@m4-').css).toBe('@media (min-width: 480px){.p10\\@m4-{padding:10px}}');
  });
});

describe('точки по высоте и ошибки', () => {
  const media = {
    t: {
      height: 600,
    },
    w: {
      width: 480,
    },
    bad: {
      width: 1,
      query: '(x)',
    },
  };

  test('высота: до, от', () => {
    expect(compile('p10@t', media).css).toBe('@media (max-height: 599.98px){.p10\\@t{padding:10px}}');
    expect(compile('p10@t-', media).css).toBe('@media (min-height: 600px){.p10\\@t-{padding:10px}}');
  });

  test('ширина и высота в одном диапазоне — предупреждение, правило не действует', () => {
    const {
      css, warnings, 
    } = compile('p10@w-t', media);
    expect(css).toBe('@media not all{.p10\\@w-t{padding:10px}}');
    expect(warnings.map((w) => w.message)).toEqual(['Media "@w-t" mixes width and height']);
  });

  test('query вместе с точкой — предупреждение, берётся query', () => {
    const {
      css, warnings, 
    } = compile('p10@bad', media);
    expect(css).toBe('@media (x){.p10\\@bad{padding:10px}}');
    expect(warnings[0].message).toBe('Media "@bad" has both "query" and "width"/"height" — "query" is used');
  });

  test('не точка и не диапазон — неизвестное имя: как написано и предупреждение (unknownMediaMode, D-058)', () => {
    const result = compile('p10@zz-', media);
    expect(compile('p10@w-xyz', media).css).toBe('@media w-xyz{.p10\\@w-xyz{padding:10px}}');
    expect(result.css).toBe('@media zz-{.p10\\@zz-{padding:10px}}');
    expect(result.warnings.map((w) => w.type)).toEqual(['unknown-media']);
  });
});

describe('точка с единицей (D-069)', () => {
  const media = {
    md: {
      width: '48rem',
    },
    lg: {
      width: '64rem',
    },
    em: {
      height: '30em',
    },
    px: {
      width: '600px',
    },
    bad: {
      width: '48 rem',
    },
  };

  test.each([
    ['p10@md', '@media (width < 48rem){.p10\\@md{padding:10px}}'],
    ['p10@md-', '@media (min-width: 48rem){.p10\\@md-{padding:10px}}'],
    ['p10@md-lg', '@media (min-width: 48rem) and (width < 64rem){.p10\\@md-lg{padding:10px}}'],
    ['p10@480-md', '@media (min-width: 480px) and (width < 48rem){.p10\\@480-md{padding:10px}}'],
    ['p10@md-1200', '@media (min-width: 48rem) and (max-width: 1200px){.p10\\@md-1200{padding:10px}}'],
    ['p10@em', '@media (height < 30em){.p10\\@em{padding:10px}}'],
    ['p10@px', '@media (max-width: 599.98px){.p10\\@px{padding:10px}}'],
  ])('%s → %s', (token, css) => {
    expect(compile(token, media).css).toBe(css);
  });

  test('неверная точка — предупреждение', () => {
    expect(compile('p10@bad', media).warnings[0].message)
      .toBe('Media "@bad" has an invalid point "48 rem": expected a number (px) or a string with px, rem or em');
  });
});
