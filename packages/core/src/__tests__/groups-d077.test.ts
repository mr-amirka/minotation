/**
 * Круглые скобки в записи (D-077): аргумент функционального псевдокласса, `groupSuspectMode`,
 * `groupMode: 'css'`.
 */
import minotationProvider from '../core/index';
import {
  parseSettingsKey,
} from '../index';
import presetStandard from '../presets/standard';
import presetSynonyms from '../presets/synonyms';
import presetMedias from '../presets/medias';
import type {
  MnOptions,
} from '../core/types';

function compile(tokens: string, options: MnOptions = {}): { css: string;
  warnings: string[] } {
  const warnings: string[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    onWarning: (w) => warnings.push(w.type + ': ' + w.message),
    ...options,
  });
  mn.setPresets([
    presetStandard,
    presetSynonyms,
    presetMedias,
  ]);
  mn.getCompiler('class')(tokens);
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s) => s.content).join(''),
    warnings,
  };
}

describe('a) группа без `|` после функционального псевдокласса — аргумент', () => {
  test.each([
    ['cF:not(.a)', '.cF\\:not\\(\\.a\\):not(.a){color:#fff}'],
    ['cF:not(.a,.b)', '.cF\\:not\\(\\.a\\,\\.b\\):not(.a,.b){color:#fff}'],
    ['cF:n(2n+1)', '.cF\\:n\\(2n\\+1\\):nth-child(2n+1){color:#fff}'],
    ['cF:has(>img)', '.cF\\:has\\(\\>img\\):has(>img){color:#fff}'],
    ['cF:not([type=a])', '.cF\\:not\\(\\[type\\=a\\]\\):not([type=a]){color:#fff}'],
    ['cF:not(:n(2n))', ':not(:nth-child(2n)){color:#fff}'],
    ['cF:is(.a\\(x)', ':is(.a\\(x){color:#fff}'],
    ['cF(:not(.a)|:f)', ':not(.a),'],
    ['cF::part(label)', '::part(label){color:#fff}'],
  ])('%s', (token, expected) => {
    const {
      css, warnings,
    } = compile(token);
    expect(css).toContain(expected);
    expect(warnings.filter((w) => w.startsWith('group-suspect'))).toEqual([]);
  });

  test('синоним, который разворачивается не в функциональный псевдокласс — не аргумент', () => {
    // `:h` → `:hover`: скобки остаются scope-грамматикой.
    expect(compile('cF:h(.x)').css).toContain(':hover.x{color:#fff}');
  });

  test('экранированное двоеточие — не псевдокласс', () => {
    expect(compile('cF\\:not(.a|.b)').warnings.filter((w) => w.startsWith('group-suspect'))).toEqual([]);
  });

  test('непарная скобка — дело проверки структуры', () => {
    expect(compile('cF:not(.a').warnings.join()).toContain('Unclosed parenthesis');
  });
});

describe('b) groupSuspectMode — группа даёт заведомо битый CSS', () => {
  test.each([['cF:h(2n)', 'Parentheses "(2n)" after ":h" are scope grammar'], ['cF:is(.a|.b)', 'Group "(.a|.b)" right after ":is"']])("%s — 'warn' (по умолчанию): предупреждение, CSS как написано", (token, message) => {
    const {
      warnings,
    } = compile(token);
    expect(warnings.join()).toContain(message);
    expect(warnings.join()).toContain("groupSuspectMode: 'silent'");
  });

  test("'silent' — молча", () => {
    expect(compile('cF:h(2n)', {
      groupSuspectMode: 'silent',
    }).warnings.filter((w) => w.startsWith('group-suspect'))).toEqual([]);
  });

  test("'strict' — токен CSS не даёт, compile бросает", () => {
    const mn = minotationProvider({
      groupSuspectMode: 'strict',
    });
    mn.setPresets([presetStandard, presetSynonyms]);
    mn.getCompiler('class')('cF:is(.a|.b) p10');
    expect(() => mn.compile()).toThrow("(groupSuspectMode: 'strict') — the token gives no CSS");
  });

  test('законная scope-грамматика и группы с `|` — без подозрений', () => {
    expect(compile('cF:h(.x) cF:h(:f) w(|max)150 cF(:h|.on)').warnings
      .filter((w) => w.startsWith('group-suspect'))).toEqual([]);
  });
});

describe("c) groupMode: 'css' — скобки это CSS", () => {
  test.each([
    ['cF:nth-child(2n)', ':nth-child(2n){color:#fff}'],
    ['cF:not(.a)', ':not(.a){color:#fff}'],
    ['crUrl(a\\.png)', '{cursor:url(a.png)}'],
    ['gtcRepeat(auto-fit,minmax(240px,1fr))', '{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}'],
  ])('%s', (token, expected) => {
    expect(compile(token, {
      groupMode: 'css',
    }).css).toContain(expected);
  });

  test('групп нет: `w(|max)150` не разворачивается', () => {
    expect(compile('w(|max)150', {
      groupMode: 'css',
    }).css).toBe('');
  });

  test('mn.assign — тот же режим', () => {
    const mn = minotationProvider({
      groupMode: 'css',
    });
    mn.setPresets([presetStandard]);
    mn.assign('li:nth-child(2n), a(.x)', 'p10');
    mn.compile();
    expect(mn.styles$.getValue().map((s) => s.content).join('')).toContain('li:nth-child(2n),a\\(.x\\){padding:10px}');
  });

  test('проверка опций', () => {
    expect(() => minotationProvider({
      groupMode: 'plain',
    } as unknown as MnOptions)).toThrow('option "groupMode" expects "groups" or "css", got string "plain"');
    expect(() => minotationProvider({
      groupMod: 'css',
    } as unknown as MnOptions)).toThrow('Did you mean "groupMode"');
  });
});

describe('настройки разбора компилятора: getCompiler(attr, settings) (D-081)', () => {
  function cssOf(mn: ReturnType<typeof minotationProvider>): string {
    mn.compile();
    return mn.styles$.getValue().map((s) => s.content).join('');
  }

  test('groupMode и contextWhere компилятора важнее опций экземпляра', () => {
    const mn = minotationProvider({
      groupMode: 'css',
      warningMode: 'silent',
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class', {
      groupMode: 'groups',
    })('w(|max)150');
    mn.getCompiler('class', {
      contextWhere: true,
    })('cF00<.card');
    mn.getCompiler('class')('crUrl(a\\.png)');
    const css = cssOf(mn);
    expect(css).toContain('max-width:150px');
    expect(css).toContain(':is(:where(.card) *){color:#f00}');
    expect(css).toContain('{cursor:url(a.png)}');
  });

  test('пустые настройки — общий компилятор экземпляра', () => {
    const mn = minotationProvider({});
    expect(mn.getCompiler('class', {})).toBe(mn.getCompiler('class'));
  });

  test.each([
    [undefined, ''],
    [{}, ''],
    [{
      notationMode: 'tw4-compatible' as const,
    }, 'tw4-compatible,,'],
    [{
      groupMode: 'css' as const,
      contextWhere: false,
    }, ',css,0'],
    [{
      contextWhere: true,
    }, ',,1'],
  ])('parseSettingsKey(%j) = %p', (settings, key) => {
    expect(parseSettingsKey(settings)).toBe(key);
  });
});
