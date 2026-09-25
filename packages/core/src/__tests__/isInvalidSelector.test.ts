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

/**
 * Задача 10 трека `notation-ergonomics`: скобки без `|` — не группа вариантов.
 *
 * `variants()` схлопывает такую группу в единственный вариант, и единственный
 * её эффект — молчаливое удаление самих скобок. В CSS уезжало правило, которое
 * не сработает никогда, без единого предупреждения (D-004).
 */
describe('вырожденная группа вариантов в значении токена', () => {
  function compileToken(token: string): { css: string; warnings: MnWarning[] } {
    const warnings: MnWarning[] = [];
    const mn: any = minotationProvider({
      onWarning: (w: MnWarning) => warnings.push(w),
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')(token);
    mn.compile();
    return {
      css: mn.styles$.getValue().map((s: { content: string }) => s.content).join(''),
      warnings,
    };
  }

  test.each([
    ['gtcRepeat(auto-fit,minmax(240px,1fr))', 'давало grid-template-columns:repeatauto-fit,minmax240px,1fr'],
    ['gtcRepeat(2,1fr)', 'давало repeat2,1fr'],
    ['crUrl(a.png)', 'давало cursor:urla и роняло `.png` в селектор'],
    ['ftBlur(4px)', 'работало по совпадению — каноническая форма ftBlur4'],
  ])('%s → брак (%s)', (token) => {
    const r = compileToken(token);
    expect(r.css).toBe('');
    expect(r.warnings.map((w) => w.type)).toContain('parse-error');
    expect(r.warnings[0].message).toContain('не образуют группу вариантов');
  });

  test.each([
    ['a)b', 'Непарная закрывающая'],
    ['p10)', 'Непарная закрывающая'],
    ['gtcRepeat(2', 'Незакрытая'],
    ['crUrl(a', 'Незакрытая'],
  ])('%s → брак: %s скобка', (token, expected) => {
    const r = compileToken(token);
    expect(r.css).toBe('');
    expect(r.warnings[0].message).toContain(expected);
  });

  test.each([
    ['p10@(sm|md)', '@media sm{'],
    ['p10:h(.x)', ':h.x{padding:10px}'],  // без presetMedias `:h` не раскрывается в hover
    ['cF00:not[.a]', ':not(.a){color:#f00}'],
    ['gtcRepeat\\(auto-fit,minmax\\(240px,1fr\\)\\)', 'repeat(auto-fit,minmax(240px,1fr))'],
    ['ftBlur4', 'filter:blur(4px)'],
  ])('%s не задет', (token, expected) => {
    expect(compileToken(token).css).toContain(expected);
  });

  test.each([
    ['p10@(sm|)', 'хвостовая пустая альтернатива'],
    ['p10@(|sm)', 'ведущая пустая альтернатива'],
    ['p10@(|)', 'обе пустые'],
    ['p10@(sm||md)', 'пустая в середине'],
    ['p10@(|||)', 'несколько пустых'],
    ['p10:(hover|)', 'в позиции состояния'],
  ])('%s → брак: %s', (token) => {
    // Пустая альтернатива даёт ЛИШНИЙ вариант без самой части: `p10@(sm|)`
    // компилировался и в `@media sm`, и в безусловное правило — медиа-запрос
    // обесценивался. В позиции состояния было хуже: `p10:(hover|)` давало
    // селектор с висячим двоеточием (`.p10…:`), то есть невалидный CSS.
    const r = compileToken(token);
    expect(r.css).toBe('');
    expect(r.warnings[0].message).toContain('Пустая альтернатива');
  });

  test.each([
    'p10()',
    'p10@()',
    'p10:h()',
  ])('%s → брак: пустые скобки', (token) => {
    // Пустые скобки бессмысленны в любой позиции — ни как группа, ни как scope,
    // поэтому бракуются и в контекстной части, в отличие от «скобок без |».
    const r = compileToken(token);
    expect(r.css).toBe('');
    expect(r.warnings[0].message).toContain('Пустые скобки');
  });

  test.each([
    ['p10@', 'суффикс медиа молча испарялся'],
    ['p10:', 'висячее двоеточие'],
    ['p10.', 'висячая точка'],
    ['p10#', 'висячая решётка'],
    ['p10~', 'висячий комбинатор'],
    ['p10+', 'висячий комбинатор соседа'],
    ['p10[', 'висячая открывающая скобка условия'],
    ['p10@sm&', 'неэкранированный `&` в имени класса'],
  ])('%s → брак: %s', (token) => {
    // Замечание владельца 2026-09-25 про `p10@`. Проверка показала, что случай
    // не один: в четырёх формах из пяти в CSS уезжал синтаксически битый
    // селектор, а не просто лишний символ.
    const r = compileToken(token);
    expect(r.css).toBe('');
    expect(r.warnings[0].message).toContain('без самой части');
  });

  test.each([
    ['p10@sm', '@media sm{'],
    ['p10:hover', ':hover{padding:10px}'],
    ['f1.5em', 'font-size:1.5em'],
    ['w10+5', 'width:calc(10px + 5px)'],
    ['p10<.a', '.a .p10'],
    ['p10', '.p10{padding:10px}'],
  ])('%s — непустой контекст и значения с точкой/плюсом не задеты', (token, expected) => {
    expect(compileToken(token).css).toContain(expected);
  });

  test.each([
    ['bgi_a\\.', 'background-image:url("a.")'],
    ['ff_a\\:', 'font-family:a:'],
  ])('%s — экранированный сепаратор в конце остаётся значением', (token, expected) => {
    expect(compileToken(token).css).toContain(expected);
    expect(compileToken(token).warnings).toHaveLength(0);
  });

  test('`<`/`>` сохраняют собственные сообщения Q-08', () => {
    // Они намеренно не входят в проверку висячего сепаратора: у `getCombinator`
    // формулировки точнее («пустой контекстный сегмент», §13 спеки).
    expect(compileToken('p10<').warnings[0].message).toContain('Пустой контекстный сегмент');
    expect(compileToken('p10>').warnings[0].message).toContain('Пустой контекстный сегмент');
  });

  test('экранированный символ внутри группы считается содержимым', () => {
    // `\|` внутри группы — литерал, а не разделитель альтернатив: группа
    // `(a\|b|md)` состоит из `a|b` и `md`, обе непустые.
    expect(compileToken('p10@(a\\|b|md)').css).toContain('@media a|b{');
    expect(compileToken('p10@(a\\|b|md)').warnings).toHaveLength(0);
  });

  test('скобки после контекстного символа — это scope, а не группа', () => {
    // `p10:h(.x)` → `:hover.x`: содержимое дописывается к тому же селектору.
    // Проверка намеренно смотрит только на значение — часть до первого
    // контекстного символа на нулевой глубине.
    const r = compileToken('p10:h(.x)');

    expect(r.css).toContain('padding:10px');
    expect(r.warnings.map((w) => w.type)).not.toContain('parse-error');
  });
});

describe('вырожденная группа вариантов в селекторе mn.assign', () => {
  function assign(selectors: Record<string, string>): string {
    const mn: any = minotationProvider({
      onWarning: 'silent',
    });
    mn.setPresets([presetStandard]);
    mn.assign(selectors);
    mn.compile();
    return mn.styles$.getValue().map((s: { content: string }) => s.content).join('');
  }

  test.each([
    'button:not(.plain)',
    'li:nth-child(2n)',
  ])('%s → исключение при регистрации, а не битый CSS', (selector) => {
    // Холодный путь: `mn.assign` зовётся при регистрации пресета, поэтому
    // fail-fast с понятным сообщением лучше правила `button:not.plain`,
    // которое молча уехало бы в вывод.
    expect(() => assign({
      [selector]: 'p10',
    })).toThrow(/не образуют группу вариантов/);
  });

  test('экранированные скобки дают корректный CSS', () => {
    expect(assign({
      'button:not\\(.plain\\)': 'p10',
    })).toContain('button:not(.plain){padding:10px}');
  });

  test.each([
    ['button:not[.plain]', 'button:not(.plain){padding:10px}'],
    ['li:nth-child[2n]', 'li:nth-child(2n){padding:10px}'],
    ['a:hover[.x[.y]]', 'a:hover(.x[.y]){padding:10px}'],
  ])('%s → %s (scope работает и в assign)', (selector, expected) => {
    // Замечание владельца 2026-09-25: `[...]` сразу после состояния — механизм
    // scope, и в токене он давно разворачивается (`cF00:not[.a]` → `:not(.a)`).
    // В селекторах `mn.assign` он не работал, и запись уезжала в CSS как есть —
    // невалидной, потому что `[.plain]` не атрибут.
    expect(assign({
      [selector]: 'p10',
    })).toContain(expected);
  });

  test.each([
    '[type=text]',
    'input[checked]',
    '.card[data-x=1]',
  ])('%s — атрибутный селектор не задет', (selector) => {
    // Граница из замечания владельца: `[` вне позиции состояния начинает
    // контекстную часть (атрибут), и трогать его нельзя.
    expect(assign({
      [selector]: 'p10',
    })).toContain(selector + '{padding:10px}');
  });

  test('в токене двойного преобразования не происходит', () => {
    // `pseudoBrackets` применяется только к пути assign: имена токенов
    // разворачивают scope своим механизмом, и второй проход дал бы
    // `:not(.a(.b))` вместо `:not(.a[.b])`.
    const mn: any = minotationProvider({
      onWarning: 'silent',
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')('cF00:not[.a[.b]]');
    mn.compile();
    const css = mn.styles$.getValue().map((s: { content: string }) => s.content).join('');

    expect(css).toContain(':not(.a[.b]){color:#f00}');
  });

  test.each([
    '(h1|)',
    '(|h1)',
    '()',
  ])('%s в assign → исключение при регистрации', (selector) => {
    expect(() => assign({
      [selector]: 'p10',
    })).toThrow(/Пустая альтернатива|Пустые скобки/);
  });

  test('настоящая группа вариантов разворачивается', () => {
    expect(assign({
      '(h1|h2)': 'c00F',
    })).toContain('h1,h2{color:#00f}');
  });
});
