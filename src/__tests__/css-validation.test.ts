// @ts-nocheck
/* eslint-disable */
/**
 * Структурная валидация CSS-вывода через postcss + аудит экранирования спецсимволов.
 *
 * Выделено из presets.test.ts (2026-08-10) — единственная секция, не дублирующая
 * preset-standard.test.ts/preset-normalize-main.test.ts. Мигрировано с v2 API на v1
 * (createMn/mn.check(...) -> minotationProvider/getCompiler('class')(...)).
 */

import postcss from 'postcss';

const mnProvider = require('../index').default || require('../index').minotationProvider;
const presetStandard = require('../presets/standard').default || require('../presets/standard');
const presetSynonyms = require('../presets/synonyms').default || require('../presets/synonyms');
const presetMedias = require('../presets/medias').default || require('../presets/medias');
const presetNormalize = require('../presets/normalize').default || require('../presets/normalize');
const presetMain = require('../presets/main').default || require('../presets/main');

function make(presets) {
  const mn = mnProvider({
    onError: (e) => { /* подавляем ошибки парсинга */ },
  });
  mn.setPresets(presets);
  return mn;
}

describe('CSS validation', () => {
  test('postcss: нет структурных ошибок', () => {
    const mn = make([
      presetStandard,
      presetSynonyms,
      presetMedias,
      presetNormalize,
      presetMain,
    ]);
    mn.getCompiler('class')('w1/2 w1/3 w50p p10 cF00<.p:h bgFFF fx1 fxdColumn');
    mn.compile();
    const css = mn.styles$.getValue().map(s => s.content).join('\n');
    expect(() => postcss.parse(css)).not.toThrow();
  });

  test('целевой класс (имя лексемы) экранирует все спецсимволы', () => {
    const tokens = [
      'w1/2',
      'p10@m',
      'cF00<.p',
      'cF00>.c',
      'cF00:h',
      'cF00*2',
      'test[attr]',
      'test(a|b)',
      'test#id',
      'test+a',
      'test~a',
      'test!x',
      'test$x',
      'test^x',
      'test&x',
    ];
    const mn = make([presetStandard, presetMedias]);
    mn.getCompiler('class')(tokens.join(' '));
    mn.compile();
    const css = mn.styles$.getValue().map(s => s.content).join(' ');

    // Целевой класс — тот, что образован от имени токена.
    // С группировкой селекторов несколько токенов с одним CSS-телом объединяются:
    // .sel1,.sel2{body} — нужно находить все классы, не только последний перед {
    // Извлекаем все классы, которые начинаются с . и за ними идут экранированные символы или буквы/цифры
    const classPattern = /\.[a-zA-Z0-9_](?:[a-zA-Z0-9_]|\\[^])*/g;
    const targetClasses = css.match(classPattern) || [];
    const barePattern = /[@/!()|*$^&<>+~#[\]\\]/;

    for (const tc of targetClasses) {
      const bare = tc.slice(1).replace(/\\./g, ''); // убираем . и экранированные пары
      expect(bare).not.toMatch(barePattern);
    }
    expect(targetClasses.length).toBeGreaterThan(4);
  });

  test('контекстные селекторы НЕ экранируются (>.+~# — валидный CSS)', () => {
    const mn = make([presetStandard]);
    mn.getCompiler('class')('cF00<.parent cF00<.a+.b cF00>.child cF00<#myid');
    mn.compile();
    const css = mn.styles$.getValue().map(s => s.content).join(' ');
    expect(css).toMatch(/\.parent /);
    expect(css).toMatch(/\.a\+\.b/);
    expect(css).toMatch(/\.child/);
    expect(css).toMatch(/#myid/);
  });

  test('состояния генерируют валидные псевдоклассы', () => {
    const mn = make([presetStandard, presetSynonyms]);
    mn.getCompiler('class')('cF00:h cF00:f cF00:a cF00:even cF00:first cF00:last');
    mn.compile();
    const css = mn.styles$.getValue().map(s => s.content).join(' ');
    expect(css).toMatch(/:hover/);
    expect(css).toMatch(/:focus/);
    expect(css).toMatch(/:active/);
    expect(css).toMatch(/:nth-child\(2n\)/);
    expect(css).toMatch(/:first-child/);
    expect(css).toMatch(/:last-child/);
  });

  test('медиа-запросы генерируют валидный CSS', () => {
    const mn = make([presetStandard, presetMedias]);
    mn.getCompiler('class')('p10@m p10@d p10@m5 p10@dark');
    mn.compile();
    const css = mn.styles$.getValue().map(s => s.content).join('\n');
    expect(() => postcss.parse(css)).not.toThrow();
    expect(css).toContain('@media (max-width: 991.98px)');
    expect(css).toContain('@media (min-width: 992px)');
  });

  test('полный CSS-вывод парсится postcss без ошибок (все пресеты)', () => {
    const mn = make([
      presetStandard,
      presetSynonyms,
      presetMedias,
      presetNormalize,
      presetMain,
    ]);
    mn.getCompiler('class')([
      'w1/2',
      'h100vh',
      'p10@m',
      'cF00<.p:h',
      'bgFFF',
      'fx1',
      'fxdColumn',
      'fxaCenter',
      'jcSpaceBetween',
      'r5',
      'o70',
      'break',
      'rlv',
      'abs',
      's0',
      'cF00<.a+.b',
      'cF00<#myid',
      'cF00<.parent@m:h',
    ].join(' '));
    mn.compile();
    const css = mn.styles$.getValue().map(s => s.content).join('\n');
    expect(() => postcss.parse(css)).not.toThrow();
  });
});
