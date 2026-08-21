// @ts-nocheck
/* eslint-disable */
/**
 * Тесты presetPrefixes — vendor-префиксы (`-webkit-`/`-moz-`) для перечисленных
 * CSS-свойств. Порт `old/minimalist-notation/presets/prefixes.js`; ранее файл
 * существовал в `src/presets/prefixes.ts`, но не был подключён к `index.ts`.
 */

const mnProvider = require('../index').default || require('../index').minotationProvider;
const presetStandard = require('../presets/standard').default || require('../presets/standard');
const presetPrefixes = require('../presets/prefixes').default || require('../presets/prefixes');

function css(token: string, withPrefixes: boolean): string {
  const mn = mnProvider({
    presets: withPrefixes ? [presetStandard, presetPrefixes] : [presetStandard],
  });
  mn.getCompiler('class')(token);
  mn.compile();
  return mn.styles$.getValue().map((s: { content: string }) => s.content).join('');
}

describe('presetPrefixes', () => {
  test('без presetPrefixes — без вендорных дублей', () => {
    expect(css('fxdC', false)).toBe('.fxdC{flex-direction:column}');
  });

  test('transform (через flexDirection) — -webkit- и -moz- дубли', () => {
    const result = css('fxdC', true);
    expect(result).toContain('-webkit-flex-direction:column');
    expect(result).toContain('-moz-flex-direction:column');
    expect(result).toContain('flex-direction:column');
  });

  test('appearance — только -webkit- (нет -moz-appearance в v1)', () => {
    const result = css('apcNone', true);
    expect(result).toContain('-webkit-appearance:none');
    expect(result).not.toContain('-moz-appearance');
    expect(result).toContain('appearance:none');
  });

  test('свойство вне списка (overflow) не получает префиксов', () => {
    expect(css('ov', true)).toBe('.ov{overflow:hidden}');
  });
});
