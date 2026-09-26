/**
 * Граничные формы значений у стандартных хендлеров: составные значения,
 * кавычки, мини-DSL трансформаций и фильтров, отбраковка заведомо битых
 * аргументов (она превращается в warning, а не в исключение наружу).
 */
import {
  minotationProvider, 
} from '../core/index';
import presetStandard from '../presets/standard';
import type {
  MnWarning, 
} from '../core/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function compile(tokens: string[], options?: any): { css: string;
  warnings: MnWarning[] } {
  const warnings: MnWarning[] = [];
  const mn: any = minotationProvider({
    onWarning: (w: MnWarning) => warnings.push(w),
    ...options, 
  });
  mn.setPresets([presetStandard]);
  const c = mn.getCompiler('class');
  for (const t of tokens) {
    c(t);
  }
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n'),
    warnings, 
  };
}

describe('составные значения', () => {
  test('значение с пробелами берётся в кавычки (font-family)', () => {
    expect(compile(['ff_Times_New_Roman']).css).toContain('font-family:"Times New Roman"');
  });

  test('в content подчёркивание даёт пробел, кавычки ставит хендлер', () => {
    expect(compile(['cnt_a_b']).css).toContain('content:"a b"');
    // Текста после `_` нет — пустая строка; пробел пишется мнемоникой.
    expect(compile(['cnt_']).css).toContain('content:""');
    expect(compile(['cntS']).css).toContain('content:" "');
  });

  test('несколько фильтров через подчёркивание складываются в одно значение', () => {
    expect(compile(['ftBlur3_Invert20']).css).toContain('filter:blur(3px) invert(20%)');
  });

  test('transform: Z-сдвиг и поворот вместе с базовым translate', () => {
    const css = compile(['xZ10', 'x50Y30S150Rz45']).css;
    expect(css).toContain('translateZ(10px)');
    expect(css).toContain('translate(50px,30px) scale(1.5) rotateZ(45deg)');
  });
});

describe('битые аргументы', () => {
  test('два десятичных разделителя в числе — токен не даёт правила', () => {
    const {
      css, 
    } = compile(['w1.2.3']);

    // хендлер бросает обычную ошибку разбора: она уходит в error$, а не в warnings$
    expect(css).not.toContain('width:1.2.3');
    expect(css).not.toContain('w1\\.2\\.3');
  });

  test('неизвестная единица измерения — токен отбраковывается', () => {
    const {
      css, 
    } = compile(['w10qq']);

    expect(css).not.toContain('width:10qq');
  });

  test('битый токен не мешает соседним компилироваться', () => {
    const {
      css, 
    } = compile(['w1.2.3', 'p10']);

    expect(css).toContain('padding:10px');
  });
});

describe('сдвиги, стороны и производные значения', () => {
  test('calc-добавка без единицы получает единицу по умолчанию', () => {
    expect(compile(['w50%+10']).css).toContain('width:calc(50% + 10px)');
  });

  test('transform: единица у Z-сдвига берётся из аргумента', () => {
    expect(compile(['xZ10%']).css).toContain('translateZ(10%)');
  });

  test('хендлеры сторон без аргумента раскрываются в значение по умолчанию', () => {
    const css = compile(['s', 'st']).css;
    expect(css).toContain('top:0');
    expect(css).toContain('bottom:0');
  });

  test('неизвестная функция фильтра прокидывается как есть', () => {
    expect(compile(['ftZzz10']).css).toContain('filter:zzz(10)');
  });

  test('известный фильтр без аргумента берёт значение по умолчанию из реестра', () => {
    const css = compile(['ftBlur', 'ftGrayscale']).css;
    expect(css).toContain('filter:blur(4px)');
    expect(css).toContain('filter:grayscale()');
  });

  test('ratio задаёт пропорцию и растягивает потомков', () => {
    const css = compile(['ratio16x9']).css;
    expect(css).toContain('>*');
    expect(css).toContain('top:0');
  });

  test('отрицательное значение допустимо там, где знак разрешён', () => {
    expect(compile(['m-10']).css).toContain('margin:-10px');
    expect(compile(['st-10']).css).toContain('top:-10px');
    // …и недопустимо там, где свойство его не принимает: `width:-10px`
    // браузер отбрасывает (было расхождением с v1 до 2026-09-26).
    expect(compile(['w-10']).css).toBe('');
  });
});

