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
    mn.getCompiler('class')('w1/2 w1/3 w50p p10 cF00<.p:h bgF fx1 fxdColumn');
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
    // Извлекаем все классы, которые начинаются с. и за ними идут экранированные символы или буквы/цифры
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
      'bgF',
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

/**
 * Согласованность валидатора (`cssGrammar`) с тем, что реально строит ядро.
 *
 * Корень класса багов: `PROPERTY_VALIDATORS` — ручная таблица «CSS-свойство →
 * валидатор», которая живёт отдельно от хендлеров. Хендлер учится отдавать
 * новую форму значения, таблица об этом не знает — и корректный CSS молча
 * отбраковывается: правило не попадает в вывод, остаётся только warning.
 * Так было с `var` (до 2026-09-17), с многозначными shorthand'ами,
 * с градиентами и с `gap:normal` (оба — 2026-09-23).
 */
describe('валидатор не бракует то, что ядро построило из осмысленного ввода', () => {
  function cssOf(token: string): string {
    const mn = mnProvider({
      onWarning: 'silent',
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')(token);
    mn.compile();
    const m = mn.styles$.getValue().map((s) => s.content).join('')
      .match(/\{([^}]*)\}\s*$/);
    return m ? m[1] : '';
  }

  test.each([
    // Градиенты: ядро строит их само, валидатор держал для `background`
    // чистый isColorValue и браковал каждый.
    ['bgF00-00F', 'background:linear-gradient(180deg,#f00 0%,#00f 100%)'],
    // `normal` — initial value у column-gap/row-gap.
    ['ggcN', 'grid-column-gap:normal'],
    // Подстановка переменной допустима в значении любого свойства.
    ['w--v', 'width:var(--v)'],
    ['bg--v', 'background:var(--v)'],
    // Многозначный shorthand.
    ['p10_20', 'padding:10px 20px'],
    // calc.
    ['w100%-20px', 'width:calc(100% - 20px)'],
  ])('%s → %s', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test('сторожа: настоящий мусор по-прежнему отбраковывается', () => {
    // Иначе «починка» валидатора превратилась бы в его отключение.
    expect(cssOf('bgUndefined')).toBe('');
    // Нераспознанная буква синонима падает в буквальный kebab: `display:a`.
    expect(cssOf('dA')).toBe('');
    expect(cssOf('p8-12')).toBe('');
  });
});

/**
 * Трек `notation-ergonomics`, задача 1 (2026-09-24). Валидатор считал
 * `width`/`min-*`/`max-*` одним семейством с общей грамматикой, хотя она у них
 * разная: у `max-*` initial value это `none`, а `auto` наоборот невалиден.
 * Плюс ни у одного не проходили ключевые слова внутреннего размера.
 *
 * Живой случай: `.uVerdict { max-width: none }` в медиазапросе — единственная
 * причина, по которой правило осталось обычным CSS в проекте affiliate.
 */
describe('размерные свойства: none, auto и внутренние размеры', () => {
  function cssOf(token) {
    const mn = mnProvider({
      onWarning: 'silent',
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')(token);
    mn.compile();
    const m = mn.styles$.getValue().map((s) => s.content).join('')
      .match(/\{([^}]*)\}\s*$/);
    return m ? m[1] : '';
  }

  test.each([
    // `none` — только у max-*, и это их initial value.
    ['wmaxN', 'max-width:none'],
    ['wmaxNone', 'max-width:none'],
    ['hmaxN', 'max-height:none'],
    // Внутренние размеры валидны у всех размерных свойств.
    ['wFitContent', 'width:fit-content'],
    ['wMinContent', 'width:min-content'],
    ['wMaxContent', 'width:max-content'],
    ['wmaxFitContent', 'max-width:fit-content'],
    ['hminMinContent', 'min-height:min-content'],
    // Обычные формы не задеты.
    ['wmax100', 'max-width:100px'],
    ['wA', 'width:auto'],
    ['wminA', 'min-width:auto'],
  ])('%s → %s', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test('max-* не принимает auto — у него другая грамматика', () => {
    // Браузер такое правило отбрасывает, поэтому оно и не должно доходить
    // до CSS. Раньше пропускалось, потому что валидатор был общий с `width`.
    expect(cssOf('wmaxA')).toBe('');
    expect(cssOf('hmaxA')).toBe('');
  });
});
