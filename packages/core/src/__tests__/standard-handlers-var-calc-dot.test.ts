/**
 * Сплошная проверка ВСЕХ хендлеров стандартного пресета на трёх сквозных
 * механизмах значения: CSS-переменные (одна и несколько сразу), вычисляемое
 * значение (`calc`) и точка — экранированная и нет.
 *
 * Зачем сплошная: правки по месту дважды подряд оставляли целые группы
 * хендлеров со своим путём разбора (`border-style` — голый `toKebabCase`,
 * `page-break` — массивная форма `synonymProvider`, `bgi`/`lisi`/`maski` —
 * безусловная обёртка в `url(…)`). Имена не перечисляются вручную: собираются
 * с самого пресета через Proxy, поэтому новый хендлер попадает под проверку
 * автоматически.
 *
 * Проверяются инварианты, а не точные значения (у 313 хендлеров они разные);
 * точные ожидания — во втором describe, по представителю каждого класса
 * разбора.
 */
import {
  minotationProvider,
} from '../core/index';
import presetStandard from '../presets/standard';
import presetSynonyms from '../presets/synonyms';
import presetMedias from '../presets/medias';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Собирает имена всех эссенций, регистрируемых пресетом. */
function collectHandlerNames(): string[] {
  const mn: any = minotationProvider();
  const names: string[] = [];
  const spy = new Proxy(mn, {
    apply(
      target, thisArg, args: any[],
    ) {
      if (typeof args[0] === 'string') {
        names.push(args[0]);
      } else if (args[0] && typeof args[0] === 'object') {
        for (const key of Object.keys(args[0])) {
          names.push(key);
        }
      }
      return Reflect.apply(
        target as any, thisArg, args,
      );
    },
  });
  presetStandard(spy as any);
  return names;
}

const HANDLER_NAMES = Array.from(new Set(collectHandlerNames())).sort();

/** CSS всех правил инстанса, в который скормлены `tokens`. */
function cssOfTokens(tokens: string[]): string {
  const mn: any = minotationProvider({
    onWarning: 'silent',
  });
  mn.setPresets([
    presetStandard,
    presetSynonyms,
    presetMedias,
  ]);
  const compile = mn.getCompiler('class');
  for (let i = 0; i < tokens.length; i++) {
    compile(tokens[i]);
  }
  mn.compile();
  return mn.styles$.getValue().map((s: {
    content: string;
  }) => s.content).join('');
}

/** Только тела правил (`{…}`), без селекторов — в них разбираем значения. */
function declarationsOf(css: string): string {
  return (css.match(/\{[^}]*\}/g) || []).join('');
}

/**
 * Нарушения инвариантов в CSS. Пустой массив — всё чисто.
 *
 * Селекторы исключены намеренно: `\` и `.` в них законны (экранирование имени
 * класса), проверять нужно только значения.
 */
function violations(css: string): string[] {
  const decls = declarationsOf(css);
  const found: string[] = [];
  // Имя переменной, не завёрнутое в var/env — молчаливый литерал в CSS.
  if (decls.replace(/(?:var|env)\([^)]*\)/g, '').includes('--')) {
    found.push('литерал "--" вне var()/env()');
  }
  // Экранирование должно сниматься при нормализации значения, а не утекать в CSS.
  if (decls.includes('\\')) {
    found.push('обратный слэш в значении');
  }
  // Служебный маркер splitValueParts (подменяет `_` внутри имени переменной).
  if (decls.includes('\0')) {
    found.push('служебный \\0 в значении');
  }
  // Пустое объявление: признак утёкшего терминатора `;` внутрь значения
  // (так выглядел баг `bs--v;` → `border-style:--v;;`).
  if (/;\s*;/.test(decls) || /;\s*\}/.test(decls)) {
    found.push('пустое объявление (утёкший ";")');
  }
  return found;
}

/**
 * Значение без «оформления»: без содержимого `url(…)` и кавычек. Нужно, чтобы
 * отличить настоящий список частей (`outline:aa bb`) от одного значения, внутри
 * которого пробел ничего не разделяет (`font-family:"aa bb"` — имя шрифта,
 * `url("aa_bb")` — путь к файлу).
 */
function unquoted(decls: string): string {
  return decls
    .replace(/url\([^)]*\)/g, '')
    .replace(/"[^"]*"/g, '')
    .replace(/'[^']*'/g, '');
}