describe('toFixed — устойчивость к погрешности IEEE754 (RESEARCH/05, 2026-09-23)', () => {
  // Баг был в `Math.floor(v*100)*0.01`: `33.3*100 === 3329.9999999999995` в IEEE754,
  // floor отбрасывал вниз → "33.29" вместо "33.3". Починено на `Math.round`.
  test.each([
    ['pt33.3%', 'padding-top:33.3%'],
    ['pt0.29%', 'padding-top:.29%'],
    ['pt0.58%', 'padding-top:.58%'],
    ['pt12.3%', 'padding-top:12.3%'],
  ])('%s → %s (не искажается погрешностью float)', (token, expected) => {
    expect(compile([token]).css).toContain(expected);
  });

  test('целые проценты по-прежнему без дробной части', () => {
    expect(compile(['pt50%']).css).toContain('padding-top:50%');
  });
});
/**
 * «Голое число = px» — сквозное правило нотации. Шесть свойств-длин из общего
 * блока свободных значений из него выпадали: `ti10` давало `text-indent:10`,
 * невалидный CSS. У `ti`/`wos`/`bsp`/`fxb` это ловил валидатор (правила в
 * выводе не было вовсе), у `tdt`/`tuo` проходило молча — свойств нет в его
 * таблице. Исправлено 2026-09-23.
 */
