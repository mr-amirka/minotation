/**
 * Разбор состояний в комбо-имени: синонимы, цепочки, группы вариантов,
 * параметризация через `[]` и скобочные вложения. Формы зафиксированы такими,
 * какие они есть в реализации (грамматика —).
 */
import {
  minotationProvider, 
} from '../core/index';
import presetStandard from '../presets/standard';
import presetSynonyms from '../presets/synonyms';

/* eslint-disable @typescript-eslint/no-explicit-any */

function compile(token: string): string {
  const mn: any = minotationProvider();
  mn.setPresets([presetStandard, presetSynonyms]);
  mn.getCompiler('class')(token);
  mn.compile();
  return mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
}

describe('состояния в комбо-имени', () => {
  test('односимвольный синоним разворачивается в псевдокласс', () => {
    expect(compile('p10:h')).toContain(':hover{padding:10px}');
  });

  test('цепочка состояний применяется последовательно', () => {
    expect(compile('p10:h:f')).toContain(':hover:focus{padding:10px}');
  });

  test('группа вариантов даёт по селектору на каждый вариант', () => {
    const css = compile('p10:(h|f)');
    expect(css).toContain(':hover');
    expect(css).toContain(':focus');
  });

  test('параметризация через [] даёт скобки в CSS', () => {
    expect(compile('p10:nth-child[2n]')).toContain(':nth-child(2n){padding:10px}');
  });

  test('состояние с суффиксом в скобках приписывается к тому же селектору', () => {
    expect(compile('p10:h(.x)')).toContain(':hover.x{padding:10px}');
  });

  test('псевдоэлемент через двойное двоеточие', () => {
    expect(compile('p10::before')).toContain('::before{padding:10px}');
  });

  test('состояние вместе с контекстным родителем', () => {
    const css = compile('p10:h<.parent');
    expect(css).toContain('.parent ');
    expect(css).toContain(':hover');
  });

  test('состояние вместе с дочерним селектором', () => {
    const css = compile('p10:h>1.child');
    expect(css).toContain('>');
    expect(css).toContain('.child');
  });
});

describe('вложенные scope-выражения в состояниях', () => {
  test('вложенная скобка приписывается к тому же селектору', () => {
    expect(compile('p10:h(.x(.y))')).toContain(':hover.x.y{padding:10px}');
  });

  test('вложенность внутри группы вариантов', () => {
    const css = compile('p10:(h(.x)|f)');
    expect(css).toContain(':hover.x');
    expect(css).toContain(':focus');
  });
});

describe('instance.states — именованные группы состояний', () => {
  test('группа раскрывается в несколько селекторов', () => {
    const mn: any = minotationProvider();
    mn.setPresets([presetStandard, presetSynonyms]);
    // точка расширения для потребителя: пакет её сам не заполняет
    mn.states = {
      interactive: [':hover', ':focus'], 
    };
    mn.getCompiler('class')('p10:interactive');
    mn.compile();

    const css = mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
    expect(css).toContain(':hover');
    expect(css).toContain(':focus');
  });

  test('состояние не из группы остаётся литеральным псевдоклассом', () => {
    const mn: any = minotationProvider();
    mn.setPresets([presetStandard, presetSynonyms]);
    mn.states = {
      interactive: [':hover'], 
    };
    mn.getCompiler('class')('p10:checked');
    mn.compile();

    const css = mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
    expect(css).toContain(':checked{padding:10px}');
  });
});

