// @ts-nocheck
/* eslint-disable */
/**
 * Тесты стандартного пресета Minotation.
 *
 * Проверяет ключевые хендлеры: размеры, отступы, цвета, позиционирование.
 */

const mnProvider = require('../index').default || require('../index').minotationProvider;
const presetStandard = require('../presets/standard').default || require('../presets/standard');

function css(token) {
  const mn = mnProvider({
    presets: [presetStandard],
    onError: (e) => { /* подавляем ошибки парсинга */ },
  });
  mn.getCompiler('class')(token);
  mn.compile();
  return mn.styles$.getValue()
    .map((s) => s.content)
    .join('');
}

// ================================================================
// Width / Height
// ================================================================
describe('Standard preset — размеры', () => {
  test('w50 → width:50px', () => {
    expect(css('w50')).toContain('width:50px');
  });

  test('w → width:100%', () => {
    expect(css('w')).toContain('width:100%');
  });

  test('w50% → width:50%', () => {
    expect(css('w50%')).toContain('width:50%');
  });

  test('w100vh → width:100vh', () => {
    expect(css('w100vh')).toContain('width:100vh');
  });

  test('h50 → height:50px', () => {
    expect(css('h50')).toContain('height:50px');
  });

  test('h → height:100%', () => {
    expect(css('h')).toContain('height:100%');
  });

  test('sq50 → width:50px;height:50px', () => {
    const result = css('sq50');
    expect(result).toContain('width:50px');
    expect(result).toContain('height:50px');
  });
});

// ================================================================
// Margin / Padding
// ================================================================
describe('Standard preset — отступы', () => {
  test('p20 → padding:20px', () => {
    expect(css('p20')).toContain('padding:20px');
  });

  test('m10 → margin:10px', () => {
    expect(css('m10')).toContain('margin:10px');
  });

  test('pt5 → padding-top:5px', () => {
    expect(css('pt5')).toContain('padding-top:5px');
  });

  test('mxA → margin-left:auto;margin-right:auto', () => {
    const result = css('mxA');
    expect(result).toContain('margin-left:auto');
    expect(result).toContain('margin-right:auto');
  });

  test('gap10 → gap:10px (регресс: priority не была объявлена в хендлере)', () => {
    expect(css('gap10')).toContain('gap:10px');
  });
});

// ================================================================
// Цвета
// ================================================================
describe('Standard preset — цвета', () => {
  test('cF00 → color:#f00', () => {
    expect(css('cF00')).toContain('color:#f00');
  });

  test('именованный цвет бракуется — цвет задаётся кодом', () => {
    // Решение владельца 2026-09-24: «пусть принимаются только коды (F00)».
    // `cRed` и `cF00` давали один результат двумя записями — в CSS поехали бы
    // оба правила, а код ещё и короче.
    expect(css('cRed')).toBe('');
    expect(css('cF00')).toContain('color:#f00');
  });

  test('bgF00 → background:#f00', () => {
    expect(css('bgF00')).toContain('background:#f00');
  });

  test('bgT → background:transparent (длинная форма бракуется)', () => {
    // Регресс, ради которого тест заводился: `colorGetBackground` падал на
    // именованных синонимах. Проверяем на краткой форме — длинная с 2026-09-24
    // бракуется как вторая запись того же цвета.
    expect(css('bgT')).toContain('background:transparent');
    expect(css('bgTransparent')).toBe('');
  });

  test('bgCT → background:currentColor', () => {
    expect(css('bgCT')).toContain('background:currentColor');
  });
});

// ================================================================
// Filter
// ================================================================
describe('Standard preset — filter', () => {
  test('ftBlur5 → filter:blur(5px) (регресс: filter() без 2-го аргумента падал в fundamentool)', () => {
    expect(css('ftBlur5')).toContain('filter:blur(5px)');
  });

  test('ftbBlur5 → backdrop-filter:blur(5px)', () => {
    expect(css('ftbBlur5')).toContain('backdrop-filter:blur(5px)');
  });

  test('ftBlur5_gray50 → комбинация фильтров', () => {
    const result = css('ftBlur5_gray50');
    expect(result).toContain('blur(5px)');
    expect(result).toContain('grayscale(50%)');
  });

  test('ft_blur5 (альтернативный синтаксис с подчёркиванием) → тот же результат', () => {
    expect(css('ft_blur5')).toContain('filter:blur(5px)');
  });
});

