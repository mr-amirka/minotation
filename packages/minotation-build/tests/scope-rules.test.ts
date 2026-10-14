/**
 * Опция `scopes` — правила для пакетов и путей со стороны потребителя (D-080…D-082).
 */
import {
  mkdirSync, mkdtempSync, rmSync, writeFileSync,
} from 'node:fs';
import {
  join,
} from 'node:path';
import {
  tmpdir,
} from 'node:os';
import {
  checkBuildOptions, clearPackageDirectiveCache, createScopeResolver, createTokenCollector, globToRegExp, isScopeRules,
  readPackageName,
} from '../src/index';
import type {
  MnPreset,
} from '../src/index';
import {
  presetMedias, presetStandard, presetSynonyms, presetTw4,
} from 'minotation';

let dir: string;
const cwd = process.cwd();
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mn-scope-rules-'));
  clearPackageDirectiveCache();
  mkdirSync(join(
    dir, 'node_modules', '@acme', 'ui',
  ), {
    recursive: true,
  });
  writeFileSync(join(
    dir, 'node_modules', '@acme', 'ui', 'package.json',
  ), JSON.stringify({
    name: '@acme/ui',
  }));
  mkdirSync(join(
    dir, 'src', 'legacy',
  ), {
    recursive: true,
  });
  process.chdir(dir);
});
afterEach(() => {
  process.chdir(cwd);
  rmSync(dir, {
    recursive: true,
    force: true,
  });
});

describe('globToRegExp', () => {
  test.each([
    [
      'src/legacy',
      'src/legacy/a.tsx',
      true,
    ],
    [
      './src/legacy/',
      'src/legacy',
      true,
    ],
    [
      'src/legacy',
      'src/legacyx/a.tsx',
      false,
    ],
    [
      'src/**/*.tw.tsx',
      'src/a/b/c.tw.tsx',
      true,
    ],
    [
      'src/**/*.tw.tsx',
      'src/c.tw.tsx',
      true,
    ],
    [
      'src/*.tsx',
      'src/a/b.tsx',
      false,
    ],
    [
      'src/?.tsx',
      'src/a.tsx',
      true,
    ],
    [
      'src/*.{ts,tsx}',
      'src/a.ts',
      true,
    ],
    [
      'src/**',
      'src/a/b/c',
      true,
    ],
  ])('%s ~ %s → %p', (
    pattern, path, expected,
  ) => {
    expect(globToRegExp(pattern).test(path)).toBe(expected);
  });
});

describe('createScopeResolver', () => {
  test('строка без `./` и шаблона — имя пакета, а не путь', () => {
    expect(createScopeResolver([{
      match: 'src',
      notationMode: 'tw4-compatible',
    }], dir)(join(
      dir, 'src', 'App.tsx',
    ), undefined)).toBeUndefined();
  });

  test('имя пакета, шаблон пути, RegExp, массив; первое подходящее правило', () => {
    const resolve = createScopeResolver([
      {
        match: '@acme/ui',
        notationMode: 'tw4-compatible',
      },
      {
        match: ['src/legacy/**', /\.tw\.tsx$/g],
        notationMode: 'breakpoint-prefixed',
      },
      {
        match: 'src/**',
        notationMode: 'property-value',
      },
    ], dir);
    expect(resolve(join(
      dir, 'node_modules', '@acme', 'ui', 'Button.tsx',
    ), undefined)).toEqual({
      notationMode: 'tw4-compatible',
    });
    expect(resolve(join(
      dir, 'src', 'legacy', 'Old.tsx',
    ), undefined)?.notationMode).toBe('breakpoint-prefixed');
    expect(resolve(join(
      dir, 'src', 'a.tw.tsx',
    ), undefined)?.notationMode).toBe('breakpoint-prefixed');
    expect(resolve(join(
      dir, 'src', 'a.tw.tsx',
    ), undefined)?.notationMode).toBe('breakpoint-prefixed');
    expect(resolve(join(
      dir, 'src', 'App.tsx',
    ), undefined)?.notationMode).toBe('property-value');
    expect(resolve(join(
      dir, 'other', 'x.tsx',
    ), undefined)).toBeUndefined();
    expect(resolve('virtual:x', undefined)).toBeUndefined();
  });

  test('своя декларация важнее правила; override — аварийно наоборот; пробелы заполняются', () => {
    const own = {
      notationMode: 'context-qualified' as const,
    };
    const file = join(
      dir, 'src', 'App.tsx',
    );
    expect(createScopeResolver([{
      match: './src',
      notationMode: 'tw4-compatible',
      requires: ['presetTw4'],
    }], dir)(file, own)).toEqual({
      notationMode: 'context-qualified',
      requires: ['presetTw4'],
    });
    expect(createScopeResolver([{
      match: './src',
      notationMode: 'tw4-compatible',
      override: true,
    }], dir)(file, own)).toEqual({
      notationMode: 'tw4-compatible',
    });
  });

  test('без правил — декларация как есть', () => {
    const own = {
      requires: ['presetTw4'],
    };
    expect(createScopeResolver(undefined, dir)('/x.tsx', own)).toBe(own);
  });
});