/**
 * Профиль значения хендлера — какие формы записи для него вообще осмысленны.
 *
 * Определяется ЭМПИРИЧЕСКИ, пробой самого хендлера, а не списком имён: список
 * пришлось бы править руками при каждом новом хендлере, и он молча устаревал бы
 * (ровно так и появились ad-hoc исключения, которые этот механизм заменил).
 * Каждая проба — вопрос к хендлеру на его же языке:
 *
 * - `calc` — даёт ли `10+5` настоящий `calc(`. Проверять реакцию на голое `10`
 *   нельзя: хендлеры свободного значения принимают его как обычное значение
 *   (`ac10` → `align-content:10`) и ложно попадают в выборку.
 * - `gradient` — строит ли `F00-00F` градиент. У таких разделитель значений —
 *   дефис, а не `_` (`bg`, `maskbg`).
 * - `multipart` — собирает ли `_aa_bb` значение из ДВУХ частей. `url`-свойства
 *   и `font-family` принимают одно значение, и `_` внутри него разделителем не
 *   является.
 */
interface ValueProfile {
  calc: boolean;
  gradient: boolean;
  multipart: boolean;
}

function profileOf(name: string): ValueProfile {
  return {
    calc: declarationsOf(cssOfTokens([name + '10+5'])).includes('calc('),
    gradient: declarationsOf(cssOfTokens([name + 'F00-00F'])).includes('gradient('),
    multipart: unquoted(declarationsOf(cssOfTokens([name + '_aa_bb']))).includes('aa bb'),
  };
}

const PROFILES: Record<string, ValueProfile> = {};
for (let i = 0; i < HANDLER_NAMES.length; i++) {
  PROFILES[HANDLER_NAMES[i]] = profileOf(HANDLER_NAMES[i]);
}

/** Хендлеры, у которых профиль разрешает данную форму. */
function withProfile(flag: keyof ValueProfile): string[] {
  return HANDLER_NAMES.filter((name) => PROFILES[name][flag]);
}

const NUMERIC_HANDLERS = withProfile('calc');
const MULTIPART_HANDLERS = withProfile('multipart');
const GRADIENT_HANDLERS = withProfile('gradient');

/** Прогоняет форму по списку хендлеров, возвращает список нарушителей. */
function sweep(makeToken: (name: string) => string, names: string[] = HANDLER_NAMES): string[] {
  const bad: string[] = [];
  for (let i = 0; i < names.length; i++) {
    const token = makeToken(names[i]);
    let css: string;
    try {
      css = cssOfTokens([token]);
    } catch (e) {
      bad.push(token + ' → исключение: ' + (e as Error).message);
      continue;
    }
    const found = violations(css);
    if (found.length) {
      bad.push(token + ' → ' + found.join(', ') + ' → ' + declarationsOf(css));
    }
  }
  return bad;
}

describe('все хендлеры стандартного пресета: переменные, calc, точка', () => {
  test('реестр собран (страховка: пустой список молча «проходил» бы всё)', () => {
    expect(HANDLER_NAMES.length).toBeGreaterThan(300);
  });

  test('одна переменная — ' + HANDLER_NAMES.length + ' хендлеров', () => {
    expect(sweep((n) => n + '--v')).toEqual([]);
  });

  test('одна переменная с терминатором', () => {
    expect(sweep((n) => n + '--v;')).toEqual([]);
  });

  test('переменная с `_` в имени (терминатор обязателен)', () => {
    expect(sweep((n) => n + '--a_b;')).toEqual([]);
  });

  test('несколько переменных — ' + MULTIPART_HANDLERS.length + ' составных', () => {
    expect(sweep((n) => n + '_--a_--b', MULTIPART_HANDLERS)).toEqual([]);
  });

  test('несколько переменных с `_` в именах', () => {
    expect(sweep((n) => n + '_--a_b;_--c_d;', MULTIPART_HANDLERS)).toEqual([]);
  });

  test('env() — тройной дефис', () => {
    expect(sweep((n) => n + '_---safe_solid', MULTIPART_HANDLERS)).toEqual([]);
  });

  test('calc: переменная + сдвиг — ' + NUMERIC_HANDLERS.length + ' числовых', () => {
    expect(sweep((n) => n + '--v;+5', NUMERIC_HANDLERS)).toEqual([]);
  });

  test('calc: числовой сдвиг', () => {
    expect(sweep((n) => n + '10+5', NUMERIC_HANDLERS)).toEqual([]);
  });

  test('calc: вычитание', () => {
    expect(sweep((n) => n + '10-5', NUMERIC_HANDLERS)).toEqual([]);
  });

  test('calc: разные единицы', () => {
    expect(sweep((n) => n + '100%-20px', NUMERIC_HANDLERS)).toEqual([]);
  });

  test('профили распознаны (страховка: пустая выборка молча «проходила» бы всё)', () => {
    expect(NUMERIC_HANDLERS.length).toBeGreaterThan(50);
    expect(MULTIPART_HANDLERS.length).toBeGreaterThan(50);
    // Градиент строят ровно `bg` и `maskbg` — оба через backgroundProvider.
    expect(GRADIENT_HANDLERS).toEqual(['bg', 'maskbg']);
  });

  test('экранированная точка — остаётся в значении', () => {
    expect(sweep((n) => n + '_a\\.b')).toEqual([]);
  });

  test('неэкранированная точка — разделитель self-class, не ломает вывод', () => {
    expect(sweep((n) => n + '_a.b')).toEqual([]);
  });

  test('точка перед цифрой доходит до хендлера без экранирования', () => {
    expect(sweep((n) => n + '10.5')).toEqual([]);
  });
});