// ================================================================
// Позиционирование
// ================================================================
describe('Standard preset — позиционирование', () => {
  test('posA → position:absolute', () => {
    expect(css('posA')).toContain('position:absolute');
  });

  test('posR → position:relative', () => {
    expect(css('posR')).toContain('position:relative');
  });

  test('posF → position:fixed', () => {
    expect(css('posF')).toContain('position:fixed');
  });

  test('static → position:static', () => {
    expect(css('static')).toContain('position:static');
  });

  test('sticky → position:sticky', () => {
    expect(css('sticky')).toContain('position:sticky');
  });

  test('dirRTL → direction:rtl', () => {
    expect(css('dirRTL')).toContain('direction:rtl');
  });
});

// ================================================================
// Display
// ================================================================
describe('Standard preset — display', () => {
  test('dN → display:none', () => {
    expect(css('dN')).toContain('display:none');
  });

  test('dB → display:block', () => {
    expect(css('dB')).toContain('display:block');
  });

  test('dF → display:flex', () => {
    expect(css('dF')).toContain('display:flex');
  });
});

// ================================================================
// Overflow
// ================================================================
describe('Standard preset — overflow', () => {
  test('ovH → overflow:hidden', () => {
    expect(css('ovH')).toContain('overflow:hidden');
  });

  test('ovA → overflow:auto', () => {
    expect(css('ovA')).toContain('overflow:auto');
  });

  test('ovbCT → overscroll-behavior:contain', () => {
    expect(css('ovbCT')).toContain('overscroll-behavior:contain');
  });

  test('ovbxN → overscroll-behavior-x:none', () => {
    expect(css('ovbxN')).toContain('overscroll-behavior-x:none');
  });
});

// ================================================================
// Font
// ================================================================
describe('Standard preset — шрифт', () => {
  test('fwB → font-weight:bold', () => {
    expect(css('fwB')).toContain('font-weight:bold');
  });

  test('taC → text-align:center', () => {
    expect(css('taC')).toContain('text-align:center');
  });

  test('fsaN → font-size-adjust:none', () => {
    expect(css('fsaN')).toContain('font-size-adjust:none');
  });
});

// ================================================================
// Text emphasis
// ================================================================
describe('Standard preset — text-emphasis', () => {
  test('tem_filled_circle → text-emphasis:filled circle', () => {
    expect(css('tem_filled_circle')).toContain('text-emphasis:filled circle');
  });

  test('tempOver → text-emphasis-position:over', () => {
    expect(css('tempOver')).toContain('text-emphasis-position:over');
  });

  test('temsCircle → text-emphasis-style:circle', () => {
    expect(css('temsCircle')).toContain('text-emphasis-style:circle');
  });
});

// ================================================================
// Object / Mask
// ================================================================
describe('Standard preset — object-fit / mask', () => {
  test('ofCV → object-fit:cover', () => {
    expect(css('ofCV')).toContain('object-fit:cover');
  });

  test('maski_a\\.png → mask-image:url("a.png") (точка в значении требует экранирования)', () => {
    expect(css('maski_a\\.png')).toContain('mask-image:url("a.png")');
  });

  test('maskbgF00 → mask-image:#f00', () => {
    expect(css('maskbgF00')).toContain('mask-image:#f00');
  });

  test('masktL → mask-type:luminance', () => {
    expect(css('masktL')).toContain('mask-type:luminance');
  });

  test('maskmMS → mask-mode:match-source', () => {
    expect(css('maskmMS')).toContain('mask-mode:match-source');
  });
});

