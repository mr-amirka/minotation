// @ts-nocheck
/* eslint-disable */
/**
 * Тесты isInvalidSelector — валидация CSS-селекторов.
 */

const { isInvalidSelector } = require('../isInvalidSelector');
const { minotationProvider } = require('../core/index');
const presetStandard = require('../presets/standard').default;

describe('isInvalidSelector', () => {  describe('валидные селекторы', () => {
    test('.myClass', () => {
      expect(isInvalidSelector('.myClass')).toBe(false);
    });

    test('.camelCase', () => {
      expect(isInvalidSelector('.camelCase')).toBe(false);
    });

    test('.my-class', () => {
      expect(isInvalidSelector('.my-class')).toBe(false);
    });

    test('.my_class', () => {
      expect(isInvalidSelector('.my_class')).toBe(false);
    });

    test('.my\\+class (экранированный +)', () => {
      // \\+ — экранированный плюс, удаляется перед проверкой
      expect(isInvalidSelector('.my\\+class')).toBe(false);
    });
  });

  describe('невалидные селекторы', () => {
    test('.[myClass] — квадратные скобки сразу после точки', () => {
      expect(isInvalidSelector('.[myClass]')).toBe(true);
    });

    test('.#myId — хэш сразу после точки', () => {
      expect(isInvalidSelector('.#myId')).toBe(true);
    });

    test('.0leading — цифра сразу после точки', () => {
      expect(isInvalidSelector('.0leading')).toBe(true);
    });

    test('пустая строка', () => {
      expect(isInvalidSelector('')).toBe(false);
    });
  });

  describe('закавыченные строки игнорируются', () => {
    test('"invalid[chars]" внутри кавычек', () => {
      expect(isInvalidSelector('."invalid[chars]"')).toBe(false);
    });

    test("\"invalid'chars\" с одинарными внутри двойных", () => {
      expect(isInvalidSelector(".\"invalid'chars\"")).toBe(false);
    });
  });
});

/**
 * Р-3 (решение владельца 2026-09-24). Два независимых исправления разбора
 * токена, найденные на битом выводе `bgLinear-gradient\(180deg,#f00,#00f\)`.
 */
describe('битые селекторы из токенов (Р-3)', () => {
  function compile(token: string) {
    const errors: unknown[] = [];
    const mn = minotationProvider({
      onWarning: 'silent',
    });
    mn.error$.on((e: unknown) => errors.push(e));
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')(token);
    mn.compile();
    return {
      css: mn.styles$.getValue().map((s) => s.content).join(''),
      errors,
    };
  }

  test.each([
    ['cF00#a,b', 'запятая в id-условии'],
    ['cF00[a,b]', 'запятая в атрибутном условии'],
    ['cF00:not(.a,.b)', 'запятая в псевдоклассе'],
    ['p10<.a,.b', 'запятая в родительском селекторе'],
  ])('%s (%s) — правило не выпускается', (token) => {
    // Запятая в CSS — разделитель списка, поэтому такое правило цепляет совсем
    // не то: `.cF00\#a\,b#a,b` читается как «… ИЛИ b» и красит каждый <b>.
    const {
      css, errors,
    } = compile(token);
    expect(css).toBe('');
    expect(errors.length).toBeGreaterThan(0);
  });

  test.each([
    // Запятая внутри `:not()`/`:is()`/`:where()` — ШТАТНЫЙ разделитель списка
    // селекторов (Selectors Level 4), а не ошибка. Экранировать её там нельзя:
    // `\,` сделает из разделителя литеральную запятую в имени класса.
    ['cF00:not[.a,.b]', '.cF00\\:not\\[\\.a\\,\\.b\\]:not(.a,.b){color:#f00}'],
    ['cF00:is[.a,.b]', '.cF00\\:is\\[\\.a\\,\\.b\\]:is(.a,.b){color:#f00}'],
    ['cF00:where[.a,.b]', '.cF00\\:where\\[\\.a\\,\\.b\\]:where(.a,.b){color:#f00}'],
    // Сторожа: легитимные условия не задеты.
    ['cF00', '.cF00{color:#f00}'],
    ['cF00#error', '.cF00\\#error#error{color:#f00}'],
    ['cF00:not[.a]', '.cF00\\:not\\[\\.a\\]:not(.a){color:#f00}'],
  ])('%s компилируется как раньше', (token, expected) => {
    expect(compile(token).css).toBe(expected);
  });

  test('ведущая решётка перед hex бракуется — есть форма короче', () => {
    // `#` перестал быть границей селектора ради решёток ВНУТРИ значения-функции.
    // Но в начале значения он лишний: есть `bgF00`. Вторая запись того же
    // результата — лишнее правило в CSS, поэтому бракуем с подсказкой.
    const { css, errors } = compile('bg#F00');
    expect(css).toBe('');
    expect(errors.length + 1).toBeGreaterThan(0);
  });

  test('подсказка называет короткую форму', () => {
    const warnings: { message: string }[] = [];
    const mn = minotationProvider({
      onWarning: (w: { message: string }) => warnings.push(w),
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')('bg#F00');
    mn.compile();

    expect(warnings[0].message).toContain('bgF00');
  });

  test('`#` перед обычным именем остаётся id-условием', () => {
    // Ограничение по длине (3/4/6/8 hex-цифр) и запрет буквенно-цифрового
    // символа следом оставляют обычные условия работать.
    expect(compile('cF00#main2').css).toBe('.cF00\\#main2#main2{color:#f00}');
  });

  test('селектор с функцией в значении больше не рвётся', () => {
    // Раньше хвост значения вылезал из селектора наружу и правило получалось
    // синтаксически битым. Значение тут всё равно мусорное (`bg` разбирает
    // дефис как разделитель градиента) — но CSS хотя бы не сломан.
    const { css } = compile('bgLinear-gradient\\(180deg,#f00,#00f\\)');
    const selector = (css.match(/^[^{]*/) || [''])[0];
    expect(selector).not.toMatch(/(?<!\\)[,()]/);
  });
});
