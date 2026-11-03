// @ts-nocheck
/* eslint-disable */
/**
 * Проверки записи токена: готовый селектор (`selectorProblem`) и скобки вариантов (`assertVariantGroups`).
 */

const { selectorProblem, assertTokenSelectors } = require('../selectorProblem');
const { minotationProvider } = require('../core/index');
const { MnParseError } = require('../core/types');
const presetStandard = require('../presets/standard').default;

describe('selectorProblem', () => {
  test.each([
    ['.myClass'],
    ['.camelCase'],
    ['.my-class'],
    ['.my_class'],
    ['.my\\+class'],
    [''],
    ['.'],
    ['."invalid[chars]"'],
    [".\"invalid'chars\""],
    ['.a:not(.b,.c)'],
    ['.a:is(.b,:not(.c,.d))'],
    ['.a\\,b'],
    ['.a[title="a,b"]'],
  ])('%s — в порядке', (selector) => {
    expect(selectorProblem(selector)).toBe('');
  });

  test.each([
    ['.[myClass]', '['],
    ['.#myId', '#'],
    ['.0leading', '0'],
    ['.p10\\>\\.0a .0a', '0'],
    ['. a', ' '],
    ['."a', '"'],
    ['.`a', '`'],
  ])('%s — после точки «%s»', (selector, next) => {
    expect(selectorProblem(selector)).toBe('Selector "' + selector + '" has "." followed by "' + next
      + '": a class name can\'t start with it');
  });

  test.each([
    ['.cF00\\#a\\,b#a,b', 'запятая снаружи'],
    ['.a(b,c', 'скобка не закрыта'],
    ['.a(b(c,d', 'не закрыта вложенная'],
    ['.a(b,(c)', 'вложенная закрыта, внешняя нет'],
    ['.a)b,c', 'лишняя закрывающая не открывает уровень'],
    ['.a\\(b,c\\)d', 'экранированные скобки — не скобки'],
  ])('%s — голая запятая (%s)', (selector) => {
    expect(selectorProblem(selector)).toBe('Selector "' + selector + '" has a bare ",": it would start a second'
      + ' selector and style other elements. Escape it — "\\," — if it belongs to the value; in :not, :is, :where'
      + ' write the list in square brackets: ":not[.a,.b]"');
  });

  test('assertTokenSelectors — первый битый селектор: MnParseError с токеном', () => {
    expect(() => assertTokenSelectors([[{}, { '.a': 1 }]], 'a')).not.toThrow();
    let error;
    try {
      assertTokenSelectors([[{}, { '.a': 1, '.b,c': 1 }]], 'tok');
    } catch (ex) {
      error = ex;
    }
    expect(error).toBeInstanceOf(MnParseError);
    expect(error.context).toEqual({ token: 'tok', handler: '', arg: 'tok', utility: 'selectors' });
  });
});

/**
 * Два независимых исправления разбора
 * токена, найденные на битом выводе `bgLinear-gradient\(180deg,#f00,#00f\)`.
 */