// ================================================================
// Touch / Outline / Слои
// ================================================================
describe('Standard preset — touch-action, outline, zoom', () => {
  test('tchaN → touch-action:none', () => {
    expect(css('tchaN')).toContain('touch-action:none');
  });

  test('thc0 → -webkit-tap-highlight-color:#000 (та же color-семья, что и olc/bgc)', () => {
    expect(css('thc0')).toContain('-webkit-tap-highlight-color:#000');
  });

  test('thc → -webkit-tap-highlight-color:currentColor (пустой суффикс — дефолт CT)', () => {
    expect(css('thc')).toContain('-webkit-tap-highlight-color:currentColor');
  });

  test('olcI бракуется — `invert` невалиден по текущей спецификации', () => {
    // Остаток CSS 2.1: `outline-color: invert` не принимает ни один браузер
    // по актуальной спеке (проверено `lexer.matchProperty`). Алиас убран.
    expect(css('olcI')).toBe('');
    expect(css('olcInvert')).toBe('');
    // Фильтр с тем же словом — другое свойство, работает.
    expect(css('ftInvert20')).toContain('filter:invert(20%)');
  });

  test('olwTN/olwM/olwTC → outline-width: thin/medium/thick', () => {
    expect(css('olwTN')).toContain('outline-width:thin');
    expect(css('olwM')).toContain('outline-width:medium');
    expect(css('olwTC')).toContain('outline-width:thick');
  });

  test('zm150% → zoom:150%', () => {
    expect(css('zm150%')).toContain('zoom:150%');
  });
});

// ================================================================
// Aspect ratio / Image rendering
// ================================================================
describe('Standard preset — aspect-ratio, image-rendering', () => {
  test('ar16/9 → aspect-ratio:16/9', () => {
    expect(css('ar16/9')).toContain('aspect-ratio:16/9');
  });

  test('irPixelated → image-rendering:pixelated', () => {
    expect(css('irPixelated')).toContain('image-rendering:pixelated');
  });
});

// ================================================================
// Многоколоночная вёрстка / Counters
// ================================================================
describe('Standard preset — columns, counters', () => {
  test('col3 → columns:3', () => {
    expect(css('col3')).toContain('columns:3');
  });

  test('wid2 → widows:2', () => {
    expect(css('wid2')).toContain('widows:2');
  });

  test('orp2 → orphans:2', () => {
    expect(css('orp2')).toContain('orphans:2');
  });

  test('coi_counter → counter-increment:counter', () => {
    expect(css('coi_counter')).toContain('counter-increment:counter');
  });

  test('cor_counter → counter-reset:counter', () => {
    expect(css('cor_counter')).toContain('counter-reset:counter');
  });
});

// ================================================================
// Box-shadow / text-shadow
// ================================================================
// SHADOW_PATTERNS (bxsh/tsh) — независимые regex-маршруты (r/x/y/m/c/in),
// каждый ищет СВОЙ фрагмент где угодно в общем суффиксе токена (не только
// когда суффикс СОСТОИТ ЦЕЛИКОМ из одного маршрута). До фикса `handlerWrap`
// (anchored=false для паттернов-массивов, core/utils.ts) комбинированные
// суффиксы вроде `19r3c43F` теряли r/x/y/c/in — оставался только blur.
// Поведение сверено с оригиналом v1 (`old/minimalist-notation`).
describe('Standard preset — box-shadow / text-shadow', () => {
  test('bxsh19 → только blur', () => {
    expect(css('bxsh19')).toContain('box-shadow:0px 0px 19px 0px #000');
  });

  test('bxsh19r3 → blur + spread', () => {
    expect(css('bxsh19r3')).toContain('box-shadow:0px 0px 19px 3px #000');
  });

  test('bxsh19c43F → blur + цвет', () => {
    expect(css('bxsh19c43F')).toContain('box-shadow:0px 0px 19px 0px #43f');
  });

  test('bxsh19r3c43F → blur + spread + цвет (регрессия)', () => {
    expect(css('bxsh19r3c43F')).toContain('box-shadow:0px 0px 19px 3px #43f');
  });

  test('bxsh19x5y5r3c43F → offset + blur + spread + цвет', () => {
    expect(css('bxsh19x5y5r3c43F')).toContain('box-shadow:5px 5px 19px 3px #43f');
  });

  test('tsh10r2c00F → text-shadow: blur + spread + цвет', () => {
    // tsh-хендлер не использует r в сборке строки (см. SHADOW_HANDLERS.tsh) —
    // spread молча отбрасывается уже на уровне самого хендлера, это не баг.
    expect(css('tsh10r2c00F')).toContain('text-shadow:0px 0px 10px #00f');
  });

  test('bxshR3 → изолированный r без ведущего числа даёт "Rpx" в blur-слоте — теперь ловится валидацией CSS-вывода (2026-09-04), CSS не эмитится', () => {
    // Раньше (известное ограничение, унаследовано из v1) — "box-shadow:0px 0px Rpx 3px #000"
    // молча уходило в бандл. С добавлением REGEXP_INVALID_CSS_VALUE (core/utils.ts) —
    // такой essence бракуется целиком, warning уходит в mn.warnings$/onWarning.
    expect(css('bxshR3')).toBe('');
  });

  test('bxsh19In → inset не поддерживается (известное ограничение, унаследовано из v1)', () => {
    expect(css('bxsh19In')).toContain('box-shadow:0px 0px 19px 0px #000');
  });
});