describe('единица по умолчанию у свойств-длин', () => {
  function cssOf(token: string): string {
    const mn = minotationProvider({
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
    ['ti10', 'text-indent:10px'],
    ['wos10', 'word-spacing:10px'],
    ['bsp10', 'border-spacing:10px'],
    ['fxb10', 'flex-basis:10px'],
    ['tdt2', 'text-decoration-thickness:2px'],
    ['tuo2', 'text-underline-offset:2px'],
    // Дробное и отрицательное — тоже длина.
    ['ti1.5', 'text-indent:1.5px'],
    ['ti-5', 'text-indent:-5px'],
    // Каждая часть многозначного значения.
    ['bsp10_20', 'border-spacing:10px 20px'],
    // Явная единица не дублируется, `0` остаётся без единицы.
    ['ti10px', 'text-indent:10px'],
    ['ti0', 'text-indent:0'],
    // Пустой суффикс — значение по умолчанию, как у `p`/`m`.
    ['ti', 'text-indent:0'],
    ['wos', 'word-spacing:0'],
    ['bsp', 'border-spacing:0'],
    ['fxb', 'flex-basis:0'],
    // Ключевые слова и переменные не трогаем.
    ['tiInherit', 'text-indent:inherit'],
    ['fxbAuto', 'flex-basis:auto'],
    ['ti--v', 'text-indent:var(--v)'],
  ])('%s → %s', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test('числовые свойства единицу НЕ получают', () => {
    // Сторож: `px` не должен просочиться туда, где значение — число.
    expect(cssOf('or2')).toBe('order:2');
    expect(cssOf('fxg2')).toBe('flex-grow:2');
    expect(cssOf('zm2')).toBe('zoom:2');
  });
});

/** `normal` — initial value у gap-семейства; синоним был только у `ggc`. */
describe('gap: синоним N (normal) во всём семействе', () => {
  function cssOf(token: string): string {
    const mn = minotationProvider({
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
    ['gapN', 'gap:normal'],
    ['gapxN', 'column-gap:normal'],
    ['gapyN', 'row-gap:normal'],
    ['ggN', 'grid-gap:normal'],
    ['ggrN', 'grid-row-gap:normal'],
    ['ggcN', 'grid-column-gap:normal'],
  ])('%s → %s', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test('числовые формы не задеты', () => {
    expect(cssOf('gap10')).toBe('gap:10px');
    expect(cssOf('gg10')).toBe('grid-gap:10px');
  });
});

/**
 * Аудит сокращённых записей по `mdn-data`. У каждого
 * значения, которое свойство принимает по спецификации, должна быть короткая
 * форма — раньше их не было у 20 хендлеров. Плюс три карты синонимов состояли
 * из значений, невалидных по текущей спецификации: `tw` (`text-wrap`),
 * `wsc` (`white-space-collapse`), `ww` (`word-wrap`) — токены с ними давали
 * CSS, который браузер молча отбрасывает.
 */
describe('сокращённые записи значений', () => {
  function cssOf(token: string): string {
    const mn = minotationProvider({
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
    // Карты, которые были заполнены значениями из умерших черновиков.
    ['twB', 'text-wrap:balance'],
    ['twP', 'text-wrap:pretty'],
    ['wscC', 'white-space-collapse:collapse'],
    ['wscPB', 'white-space-collapse:preserve-breaks'],
    ['wwA', 'word-wrap:anywhere'],
    // Пропуски в существующих картах.
    ['crW', 'cursor:wait'],
    ['crZI', 'cursor:zoom-in'],
    ['crNWR', 'cursor:nw-resize'],
    ['ovC', 'overflow:clip'],
    ['aiAC', 'align-items:anchor-center'],
    ['jiFS', 'justify-items:flex-start'],
    // `bgp` убран (трек notation-ergonomics, задача 5) — только атомарные оси.
    ['bgpxL', 'background-position-x:left'],
    ['bgpyT', 'background-position-y:top'],
    ['bgpxXS', 'background-position-x:x-start'],
    ['opC', 'object-position:center'],
    ['clIS', 'clear:inline-start'],
    ['rszBL', 'resize:block'],
    ['taMP', 'text-align:match-parent'],
    ['ttMA', 'text-transform:math-auto'],
    ['tjICH', 'text-justify:inter-character'],
    ['wsPR', 'white-space:preserve'],
    ['wbBW', 'word-break:break-word'],
    ['bgcpBA', 'background-clip:border-area'],
    ['wmSRL', 'writing-mode:sideways-rl'],
    ['dFW', 'display:flow'],
    ['tdBL', 'text-decoration:blink'],
    ['tdW', 'text-decoration:wavy'],
    ['usAL', 'user-select:all'],
    ['eAL', 'pointer-events:all'],
    ['vaS', 'vertical-align:sub'],
    ['fvTN', 'font-variant:tabular-nums'],
    ['fsmS', 'font-smooth:small'],
  ])('%s → %s', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test.each([
    // Сторожа: прежние формы не сломаны переназначением букв.
    ['dF', 'display:flex'],
    ['clB', 'clear:both'],
    ['rszB', 'resize:both'],
    ['taL', 'text-align:left'],
    ['wsN', 'white-space:normal'],
    ['wbK', 'word-break:keep-all'],
    ['crP', 'cursor:pointer'],
    ['tdU', 'text-decoration:underline'],
    ['vaSUP', 'vertical-align:super'],
    ['fvSC', 'font-variant:small-caps'],
  ])('%s → %s (прежняя форма)', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test('text-decoration-line не получил стили линии от шортката', () => {
    // `solid` валиден у `text-decoration`, но не у `text-decoration-line` —
    // карта общая, поэтому расширяли только шорткат.
    expect(cssOf('tdS')).toBe('text-decoration:solid');
    expect(cssOf('tdlS')).not.toBe('text-decoration-line:solid');
  });

  test('свободное значение продолжает работать там, где были карты', () => {
    // `op` остался общим: атомарных object-position-x/y в CSS нет.
    expect(cssOf('op_left_top')).toBe('object-position:left top');
    expect(cssOf('bgpx50%')).toBe('background-position-x:50%');
  });

  test('общий bgp убран — остались только оси', () => {
    // Задача 5 трека: общий хендлер давал уникальный класс на каждую
    // комбинацию осей, атомарные части переиспользуются между комбинациями.
    expect(cssOf('bgpL')).toBe('');
    expect(cssOf('bgp_left_top')).toBe('');
  });
});

/**
 * Ветки, найденные разбором покрытия:
 * категория A): живой код без единого теста. Здесь закрываются все восемь.
 */
describe('переменная как слагаемое в calc (PATTERN_VAR_ADD)', () => {
  function cssOf(token: string): string {
    const m = cssOfFull(token).match(/\{([^}]*)\}\s*$/);
    return m ? m[1] : '';
  }

  /** Полное правило вместе с селектором — нужно, чтобы проверять комбинаторы. */
  function cssOfFull(token: string): string {
    const mn = minotationProvider({
      onWarning: 'silent',
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')(token);
    mn.compile();
    return mn.styles$.getValue().map((s) => s.content).join('');
  }

  // Три дефиса подряд читаются как «знак операции `-`» + «`--` имени переменной».
  // Со знаком `+` то же самое работает с 2026-09-25: до этого `+` всегда был
  // комбинатором соседа, кроме случая «перед цифрой», и `w10+--a` молча терял
  // слагаемое (`.w10\+--a+--a{width:10px}`). Исключение добавлено в
  // `REGEXP_SELECTOR_EXCEPTIONS`.
  test.each([
    ['w10---a', 'width:calc(10px - var(--a))'],
    ['w10----a', 'width:calc(10px - env(--a))'],
    ['w10---a,10px', 'width:calc(10px - var(--a,10px))'],
    ['w10---a,10', 'width:calc(10px - var(--a,10px))'],
    ['w--a;---b', 'width:calc(var(--a) - var(--b))'],
    ['w10+--a', 'width:calc(10px + var(--a))'],
    ['w10+---a', 'width:calc(10px + env(--a))'],
    ['w10+--a,10px', 'width:calc(10px + var(--a,10px))'],
    ['w--a;+--b', 'width:calc(var(--a) + var(--b))'],
  ])('%s → %s', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test('единица дописывается к дефолту переменной, если её не указали', () => {
    // `,10` без единицы и `,10px` дают одно и то же — разница только в том,
    // берётся ли ветка `validateUnit(p.vua)`.
    expect(cssOf('w10---a,10')).toBe(cssOf('w10---a,10px'));
  });

  test('комбинатор соседа не задет: `+` перед обычным селектором работает как был', () => {
    // Исключение узкое — только `+` непосредственно перед `--`.
    expect(cssOfFull('p10+div')).toContain('+div{padding:10px}');
    expect(cssOfFull('p10+.next')).toContain('+.next{padding:10px}');
  });

  test('числовое слагаемое не задето', () => {
    expect(cssOf('w10+5')).toBe('width:calc(10px + 5px)');
    expect(cssOf('w10-5')).toBe('width:calc(10px - 5px)');
  });
});

describe('hex с непрозрачной альфой канонизируется до короткой формы', () => {
  test('cFF0000FF → подсказка cF00, правила нет', () => {
    // Альфа `ff` = полностью непрозрачный: отбрасывается, дальше обычное
    // сокращение пар. Тесты цвета писались на ПРОЗРАЧНУЮ альфу (`cFF000088`),
    // поэтому эта ветка оставалась без покрытия.
    const r = compile(['cFF0000FF']);
    expect(r.css).not.toContain('color:');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].type).toBe('parse-error');
    expect(r.warnings[0].message).toContain('"cF00"');
  });

  test('альфа F у короткой формы тоже отбрасывается', () => {
    const r = compile(['cF00F']);
    expect(r.css).not.toContain('color:');
    expect(r.warnings[0].message).toContain('"cF00"');
  });

  test('прозрачная альфа по-прежнему уводит в десятичную форму', () => {
    expect(compile(['cFF000088']).warnings[0].message).toContain('"cF00.53"');
  });
});

/**
 * Неразобранный хвост суффикса больше не отбрасывается молча.
 *
 * Корень у `ratio` был не в самом хендлере: `routeParseProvider` оборачивал
 * тело маршрута как `^body$`, и альтернация верхнего уровня разносила якоря
 * (`^A|B$` — «A с начала ИЛИ B до конца»). Из-за этого `ratio` матчился началом,
 * а специально заведённая ловушка `(.*):other` не срабатывала никогда.
 * Починено в `fundamentool` — тело оборачивается в `^(?:body)$`.
 */
describe('ratio: хвост, который не разобрался, бракует токен', () => {
  function compileRatio(token: string): { css: string;
    warnings: MnWarning[] } {
    return compile([token]);
  }

  test.each([
    ['ratio16/9', 'пропорция пишется через `x`: ratio16x9'],
    ['ratio56.25', 'дробь в этой позиции шаблон не принимает'],
    ['ratio9x16zzz', 'мусор в хвосте'],
  ])('%s → брак (%s)', (token) => {
    const r = compileRatio(token);
    expect(r.css).not.toContain('padding-top');
    expect(r.warnings.map((w) => w.type)).toContain('parse-error');
  });

  test.each([
    ['ratio9x16', 'padding-top:177.78%'],
    ['ratio16', 'padding-top:16%'],
    ['ratio16+10px', 'padding-top:calc(16% + 10px)'],
  ])('%s продолжает работать', (token, expected) => {
    expect(compileRatio(token).css).toContain(expected);
  });
});

/**
 * Сокращение для
 * `repeat(auto-fit, minmax(…))` — самого ходового паттерна адаптивной сетки.
 * Без него он пишется четырьмя экранированными скобками.
 */
describe('auto-repeat: gtcAF240 вместо gtcRepeat\\(auto-fit,minmax\\(240px,1fr\\)\\)', () => {
  function cssOf(token: string): string {
    const mn = minotationProvider({
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
    ['gtcAF240', 'grid-template-columns:repeat(auto-fit, minmax(240px, 1fr))'],
    ['gtcAF240_1fr', 'grid-template-columns:repeat(auto-fit, minmax(240px, 1fr))'],
    ['gtcAF240_300', 'grid-template-columns:repeat(auto-fit, minmax(240px, 300px))'],
    ['gtcAF15em', 'grid-template-columns:repeat(auto-fit, minmax(15em, 1fr))'],
    ['gtcAF20%_1fr', 'grid-template-columns:repeat(auto-fit, minmax(20%, 1fr))'],
    ['gtcAFL240', 'grid-template-columns:repeat(auto-fill, minmax(240px, 1fr))'],
    ['gtrAF100', 'grid-template-rows:repeat(auto-fit, minmax(100px, 1fr))'],
  ])('%s → %s', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test('второй аргумент по умолчанию — 1fr, явный 1fr даёт тот же CSS', () => {
    expect(cssOf('gtcAF240')).toBe(cssOf('gtcAF240_1fr'));
  });

  test.each([
    'gtcAF',       // без размера
    'gtcAFL',
    'gtcAF240_',   // разделитель без второго аргумента
    'gtcAF240_1fr_2fr',
  ])('%s → брак, а не молчаливый мусор', (token) => {
    // До сокращения `gtcAF` уходил в общий путь свободного значения и давал
    // `grid-template-columns:a-f` — невалидный CSS без предупреждения.
    expect(cssOf(token)).toBe('');
  });

  test.each([
    ['gtcNone', 'grid-template-columns:none'],
    ['gtcAuto', 'grid-template-columns:auto'],
    ['gtc1fr_auto', 'grid-template-columns:1fr auto'],
    ['gtcSubgrid', 'grid-template-columns:subgrid'],
  ])('%s — обычные значения не задеты', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test('полная экранированная форма продолжает работать', () => {
    // Сокращение её не отменяет: `minmax(200px, 300px)` без auto-repeat,
    // именованные линии и прочее по-прежнему пишутся скобками.
    expect(cssOf('gtcRepeat\\(auto-fit,minmax\\(240px,1fr\\)\\)'))
      .toBe('grid-template-columns:repeat(auto-fit,minmax(240px,1fr))');
  });
});

/**
 * Хендлеры со словарём кратких записей бракуют незнакомое СЛОВО.
 *
 * Раньше оно проходило насквозь и давало мёртвое правило: `ovN` →
 * `overflow:n`, `posN` → `position:n`. Ловил это только валидатор ядра,
 * который по плану Q-01 из рантайма уходит.
 */
describe('незнакомое слово у хендлера со словарём', () => {
  function cssOf(token: string): string {
    const mn = minotationProvider({
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
    'ovN',
    'ovxN',
    'ovyN',
    'vN',
  ])('%s → брак: такой краткой записи нет', (token) => {
    expect(cssOf(token)).toBe('');
  });

  test.each([
    ['ovH', 'overflow:hidden'],
    ['clN', 'clear:none'],
    ['dF', 'display:flex'],
    ['crP', 'cursor:pointer'],
    ['jcC', 'justify-content:center'],
  ])('%s → %s — краткая запись работает', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test.each([['ovInherit', 'overflow:inherit'], ['dUnset', 'display:unset']])('%s → %s — CSS-wide keywords проходят', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test.each([
    ['d--v', 'display:var(--v)'],
    ['bgpx50%', 'background-position-x:50%'],
    ['tn_0.2s_all_ease', 'transition:0.2s all ease'],
  ])('%s → %s — переменные, числа и свободная форма не задеты', (token, expected) => {
    // Проверяется только СЛОВО: числа, проценты, функции и режим с ведущим `_`
    // словарём не перечислить, и у многих свойств они законны.
    expect(cssOf(token)).toBe(expected);
  });

  test('длинная форма по-прежнему уводит к краткой', () => {
    expect(cssOf('dFlex')).toBe('');
    expect(cssOf('crPointer')).toBe('');
  });
});

/**
 * Свойства-длины бракуют голое слово.
 *
 * `tiA` давало `text-indent:a`, `wosN` — `word-spacing:n`, `fxbZzz` —
 * `flex-basis:zzz`. Список допустимых слов задан на свойство: у `text-indent`
 * и `border-spacing` их нет вовсе, у `flex-basis` — пять.
 */
describe('голое слово у свойства-длины', () => {
  function cssOf(token: string): string {
    const mn = minotationProvider({
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
    'tiA',
    'tiN',
    'wosA',
    'wosN',
    'bspA',
    'bspN',
    'fxbZzz',
    'tdtZzz',
    'tuoN',
  ])('%s → брак', (token) => {
    expect(cssOf(token)).toBe('');
  });

  test.each([
    ['ti10', 'text-indent:10px'],
    ['wosNormal', 'word-spacing:normal'],
    ['fxbAuto', 'flex-basis:auto'],
    ['fxbFitContent', 'flex-basis:fit-content'],
    ['tdtFromFont', 'text-decoration-thickness:from-font'],
    ['tuoAuto', 'text-underline-offset:auto'],
  ])('%s → %s — ключевое слово своего свойства', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test.each([['tiInherit', 'text-indent:inherit'], ['bspUnset', 'border-spacing:unset']])('%s → %s — CSS-wide проходят', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test.each([['apcNone', 'appearance:none'], ['irPixelated', 'image-rendering:pixelated']])('%s → %s — не-длины в том же блоке не задеты', (token, expected) => {
    // У них значения произвольны и словарём не перечислимы.
    expect(cssOf(token)).toBe(expected);
  });
});