/**
 * Точные ожидания по представителю каждого класса разбора. Sweep выше ловит
 * молчаливый мусор, эти — что значение собирается ИМЕННО так, как задумано.
 */
describe('представители классов разбора — точные значения', () => {
  function cssOf(token: string): string {
    const m = cssOfTokens([token]).match(/\{([^}]*)\}\s*$/);
    return m ? m[1] : '';
  }

  describe.each([
    // [класс разбора, токены и ожидания]
    ['числовой/размерный (getVal)', [
      ['w--v', 'width:var(--v)'],
      ['w--my_w;', 'width:var(--my_w)'],
      ['w--v;+5', 'width:calc(var(--v) + 5px)'],
      ['w10+5', 'width:calc(10px + 5px)'],
      ['w10-5', 'width:calc(10px - 5px)'],
      ['w10.5', 'width:10.5px'],
      ['w10\\.5', 'width:10.5px'],
      ['p--a;_--b;', 'padding:var(--a) var(--b)'],
    ]],
    ['цветовой', [
      ['c--v', 'color:var(--v)'],
      ['c--my_ink;', 'color:var(--my_ink)'],
      ['bc--my_line;', 'border-color:var(--my_line)'],
      ['olc--v', 'outline-color:var(--v)'],
    ]],
    ['свободное значение (synonymProvider)', [
      ['ol--v', 'outline:var(--v)'],
      ['ol_--a_--b', 'outline:var(--a) var(--b)'],
      ['ol3px_solid_--marker', 'outline:3px solid var(--marker)'],
      ['ol_1px_solid_---safe', 'outline:1px solid env(--safe)'],
      ['ol_a\\.b', 'outline:a.b'],
      ['pos--v', 'position:var(--v)'],
    ]],
    ['border-style (свой sidesSetter)', [
      ['bs--v', 'border-style:var(--v)'],
      ['bs--a_b;', 'border-style:var(--a_b)'],
      ['bsx--v', 'border-left-style:var(--v);border-right-style:var(--v)'],
    ]],
    ['массивная форма synonymProvider (page-break)', [['pgba--v', 'page-break-after:var(--v);break-after:var(--v)'], ['pgbi--a_b;', 'page-break-inside:var(--a_b);break-inside:var(--a_b)']]],
    ['url-свойства', [
      ['bgi--hero', 'background-image:var(--hero)'],
      ['bgi--a_b;', 'background-image:var(--a_b)'],
      ['bgi_img/a\\.png', 'background-image:url("img/a.png")'],
      ['lisi--v', 'list-style-image:var(--v)'],
      ['maski--v', 'mask-image:var(--v)'],
    ]],
    ['тени (свой позиционный парсер + сырая ветка)', [['bxsh_0_0_10px_--shadow', 'box-shadow:0 0 10px var(--shadow)'], ['bxsh_0_0_--a;_--b;', 'box-shadow:0 0 var(--a) var(--b)']]],
    ['multi-value свойства', [['tn_all_0.2s_--ease', 'transition:all 0.2s var(--ease)'], ['tn_--a;_--b;', 'transition:var(--a) var(--b)']]],
    ['шрифт и content', [
      ['ff--v', 'font-family:var(--v)'],
      ['ff--my_font;', 'font-family:var(--my_font)'],
      ['ff--mono,serif', 'font-family:var(--mono,serif)'],
      ['font16px/1.55_--font', 'font:16px/1.55 var(--font)'],
      ['cnt_a\\.b', 'content:a.b'],
    ]],
  ])('%s', (_cls, cases) => {
    test.each(cases)('%s → %s', (token, expected) => {
      expect(cssOf(token as string)).toBe(expected);
    });
  });
});