// ================================================================
// CSS-переменные в значениях (регрессия 2026-09-22)
// ================================================================
describe('Standard preset — var()/env() в значениях', () => {
  test.each([
    ['c--ink', 'color:var(--ink)'],
    ['bg--panel', 'background:var(--panel)'],
    ['bc--line', 'border-color:var(--line)'],
    ['w--x', 'width:var(--x)'],
    ['p--gap', 'padding:var(--gap)'],
    ['f--size', 'font-size:var(--size)'],
  ])('%s → %s', (token, expected) => {
    expect(css(token)).toContain(expected);
  });

  // До исправления: ff--mono → font-family:"-mono" (ведущий `-` трактовался
  // как «взять имя шрифта в кавычки»), в отличие от остальных хендлеров.
  // Хендлеры с собственным разбором суффикса (не через общий val()) молча роняли
  // CSS-переменную в значение по умолчанию: lh--tight → line-height:1, o--op → opacity:0.
  test.each([
    ['lh--tight', 'line-height:var(--tight)'],
    ['lh---safe', 'line-height:env(--safe)'],
    ['o--op', 'opacity:var(--op)'],
    ['tsa--x', 'text-size-adjust:var(--x)'],
    ['fsa--x', 'font-size-adjust:var(--x)'],
  ])('%s → %s', (token, expected) => {
    expect(css(token)).toContain(expected);
  });
  test('обычные значения этих хендлеров не затронуты', () => {
    expect(css('lh150%')).toContain('line-height:150%');
    expect(css('lh1')).toContain('line-height:1');
    expect(css('lh20px')).toContain('line-height:20px');
    expect(css('o50')).toContain('opacity:.5');
  });

  test('ff--mono → font-family:var(--mono)', () => {
    expect(css('ff--mono')).toContain('font-family:var(--mono)');
  });
  test('ff---safe → font-family:env(--safe)', () => {
    expect(css('ff---safe')).toContain('font-family:env(--safe)');
  });
  test('обычное имя шрифта не затронуто: ffArial → font-family:arial', () => {
    expect(css('ffArial')).toContain('font-family:arial');
  });
  test('список шрифтов не затронут: ff_Arial,_Helvetica', () => {
    expect(css('ff_Arial,_Helvetica')).toContain('font-family:');
  });
});

// ================================================================
// letter-spacing (регрессия 2026-09-22)
// ================================================================
describe('Standard preset — letter-spacing', () => {
  test.each([
    ['lts0.06em', 'letter-spacing:0.06em'],
    ['lts-0.02em', 'letter-spacing:-0.02em'],
    ['lts2', 'letter-spacing:2px'],
    ['ltsN', 'letter-spacing:normal'],
  ])('%s → %s', (token, expected) => {
    expect(css(token)).toContain(expected);
  });
});

