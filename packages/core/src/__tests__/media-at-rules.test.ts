/**
 * `@supports` и `@container` в описании медиа (D-057), неизвестное имя медиа —
 * `unknownMediaMode` (D-058), признаки устройства в `presetMedias`.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import presetMedias from '../presets/medias';
import presetSynonyms from '../presets/synonyms';
import type {
  MnOptions, MnWarning,
} from '../core/types';

function compile(tokens: string, options: MnOptions = {}) {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    onWarning: (w) => warnings.push(w),
    ...options,
  });
  mn.setPresets([presetStandard, presetMedias]);
  mn.media.grid = {
    supports: '(display: grid)',
  };
  mn.media.side = {
    container: 'sidebar (width >= 448px)',
  };
  mn.getCompiler('class')(tokens);
  let error: unknown;
  try {
    mn.compile();
  } catch (ex) {
    error = ex;
  }
  return {
    css: mn.styles$.getValue().map((s) => s.content),
    warnings,
    error,
  };
}

describe('@supports и @container (D-057)', () => {
  test.each([
    ['m1@grid', ['@supports (display: grid){.m1\\@grid{margin:1px}}']],
    ['m1@side', ['@container sidebar (width >= 448px){.m1\\@side{margin:1px}}']],
    ['m1@dark&grid', ['@media (prefers-color-scheme: dark){@supports (display: grid){.m1\\@dark\\&grid{margin:1px}}}']],
    ['m1@grid&side', ['@supports (display: grid){@container sidebar (width >= 448px){.m1\\@grid\\&side{margin:1px}}}']],
    ['m1@grid,dark', ['@supports (display: grid){.m1\\@grid\\,dark{margin:1px}}', '@media (prefers-color-scheme: dark){.m1\\@grid\\,dark{margin:1px}}']],
  ])('%s', (token, css) => {
    expect(compile(token).css).toEqual(css);
  });

  test('часть выражения через запятую не затирает то же имя отдельно', () => {
    // До исправления `.safari` из `@safari,dark` и `@safari` писались под одним ключом.
    const {
      css,
    } = compile('m1@safari m4@safari,dark m1@grid m4@grid,dark');
    expect([...css].sort()).toEqual([
      '.safari .m1\\@safari{margin:1px}',
      '.safari .m4\\@safari\\,dark{margin:4px}',
      '@media (prefers-color-scheme: dark){.m4\\@grid\\,dark{margin:4px}}',
      '@media (prefers-color-scheme: dark){.m4\\@safari\\,dark{margin:4px}}',
      '@supports (display: grid){.m1\\@grid{margin:1px}}',
      '@supports (display: grid){.m4\\@grid\\,dark{margin:4px}}',
    ]);
  });
});

describe('unknownMediaMode (D-058)', () => {
  test("'warn' по умолчанию — CSS как написано и предупреждение", () => {
    const {
      css, warnings, error,
    } = compile('p10@zz');
    expect(css).toEqual(['@media zz{.p10\\@zz{padding:10px}}']);
    expect(warnings.map((w) => [w.type, w.message])).toEqual([['unknown-media', 'Media "@zz" is unknown — it goes to CSS as written: "@media zz". Describe it in mn.media; to hide'
        + ' this warning: unknownMediaMode: \'silent\'; to forbid such tokens: unknownMediaMode: \'strict\'.']]);
    expect(error).toBeUndefined();
  });

  test("'silent' — как написано, без предупреждения", () => {
    const {
      css, warnings,
    } = compile('p10@zz', {
      unknownMediaMode: 'silent',
    });
    expect(css).toEqual(['@media zz{.p10\\@zz{padding:10px}}']);
    expect(warnings).toEqual([]);
  });

  test("'strict' — брак сборки, правило не действует", () => {
    const {
      css, error,
    } = compile('p10@zz', {
      unknownMediaMode: 'strict',
    });
    expect(css).toEqual(['@media not all{.p10\\@zz{padding:10px}}']);
    expect((error as Error).name).toBe('MnForbiddenTokenError');
    expect((error as Error).message).toContain('Media "@zz" is unknown (unknownMediaMode: \'strict\')');
  });

  test('типы медиа CSS известны без описания', () => {
    const mn = minotationProvider({
      warningMode: 'silent',
      unknownMediaMode: 'strict',
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')('p1@print p2@screen p3@all');
    expect(() => mn.compile()).not.toThrow();
  });

  test('неверное значение опции — ошибка', () => {
    expect(() => minotationProvider({
      unknownMediaMode: 'warning' as never,
    })).toThrow('unknownMediaMode');
  });
});

describe('presetMedias — признаки устройства (D-057)', () => {
  test.each([
    ['light', '(prefers-color-scheme: light)'],
    ['portrait', '(orientation: portrait)'],
    ['motion-reduce', '(prefers-reduced-motion: reduce)'],
    ['contrast-more', '(prefers-contrast: more)'],
    ['forced-colors', '(forced-colors: active)'],
    ['pointer-coarse', '(pointer: coarse)'],
    ['any-pointer-fine', '(any-pointer: fine)'],
    ['noscript', '(scripting: none)'],
    ['print', 'print'],
  ])('@%s → %s', (name, query) => {
    const {
      css, warnings,
    } = compile('p10@' + name);
    expect(css).toEqual(['@media ' + query + '{.p10\\@' + name + '{padding:10px}}']);
    expect(warnings).toEqual([]);
  });
});

describe('mediaNesting (D-070)', () => {
  test.each([
    [
      'm1@dark&grid',
      false,
      ['@media (prefers-color-scheme: dark){@supports (display: grid){.m1\\@dark\\&grid{margin:1px}}}'],
    ],
    [
      'p1@m4&dark',
      true,
      ['@media (max-width: 479.98px){@media (prefers-color-scheme: dark){.p1\\@m4\\&dark{padding:1px}}}'],
    ],
    [
      'p1@m4&dark',
      false,
      ['@media (max-width: 479.98px) and (prefers-color-scheme: dark){.p1\\@m4\\&dark{padding:1px}}'],
    ],
    [
      'p1@mouse&hover',
      true,
      ['@media (pointer: fine) and (hover: hover){.p1\\@mouse\\&hover{padding:1px}}'],
    ],
    [
      'p1@m4&dark&grid',
      true,
      ['@media (max-width: 479.98px){@media (prefers-color-scheme: dark){@supports (display: grid){'
      + '.p1\\@m4\\&dark\\&grid{padding:1px}}}}'],
    ],
  ])('%s, mediaNesting: %s', (
    token, mediaNesting, css,
  ) => {
    expect(compile(token, {
      mediaNesting,
    }).css).toEqual(css);
  });

  test('неверное значение — ошибка', () => {
    expect(() => minotationProvider({
      mediaNesting: 'yes' as never,
    })).toThrow('option "mediaNesting" expects a boolean');
  });
});

describe('приоритет ^N (D-071)', () => {
  function styles(tokens: string) {
    const mn = minotationProvider({
      warningMode: 'silent',
    });
    mn.setPresets([
      presetStandard,
      presetSynonyms,
      presetMedias,
    ]);
    mn.getCompiler('class')(tokens);
    mn.compile();
    return mn.styles$.getValue().map((s) => [s.priority, s.content]);
  }

  test('@^5 — без медиа: правило без условия, свой блок с приоритетом', () => {
    expect(styles('cF00@^5')).toEqual([[5, '.cF00\\@\\^5{color:#f00}']]);
  });

  test(':h с приоритетом — медиа синонима встаёт перед ^N', () => {
    expect(styles('cF00:h@d^3')).toEqual([[3, '@media (max-width: 991.98px) and (hover: hover){.cF00\\:h\\@d\\^3:hover{color:#f00}}']]);
    expect(styles('cF00:h@^5')).toEqual([[5, '@media (hover: hover){.cF00\\:h\\@\\^5:hover{color:#f00}}']]);
  });
});