describe('[attr=val] — атрибут-селектор как суффикс токена (v1 «Complex selectors», HANDLERS.md 2026-09-23)', () => {
  test('bg--ink[aria-pressed=true] — атрибут-селектор добавляется к элементу как есть', () => {
    expect(compile('bg--ink[aria-pressed=true]')).toBe('.bg--ink\\[aria-pressed\\=true\\][aria-pressed=true]{background:var(--ink)}');
  });

  test('bc--ink[aria-pressed=true] и c--bg[aria-pressed=true] — независимые правила с общим условием', () => {
    const mn: any = minotationProvider();
    mn.setPresets([presetStandard, presetSynonyms]);
    mn.getCompiler('class')('bc--ink[aria-pressed=true]');
    mn.getCompiler('class')('c--bg[aria-pressed=true]');
    mn.compile();
    const css = mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
    expect(css).toContain('.bc--ink\\[aria-pressed\\=true\\][aria-pressed=true]{border-color:var(--ink)}');
    expect(css).toContain('.c--bg\\[aria-pressed\\=true\\][aria-pressed=true]{color:var(--bg)}');
  });

  test('литеральный класс в HTML должен содержать суффикс буквально целиком', () => {
    // Селектор матчит ТОЛЬКО элемент, чей class содержит весь исходный токен
    // (включая скобки) — а не просто "bg--ink" отдельно.
    const css = compile('bg--ink[aria-pressed=true]');
    expect(css.startsWith('.bg--ink\\[aria-pressed\\=true\\]')).toBe(true);
  });
});

describe('(a|b) группировка + общий суффикс — практический случай (HANDLERS.md 2026-09-23)', () => {
  test('(bg|bc)F00 без суффикса — два правила на одном литеральном (нераскрытом) селекторе', () => {
    expect(compile('(bg|bc)F00')).toBe('.\\(bg\\|bc\\)F00{background:#f00}.\\(bg\\|bc\\)F00{border-color:#f00}');
  });

  test('(bg|bc)F00.active — общий self-class суффикс пишется один раз на оба свойства', () => {
    // Экономия записи vs. `bgF00.active bcF00.active` — суффикс не дублируется.
    expect(compile('(bg|bc)F00.active')).toBe('.\\(bg\\|bc\\)F00\\.active.active{background:#f00}.\\(bg\\|bc\\)F00\\.active.active{border-color:#f00}');
  });
});
/**
 * §13/§14 спеки (`04-grammar-02-parent-selectors.md`) — вырожденные формы
 * контекстных селекторов. «выдаёт предупреждение
 * и не компилирует ничего в этих кейсах».
 *
 * Все эти формы в v1 «работали», но давали не то, что имел в виду автор:
 * пустой `<` и `<N` без селектора разворачивались в универсальный `*`,
 * `<0` склеивал оба класса на одном элементе, отрицательная глубина молча
 * инвертировала направление. Отход от v1 здесь сознательный (§15 спеки).
 */