// ================================================================
// Очевидность записи (2026-09-22)
// ================================================================
describe('Standard preset — предсказуемость значений', () => {
  // `lh` — единственное свойство, где голое число означает не пиксели, а множитель:
  // так же, как в самом CSS. Раньше `lh1` давало `line-height:1px`.
  test.each([
    ['lh1.5', 'line-height:1.5'],
    ['lh1', 'line-height:1'],
    ['lh0', 'line-height:0'],
    ['lh20px', 'line-height:20px'],
    ['lh1.2em', 'line-height:1.2em'],
    ['lh150%', 'line-height:150%'],
  ])('%s → %s', (token, expected) => {
    expect(css(token)).toContain(expected);
  });

  // `fw600` — самая естественная запись: значение CSS как есть. Раньше давало 900.
  test.each([
    ['fw600', 'font-weight:600'],
    ['fw6', 'font-weight:600'],
    ['fw900', 'font-weight:900'],
    ['fw100', 'font-weight:100'],
    ['fw1', 'font-weight:100'],
    ['fwBold', 'font-weight:bold'],
  ])('%s → %s', (token, expected) => {
    expect(css(token)).toContain(expected);
  });

  // `o0.5` — запись «как в CSS»; раньше округлялась в 0 (трактовалась как 0.5 %).
  test.each([
    ['o50', 'opacity:.5'],
    ['o0.5', 'opacity:.5'],
    ['o100', 'opacity:1'],
    ['o0', 'opacity:0'],
  ])('%s → %s', (token, expected) => {
    expect(css(token)).toContain(expected);
  });

  // Короткие формы современных значений (добавлены 2026-09-22): раньше `dG` давало
  // `display:g`, `aiE` → `align-items:e` — буквы не было в карте синонимов.
  test.each([
    ['dG', 'display:grid'],
    ['dIG', 'display:inline-grid'],
    ['dFR', 'display:flow-root'],
    ['dCN', 'display:contents'],
    ['jcE', 'justify-content:end'],
    ['jcS', 'justify-content:start'],
    ['jcSE', 'justify-content:space-evenly'],
    ['jcL', 'justify-content:left'],
    ['aiE', 'align-items:end'],
    ['aiS', 'align-items:start'],
    ['aiSS', 'align-items:self-start'],
    ['acSE', 'align-content:space-evenly'],
  ])('%s → %s', (token, expected) => {
    expect(css(token)).toContain(expected);
  });
  // Одна буква — один смысл у родственных свойств: `S` — start, `ST` — stretch.
  test.each([
    ['aiS', 'align-items:start'],
    ['asS', 'align-self:start'],
    ['acS', 'align-content:start'],
    ['aiST', 'align-items:stretch'],
    ['asST', 'align-self:stretch'],
    ['acST', 'align-content:stretch'],
  ])('%s → %s — согласованность букв', (token, expected) => {
    expect(css(token)).toContain(expected);
  });
  // `-` в нотации — вычитание. `p8-12` читается как calc(8px - 12px): отрицательный
  // padding браузер отбрасывает, а автор обычно имел в виду `py8 px12`.
  test.each(['p8-12', 'r4-8', 'w10-20'])('%s — не компилируется (отрицательная длина)', (token) => {
    expect(css(token)).toBe('');
  });
  test.each([
    ['p20-8', 'padding:calc(20px - 8px)'],
    ['mt8-12', 'margin-top:calc(8px - 12px)'],
    ['py8 px12', 'padding-left:12px'],
  ])('%s → %s — законные случаи не затронуты', (token, expected) => {
    expect(css(token)).toContain(expected);
  });

  // Многобуквенный синоним, которого нет в карте, после toKebabCase выглядит как
  // «кебаб из одиночных букв» (`tdLT` → `text-decoration:l-t`) — тоже мусор.
  test.each(['tdLT', 'tdXY'])('%s — не компилируется (неразобранный синоним)', (token) => {
    expect(css(token)).toBe('');
  });
  test('tdU → text-decoration:underline — корректный синоним не затронут', () => {
    expect(css('tdU')).toContain('text-decoration:underline');
  });
  // `font` — shorthand: одно число даёт невалидный CSS (`font:12`).
  test.each(['font12', 'font1.5'])('%s — не компилируется (неполный shorthand)', (token) => {
    expect(css(token)).toBe('');
  });
  test('font12px_Arial → font с размером и семейством', () => {
    expect(css('font12px_Arial')).toContain('font:');
  });

  // Буква, которой нет ни в одной карте, по-прежнему не даёт молчаливый мусор.
  test.each(['dQ', 'aiQ', 'jcQ', 'taQ'])('%s — не компилируется (неразобранный синоним)', (token) => {
    expect(css(token)).toBe('');
  });
  test.each([
    ['dG', 'display:grid'],
    ['dF', 'display:flex'],
    ['aiFE', 'align-items:flex-end'],
    ['jcSB', 'justify-content:space-between'],
    ['taL', 'text-align:left'],
  ])('%s → %s — корректные синонимы не затронуты', (token, expected) => {
    expect(css(token)).toContain(expected);
  });
});