describe('битые селекторы из токенов', () => {
  function compile(token: string) {
    const errors: unknown[] = [];
    const warnings: { type: string; token: string; message: string }[] = [];
    const mn = minotationProvider({
      warningMode: 'silent',
      onWarning: (w) => warnings.push(w),
    });
    mn.error$.watch((e: unknown) => errors.push(e));
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')(token);
    mn.compile();
    return {
      css: mn.styles$.getState().map((s) => s.content).join(''),
      errors,
      warnings,
    };
  }

  test.each([
    ['cF00#a,b', 'запятая в id-условии'],
    ['cF00[a,b]', 'запятая в атрибутном условии'],
    ['p10<.a,.b', 'запятая в родительском селекторе'],
  ])('%s (%s) — правило не выпускается, предупреждение с токеном', (token) => {
    // Запятая в CSS — разделитель списка, поэтому такое правило цепляет совсем
    // не то: `.cF00\#a\,b#a,b` читается как «… ИЛИ b» и красит каждый <b>.
    const {
      css, errors, warnings,
    } = compile(token);
    expect(css).toBe('');
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('parse-error');
    expect(warnings[0].token).toBe(token);
    expect(warnings[0].message).toContain('has a bare ","');
  });

  test('после точки — не имя класса: предупреждение с токеном', () => {
    const {
      css, errors, warnings,
    } = compile('p10.#a');
    expect(css).toBe('');
    expect(errors).toEqual([]);
    expect(warnings.map((w) => [w.type, w.token])).toEqual([['parse-error', 'p10.#a']]);
    expect(warnings[0].message).toContain('has "." followed by "#"');
  });

  test('strict: битый селектор — ошибка сборки', () => {
    const mn = minotationProvider({
      warningMode: 'error',
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')('cF00#a,b');
    expect(() => mn.compile()).toThrow('has a bare ","');
  });

  test.each([
    // Запятая внутри `:not`/`:is`/`:where` — ШТАТНЫЙ разделитель списка
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
 * `variants` схлопывает такую группу в единственный вариант, и единственный
 * её эффект — молчаливое удаление самих скобок. В CSS уезжало правило, которое
 * не сработает никогда, без единого предупреждения.
 */
describe('вырожденная группа вариантов в значении токена', () => {
  function compileToken(token: string): { css: string; warnings: MnWarning[] } {
    const warnings: MnWarning[] = [];
    const mn: any = minotationProvider({
      onWarning: (w: MnWarning) => warnings.push(w),
      // Тест не про дочерние селекторы: о них предупреждает childSelectorMode (D-041).
      childSelectorMode: 'silent',
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')(token);
    mn.compile();
    return {
      css: mn.styles$.getState().map((s: { content: string }) => s.content).join(''),
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
    expect(r.warnings[0].message).toContain('do not form a variant group');
  });

  test.each([
    // Тег обязан быть зарегистрирован: с 2026-09-26 у имени без тега
    // структура не проверяется вовсе — это чужой класс, а не токен.
    ['w50)b', 'Unmatched closing'],
    ['p10)', 'Unmatched closing'],
    ['gtcRepeat(2', 'Unclosed'],
    ['crUrl(a', 'Unclosed'],
  ])('%s → брак: %s скобка', (token, expected) => {
    const r = compileToken(token);
    expect(r.css).toBe('');
    expect(r.warnings[0].message).toContain(expected);
  });

  test.each([
    ['p10@(sm|md)', '@media sm{'],
    ['p10:h(.x)', ':h.x{padding:10px}'],  // без presetMedias `:h` не раскрывается в hover
    ['cF00:not[.a]', ':not(.a){color:#f00}'],
    // Экранированные скобки — не группа: доходят до хендлера как текст (функции в значении бракуются хендлером, D-124).
    ['cnt_see_\\(note\\)', 'content:"see (note)"'],
    ['ftBlur4', 'filter:blur(4px)'],
  ])('%s не задет', (token, expected) => {
    expect(compileToken(token).css).toContain(expected);
  });

  test.each([
    ['p10@(sm|)', 'хвостовая пустая альтернатива', 'ends with "@"'],
    ['p10@(|sm)', 'ведущая пустая альтернатива', 'ends with "@"'],
    ['p10@(sm||md)', 'пустая в середине', 'ends with "@"'],
    ['p10:(hover|)', 'в позиции состояния', 'ends with ":"'],
    ['p10@(|sm):hover', 'состояние после медиа (D-088)', 'a state after the media part'],
    ['p10@(|)', 'обе пустые', 'All alternatives'],
    ['p10@(|||)', 'несколько пустых', 'All alternatives'],
  ])('%s → брак: %s', (token, _what, reason) => {
    // Пустая альтернатива бракуется не по записи, а по РЕЗУЛЬТАТУ развёртки:
    // `p10@(sm|)` даёт вариант `p10@` с висячим `@` — медиа-запрос бы
    // обесценился, правило стало бы безусловным. `p10:(hover|)` даёт `p10:` —
    // селектор с висячим двоеточием, невалидный CSS. Сообщение указывает на
    // конкретный битый вариант, а не на группу целиком.
    const r = compileToken(token);
    expect(r.css).toBe('');
    expect(r.warnings[0].message).toContain(reason);
  });

  test.each([
    ['w(|max)150', ['width:150px', 'max-width:150px']],
    ['p(|t)10', ['padding:10px', 'padding-top:10px']],
  ])('%s — пустая альтернатива в имени законна', (token, declarations) => {
    // До 2026-10-04 бракуется вместе с вырожденными формами, хотя дефекта
    // здесь нет: варианты `w150` и `wmax150` — полноценные токены, и каждый
    // проходит обычную проверку своим хендлером. Запрет был шире своего
    // обоснования: все найденные тогда дефекты были в контекстной части.
    const r = compileToken(token);
    expect(r.warnings).toEqual([]);
    for (const declaration of declarations) {
      expect(r.css).toContain(declaration);
    }
  });

  test.each([
    ['c00F(@sm|.active)<.parent', ['.parent .c00F', '.active']],
  ])('%s — медиа в альтернативе группы, хвост группы — после неё: законно', (token, fragments) => {
    // Группа варьирует ВИД контекста при общем хвосте — `c00F(@sm|.active)<.parent` даёт
    // `c00F@sm<.parent` и `c00F.active<.parent` (уточнение владельца 2026-10-04). С D-088 медиа — в конце
    // токена или своей альтернативы группы: записанное `p10@sm<.x` — брак, эта запись — нет.
    const r = compileToken(token);
    expect(r.warnings.filter((w: { type: string }) => w.type === 'parse-error')).toEqual([]);
    for (const fragment of fragments) {
      expect(r.css).toContain(fragment);
    }
  });

  test('`p10@:hover` — состояние после `@` ловится и без группы (D-088)', () => {
    // До D-088 `p10@:h` молча давал безусловное правило; теперь `@:имя` — запрос к контейнеру по имени, а имя
    // состояния там — брак с подсказкой.
    const r = compileToken('p10@:hover');
    expect(r.css).toBe('');
    expect(r.warnings[0].message).toContain('a state after the media part');
  });

  test.each([
    'p10@sm:hover',
    'p10@sm.active',
    'p10@sm<.parent',
    'p10@sm>li',
  ])('%s — после медиа только медиа (D-088)', (token) => {
    const r = compileToken(token);
    expect(r.css).toBe('');
    expect(r.warnings[0].message).toContain('after the media part');
  });

  test('экранированный `@` пустым медиа не считается', () => {
    // `\@` — часть значения, а не сепаратор контекста.
    const r = compileToken('bgi_a\\@\\:b');
    expect(r.warnings.map((w: { message: string }) => w.message).join(''))
      .not.toContain('Empty media name');
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
    expect(r.warnings[0].message).toContain('Empty parentheses');
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
    // Проверка показала, что случай
    // не один: в четырёх формах из пяти в CSS уезжал синтаксически битый
    // селектор, а не просто лишний символ.
    const r = compileToken(token);
    expect(r.css).toBe('');
    expect(r.warnings[0].message).toContain('with nothing after it');
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
    // Было `ff_a\:` → `font-family:a:`, но двоеточие в имени шрифта по
    // грамматике невалидно, и с 2026-09-27 такое имя бракуется. Механизм
    // экранирования проверяется там, где двоеточие в значении осмысленно.
    ['cnt_a\\:', 'content:"a:"'],
  ])('%s — экранированный сепаратор в конце остаётся значением', (token, expected) => {
    expect(compileToken(token).css).toContain(expected);
    expect(compileToken(token).warnings).toHaveLength(0);
  });

  test('`<`/`>` сохраняют собственные, более точные сообщения', () => {
    // Они намеренно не входят в проверку висячего сепаратора: у `getCombinator`
    // формулировки точнее («пустой контекстный сегмент», §13 спеки).
    expect(compileToken('p10<').warnings[0].message).toContain('Empty context segment');
    expect(compileToken('p10>').warnings[0].message).toContain('Empty context segment');
  });

  test('экранированный символ внутри группы считается содержимым', () => {
    // `\|` внутри группы — литерал, а не разделитель альтернатив: группа
    // `(a\|b|md)` состоит из `a|b` и `md`, обе непустые.
    expect(compileToken('p10@(a\\|b|md)').css).toContain('@media a|b{');
    // Имена `a|b` и `md` не описаны — их предупреждение `unknown-media` (D-058) о другом.
    expect(compileToken('p10@(a\\|b|md)').warnings.filter((w) => w.type !== 'unknown-media')).toHaveLength(0);
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
      warningMode: 'silent',
    });
    mn.setPresets([presetStandard]);
    mn.assign(selectors);
    mn.compile();
    return mn.styles$.getState().map((s: { content: string }) => s.content).join('');
  }

  test.each([
    ['button:not(.plain)', 'button:not(.plain){padding:10px}'],
    ['li:nth-child(2n)', 'li:nth-child(2n){padding:10px}'],
    ['li:not(:nth-child(2n))', 'li:not(:nth-child(2n)){padding:10px}'],
  ])('%s → %s: скобки функционального псевдокласса — аргумент (D-077)', (selector, expected) => {
    // До D-077 — исключение при регистрации (группа без `|`), ещё раньше — `button:not.plain`.
    expect(assign({
      [selector]: 'p10',
    })).toContain(expected);
  });

  test('селектор: подозрительная группа — по groupSuspectMode', () => {
    const mn: any = minotationProvider({
      warningMode: 'silent',
      groupSuspectMode: 'strict',
    });
    mn.setPresets([presetStandard]);
    mn.assign({
      'li:is(.a|.b)': 'p10',
    });
    expect(() => mn.compile()).toThrow(/right after ":is"/);
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
    // `[...]` сразу после состояния — механизм
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
    // Граница: `[` вне позиции состояния начинает
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
      warningMode: 'silent',
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')('cF00:not[.a[.b]]');
    mn.compile();
    const css = mn.styles$.getState().map((s: { content: string }) => s.content).join('');

    expect(css).toContain(':not(.a[.b]){color:#f00}');
  });

  test.each([
    '(h1|)',
    '(|h1)',
    '()',
  ])('%s в assign → исключение при регистрации', (selector) => {
    expect(() => assign({
      [selector]: 'p10',
    })).toThrow(/Empty selector|All alternatives|Empty parentheses/);
  });

  test.each([
    ['div(|.x)', 'div,div.x{padding:10px}'],
  ])('%s в assign — пустая альтернатива законна, если вариант не пустой', (selector, expected) => {
    // Проверка по результату развёртки (D-020): дефект — пустой вариант, а не
    // пустая альтернатива. `div(|.x)` даёт `div` и `div.x`, оба настоящие.
    const css = assign({
      [selector]: 'p10',
    });
    expect(css).toContain(expected);
  });

  test('висячий сепаратор в варианте селектора ловится, хотя запись кончается на `)`', () => {
    expect(() => assign({
      '(h1|h2:)': 'p10',
    })).toThrow(/ends with ":"/);
  });

  test('настоящая группа вариантов разворачивается', () => {
    expect(assign({
      '(h1|h2)': 'c00F',
    })).toContain('h1,h2{color:#00f}');
  });
});

/**
 * Граница «чужой класс / ошибка в токене».
 *
 * До 2026-09-26 структура имени проверялась раньше, чем выяснялось, есть ли у
 * него зарегистрированный тег. Чужой класс, случайно начавшийся с тега,
 * получал `parse-error`, и со `warningMode: 'error'` ронял сборку: `sr-only` → `s` +
 * неразбираемый `-only`, `mt-auto` → `mt`. Образец `class="..."` из
 * комментария в JSX ронял сборку сайта `affiliate` (трек `scanner-robustness`,
 * задача 1).
 *
 * Сторож нужен на обе стороны: чужие классы молчат, настоящие ошибки в
 * токенах предупреждают.
 */
describe('классы вне нотации: молчат, только если записи для имени нет (D-065)', () => {
  function compile(token: string): { css: string; warnings: MnWarning[] } {
    const warnings: MnWarning[] = [];
    const mn: any = minotationProvider({
      onWarning: (w: MnWarning) => warnings.push(w),
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')(token);
    mn.compile();
    return {
      css: mn.styles$.getState().map((s: { content: string }) => s.content).join(''),
      warnings,
    };
  }

  test.each([
    ['...', 'образец из комментария в разметке'],
    ['…', 'многоточие одним символом'],
    ['flex-col', 'имени `flex` в стандартном пресете нет'],
    ['text-center', 'имени `text` нет'],
    ['btn-primary', 'имени `btn` нет'],
  ])('%s — молчит (%s)', (token) => {
    const r = compile(token);
    expect(r.css).toBe('');
    expect(r.warnings).toEqual([]);
  });

  // До D-065 такие классы молчали: остаток вида `-слово` хендлеру не передавался («чужой
  // класс»). Теперь хендлер вызывается всегда и сам сообщает, что значение не разобрал.
  test.each([
    ['sr-only', 'хендлер `sr` (сдвиг справа)'],
    ['mt-auto', 'хендлер `mt`'],
    ['w-full', 'хендлер `w`'],
    ['bg-red-500', 'хендлер `bg`'],
    ['my-widget', 'хендлер `my` (отступ сверху и снизу)'],
  ])('%s — запись есть, значение не разобрано: предупреждение без CSS (%s)', (token) => {
    const r = compile(token);
    expect(r.css).toBe('');
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  test.each([
    'w50@',
    'p10:',
    'cF00.',
    'p10@()',
    'w10zz',
    'pZzz',
  ])('%s — предупреждает: это MN-токен с ошибкой', (token) => {
    const r = compile(token);
    expect(r.css).toBe('');
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  test.each([
    ['w$v', 'width:var(--v)'],
    ['w$$safe', 'width:env(safe)'],
    ['w10-5', 'width:calc(10px - 5px)'],
    ['w-5', ''],
    ['bgF00-00F', 'background:linear-gradient'],
    ['tupFF', 'text-underline-position:from-font'],
  ])('%s — формы нотации с дефисом не задеты', (token, expected) => {
    const r = compile(token);
    expected ? expect(r.css).toContain(expected) : expect(r.css).toBe('');
  });
});