describe('вырожденные контекстные селекторы: предупреждение и никакого CSS', () => {
  function compile(token: string) {
    const warnings: { type: string;
      token?: string;
      message: string }[] = [];
    const mn: any = minotationProvider({
      onWarning: (w: { type: string;
        token?: string;
        message: string }) => warnings.push(w),
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
    ['p10<', 'пустой родительский сегмент'],
    ['p10>', 'пустой дочерний сегмент'],
    ['p10<<', 'два пустых сегмента подряд'],
    ['p10<0', 'глубина 0 — склеивание классов'],
    ['p10>0', 'глубина 0 в дочернем направлении'],
    ['p10<1', 'глубина без селектора'],
    ['p10<2', 'глубина 2 без селектора'],
    ['p10<-1', 'отрицательная глубина — инверсия направления'],
    ['p10<.a<1', 'безымянный уровень в середине цепочки'],
  ])('%s (%s) — CSS не создаётся, есть parse-error', (token) => {
    const {
      css, warnings,
    } = compile(token);
    expect(css).toBe('');
    expect(warnings.map((w) => w.type)).toContain('parse-error');
    expect(warnings[0].token).toBe(token);
  });

  test.each([
    // Сторожа: законные формы контекста не задеты.
    ['p10<.a', '.a .p10\\<\\.a{padding:10px}'],
    ['p10<1.a', '.a>.p10\\<1\\.a{padding:10px}'],
    ['p10>.c', '.p10\\>\\.c .c{padding:10px}'],
    ['p10', '.p10{padding:10px}'],
  ])('%s компилируется как раньше', (token, expected) => {
    const {
      css, warnings,
    } = compile(token);
    expect(css).toContain(expected);
    expect(warnings).toEqual([]);
  });

  test('сообщение объясняет, что было не так', () => {
    expect(compile('p10<0').warnings[0].message).toContain('Глубина 0');
    expect(compile('p10<-1').warnings[0].message).toContain('Отрицательная глубина');
    expect(compile('p10<').warnings[0].message).toContain('Пустой контекстный сегмент');
  });
});

/**
 * Синонимы состояний и предупреждение о незарегистрированном имени.
 *
 * неизвестное имя НЕ бракуется — псевдокласс
 * может быть специфичен для окружения или ещё не быть в стандарте. Но и молчать
 * нельзя: `p10:fv` давал мёртвое правило `.p10\:fv:fv{…}` без признака ошибки.
 * Предупреждение подсказывает завести синоним и писать одну каноническую форму.
 */
describe('синонимы состояний', () => {
  function compileWith(token: string): { css: string;
    warnings: any[] } {
    const warnings: any[] = [];
    const mn: any = minotationProvider({
      onWarning: (w: any) => warnings.push(w),
    });
    mn.setPresets([presetStandard, presetSynonyms]);
    mn.getCompiler('class')(token);
    mn.compile();
    return {
      css: mn.styles$.getValue().map((s: { content: string }) => s.content).join(''),
      warnings,
    };
  }

  test.each([
    ['p10:fv', ':focus-visible'],
    ['p10:fw', ':focus-within'],
    ['p10:v', ':visited'],
    ['p10:link', ':link'],
    ['p10:al', ':any-link'],
    ['p10:t', ':target'],
    ['p10:e', ':empty'],
    ['p10:root', ':root'],
    ['p10:r', ':required'],
    ['p10:opt', ':optional'],
    ['p10:ro', ':read-only'],
    ['p10:rw', ':read-write'],
    ['p10:invalid', ':invalid'],
    ['p10:valid', ':valid'],
    ['p10:ir', ':in-range'],
    ['p10:oor', ':out-of-range'],
    ['p10:ps', ':placeholder-shown'],
    ['p10:ind', ':indeterminate'],
    ['p10:def', ':default'],
    ['p10:af', ':autofill'],
    ['p10:fot', ':first-of-type'],
    ['p10:lot', ':last-of-type'],
    ['p10:oot', ':only-of-type'],
    ['p10:nt', ':nth-of-type'],
    ['p10:nl', ':nth-last-child'],
    ['p10:nlt', ':nth-last-of-type'],
  ])('%s → %s, без предупреждения', (token, expected) => {
    const r = compileWith(token);

    expect(r.css).toContain(expected + '{padding:10px}');
    expect(r.warnings).toHaveLength(0);
  });

  test.each([
    ['p10:not[.a]', ':not(.a)'],
    ['p10:is[.a]', ':is(.a)'],
    ['p10:where[.a]', ':where(.a)'],
    ['p10:has[.a]', ':has(.a)'],
  ])('%s → %s — функциональные псевдоклассы не предупреждают', (token, expected) => {
    // Ключ совпадает с именем намеренно: это штатный синтаксис нотации.
    const r = compileWith(token);

    expect(r.css).toContain(expected + '{padding:10px}');
    expect(r.warnings).toHaveLength(0);
  });

  test('псевдоэлемент не считается состоянием', () => {
    // `p10::before` даёт пару ['', 'before']: пустое имя — признак
    // псевдоэлемента, о следующем за ним предупреждать не о чем.
    const r = compileWith('p10::before');

    expect(r.css).toContain('::before{padding:10px}');
    expect(r.warnings).toHaveLength(0);
  });

  test('незарегистрированное имя компилируется, но предупреждает', () => {
    const r = compileWith('p10:fvv');

    expect(r.css).toContain(':fvv{padding:10px}');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].type).toBe('unregistered-state');
    expect(r.warnings[0].token).toBe('p10:fvv');
    expect(r.warnings[0].message).toContain('не зарегистрировано');
  });

  test('полное имя вместо синонима тоже предупреждает — нужна одна форма', () => {
    // Смысл механизма: подтолкнуть к единой канонической записи.
    // `:h` молчит, `:hover` предупреждает — либо пиши `:h`, либо заведи синоним.
    expect(compileWith('p10:h').warnings).toHaveLength(0);
    expect(compileWith('p10:hover').warnings).toHaveLength(1);
  });
});