// ================================================================
// Покрытие свойств: text-decoration-style / text-underline-* / gap-* / justify-* (2026-09-22)
// ================================================================
describe('Standard preset — свойства, добавленные при аудите покрытия', () => {
  test.each([
    ['tdstDotted', 'text-decoration-style:dotted'],
    ['tdstWavy', 'text-decoration-style:wavy'],
    ['tdstSolid', 'text-decoration-style:solid'],
  ])('%s → %s', (token, expected) => {
    expect(css(token)).toContain(expected);
  });
  test.each([
    ['tuo2px', 'text-underline-offset:2px'],
    ['tuoAuto', 'text-underline-offset:auto'],
  ])('%s → %s', (token, expected) => {
    expect(css(token)).toContain(expected);
  });
  test.each([
    ['tup_under', 'text-underline-position:under'],
    ['tupFromFont', 'text-underline-position:from-font'],
  ])('%s → %s', (token, expected) => {
    expect(css(token)).toContain(expected);
  });

  // gapx/gapy — атомарная альтернатива многозначному `gap8_16` (D-003).
  test.each([
    ['gapx16', 'column-gap:16px'],
    ['gapy8', 'row-gap:8px'],
    ['gap12', 'gap:12px'],
  ])('%s → %s', (token, expected) => {
    expect(css(token)).toContain(expected);
  });

  // justify-self / justify-items — отсутствовали полностью до аудита.
  test.each([
    ['jsC', 'justify-self:center'],
    ['jsS', 'justify-self:start'],
    ['jsST', 'justify-self:stretch'],
    ['jiC', 'justify-items:center'],
    ['jiST', 'justify-items:stretch'],
    ['jiLG', 'justify-items:legacy'],
  ])('%s → %s', (token, expected) => {
    expect(css(token)).toContain(expected);
  });
});

/**
 * Системные цвета (CSS Color 4) — берутся из темы ОС, кодом не выразимы.
 * Аббревиатуры заведены 2026-09-24 по решению владельца («вместо них можно
 * сделать аббревиатуры»), до этого была только длинная форма.
 */
describe('системные цвета: краткие формы', () => {
  test.each([
    ['cBT', 'color:buttonText'],
    ['olcBT', 'outline-color:buttonText'],
    ['bcHL', 'border-color:highlight'],
    ['cCV', 'color:canvas'],
    ['cCVT', 'color:canvasText'],
    ['cGT', 'color:grayText'],
    ['cLT', 'color:linkText'],
    ['cVT', 'color:visitedText'],
  ])('%s → %s', (token, expected) => {
    expect(css(token)).toContain(expected);
  });

  test('аббревиатура не путается с hex-кодом', () => {
    // Буквы аббревиатур бывают валидными hex-цифрами: до фикса `bgAC`
    // (AccentColor) уходил в `#aaa`, а `bgBB` (ButtonBorder) — в `#bb`,
    // потому что backgroundProvider не смотрел в карту синонимов.
    expect(css('bgAC')).toContain('background:accentColor');
    expect(css('bgBB')).toContain('background:buttonBorder');
    // Настоящий hex из тех же букв по-прежнему код.
    expect(css('bgAAC')).toContain('background:#aac');
    expect(css('bgF00')).toContain('background:#f00');
  });

  test('currentColor и transparent — прежние краткие формы', () => {
    expect(css('cCT')).toContain('color:currentColor');
    expect(css('cT')).toContain('color:transparent');
    expect(css('bgT')).toContain('background:transparent');
  });
});