describe('scopes — проверка опции', () => {
  test.each([
    [{
      scopes: {},
    }, 'option "scopes" expects an array of scope rules'],
    [{
      scopes: ['@acme/ui'],
    }, 'option "scopes[0]" expects an object with "match"'],
    [{
      scopes: [{
        notationMode: 'tw4-compatible',
      }],
    }, 'option "scopes[0]" needs "match"'],
    [{
      scopes: [{
        match: 5,
      }],
    }, 'expects a package name, a path pattern, a RegExp or an array of them'],
    [{
      scopes: [{
        match: [],
      }],
    }, 'expects a package name, a path pattern, a RegExp or an array of them'],
    [{
      scopes: [{
        match: 'a',
        attrs: 'class',
      }],
    }, 'unknown option "scopes[0].attrs". Known options: notationMode, requires, groupMode, contextWhere, warningMode, specificityMode, importantMode,'
      + ' maxDepthMode, childSelectorMode, unknownMediaMode, suspectClassMode, groupSuspectMode, match, override'],
  ])('%j', (options, message) => {
    expect(() => checkBuildOptions(options as never, 'mnVite')).toThrow(message);
  });

  test('проверка доступна и отдельно; пакет с битым или пустым package.json — без имени', () => {
    expect(isScopeRules(
      [], 'x', 'scopes',
    )).toBeUndefined();
    mkdirSync(join(dir, 'nil'));
    writeFileSync(join(
      dir, 'nil', 'package.json',
    ), 'null');
    expect(readPackageName(join(
      dir, 'nil', 'a.tsx',
    ))).toBeUndefined();
  });

  test('допустимые правила', () => {
    expect(() => checkBuildOptions({
      scopes: [{
        match: ['@acme/ui', /x/],
        override: true,
        requires: ['presetTw4'],
        notationMode: 'tw4-compatible',
      }],
    }, 'mnVite')).not.toThrow();
  });
});

describe('scopes в сборке: пакет без декларации на Tailwind', () => {
  test('правило даёт пакету семейство и режим — своя область', () => {
    const collector = createTokenCollector({
      attrs: 'class',
      presets: [
        presetStandard,
        presetSynonyms,
        presetMedias,
      ] as MnPreset[],
      scopePresets: [presetTw4],
      scopes: [{
        match: '@acme/ui',
        requires: ['presetTw4'],
        notationMode: 'tw4-compatible',
      }],
    });
    collector.add(join(
      dir, 'src', 'App.html',
    ), '<div class="p10">');
    collector.add(join(
      dir, 'node_modules', '@acme', 'ui', 'Button.html',
    ), '<b class="p-4 hover:flex">');
    const css = collector.css();
    expect(css).toContain('.p10{padding:10px}');
    expect(css).toContain('.p-4{padding:calc(var(--spacing) * 4)}');
    expect(css).toContain('.hover\\:flex:hover{display:flex}');
  });
});
