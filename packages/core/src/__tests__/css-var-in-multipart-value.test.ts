/**
 * Развёртка CSS-переменных в СОСТАВНОМ значении (`ol_3px_solid_--marker`).
 *
 * До 2026-09-23 подстановка `--name` → `var(--name)` работала только там, где
 * значение разбиралось общим `getVal`. Хендлеры со «свободным» значением
 * (`synonymProvider` и родня) отдавали имя переменной литералом — невалидный CSS
 * и БЕЗ предупреждения: правило просто молча не работало в браузере.
 * Найдено при переводе `affiliate-site-mn` с `mn.css` на `mn.assign`.
 */
import {
  minotationProvider,
} from '../core/index';
import presetStandard from '../presets/standard';

/* eslint-disable @typescript-eslint/no-explicit-any */

function cssOf(token: string): string {
  const mn: any = minotationProvider({
    onWarning: 'silent',
  });
  mn.setPresets([presetStandard]);
  mn.getCompiler('class')(token);
  mn.compile();
  const css = mn.styles$.getValue().map((s: {
    content: string;
  }) => s.content).join('');
  const m = css.match(/\{([^}]*)\}\s*$/);
  return m ? m[1] : '';
}

describe('CSS-переменные в составном значении', () => {
  test.each([
    // Регрессия, с которой всё началось: суффикс начинается с `_`, поэтому
    // целиком уходил в «сырой» режим и давал `outline:3px solid --marker`.
    ['ol_3px_solid_--marker', 'outline:3px solid var(--marker)'],
    // Та же форма без ведущего `_` — другой путь внутри хендлера, тот же итог.
    ['ol3px_solid_--marker', 'outline:3px solid var(--marker)'],
    // Одиночная переменная у хендлера свободного значения тоже не работала.
    ['ol--marker', 'outline:var(--marker)'],
    ['tn_all_0.2s_--ease', 'transition:all 0.2s var(--ease)'],
    ['bxsh_0_0_10px_--shadow', 'box-shadow:0 0 10px var(--shadow)'],
    ['font16px/1.55_--font', 'font:16px/1.55 var(--font)'],
    // Несколько переменных в одном значении.
    ['ol_3px_solid_--marker', 'outline:3px solid var(--marker)'],
    ['tn_--prop_--dur_--ease', 'transition:var(--prop) var(--dur) var(--ease)'],
  ])('%s → %s', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test('тройной дефис в составном значении даёт env(), как и в одиночном', () => {
    expect(cssOf('ol_3px_solid_---safe')).toBe('outline:3px solid env(--safe)');
  });

  test('имя переменной не кебабится — camelCase сохраняется', () => {
    // Иначе `--myInk` превратилось бы в `var(--my-ink)` и ссылалось бы
    // на несуществующую переменную. `getVal`-путь так себя и вёл всегда.
    expect(cssOf('ol_1px_solid_--myInk')).toBe('outline:1px solid var(--myInk)');
    expect(cssOf('c--myInk')).toBe('color:var(--myInk)');
  });

  test('форма с запасным значением: `--name,fallback`', () => {
    // Раньше REGEXP_CSS_VAR исключал запятую с пометкой «разбирается по месту»,
    // но по месту не разбиралась нигде: `ff--font,serif` давало
    // `font-family:"-font",serif` (ведущий `-` = «взять в кавычки»).
    expect(cssOf('ff--font,serif')).toBe('font-family:var(--font,serif)');
  });

  test('без терминатора `_` остаётся разделителем', () => {
    // Экранирование (`\_`) здесь не работает и работать не может: обратный слэш
    // снимается раньше, на разборе токена, и в суффикс приходит уже
    // `--line_soft`. Именно поэтому для имён с `_` нужен `;` (тесты ниже).
    expect(cssOf('ol_1px_solid_--line\\_soft'))
      .toBe('outline:1px solid var(--line) soft');
  });
});

describe('`;` — явный конец имени переменной', () => {
  test('кейс, ради которого терминатор доведён до конца', () => {
    // `_` внутри `--border_size;` — часть
    // имени, снаружи — по-прежнему разделитель частей значения.
    expect(cssOf('ol--border_size;_solid_--marker'))
      .toBe('outline:var(--border_size) solid var(--marker)');
  });

  test.each([
    // Числовой путь (getVal) — режет суффикс по `_`, терминатор его защищает.
    ['w--my_width;', 'width:var(--my_width)'],
    ['p--gap_size;', 'padding:var(--gap_size)'],
    // Терминатор совместим с арифметикой.
    ['w--my_w;+5', 'width:calc(var(--my_w) + 5px)'],
    // Путь «свободного» значения.
    ['ff--my_font;', 'font-family:var(--my_font)'],
    ['ol--marker;_solid', 'outline:var(--marker) solid'],
    // Цветовой путь: `_` там и так был доступен, но `;` не должен ломать.
    ['c--my_ink;', 'color:var(--my_ink)'],
    ['bc--my_line;', 'border-color:var(--my_line)'],
    ['olc--my_line;', 'outline-color:var(--my_line)'],
    ['bg--my_bg;', 'background:var(--my_bg)'],
    // Несколько имён с `_` в одном значении.
    ['ol--a_b;_solid_--c_d;', 'outline:var(--a_b) solid var(--c_d)'],
  ])('%s → %s', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test('терминатор необязателен — имя без `_` можно писать и с ним, и без', () => {
    expect(cssOf('w--gap;')).toBe('width:var(--gap)');
    expect(cssOf('w--gap')).toBe('width:var(--gap)');
    expect(cssOf('c--ink;')).toBe('color:var(--ink)');
    expect(cssOf('c--ink')).toBe('color:var(--ink)');
  });

  test('`;` не попадает внутрь имени переменной', () => {
    // Сторож против регрессии: когда REGEXP_CSS_VAR расширяли на
    // fallback-форму, `[^\s]+` впустил `;` в имя — `ff--my_font;` дало
    // `var(--my_font;)`.
    expect(cssOf('ff--my_font;')).not.toContain(';');
  });
});

describe('хендлеры со своим путём разбора — сплошная проверка 2026-09-23', () => {
  // Найдено прогоном ВСЕХ 313 хендлеров стандартного пресета с переменной в
  // значении: отлавливались случаи, где `--` остаётся в CSS вне `var`/`env`.
  // Три группы мимо общего пути, 107 битых комбинаций.
  test.each([
    // border-style (16 хендлеров по сторонам) — шёл через голый toKebabCase.
    ['bs--v', 'border-style:var(--v)'],
    ['bs--a_b;', 'border-style:var(--a_b)'],
    ['bsx--v', 'border-left-style:var(--v);border-right-style:var(--v)'],
    // page-break — единственные пользователи МАССИВНОЙ формы synonymProvider,
    // она нормализовала значение как имя шрифта.
    ['pgba--v', 'page-break-after:var(--v);break-after:var(--v)'],
    ['pgba--a_b;', 'page-break-after:var(--a_b);break-after:var(--a_b)'],
    ['pgbi--v', 'page-break-inside:var(--v);break-inside:var(--v)'],
    // url-свойства: переменная — значение целиком, а не имя файла внутри url.
    ['bgi--hero', 'background-image:var(--hero)'],
    ['bgi--a_b;', 'background-image:var(--a_b)'],
    ['lisi--v', 'list-style-image:var(--v)'],
    ['maski--v', 'mask-image:var(--v)'],
  ])('%s → %s', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });

  test.each([
    // Сторожа: обычные значения тех же хендлеров не задеты.
    ['bsS', 'border-style:solid'],
    ['bs', 'border-style:solid'],
    ['bsDotted', 'border-style:dotted'],
    ['pgbaAV', 'page-break-after:avoid;break-after:avoid'],
    ['bgi', 'background-image:none'],
  ])('%s → %s (без переменной)', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });
});

describe('составные значения без переменных не затронуты', () => {
  test.each([
    ['ol_3px_solid_red', 'outline:3px solid red'],
    ['olS', 'outline:solid'],
    ['tn_all_0.2s_ease', 'transition:all 0.2s ease'],
    ['bxsh_0_0_10px_red', 'box-shadow:0 0 10px red'],
    ['posSticky', 'position:sticky'],
    // Посегментный kebab: склеенная строка дала бы `0_1_-auto`.
    ['fx0_1_Auto', 'flex:0 1 auto'],
    // Суффикс из одних `_` — у `content` особый случай (пустое значение невалидно).
    ['cnt_', 'content:\' \''],
    // `\_` снимается до хендлера (см. тест-ограничение выше), поэтому `_`
    // здесь работает как обычный разделитель → пробел.
    ['ff_my\\_font', 'font-family:"my font"'],
  ])('%s → %s', (token, expected) => {
    expect(cssOf(token)).toBe(expected);
  });
});