/**
 * Канонизация записи цвета (Р-1, решения владельца 2026-09-24).
 * Один цвет — одна запись, иначе в CSS попадает несколько правил с тем же
 * результатом.
 */
describe('канонизация цвета: одна запись на значение', () => {
  function warn(token) {
    const warnings = [];
    const mn = mnProvider({
      onWarning: (w) => warnings.push(w),
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')(token);
    mn.compile();
    return warnings.length ? warnings[0].message : '';
  }

  test.each([
    // Сокращение одинаковых пар и повторов.
    ['cFFFFFF', 'cF'],
    ['cFFF', 'cF'],
    ['cFF0000', 'cF00'],
    ['c000000', 'c0'],
    // Избыточная непрозрачная альфа.
    ['cFF', 'cF'],
    ['cF00F', 'cF00'],
    // Hex-альфа → десятичная (читается сразу, копируется из макета).
    ['cAA', 'cA.67'],
    ['cF8', 'cF.53'],
    ['c0A0A1280', 'c0A0A12.5'],
    // Полная прозрачность — тоже десятичная, ради единообразия.
    ['c00', 'c0.0'],
    ['cF000', 'cF00.0'],
  ])('%s бракуется, подсказка — %s', (token, expected) => {
    const message = warn(token);
    expect(message).toContain('"' + expected + '"');
  });

  test.each([
    // Канонические формы проходят молча.
    'cF', 'c0', 'cF00', 'c0A0A12', 'cF00.5', 'cA.67', 'c0.0', 'cCT', 'cT', 'cBT',
  ])('%s — канонично, без предупреждений', (token) => {
    expect(warn(token)).toBe('');
  });
});

/**
 * Прозрачность переменной и цветовые функции (решение владельца 2026-09-25:
 * «нужно решение, а не обходной путь» — про `color-mix` в `tokens.css`).
 */
describe('цвет: переменная с альфой и функции', () => {
  test.each([
    ['bc--warn.3', 'border-color:color-mix(in srgb, var(--warn) 30%, transparent)'],
    ['c--ink.5', 'color:color-mix(in srgb, var(--ink) 50%, transparent)'],
    ['bg--panel.85', 'background:color-mix(in srgb, var(--panel) 85%, transparent)'],
    ['c--warn.67', 'color:color-mix(in srgb, var(--warn) 67%, transparent)'],
  ])('%s → %s', (token, expected) => {
    // Точка-альфа работала только для кодов (`cF00.5`); у переменных она
    // молча уходила в имя и давала битое `var(--warn.3)`.
    expect(css(token)).toContain(expected);
  });

  test.each([
    ['cOklch\\(0.7_0.1_200\\)', 'color:oklch(0.7 0.1 200)'],
    ['cLight-dark\\(white,black\\)', 'color:light-dark(white,black)'],
  ])('функция пропускается насквозь: %s', (token, expected) => {
    expect(css(token)).toContain(expected);
  });

  test('живой случай: color-mix целиком в токене', () => {
    // `.uBcWarn { border-color: color-mix(in srgb, var(--warn) 30%, transparent) }`
    // из tokens.css проекта affiliate — то, ради чего это заводилось.
    expect(css('bcColor-mix\\(in_srgb,var\\(--warn\\)_30%,transparent\\)'))
      .toContain('border-color:color-mix(in srgb,var(--warn) 30%,transparent)');
  });

  test('обычные формы цвета не задеты', () => {
    expect(css('c--warn')).toContain('color:var(--warn)');
    expect(css('cF00.5')).toContain('color:rgba(255,0,0,.5)');
    expect(css('cF00')).toContain('color:#f00');
    expect(css('cT')).toContain('color:transparent');
  });

  test('мусор по-прежнему бракуется', () => {
    expect(css('cUndefined')).toBe('');
    expect(css('cRed')).toBe('');
  });
});