/**
 * Градиенты (`bg`/`maskbg`): разделитель значений — ДЕФИС, а не `_`; `;`
 * закрывает имя переменной. До 2026-09-23 каждый градиент для `background`
 * молча отбраковывался валидатором (`cssGrammar`: `'background': isColorValue`),
 * хотя ядро строило его правильно — правило не доходило до CSS вообще.
 */
describe('градиенты: bg / maskbg', () => {
  function cssOf(token: string): string {
    const m = cssOfTokens([token]).match(/\{([^}]*)\}\s*$/);
    return m ? m[1] : '';
  }

  test.each([
    // Два цвета: fallback-цвет + сам градиент.
    ['bgF00-00F', 'background:linear-gradient(180deg,#f00 0%,#00f 100%)'],
    ['bg0F0-00F', 'background:linear-gradient(180deg,#0f0 0%,#00f 100%)'],
    // Три точки — проценты распределяются автоматически.
    ['bgF00-00F-0F0', 'background:linear-gradient(180deg,#f00 0%,#00f 50%,#0f0 100%)'],
    // Переменные как цвета градиента.
    ['bg--a;--b;--c', 'background:linear-gradient(180deg,var(--a) 0%,var(--b) 50%,var(--c) 100%)'],
    ['bg--a;-F00-324', 'background:linear-gradient(180deg,var(--a) 0%,#f00 50%,#324 100%)'],
    // Переменная с `_` в имени внутри градиента — терминатор работает и здесь.
    ['bg--my_a;--my_b', 'background:linear-gradient(180deg,var(--my_a) 0%,var(--my_b) 100%)'],
    // Модификаторы: угол, радиальный, повторяющийся.
    ['bg0F0-00F_g90', 'background:linear-gradient(270deg,#0f0 0%,#00f 100%)'],
    ['bgF00-00F_r', 'background:radial-gradient(circle,#f00 0%,#00f 100%)'],
    ['bgF00-00F_rpt', 'background:repeating-linear-gradient(180deg,#f00 0%,#00f 100%)'],
    // maskbg — тот же backgroundProvider, свойство mask-image.
    ['maskbg0F0-00F', 'mask-image:linear-gradient(180deg,#0f0 0%,#00f 100%)'],
    ['maskbg--a;-F00-324', 'mask-image:linear-gradient(180deg,var(--a) 0%,#f00 50%,#324 100%)'],
  ])('%s → %s', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test('одиночное значение остаётся простым цветом, без градиента', () => {
    expect(cssOf('bgF00')).toBe('background:#f00');
    // Именованные цвета убраны — только коды.
    expect(cssOf('bgRed')).toBe('');
    expect(cssOf('bgF00')).toBe('background:#f00');
    expect(cssOf('bg--a')).toBe('background:var(--a)');
  });

  test('мусорное значение по-прежнему отбраковывается', () => {
    // Сторож: расширение валидатора на градиенты не должно открывать дорогу
    // произвольной строке.
    expect(cssOf('bgUndefined')).toBe('');
  });
});

describe('точка: экранированная против неэкранированной', () => {
  function cssOf(token: string): string {
    const m = cssOfTokens([token]).match(/\{([^}]*)\}\s*$/);
    return m ? m[1] : '';
  }

  test('точка перед БУКВОЙ — разделитель self-class, в значение не попадает', () => {
    // Штатное поведение, не дефект: для точки внутри значения есть экранирование.
    expect(cssOf('bgi_img/a.png')).toBe('background-image:url("img/a")');
  });

  test('экранированная точка перед буквой попадает в значение', () => {
    expect(cssOf('bgi_img/a\\.png')).toBe('background-image:url("img/a.png")');
  });

  test('точка перед ЦИФРОЙ доходит до хендлера и без экранирования', () => {
    expect(cssOf('w10.5')).toBe('width:10.5px');
    expect(cssOf('o0.5')).toBe('opacity:.5');
  });

  test('экранирование точки перед цифрой ничего не меняет', () => {
    expect(cssOf('w10\\.5')).toBe('width:10.5px');
    expect(cssOf('o0\\.5')).toBe('opacity:.5');
  });
});
