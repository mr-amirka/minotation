/**
 * `@supports` и `@container` в описании медиа (D-057), неизвестное имя медиа —
 * `unknownMediaMode` (D-058), признаки устройства в `presetMedias`.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import presetMedias from '../presets/medias';
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
