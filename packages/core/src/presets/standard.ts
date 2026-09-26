/**
 * Стандартный пресет Minotation — все CSS-токены.
 *
 * ## Архитектура
 *
 * Хендлеры генерируются **динамически** через `forIn`-циклы над картами свойств.
 * Это позволяет покрыть сотни CSS-свойств без ручного перечисления каждого.
 *
 * ### Основные группы хендлеров
 *
 * | Группа | Токены | CSS-свойства |
 * |--------|--------|-------------|
 * | **Размеры** | `w`, `h`, `sq`, `wmin`, `wmax`, `hmin`, `hmax` | `width`, `height`, `min/max-*` |
 * | **Отступы** | `p`, `m` + стороны (`t`,`b`,`l`,`r`,`x`,`y`) | `padding`, `margin` |
 * | **Границы** | `b`, `bs`, `bc`, `bi` + стороны | `border-*` |
 * | **Цвета** | `c`, `bg`, `bga`, `bgi`, `bgo`, `bgr`, `bgs` | `color`, `background-*` |
 * | **Флекс** | `fxa`, `fya`, `fx` | `flex`, `align-*`, `justify-*` |
 * | **Позиция** | `pos`, `abs`, `ar`, `ai`, `ac`, `as` | `position`, `align/justify` |
 * | **Тени** | `bxsh`, `tsh` | `box-shadow`, `text-shadow` |
 * | **Фильтры** | `blur`, `gray`, `bright`, `contrast`, `hue`, `invert`, `saturate`, `sepia` | `filter` |
 * | **Текст** | `break`, `td`, `fw`, `ff`, `fs`, `lh`, `ta`, `va`, `ws`, `wb`, `ov` | `text-*`, `font-*`, `line-height`, `overflow` |
 * | **Таблицы** | `tbl`, `tbl.cell` | `display:table`, `display:table-cell` |
 *
 * ### Как работают стороны
 *
 * Базовые токены (`p`, `m`, `b`, `s`) комбинируются с суффиксами сторон:
 * - `t` = top, `b` = bottom, `l` = left, `r` = right
 * - `x` = left+right, `y` = top+bottom
 * - `lt` = left+top, `rb` = right+bottom, и т.д.
 *
 * Примеры: `p20` → `padding:20px`, `pt10` → `padding-top:10px`, `mxA` → `margin-left:auto;margin-right:auto`
 *
 * ### Значения
 *
 * Токен `w50%+10` парсится как `width: calc(50% + 10px)`.
 * `+` в середине значения — оператор `calc`, не требует экранирования.
 *
 * @module presetStyles
 * @author Amir Absaliamov <amir.absolutely@gmail.com>
 */

/** @constant {RegExp} Разделитель запятых с пробелами */
const REGEXP_COMMA = /(?:\s*,\s*)+/;
const REGEXP_TRIM_SNAKE_LEFT = /^_+/g;
const REGEXP_TRIM_KEBAB_LEFT = /^-+/g;
const REGEXP_FILTER_NAME = /^([A-Za-z]+)([0-9]*)(.*)$/;
const REGEXP_FILTER_SEP = /_+/;
const REGEXP_DOTS = /\./g;
const REGEXP_UNESCAPED_UNDERSCORE = /(?<!\\)_/;


const PATTERN_VAR = '((-):env?((--[^;,]+)(,\\d+([a-z%]+):vu?):va?):vv;?)';
// eslint-disable-next-line
const PATTERN_VAR_ADD = '(-):nva?((--[^;,]+)(,[0-9\\.]+([a-z%]+):vua?):vaa?):vva;?';
const PATTERN_DIGITS = '(-?[0-9\\.]+)';

// eslint-disable-next-line
// `;?` после имени переменной — тот же необязательный терминатор, что в
// PATTERN_VAR. Цветовому пути он не нужен для разбора (здесь нет разреза по
// `_`, поэтому `c--my_ink` работает и без него), но пишущий токен не обязан
// помнить, какой хендлер каким путём разбирается: без `;?` привычное
// `c--my_ink;` молча не давало правила (2026-09-23).
const PATTERN_BASE_COLOR = '([A-Z][a-z][A-Za-z]+):camel|([A-Fa-f0-9]+(\\.[0-9]+)?):color|(-?--[^;]+):vv;?';
const PATTERN_COLOR = '^(' + PATTERN_BASE_COLOR + '):value';

const PATTERN_VAL = '^(((([A-Za-z]+):otherName|([-]):sign?'
  + PATTERN_DIGITS + ':num(/' + PATTERN_DIGITS
  + ':total?)?):value([a-z%]+):unit?)|'
  + PATTERN_VAR + '):vl(([-+]):sa(([0-9\\.]+):addv([a-z%]+):addu?|'
  + PATTERN_VAR_ADD + ')):add?$';


const SHADOW_PATTERNS = [
  '(r|R)(\\-?[0-9]+):r',
  '(x|X)(\\-?[0-9]+):x',
  '(y|Y)(\\-?[0-9]+):y',
  '(m|M)([0-9]+):m',
  'c(' + PATTERN_BASE_COLOR + '):c',
  '(in):in',
];
const TOP = '-top';
const BOTTOM = '-bottom';
const LEFT = '-left';
const RIGHT = '-right';

const SIDES_MAP = {
  '': [''],
  t: [TOP],
  b: [BOTTOM],
  l: [LEFT],
  r: [RIGHT],

  y: [TOP, BOTTOM],
  yl: [
    TOP,
    BOTTOM,
    LEFT,
  ],
  yr: [
    TOP,
    BOTTOM,
    RIGHT,
  ],

  x: [LEFT, RIGHT],
  xt: [
    LEFT,
    RIGHT,
    TOP,
  ],
  xb: [
    LEFT,
    RIGHT,
    BOTTOM,
  ],

  lt: [TOP, LEFT],
  rt: [TOP, RIGHT],
  lb: [BOTTOM, LEFT],
  rb: [BOTTOM, RIGHT],
};
/**
 * Словесные значения цвета — только те, что кодом не выразить, и каждое
 * с краткой формой.
 *
 * Системные цвета (CSS Color 4) берутся из темы ОС: `cBT` вместо
 * `cButtonText`. Аббревиатура — первые буквы слов, `T` на конце для `…Text`.
 *
 * ⚠️ Длинные формы (`cButtonText`) пока тоже работают: `normalizeDefault`
 * разворачивает синоним в АЛИАС на длинное имя (`exts: ['cButtonText']`), то
 * есть она нужна как цель ссылки. Отключение дублирующих записей требует
 * смены механизма алиасов.
 */
const COLOR_SYNONYMS = {
  CT: 'CurrentColor',
  T: 'Transparent',
  // Системные цвета.
  BT: 'ButtonText',
  BF: 'ButtonFace',
  BB: 'ButtonBorder',
  CV: 'Canvas',
  CVT: 'CanvasText',
  FLD: 'Field',
  FLDT: 'FieldText',
  GT: 'GrayText',
  HL: 'Highlight',
  HLT: 'HighlightText',
  LT: 'LinkText',
  VT: 'VisitedText',
  AT: 'ActiveText',
  MK: 'Mark',
  MKT: 'MarkText',
  AC: 'AccentColor',
  ACT: 'AccentColorText',
  SI: 'SelectedItem',
  SIT: 'SelectedItemText',
};
/**
 * Краткие записи `border-style`.
 *
 * `DTDS` → `dot-dash`, `DTDTDS` → `dot-dot-dash` и `W` → `wave` убраны
 * 2026-09-26: таких значений в CSS нет вовсе. Это проприетарный набор старой
 * Mozilla, работавший только под `-moz-border-*-style`; в v1 он попал оттуда, а
 * в стандарт не вошёл ни один из трёх. Любой из них давал правило, которое
 * браузер отбрасывает целиком.
 */
const BORDER_STYLE_SYNONYMS = {
  N: 'None',
  H: 'Hidden',
  DT: 'Dotted',
  DS: 'Dashed',
  S: 'Solid',
  DB: 'Double',
  G: 'Groove',
  R: 'Ridge',
  I: 'Inset',
  O: 'Outset',
};
/** `<line-style>` целиком — ровно то, что принимает спецификация. */
const BORDER_STYLE_KEYWORDS = wordsSet('none hidden dotted dashed solid double'
  + ' groove ridge inset outset');
/** Ключевые слова позиции — общие для `background-position`/`object-position`. */
const POSITION_KEYWORDS = {
  L: 'Left',
  C: 'Center',
  R: 'Right',
  T: 'Top',
  B: 'Bottom',
};
const SIZE_SYNONYMS = {
  A: 'Auto',
  N: 'None',
};

/** Внутренние размеры — общая часть для `width`/`height` и их min/max. */
const KEYWORDS_INTRINSIC: Record<string, 1> = {
  'min-content': 1,
  'max-content': 1,
  'fit-content': 1,
  stretch: 1,
};
/** `width`/`height` и `min-*`: внутренние размеры плюс `auto`. */
const KEYWORDS_SIZE: Record<string, 1> = {
  ...KEYWORDS_INTRINSIC,
  auto: 1,
};
/** `max-*`: внутренние размеры плюс `none` (а `auto` — невалиден). */
const KEYWORDS_SIZE_MAX: Record<string, 1> = {
  ...KEYWORDS_INTRINSIC,
  none: 1,
};
/** `gap`-семейство, `letter-spacing`, `word-spacing`. */
const KEYWORDS_NORMAL: Record<string, 1> = {
  normal: 1,
};
/** Краткие записи gap-семейства: `auto`/`none` у него невалидны. */
const GAP_SYNONYMS = {
  N: 'Normal',
};
const TD_SYNONYMS = {
  '': 'None',
  N: 'None',
  U: 'Underline',
  O: 'Overline',
  L: 'LineThrough',
  I: 'Inherit',
  BL: 'Blink',
  SPE: 'SpellingError',
  GRE: 'GrammarError',
};
const BREAK_AFTER_SYNONYMS = {
  A: 'Auto',
  AW: 'Always',
  AV: 'Avoid',
  AVP: 'AvoidPage',
  AVC: 'AvoidColumn',
  AVRN: 'AvoidRegion',
  RN: 'Region',
  C: 'Column',
  P: 'Page',
  L: 'Left',
  R: 'Right',
  RE: 'Recto',
  VE: 'Verso',
};
const FONT_WEIGHT_SYNONYMS = {
  N: 'Normal',
  B: 'Bold',
  BR: 'Bolder',
  LR: 'Lighter',
};
/** Те же слова полной записью: `fwBolder` работает наравне с `fwBR`. */
const FONT_WEIGHT_KEYWORDS: Record<string, 1> = {
  normal: 1,
  bold: 1,
  bolder: 1,
  lighter: 1,
};
const OUTLINE_STYLE_SYNONYMS = {
  N: 'None',
  DT: 'Dotted',
  DS: 'Dashed',
  S: 'Solid',
  DB: 'Double',
  G: 'Groove',
  R: 'Ridge',
  I: 'Inset',
  O: 'Outset',
  // `auto` — стиль по усмотрению браузера (обычно системное кольцо фокуса).
  A: 'Auto',
  // Толщина: валидна у шортката `outline`, у `outline-style` игнорируется.
  TH: 'Thin',
  M: 'Medium',
  TK: 'Thick',
};
const POSITION_SYNONYMS = {
  '': 'Relative',
  R: 'Relative',
  A: 'Absolute',
  F: 'Fixed',
  S: 'Static',
  SK: 'Sticky',
};

const OVERSCROLL_BEHAVIOR_PRIORITIES = {
  A: 'Auto',
  CT: 'Contain',
  N: 'None',
  I: 'Inherit',
  R: 'Revert',
  RL: 'RevertLayer',
  U: 'Unset',
};

const POSITION_PRIORITIES = {
  relative: 0,
  absolute: 1,
  fixed: 2,
  static: 3,
  sticky: 4,
};

const SHADOW_HANDLERS: Record<string, [string, (x: any, y: any, value: any, r: any, color: any) => any[]]> = {
  bxsh: ['boxShadow', function(
    x, y, value, r, color,
  ) {
    return [
      x,
      y,
      value,
      r,
      color,
    ];
  }],
  tsh: ['textShadow', function(
    x, y, value, r, color,
  ) {
    return [
      x,
      y,
      value,
      color,
    ];
  }],
};
const FILTER_MAP = {
  blur: [
    'blur',
    4,
    'px',
  ],
  gray: [
    'grayscale',
    100,
    '%',
  ],
  bright: [
    'brightness',
    100,
    '%',
  ],
  contrast: [
    'contrast',
    100,
    '%',
  ],
  hue: [
    'hue-rotate',
    180,
    'deg',
  ],
  invert: [
    'invert',
    100,
    '%',
  ],
  saturate: [
    'saturate',
    100,
    '%',
  ],
  sepia: [
    'sepia',
    100,
    '%',
  ],
};
/**
 * Единицы длины, которые принимает нотация, плюс `%`.
 *
 * Список был из 14 единиц — ровно тот набор, что существовал в CSS2.1 плюс
 * ранние viewport-единицы. Всё, что пришло позже, нотацией не выражалось
 * вообще: `hmin100dvh` (самый ходовой приём мобильной вёрстки — высота
 * viewport'а без адресной строки), `w50cqw` (container queries), `p1lh`,
 * `w10q` — каждый давал предупреждение «Unit is invalid», хотя по грамматике
 * CSS все они валидны у любого свойства-длины. Проверено арбитром
 * (`css-tree` + `mdn-data`): для `width` валидны все 42 единицы ниже.
 *
 * Порядок — по убыванию длины: список идёт в альтернацию regex'а
 * ({@link REGEXP_SHADOW_SUFFIX}), где первая подошедшая ветка выигрывает, и
 * короткая единица, стоящая раньше длинной с тем же началом, откусила бы от
 * неё префикс.
 */
const UNITS = ('svmin,svmax,lvmin,lvmax,dvmin,dvmax,cqmin,cqmax,vmin,vmax,'
  + 'svw,svh,lvw,lvh,dvw,dvh,cqw,cqh,cqi,cqb,rlh,rem,rex,rch,ric,cap,'
  + 'em,ex,px,cm,mm,in,pt,pc,ch,ic,lh,vw,vh,vi,vb,q,%').split(',');

/** `:name`-аннотации маршрута — та же форма, что вырезает `routeParseProvider`. */
const REGEXP_ROUTE_KEY = /:[_A-Za-z0-9.]+/g;

/**
 * Проверка суффикса теней ЦЕЛИКОМ.
 *
 * `SHADOW_PATTERNS` — независимые НЕанкоренные regex'ы: каждый ищет свой
 * фрагмент где угодно в суффиксе (`19r3c43F` → r-паттерн находит `r3`,
 * c-паттерн — `c43F`). Обратная сторона в том, что неразобранный хвост никто
 * не замечает: `bxsh10zzz` давал ровно тот же CSS, что `bxsh10`, `bxsh0_2_8_F00`
 * (забытый ведущий `_`) — `0px 0px 0px 0px #000`, и всё это без единого
 * предупреждения. Молчаливый мусор в CSS недопустим.
 *
 * Собирается из тех же `SHADOW_PATTERNS` и того же `UNITS`, чтобы не разъехаться
 * с ними при правке: добавили модификатор или единицу — проверка узнала сама.
 * Единица ограничена реальным списком не для красоты: `bxsh10zzz` иначе проходит
 * (`zzz` попадает в группу единицы generic-разбора ядра и тихо отбрасывается),
 * тогда как `w10zzz`/`p10zzz` бракуются — поведение должно быть одинаковым.
 *
 * Первая группа захвата — единица; остальные приходят из самих
 * `SHADOW_PATTERNS` и здесь не нужны. Брать её из `p.unit` нельзя: разбор
 * значения в ядре считает единицей любой буквенный хвост после числа, и у
 * `bxsh19r3c43F` туда попадает начало модификаторов (`r`), а не `em`.
 *
 * Из списка исключены две единицы.
 *
 * `%` — по грамматике тень задаётся `<length>` и процентов не принимает; без
 * исключения `bxsh10%` давало `0% 0% 10% 0% #000`, правило, которое браузер
 * отбрасывает целиком.
 *
 * `in` — коллизия с модификатором `in` (inset): в `bxsh10in` обе трактовки
 * подходят, и побеждает первая по порядку. Модификатор здесь важнее — он
 * документирован и осмыслен, тогда как дюймы в тени на экране не нужны
 * (`in` вообще единица печати). Кому понадобятся — доступны через свободную
 * форму: `bxsh_0_0_10in_#000`.
 */
const SHADOW_UNITS = UNITS.filter((unit) => unit !== '%' && unit !== 'in');
/** Единицы угла — всё, чем измеряется поворот в CSS. */
const ANGLE_UNITS = [
  'deg',
  'grad',
  'rad',
  'turn',
];
/**
 * Хвост `r{x|y|z}{число}{единица?}` в суффиксе `x`-хендлера.
 *
 * Единицу угла здесь нельзя брать из `p.unit`: у составного суффикса это поле
 * заполняет ещё и generic-разбор ядра, и у `x10y20rz45` (единица не написана)
 * туда попадал `y` от `y20`, давая `rotateZ(45y)`. Поворот — последняя часть
 * собственного паттерна хендлера, поэтому его хвост однозначно ловится с конца
 * строки.
 */
const REGEXP_ANGLE_TAIL = /[rR][xyz][-+]?[0-9.]+([a-z]*)$/;
const REGEXP_SHADOW_SUFFIX = new RegExp('^(?:[0-9.]+(' + SHADOW_UNITS.join('|') + ')?)?(?:'
    + SHADOW_PATTERNS.map((pattern) => '(?:' + pattern.replace(REGEXP_ROUTE_KEY, '') + ')').join('|')
    + ')*$');

/**
 * Бракует токен: аргумент хендлера не разобрался.
 *
 * Бросает {@link MnParseError}, а не обычный `Error`, чтобы ядро увело это в
 * {@link MnInstance.warnings$} (тип `parse-error`), а не в `error$`: битый
 * аргумент — ошибка автора токена, а не сбой библиотеки. Контекст здесь
 * заполнить нечем — `throwInvalid` зовут из глубины разбора значения
 * (`getVal`, `normalizeDefault`, …), где ни имени хендлера, ни самого токена
 * уже не видно. Поля остаются пустыми, а ядро подставляет реальные в
 * `__initEssence` (`core/index.ts`), где и токен, и имя хендлера известны.
 */
function throwInvalid(message?: string): never {
  throw new MnParseError(message || 'Parameter is invalid', {
    token: '',
    handler: '',
    arg: '',
  });
}
function floatNormalize(v: any, nosign?: number): number {
  const m = v && v.match(REGEXP_DOTS);
  // ИСПРАВЛЕНО 2026-09-23: предыдущая попытка (тем же числом) убрать
  // `v < 0 && nosign` как "недостижимое" опиралась только на `num` (числитель
  // в getVal's total-ветке, знак у него отдельной группой `sign`, не бывает
  // отрицательным). Но PATTERN_DIGITS = `(-?[0-9.]+)` допускает знак и у
  // ЗНАМЕНАТЕЛЯ (`total`) — `w1/-2` реально даёт отрицательный `total`, и v1
  // на нём throwInvalid'ит (пустой вывод), а без этой проверки v2 молча
  // считал `-50%`. Ветка ЖИВАЯ — просто её не было в тест-сьюте; тест на
  // `w1/-2` добавлен, `positive`/`nosign` в сигнатуру возвращены.
  (m && m.length > 1 || isNaN(v = parseFloat(v)) || (v < 0 && nosign))
    && throwInvalid();
  return v;
}

function replace(
  v: any, from: string | RegExp, to: string,
): string {
  return ('' + v).replace(from, to);
}
function snakeLeftTrim(v: string): string {
  return replace(
    v, REGEXP_TRIM_SNAKE_LEFT, '',
  );
}
function styleWrap(style: Record<string, any>, priority?: number): MnHandlerResult {
  return {
    style,
    priority: priority || 0,
  };
}
/**
 * `--name` → `var(--name)`, `---name` → `env(--name)`; для суффикса другой формы — `undefined`.
 *
 * Нужна хендлерам, которые разбирают суффикс сами, а не через общий `val`
 * (`ff`, `lh`): там CSS-переменная иначе молча превращается в мусор —
 * `ff--mono` давал `font-family:"-mono"` (ведущий `-` в {@link __wr} означает
 * «взять имя шрифта в кавычки»), а `lh--tight` проваливался в значение по
 * умолчанию и давал `line-height:1`.
 *
 * Форма с запасным значением (`--mono,serif` → `var(--mono,serif)`) входит сюда
 * же: запятая допускается внутри имени. Раньше она была исключена (`[^,\s]+`) с
 * пометкой «разбирается по месту», но по месту не разбиралась нигде —
 * `ff--font,serif` давал `font-family:"-font",serif` (2026-09-23).
 *
 * Завершающий `;` — явный конец имени (`--border_size;`, см.
 * {@link splitValueParts}); в само имя он не входит.
 */
const REGEXP_CSS_VAR = /^(---?)([^;\s]+);?$/;
function cssVarValue(s: string): string | undefined {
  const m = REGEXP_CSS_VAR.exec(s);
  return m ? (m[1].length === 3 ? 'env(--' : 'var(--') + m[2] + ')' : undefined;
}
/**
 * Режет значение на `_`-части, НЕ трогая `_` внутри явно завершённого имени
 * переменной: `ol--border_size;_solid_--marker` → `['--border_size;', 'solid',
 * '--marker']`.
 *
 * Зачем: `_` — разделитель частей значения, поэтому имя переменной с `_`
 * иначе недостижимо (`--border_size` разваливается на `var(--border)` и
 * `size`). Экранирование здесь не вариант — обратный слэш снимается раньше, на
 * разборе токена, и до хендлера не доходит вовсе. Завершающий `;` в грамматике
 * значений был заложен изначально (`PATTERN_VAR`: имя `--[^;,]+`, затем `;?`),
 * но не работал: и `getVal`, и {@link valueNormalize} резали строку по `_`
 * ДО парсера.
 *
 * `_` внутри имени подменяется на служебный `\0` только на время разреза и
 * возвращается обратно в каждой части, поэтому наружу `\0` не попадает.
 * Значения без `;` идут коротким путём, без замен.
 *
 * @param byEscaped `1` — резать по неэкранированным `_` (`\_` — литерал),
 *   иначе по любому `_`.
 * @param keepHidden `1` — оставить `_` имени подменённым на `\0`; нужно
 *   вызывающему, который потом прогоняет части через `spaceNormalize` (та
 *   превратила бы восстановленный `_` в пробел уже внутри имени). Такой
 *   вызывающий обязан сам вернуть `\0` → `_` в самом конце.
 */
const REGEXP_VAR_TERMINATED = /(---?[^;\s]+);/g;
const REGEXP_UNDERSCORE_ALL = /_/g;
const REGEXP_VAR_UNDERSCORE = /\0/g;
function varUnderscoreHide(_all: string, name: string): string {
  return name.replace(REGEXP_UNDERSCORE_ALL, '\0') + ';';
}
function splitValueParts(
  v: string, byEscaped?: 1, keepHidden?: 1,
): string[] {
  const parts = (v.indexOf(';') < 0
    ? v
    : v.replace(REGEXP_VAR_TERMINATED, varUnderscoreHide)
  ).split(byEscaped ? REGEXP_UNESCAPED_UNDERSCORE : '_');
  if (keepHidden) {
    return parts;
  }
  let i = parts.length;
  while (i--) {
    parts[i] = parts[i].replace(REGEXP_VAR_UNDERSCORE, '_');
  }
  return parts;
}
/**
 * Дописывает `px` к каждой части значения, которая осталась голым числом.
 *
 * В нотации «голое число = px» — сквозное правило (`p10` → `padding:10px`,
 * `w10`, `mt10`, `lts2`). Свойства-длины из общего блока свободных значений
 * (`ti`, `wos`, `bsp`, `fxb`, `tdt`, `tuo`) из него выпадали: `ti10` давало
 * `text-indent:10` — невалидный CSS, который браузер отбрасывает. У части из
 * них это ещё и молча проходило мимо валидатора, потому что свойства нет в
 * его таблице (2026-09-23).
 *
 * `0` не трогаем — он валиден без единицы. Уже готовые части (`10px`, `50%`,
 * `auto`, `calc(…)`, `var(…)`) не подходят под «голое число» и проходят мимо.
 */
const REGEXP_BARE_NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)$/;
/** Значение-слово: только буквы и дефисы, без цифр, скобок и единиц. */
const REGEXP_BARE_WORD = /^[a-z][a-z-]*$/;
/** Целое со знаком — `z-index` дробей не принимает. */
const REGEXP_INTEGER = /^[-+]?\d+$/;
function defaultUnitNormalize(v: string): string {
  if (v.indexOf(' ') < 0) {
    return v !== '0' && REGEXP_BARE_NUMBER.test(v) ? v + 'px' : v;
  }
  const parts = v.split(' ');
  let i = parts.length;
  let part: string;
  while (i--) {
    part = parts[i];
    if (part !== '0' && REGEXP_BARE_NUMBER.test(part)) {
      parts[i] = part + 'px';
    }
  }
  return parts.join(' ');
}
/**
 * Готовая длина: `0`, либо число с единицей из {@link UNITS}.
 *
 * Собирается из того же списка, чтобы не разъехаться с ним при правке:
 * добавили единицу — проверка узнала сама.
 */
const REGEXP_LENGTH_PART = new RegExp('^(?:0|[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:'
  + UNITS.join('|') + '))$');
/**
 * Что именно принимает свойство-длина — флаги, третья позиция в таблице ниже.
 *
 * Признаков три, и свойства делятся по каждому независимо, поэтому одного флага
 * «это длина» мало: `text-indent:10%` валиден, `word-spacing:10%` — нет;
 * `border-spacing:10px 20px` валиден, `text-indent:10px 20px` — нет;
 * `text-indent:-5px` валиден, `flex-basis:-5px` — нет. Каждое разрешение
 * сверено с арбитром (`css-tree` + `mdn-data`), а не поставлено на глаз.
 *
 * Голый `0` означает «длина без единственной поблажки»; комбинируются через
 * `|`, например `LENGTH_PERCENT | LENGTH_SIGN` у `text-indent`.
 */
/**
 * Ключевые слова одиночных свойств-длин. Пусто означает «только CSS-wide»:
 * `outline-offset:auto` и `letter-spacing:auto` по грамматике невалидны, хотя
 * оба свойства выглядят так, будто `auto` должны принимать.
 */
const EMPTY_KEYWORDS: Record<string, 1> = {};
const LETTER_SPACING_KEYWORDS: Record<string, 1> = {
  normal: 1,
};
const TEXT_SIZE_ADJUST_KEYWORDS: Record<string, 1> = {
  auto: 1,
  none: 1,
};
/** Краткие записи `tsa`: `tsaA` → `auto`, `tsaN` → `none`. */
const TEXT_SIZE_ADJUST_SYNONYMS: Record<string, string> = {
  A: 'Auto',
  N: 'None',
};
const FONT_SIZE_ADJUST_KEYWORDS: Record<string, 1> = {
  none: 1,
  'from-font': 1,
};
/**
 * Строка слов через пробел → множество для проверки значения.
 *
 * Компактнее объектного литерала и в исходнике, и в бандле, а разворачивается
 * один раз на холодном пути регистрации.
 */
function wordsSet(words: string): Record<string, 1> {
  const parts = words.split(' ');
  const set: Record<string, 1> = {};
  let i = parts.length;
  while (i--) {
    set[parts[i]] = 1;
  }
  return set;
}
/**
 * Списки значений свойств с закрытым перечислением.
 *
 * Такие свойства принимали ЛЮБОЕ слово: `irF00` давало `image-rendering:f00`,
 * `apcZzz` — `appearance:zzz`, `tsQwe` — `transform-style:qwe`. Валидатор ядра
 * ни одно из них не знал (permissive pass-through), поэтому мусор уходил в CSS
 * молча.
 *
 * Списки выписаны из `mdn-data`, и тест сверяет каждое слово с грамматикой —
 * разойтись со спецификацией молча они не могут. Вендорные формы
 * (`-moz-crisp-edges`) оставлены: они валидны и реально используются.
 *
 * Это не таблица «свойство → валидатор», от которой уходит Q-01: здесь список
 * принадлежит хендлеру, лежит рядом с ним и проверяет его собственный аргумент,
 * а не разбирает CSS-грамматику.
 *
 * Значение записи — `1` либо строка-замена. Замена нужна там, где каноническое
 * значение в camelCase не записывается: цифра не даёт дефиса (`tsPreserve3D`
 * кебабится в `preserve3d`, а не в `preserve-3d`), а ведущий дефис вендорной
 * формы теряется тем более. Без замены единственное содержательное значение
 * `transform-style` пришлось бы писать сырым режимом — `ts_preserve-3d`.
 */
const ENUM_KEYWORDS: Record<string, Record<string, 1 | string>> = {
  appearance: wordsSet('none auto searchfield textarea checkbox radio menulist'
    + ' listbox meter progress-bar button textfield menulist-button'),
  // `jump-start`/`jump-end`/`jump-none`/`jump-both`/`start`/`end` в список НЕ
  // входят: это аргументы `steps()`, а не самостоятельные значения свойства.
  // Ошибку поймал тест-арбитр — в `mdn-data` они лежат внутри `<step-position>`,
  // и наивный обход определения вытащил их наравне с остальными.
  transitionTimingFunction: wordsSet('linear ease ease-in ease-out ease-in-out'
    + ' step-start step-end'),
  gridAutoFlow: wordsSet('row column dense'),
  textDecorationSkip: wordsSet('none objects spaces leading-spaces'
    + ' trailing-spaces edges box-decoration'),
  textDecorationSkipInk: wordsSet('auto all none'),
  textDecorationStyle: wordsSet('solid double dotted dashed wavy'),
  textUnderlinePosition: wordsSet('auto from-font under left right'),
  transformStyle: {
    ...wordsSet('flat preserve-3d'),
    // Обе естественные записи цифры: `tsPreserve3d` и `tsPreserve3D`.
    preserve3d: 'preserve-3d',
    'preserve3-d': 'preserve-3d',
  },
  mixBlendMode: wordsSet('normal multiply screen overlay darken lighten'
    + ' color-dodge color-burn hard-light soft-light difference exclusion hue'
    + ' saturation color luminosity plus-darker plus-lighter'),
  textEmphasisStyle: wordsSet('none filled open dot circle double-circle'
    + ' triangle sesame'),
  // `right`/`left` валидны только вторым словом (`over right`): грамматика —
  // `[over | under] && [right | left]?`. Порядок здесь не проверяется, слова
  // берутся списком.
  textEmphasisPosition: wordsSet('auto over under right left'),
  zoom: wordsSet('normal reset'),
  aspectRatio: wordsSet('auto'),
  position: {
    ...wordsSet('static relative absolute sticky fixed -webkit-sticky'),
    'webkit-sticky': '-webkit-sticky',
  },
  imageRendering: {
    ...wordsSet('auto crisp-edges pixelated smooth optimize-contrast'),
    'moz-crisp-edges': '-moz-crisp-edges',
    '-moz-crisp-edges': '-moz-crisp-edges',
    'o-crisp-edges': '-o-crisp-edges',
    '-o-crisp-edges': '-o-crisp-edges',
    'webkit-optimize-contrast': '-webkit-optimize-contrast',
    '-webkit-optimize-contrast': '-webkit-optimize-contrast',
    // `optimizeSpeed`/`optimizeQuality` записаны в спецификации camelCase —
    // это legacy из SVG. Кебабизация суффикса их ломает, поэтому возвращаем.
    'optimize-speed': 'optimizeSpeed',
    optimizespeed: 'optimizeSpeed',
    'optimize-quality': 'optimizeQuality',
    optimizequality: 'optimizeQuality',
  },
};
/**
 * Свойства из {@link ENUM_KEYWORDS}, у которых значение состоит из нескольких
 * слов: `text-emphasis-style: filled dot`, `grid-auto-flow: row dense`.
 * Остальные берут ровно одно, и `irAuto_Pixelated` для них — ошибка.
 */
const ENUM_MULTI: Record<string, 1> = {
  textEmphasisStyle: 1,
  textEmphasisPosition: 1,
  textDecorationSkip: 1,
  textUnderlinePosition: 1,
  gridAutoFlow: 1,
};
/**
 * Бракует значение свойства с закрытым перечислением.
 *
 * Регистр не важен: ключевые слова в CSS регистронезависимы, и сырой режим
 * (`tems_Filled_Dot`) оставляет их как написано. Ключи списка — в нижнем
 * регистре, значение — `1` либо каноническая запись, которой заменяется
 * найденное слово.
 */
function assertEnumValue(
  v: string,
  words: Record<string, 1 | string>,
  multi: 1 | 0 | undefined,
  essenceName: string,
  raw: string,
): string {
  // Подстановка и любая функция проходят: их содержимое здесь разбирать нечем,
  // а по спецификации `var()` валиден у любого свойства. CSS-wide keywords
  // валидны везде и в списке свойства не перечисляются.
  if (v.indexOf('(') > -1 || GLOBAL_KEYWORDS[v]) {
    return v;
  }
  const prefix = 'Значение "' + raw + '" не распознано: у "' + essenceName + '" ';
  const parts = v.split(' ');
  let i = parts.length;
  let canon: 1 | string | undefined;
  (i < 2 || multi) || throwInvalid(prefix + 'ожидается одно значение');
  while (i--) {
    canon = words[parts[i].toLowerCase()];
    canon || throwInvalid(prefix + 'перечень значений закрыт');
    canon === 1 || (parts[i] = canon as string);
  }
  return parts.join(' ');
}
/**
 * Ключевые слова, допустимые у любого свойства (CSS-wide keywords).
 * В словарях отдельных хендлеров не перечисляются — они валидны везде.
 */
const GLOBAL_KEYWORDS: Record<string, 1> = {
  inherit: 1,
  initial: 1,
  unset: 1,
  revert: 1,
  'revert-layer': 1,
};
/**
 * Форма значения у свойств, которые берут безразмерное число.
 *
 * Проверки не было вовсе, а единица к такому значению приписывается по общему
 * правилу нотации «число = px» или просто уходит как написана: `wid10px` давало
 * `widows:10px`, `or2.5` — `order:2.5` (свойство берёт только целое),
 * `fxg10px` — `flex-grow:10px`, `zm10px` — `zoom:10px`. Браузер такие правила
 * отбрасывает.
 *
 * Слово проверяется отдельно — списком в {@link ENUM_KEYWORDS}, если он у
 * свойства есть (`zoom: normal | reset`, `aspect-ratio: auto`).
 */
const REGEXP_VALUE_INTEGER = /^[-+]?\d+$/;
const REGEXP_VALUE_NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)$/;
/** Неотрицательное число или процент — `zoom:1.5`, `zoom:150%`. */
const REGEXP_VALUE_ZOOM = /^(?:\d+\.?\d*|\.\d+)%?$/;
/** Неотрицательное число или дробь — `aspect-ratio:1.5`, `aspect-ratio:16/9`. */
const REGEXP_VALUE_RATIO = /^(?:\d+\.?\d*|\.\d+)(?:\/(?:\d+\.?\d*|\.\d+))?$/;
const VALUE_PATTERNS: Record<string, RegExp> = {
  widows: REGEXP_VALUE_INTEGER,
  orphans: REGEXP_VALUE_INTEGER,
  order: REGEXP_VALUE_INTEGER,
  flexGrow: REGEXP_VALUE_NUMBER,
  flexShrink: REGEXP_VALUE_NUMBER,
  // Ни то, ни другое отрицательных не принимает; дробь есть только у
  // соотношения сторон, процент — только у масштаба.
  zoom: REGEXP_VALUE_ZOOM,
  aspectRatio: REGEXP_VALUE_RATIO,
};
/** Проценты допустимы: `text-indent:10%`, но не `word-spacing:10%`. */
const LENGTH_PERCENT = 1;
/** Несколько значений через `_`: `border-spacing:10px 20px`. */
const LENGTH_MULTI = 2;
/** Отрицательные значения: `text-indent:-5px`, но не `flex-basis:-5px`. */
const LENGTH_SIGN = 4;
/**
 * Бракует значение свойства-длины, которое длиной не является.
 *
 * Числовой путь ядра единицу проверяет (`validateUnit`), а общий блок свободных
 * значений — нет: суффикс кебабится и уходит в CSS как есть. В результате
 * `ti10zz` давало `text-indent:10zz`, `tiF00` — `text-indent:f00`, `ti1/2` —
 * `text-indent:1/2`, `ti10-5` — `text-indent:10-5` (вычитание, не свёрнутое в
 * `calc`). Всё это браузер отбрасывает, а предупреждения не было: свойства нет
 * в таблице валидатора ядра. Поведение должно совпадать с числовым путём, где
 * `w10zz` бракуется.
 *
 * Значение с функцией (`calc(…)`, `var(…)`, `clamp(…)`) пропускается целиком:
 * разбирать его содержимое здесь нечем, а по спецификации подстановка валидна у
 * любого свойства.
 *
 * @param allow — что именно свойство принимает, см. {@link LENGTH_PERCENT}
 */
function assertLengthValue(
  v: string, essenceName: string, raw: string, allow: number,
): string {
  if (v.indexOf('(') > -1) {
    return v;
  }
  const prefix = 'Значение "' + raw + '" не распознано: у "' + essenceName + '" ';
  const parts = v.split(' ');
  let i = parts.length;
  let part: string;
  (i < 2 || (allow & LENGTH_MULTI))
    || throwInvalid(prefix + 'ожидается одно значение');
  while (i--) {
    part = parts[i];
    // Слово сюда доходит только разрешённое: список ключевых слов свойства
    // проверен выше по `assertKnownWord`-правилу вызывающего блока.
    REGEXP_LENGTH_PART.test(part) || REGEXP_BARE_WORD.test(part)
      || throwInvalid(prefix + 'ожидается длина');
    (part.indexOf('%') < 0 || (allow & LENGTH_PERCENT))
      || throwInvalid(prefix + 'ожидается длина, процент недопустим');
    (part[0] !== '-' || (allow & LENGTH_SIGN))
      || throwInvalid(prefix + 'отрицательное значение недопустимо');
  }
  return v;
}
/**
 * Сокращение для `repeat(auto-fit|auto-fill, minmax(<size>, <size>))`.
 *
 * Самый ходовой паттерн адаптивной сетки без него пишется четырьмя
 * экранированными скобками: `gtcRepeat\(auto-fit,minmax\(240px,1fr\)\)`.
 *
 * | Токен | CSS |
 * |---|---|
 * | `gtcAF240` | `repeat(auto-fit, minmax(240px, 1fr))` |
 * | `gtcAF240_300` | `repeat(auto-fit, minmax(240px, 300px))` |
 * | `gtcAF15em_1fr` | `repeat(auto-fit, minmax(15em, 1fr))` |
 * | `gtcAFL240` | `repeat(auto-fill, minmax(240px, 1fr))` |
 *
 * Второй аргумент необязателен, по умолчанию `1fr`: умолчание закрывает типовой
 * случай, а редкий (`minmax(200px, 300px)`) остаётся выразимым без возврата
 * к скобкам.
 *
 * `AF` — `auto-fit`, `AFL` — `auto-fill`. Обе аббревиатуры претендуют на `AF`
 * (первые буквы слов), поэтому более ходовой `auto-fit` получает короткую —
 * тот же принцип, что у `us`: `A` остался за `auto`, `all` получил `AL`.
 *
 * Голое число получает `px` по сквозному правилу нотации; `fr`, `%`, `em`
 * и прочие явные единицы проходят как написаны.
 */
const REGEXP_AUTO_REPEAT = /^AF(L?)([0-9.]+[a-z%]*)(?:_([0-9.]+[a-z%]*))?$/;
/**
 * Похоже на сокращение auto-repeat, но не разобралось — вероятная описка.
 *
 * Голые `AF`/`AFL` сюда тоже входят: до появления сокращения они уходили в общий
 * путь свободного значения и давали `grid-template-columns:a-f` — молчаливый
 * мусор. Значений, начинающихся с `AF`, у grid-template-свойств нет.
 */
const REGEXP_AUTO_REPEAT_LIKE = /^AFL?(?:[0-9.]|$)/;

function autoRepeatValue(suffix: string, essenceName: string): string | undefined {
  const m = REGEXP_AUTO_REPEAT.exec(suffix);
  if (!m) {
    REGEXP_AUTO_REPEAT_LIKE.test(suffix) && throwInvalid('Запись "' + essenceName + suffix + '" похожа на сокращение auto-repeat, но '
        + 'не разобралась. Форма: "' + essenceName + 'AF240" или "' + essenceName
        + 'AF240_1fr" (AF — auto-fit, AFL — auto-fill)');
    return;
  }
  return 'repeat(auto-fi' + (m[1] ? 'll' : 't') + ', minmax('
    + defaultUnitNormalize(m[2]) + ', '
    + (m[3] ? defaultUnitNormalize(m[3]) : '1fr') + '))';
}

function __wr(v: string): string {
  return v[0] == '-'
    ? '"' + v.slice(1) + '"'
    : (
      v.indexOf(' ') > -1 ? '"' + v + '"' : v
    );
}
function calc(
  v: any, sign: string, add: any,
): string {
  return 'calc(' + v + ' ' + sign + ' ' + add + ')';
}
function normalizeCalc(
  base: any, signAndVal: string, unit: string,
): string {
  const sign = signAndVal[0];
  const val = signAndVal.slice(1);
  // Единственный вызов (ratio-хендлер) всегда передаёт третьим аргументом
  // validateUnit(p.addu || 'px') — тот никогда не возвращает пустую строку
  // при непустом входе, поэтому фолбэк на '' здесь недостижим (2026-09-23,
  // подтверждено и в v1 — тот же единственный вызов).
  return calc(
    base, sign, val + unit,
  );
}
function normalizeDefault(p: any, def?: string | number): MnHandlerResult {
  return {
    exts: [p.name + (def || 0) + p.ni],
  };
}

import {
  MnInstance,
  MnHandler,
  MnHandlerResult,
} from '../types';
import {
  MnParseError,
} from '../core/types';


export default (mn: MnInstance) => {
  const {
    utils,
    setKeyframes,
  } = mn;
  const {
    isDefined,
    map,
    mapIn,
    filter,
    forIn,
    forEach,
    upperFirst,
    lowerFirst,
    toUpper,
    camelToKebabCase,
    isArray,
    flags,
    reduce,
    size,
    intval,
    floatval,
    color: getColor,
    colorGetBackground,
    spaceNormalize,
    routeParseProvider,
    indexOf,
    toFixed,
  } = utils;

  const parseVals = routeParseProvider(PATTERN_VAL);


  function validateUnit(unit?: string): string | undefined {
    if (!unit || indexOf(UNITS, unit) > -1) {
      return unit;
    }
    throwInvalid('Unit "' + unit + '" is invalid');
  }
  /**
   * Собирает угол для `rotate*()`: число плюс единица угла.
   *
   * Единица не проверялась вовсе — в CSS уходило то, что написано:
   * `rx10px` давало `rotateX(10px)`, `rx10s` — `rotateX(10s)`. Не проверялось
   * и само значение: `rxInherit` давало `rotateX(Inheritdeg)`, буквальную
   * склейку слова с единицей. Всё это браузер отбрасывает, а предупреждения не
   * было: `transform` — permissive pass-through для валидатора ядра.
   *
   * Поворот измеряется только углом, поэтому список короткий и закрытый;
   * умолчание `deg` сохраняется (`rx45` → `rotateX(45deg)`).
   */
  function assertAngle(
    value: string, unit: string | undefined, raw: string,
  ): string {
    REGEXP_BARE_NUMBER.test(value) || throwInvalid('Значение "' + raw
      + '" не распознано: поворот задаётся числом');
    (!unit || indexOf(ANGLE_UNITS, unit) > -1) || throwInvalid('Unit "' + unit
      + '" is invalid: поворот измеряется углом (' + ANGLE_UNITS.join(', ') + ')');
    return value + (unit || 'deg');
  }
  /**
   * Бракует слово, которого хендлер не знает.
   *
   * Разбор значения пропускал ЛЮБОЕ camelCase-слово насквозь, только кебабя
   * его: `pZzz` давал `padding:zzz`, `pRed` — `padding:red`, `sTrue` —
   * `top:true;bottom:true;…`. Правило здесь локальное, грамматика CSS не нужна:
   * слово допустимо, если это краткая запись из словаря хендлера, одно из его
   * ключевых слов или CSS-wide keyword.
   *
   * Списки ключевых слов различаются по свойствам даже внутри одного семейства:
   * `margin:auto` валиден, `padding:auto` — нет; `max-width:none` валиден,
   * `min-width:none` — нет. Поэтому список приходит от места регистрации,
   * а не берётся общим на всё семейство.
   *
   * @param value — уже кебабнутое значение
   * @param raw — как оно записано в токене (для сообщения и поиска по словарю)
   * @param symonyms — словарь кратких записей хендлера
   * @param keywords — допустимые ключевые слова конкретного свойства
   */
  function assertKnownWord(
    value: string,
    raw: string,
    symonyms?: Record<string, any>,
    keywords?: Record<string, 1>,
  ): string {
    if (GLOBAL_KEYWORDS[value]
      || (symonyms && symonyms[raw])
      || (keywords && keywords[value])) {
      return value;
    }
    return throwInvalid('Значение "' + raw + '" не распознано: ожидается число '
      + 'с единицей, переменная, calc или ключевое слово этого свойства');
  }

  /**
   * Значение одиночного свойства-длины: либо слово из его списка, либо число с
   * единицей.
   *
   * Хендлеры вида `olo`, `lts`, `tsa`, `fsa` собирали значение вручную одной и
   * той же строчкой `camel ? toKebabCase(camel) : num + (p.unit || 'px')`, и ни
   * слово, ни единица там не проверялись: `oloZzz` давало `outline-offset:zzz`,
   * `oloF00` — `outline-offset:f`, `lts10zz` — `letter-spacing:10zz`,
   * `olo10%` — `outline-offset:10%` (процентов это свойство не принимает).
   * Валидатор ядра ни одно из этих свойств не знал.
   *
   * @param p — параметры хендлера
   * @param keywords — ключевые слова конкретного свойства
   * @param allow — флаги допустимого, см. {@link LENGTH_PERCENT}
   * @param defaultUnit — единица для голого числа
   */
  function lengthOrWord(
    p: any,
    keywords: Record<string, 1>,
    allow: number,
    defaultUnit: string,
    symonyms?: Record<string, string>,
  ): string {
    const camel = p.camel;
    if (camel) {
      return assertKnownWord(
        toKebabCase(symonyms && symonyms[camel] || camel),
        camel, symonyms, keywords,
      );
    }
    const num = p.num;
    if (num == '0') {
      return num;
    }
    const unit = p.unit;
    unit === '%' && !(allow & LENGTH_PERCENT) && throwInvalid('Значение "'
      + p.suffix + '" не распознано: у этого свойства процент недопустим');
    // Знак здесь не проверяется: все четыре свойства этого пути
    // (`outline-offset`, `letter-spacing`, `text-size-adjust`,
    // `font-size-adjust`) отрицательные значения принимают. Появится пятое,
    // которое не принимает, — проверка добавится вместе с ним, а мёртвой
    // ветки до тех пор нет.
    return (p.sign || '') + num + (validateUnit(unit) || defaultUnit);
  }

  /**
   * Бракует минус у свойства, которое отрицательных значений не принимает.
   *
   * Флаг `positive` у {@link getVal} был, но доходил только до
   * {@link floatNormalize} — а тот зовётся в единственной ветке разбора, для
   * дроби (`w1/-2`). Обычное число знак получало из `p.sign` и приклеивало его
   * без всякой проверки, так что `p-5` давало `padding:-5px`, `w-5` —
   * `width:-5px`, `f-5` — `font-size:-5px`. Браузер такое правило отбрасывает
   * целиком; предупреждения не было.
   *
   * Осмысленность минуса — свойство свойства, а не разбора: `margin`, `top`,
   * `text-indent`, `letter-spacing` отрицательные принимают, `padding`,
   * `width`, `border-width`, `font-size`, `border-radius` — нет. Поэтому
   * решает вызывающая сторона тем же флагом, каким и раньше.
   */
  function assertSign(
    sign: string | undefined, positive: number | undefined, suffix: any,
  ): void {
    sign === '-' && positive
      && throwInvalid('Значение "' + suffix
        + '" не распознано: отрицательное значение у этого свойства недопустимо');
  }
  /**
   * Бракует процент у свойства, которое принимает только длину.
   *
   * Процент — отдельный тип значения, и свойства делятся по нему не так, как
   * по знаку: `width:10%` валиден, `border-width:10%` — нет, `padding:10%`
   * валиден, `outline-width:10%` — нет. Проверки не было вовсе, поэтому
   * `b10%` давало `border-width:10%`, а `b1/2` — `border-width:50%` (дробь
   * всегда разворачивается в процент). Браузер такие правила отбрасывает.
   */
  function assertPercent(noPercent: number | undefined, suffix: any): void {
    noPercent && throwInvalid('Значение "' + suffix
      + '" не распознано: у этого свойства ожидается длина, процент недопустим');
  }
  function getVal(
    suffix: any,
    positive?: number,
    one?: number,
    defaultUnit?: string,
    noOtherName?: number,
    symonyms?: Record<string, any>,
    keywords?: Record<string, 1>,
    noPercent?: number,
  ): [string, number] {
    // Все 6 вызовов getVal в этом файле передают defaultUnit='px' явно —
    // фолбэк недостижим (подтверждено и в v1, 2026-09-23). Параметр остаётся
    // опциональным в сигнатуре (иначе конфликт с предшествующими optional
    // positive/one — TS1016), реальное значение гарантирует вызывающая сторона.
    /* istanbul ignore next */
    defaultUnit = defaultUnit || 'px';
    const parts = splitValueParts('' + suffix);
    const l = parts.length;
    one && l > 1 && throwInvalid('There must be one parameter');
    l > 4 && throwInvalid('There should not be more than 4 parameters');
    const output: string[] = new Array(l);
    let i = 0;
    let otherName: string | undefined;
    let add: string | undefined;
    let total: string | undefined;
    let vv: string | undefined;
    let vva: string | undefined;
    let num: string | undefined;
    let val: string;
    let p: Record<string, any>;
    let sa: string | undefined;
    for (; i < l; i++) {
      parseVals(parts[i], p = {});
      if (otherName = p.otherName) {
        noOtherName && throwInvalid();
        output[i] = assertKnownWord(
          toKebabCase(symonyms && symonyms[otherName] || otherName),
          otherName, symonyms, keywords,
        );
        continue;
      }
      // NOTE: p.vl не работает из-за бага routeParseProvider в fundamentool.
      // Используем p.num/p.otherName/p.vv как признаки наличия значения.
      (p.num != null || p.otherName || p.vv) || throwInvalid();
      num = p.num;
      vv = p.vv;
      add = p.add;
      total = p.total;
      vva = p.vva;
      sa = p.sa;
      val = num == '0'
        ? num
        : (
          vv ? (
            (p.env ? 'env(' : 'var(') + vv
              + (p.va ? (validateUnit(p.vu) ? '' : defaultUnit) : '') + ')'
          ) : (assertSign(
            p.sign, positive, suffix,
          ), p.sign || '') + (
            total
              ? (assertPercent(noPercent, suffix),
              toFixed(100 * floatNormalize(num, positive) / floatNormalize(total, positive)) + '%')
              : (p.unit === '%' && assertPercent(noPercent, suffix),
              toFixed(num) + validateUnit(p.unit || defaultUnit))
          )
        );
      output[i] = add ? calc(
        val,
        sa,
        vva
          ? ((p.nva ? 'env(' : 'var(') + vva
              + (p.vaa ? (validateUnit(p.vua) ? '' : defaultUnit) : '') + ')')
          : ('' + floatNormalize(p.addv)
              + validateUnit(p.addu || defaultUnit)),
      ) : val;
    }
    return [output.join(' '), l - 1];
  }

  function toKebabCase(v: string): string {
    return camelToKebabCase(lowerFirst(v));
  }
  /**
   * Нормализует «свободное» значение хендлера, которое не разбирается общим
   * `getVal`: `_` — разделитель частей (`\_` — литеральный символ), каждая
   * часть ОТДЕЛЬНО проверяется на CSS-переменную (`--name` → `var(--name)`,
   * `---name` → `env(--name)`) и только потом кебабится.
   *
   * Посегментно — по двум независимым причинам. (1) `camelToKebabCase` по всей
   * склеенной `_`-строке видит её одним словом и вставляет `-` перед заглавной
   * буквой внутри отдельного сегмента: `fx0_1_Auto` дало бы `0_1_-auto` вместо
   * `0_1_auto`. (2) Имя переменной кебабить нельзя — `--myInk` должен дать
   * `var(--myInk)`, а не `var(--my-ink)`; в `getVal`-пути имена уже
   * сохраняются как есть, здесь — так же.
   *
   * Ведущий `_` — режим «значение уже готово, не кебабить». Развёртка
   * переменных выполняется и в нём: `--name` в позиции CSS-значения не имеет
   * смысла как литерал, а без этого не работали составные шорткаты — суффикс
   * `ol_3px_solid_--marker` начинается с `_` и целиком уходил в сырой режим,
   * давая невалидное `outline:3px solid --marker` (2026-09-23).
   */
  function valueNormalize(v: string): string {
    const raw = v[0] == '_';
    const parts = splitValueParts(
      raw ? snakeLeftTrim(v) : v, 1, 1,
    );
    let i = parts.length;
    let part: string;
    while (i--) {
      part = parts[i];
      parts[i] = cssVarValue(part) || (raw ? part : toKebabCase(part));
    }
    // `\0` возвращается в `_` ТОЛЬКО после spaceNormalize — иначе та превратила
    // бы его в пробел уже внутри имени переменной (см. splitValueParts).
    return spaceNormalize(parts.join('_')).replace(REGEXP_VAR_UNDERSCORE, '_');
  }
  function fontNameNormalize(s: string): string {
    const c = s[0];
    return spaceNormalize(c == '_'
      ? snakeLeftTrim(s)
      : (
        c == '\'' || c == '-'
          ? s
          : toKebabCase(s)
      ));
  }
  /**
   * Хендлер со словарём кратких записей значения.
   *
   * Синоним разворачивается в ЗНАЧЕНИЕ напрямую. Раньше это был алиас на
   * длинную форму (`dF` → `exts: ['dFlex']`), из-за чего длинная форма была
   * несущей и убрать её было нельзя — а она даёт вторую запись того же
   * результата и второе правило в CSS. Теперь синоним разворачивается в
   * значение, а {@link assertSynonymAbbr} бракует длинные формы, у которых
   * есть краткая.
   */
  function synonymProvider(
    propName: string | string[],
    synonyms: Record<string, any>,
    priority?: number,
    _style?: Record<string, any>,
    // Свойство принимает не только слова из словаря, но и число/длину.
    numeric?: 1,
  ): MnHandler {
    let props: Record<string, number>;
    // Обратный индекс: длинное слово → краткая запись, строится из самого
    // словаря, поэтому новый синоним сразу начинает бракать свою длинную форму.
    const byWord: Record<string, string> = {};
    forIn(synonyms, (word: string, abbr: string) => {
      abbr && (byWord[valueNormalize(word)] = abbr);
    });
    // Допустимые слова — значения самого словаря: словарь задан на свойство,
    // поэтому отдельная таблица не нужна.
    const keywords: Record<string, 1> = {};
    forIn(synonyms, (word: string) => {
      keywords[valueNormalize(word)] = 1;
    });
    /**
     * Проверяет значение, которого нет в словаре кратких записей.
     *
     * Длинная форма бракуется в пользу краткой (две записи одного значения
     * дают в CSS два правила). Незнакомое слово бракуется вовсе: раньше оно
     * проходило насквозь и давало мёртвое правило — `ovN` → `overflow:n`,
     * `posN` → `position:n`, `fwA` → `font-weight:a`.
     *
     * **Число бракуется так же, как слово.** Раньше проверялось только слово,
     * потому что «числа словарём не перечислить», — но у свойства с закрытым
     * перечнем число невалидно само по себе, и `pos10` давало `position:10`,
     * `ov1.5` — `overflow:1.5`, `d10px` — `display:10px`. Сверка с грамматикой
     * показала, что из 38 свойств этого пути числа законны ровно у двух
     * (`text-decoration` — толщина линии, `vertical-align` — сдвиг), плюс у
     * позиции фона; они и помечены флагом `numeric`.
     *
     * Проходят мимо проверки: CSS-wide keywords, переменные и любые функции
     * (`cursor:url(…)`, `display:var(--v)`) — их словарём не перечислить.
     * Ведущий `_` — режим «значение уже готово» (`ol_3px_solid_red`):
     * составное значение тоже не перечислить.
     */
    function assertSynonymAbbr(p: any, value: string): void {
      // Сюда доходит только запись, которой НЕТ в словаре кратких форм
      // (её перехватывает `synonyms[p.suffix]` выше), поэтому если у значения
      // есть аббревиатура — записано точно длинной формой.
      const abbr = byWord[value];
      if (abbr) {
        throwInvalid('Записывается короче: "' + p.name + abbr
          + '" вместо "' + p.name + p.suffix + '" — то же значение');
      }
      if (value.indexOf('(') > -1 || p.suffix[0] === '_'
        || GLOBAL_KEYWORDS[value] || keywords[value]) {
        return;
      }
      REGEXP_BARE_WORD.test(value)
        ? throwInvalid('Значение "' + p.suffix + '" не распознано: у "' + p.name
          + '" нет такой краткой записи, а ключевым словом оно не является')
        : (numeric
          // Число у такого свойства — длина или процент, а не что угодно:
          // `bgpx10zz` давало `background-position-x:10zz`, `va10s` —
          // `vertical-align:10s`.
          ? (REGEXP_LENGTH_PART.test(value)
            || throwInvalid('Значение "' + p.suffix + '" не распознано: у "'
              + p.name + '" ожидается длина'))
          : throwInvalid('Значение "' + p.suffix + '" не распознано: у "'
            + p.name + '" перечень значений закрыт, число недопустимо'));
    }
    return isArray(propName)
      ? (props = flags(propName), ((p: any) => {
        let s: string; let style: Record<string, any>; let synonym: any; let propName: string;
        if (synonym = synonyms[s = p.suffix]) {
          style = {};
          s = valueNormalize(synonym);
          for (propName in props) style[propName] = s; // eslint-disable-line
          return styleWrap(style, priority);
        }
        if (s) {
          // valueNormalize, а не fontNameNormalize: массивную форму используют
          // только page-break-хендлеры (`pgba`/`pgbb`/`pgbi`), к именам шрифтов
          // отношения не имеющие. Через fontNameNormalize переменная уходила в
          // CSS литералом — `pgba--v` давал `page-break-after:--v` (2026-09-23).
          s = valueNormalize(s);
          assertSynonymAbbr(p, s);
          style = {};
          for (propName in props) style[propName] = s; // eslint-disable-line
          return styleWrap(style, priority);
        }
      }))
      : ((p: any) => {
        let s: string; let style: Record<string, any>; let synonym: any;
        if (synonym = synonyms[s = p.suffix]) {
          style = {};
          style[propName as string] = valueNormalize(synonym);
          return styleWrap(style, priority);
        }
        if (!s) {
          return _style ? styleWrap(_style, priority) : 0;
        }
        s = valueNormalize(s);
        assertSynonymAbbr(p, s);
        style = {};
        style[propName as string] = s;
        return styleWrap(style, priority);
      });
  }

  /**
 * Ведущая решётка перед hex — лишний символ: цвет в нотации пишется без неё
 * (`bgF00`, а не `bg#F00`). Бракуем, чтобы не плодить вторую запись того же
 * результата.
 *
 * Внутренние решётки не трогаем — там они часть значения-функции
 * (`bgLinear-gradient\(180deg,#f00,#00f\)`), и именно ради них `#` перед hex
 * перестал быть границей селектора.
 */
  /**
 * Короткая запись ТОГО ЖЕ цвета, если она есть, иначе `undefined`.
 *
 * Один цвет записывался несколькими способами: `cF`, `cFF`, `cFFF`, `cFFFFFF`
 * — все дают `#fff`, но каждый порождает СВОЁ правило в CSS. Такие записи
 * бракуются с подсказкой, чтобы в проекте осталась одна форма.
 *
 * Как сокращается (в нотации длина hex задаёт форму, см. HANDLERS.md):
 * `AABBCC` → `ABC`, `AABBCCDD` → `ABCD` (одинаковые пары);
 * `AAA` → `A`, `AAAB` → `AB` (одинаковые R/G/B — остаётся цвет и альфа).
 * Применяется повторно: `FFFFFF` → `FFF` → `F`.
 */
  function shorterHex(hex: string): string | undefined {
    let current = hex;
    let step: string | undefined;
    do {
      step = shorterHexStep(current);
      step && (current = step);
    } while (step);
    return current === hex ? undefined : current;
  }
  function shorterHexStep(hex: string): string | undefined {
    const l = hex.length;
    let i: number;
    // Полностью непрозрачная альфа ничего не добавляет: `cFF` = `cF`,
    // `cF00F` = `cF00`, `c0A0A12F` = `c0A0A12`. Альфа — последний символ при
    // длине 2/4/7 и последние два при 8.
    if ((l === 2 || l === 4 || l === 7) && hex[l - 1].toLowerCase() === 'f') {
      return hex.slice(0, l - 1);
    }
    if (l === 8 && hex.slice(6).toLowerCase() === 'ff') {
      return hex.slice(0, 6);
    }
    if (l === 6 || l === 8) {
      for (i = 0; i < l; i += 2) {
        if (hex[i].toLowerCase() !== hex[i + 1].toLowerCase()) {
          return;
        }
      }
      let halved = '';
      for (i = 0; i < l; i += 2) {
        halved += hex[i];
      }
      return halved;
    }
    // `AAA` → `A`, `AAAB` → `AB`: первые три задают цвет, четвёртый — альфа.
    if ((l === 3 || l === 4)
    && hex[0].toLowerCase() === hex[1].toLowerCase()
    && hex[1].toLowerCase() === hex[2].toLowerCase()) {
      return hex[0] + hex.slice(3);
    }
  }
  /**
   * Альфа-канал: сколько символов занимает и каков делитель. Длина значения
   * задаёт форму (см. HANDLERS.md): 2 = цвет+альфа, 4 = RGB+альфа,
   * 7 = RRGGBB+альфа, 8 = RRGGBB+AA.
   */
  const HEX_ALPHA_FORM: Record<number, [number, number]> = {
    2: [1, 15],
    4: [1, 15],
    7: [1, 15],
    8: [2, 255],
  };
  /**
   * Каноничная запись альфа-канала, если текущая не такова.
   *
   * Альфа всегда пишется десятичной дробью: `cA.67`, `cF00.5`, `c0.0`.
   * Hex-альфа (`cAA`) требует считать в уме, а значения обычно копируют из
   * макета в процентах. Отдельного исключения для полной прозрачности (`c00`)
   * намеренно нет: две формы записи одного и того же сложнее запомнить,
   * чем одну.
   */
  function canonicalAlpha(hex: string): string | undefined {
    // Уже десятичная — ничего не меняем.
    if (hex.indexOf('.') > -1) {
      return;
    }
    const form = HEX_ALPHA_FORM[hex.length];
    if (!form) {
      return;
    }
    const alpha = parseInt(hex.slice(hex.length - form[0]), 16);
    return hex.slice(0, hex.length - form[0]) + '.'
      + toFixed(alpha / form[1]).replace(REGEXP_LEADING_ZERO, '');
  }
  /** Значение-функция: `color-mix(…)`, `oklch(…)`, `light-dark(…)`. */
  const REGEXP_COLOR_FUNCTION = /^[a-z][a-z0-9-]*\(/i;
  /** CSS-переменная с альфой: `--warn.3` → 30% непрозрачности. */
  const REGEXP_VAR_WITH_ALPHA = /^(---?[^.;\s]+)\.([0-9]+)$/;
  /**
   * Значение цвета, которое НЕ разбирается как код: функция или переменная
   * с альфой. Возвращает готовый CSS или `undefined`, если это обычный цвет.
   *
   * Два случая, ради которых заведено:
   *
   * 1. `bc--warn.3` → `color-mix(in srgb, var(--warn) 30%, transparent)`.
   *    Точка-альфа уже работает для кодов (`cF00.5` → `rgba(…,.5)`), здесь
   *    то же правило распространено на переменные. До этого `bc--warn.3`
   *    молча давал `var(--warn.3)` — переменной с точкой в имени не бывает,
   *    то есть это был битый CSS.
   * 2. `bcColor-mix\(in_srgb,var\(--warn\)_30%,transparent\)` — любая
   *    функция отдаётся как есть. Запасной выход для `oklch`/`light-dark`
   *    и прочего, чего нет отдельным хендлером.
   *
   * Разбирается СЫРОЙ суффикс: `PATTERN_COLOR` обрезает функцию на первой
   * скобке (`Color-mix(a,b)` → `camel: 'Color'`), поэтому по разобранным
   * полям её не восстановить.
   */
  function rawColorValue(suffix: string): string | undefined {
    if (!suffix) {
      return;
    }
    if (REGEXP_COLOR_FUNCTION.test(suffix)) {
      return valueNormalize(suffix);
    }
    const withAlpha = REGEXP_VAR_WITH_ALPHA.exec(suffix);
    if (withAlpha) {
      // `.3` → 30%, `.67` → 67% — как у кодов.
      return 'color-mix(in srgb, var(' + withAlpha[1] + ') '
        + toFixed(parseFloat('0.' + withAlpha[2]) * 100) + '%, transparent)';
    }
  }
  /** Бракует цвет, у которого есть более короткая или более читаемая запись. */
  function assertShortestHex(p: any, hex: string): void {
    if (!hex) {
      return;
    }
    const shorter = shorterHex(hex);
    const best = canonicalAlpha(shorter || hex) || shorter;
    if (best && best !== hex) {
      throwInvalid('Цвет записывается как "' + p.name + best
        + '" вместо "' + p.name + hex + '" — то же самое значение');
    }
  }
  /** Ведущий `0` перед точкой — в нотации альфа пишется как `.67`, не `0.67`. */
  const REGEXP_LEADING_ZERO = /^0?\./;
  const REGEXP_LEADING_HASH_HEX = /^#[0-9A-Fa-f]{3,8}$/;
  /**
 * Обратный индекс `COLOR_SYNONYMS`: длинное слово → аббревиатура.
 *
 * Нужен, чтобы забраковать вторую запись того же цвета: `cCurrentColor` при
 * наличии `cCT`. Стало возможно после 2026-09-24, когда синонимы перестали
 * разворачиваться в АЛИАС на длинную форму (`exts: ['cCurrentColor']`) и
 * начали отдавать значение напрямую — до этого длинная форма была нужна как
 * цель ссылки и убрать её было нельзя.
 */
  const COLOR_SYNONYM_BY_WORD: Record<string, string> = {};
  forIn(COLOR_SYNONYMS, (word: string, abbr: string) => {
    COLOR_SYNONYM_BY_WORD[word.toLowerCase()] = abbr;
  });
  /**
   * Проверяет словесное значение цвета.
   *
   * Разбор пропускал ЛЮБОЕ camelCase-слово как цвет: `bcZzz` давал
   * `border-color:zzz`, `bcTrue` — `border-color:true`. Словарь цветов закрыт
   * (именованные цвета не принимаются — только коды), поэтому слово допустимо,
   * только если это ключевое слово из {@link COLOR_SYNONYMS} или CSS-wide.
   *
   * У слова, для которого есть аббревиатура, форма одна — краткая.
   */
  function assertColorAbbr(p: any): void {
    const camel = p.camel;
    if (!camel) {
      return;
    }
    const abbr = COLOR_SYNONYM_BY_WORD[camel.toLowerCase()];
    if (abbr) {
      throwInvalid('Цвет записывается короче: "' + p.name + abbr
      + '" вместо "' + p.name + camel + '"');
    }
    // `p.camel` заполняет не только разбор цвета, но и generic-разбор ядра:
    // у `cF00` там окажется `F` (первая заглавная буква кода). Словом значение
    // считается, только если камель — это ВЕСЬ суффикс и кода/переменной нет.
    if (camel !== p.suffix || p.color || p.vv
      || REGEXP_PLAIN_HEX.test(p.suffix)) {
      return;
    }
    GLOBAL_KEYWORDS[toKebabCase(camel)] || throwInvalid('Значение "' + camel
      + '" не распознано как цвет: ожидается код (`F00`), переменная или '
      + 'ключевое слово');
  }
  /** Одиночный hex без альфы/градиента — только цифры. */
  const REGEXP_PLAIN_HEX = /^[0-9A-Fa-f]+$/;

  function backgroundProvider(propName: string): MnHandler {
    return (p: any) => {
      let v: string; let style: Record<string, any>;
      p.negative && throwInvalid();
      if (REGEXP_LEADING_HASH_HEX.test(p.suffix)) {
        throwInvalid('Лишняя решётка: цвет пишется без неё — "'
          + p.name + p.suffix.slice(1) + '" вместо "' + p.name + p.suffix + '"');
      }
      // Синонимы проверяем ДО разбора как цвета: буквы аббревиатур бывают
      // валидными hex-цифрами, и без этого `bgAC` (AccentColor) уходил в
      // `#aaa`, `bgBB` (ButtonBorder) — в `#bb` (2026-09-24).
      const raw = rawColorValue(p.suffix);
      if (raw) {
        style = {};
        style[propName] = raw;
        return styleWrap(style);
      }
      const synonym = COLOR_SYNONYMS[p.suffix];
      if (synonym) {
        // Значение НАПРЯМУЮ, без алиаса на длинную форму (`bgCurrentColor`):
        // иначе длинная форма нужна как цель ссылки и её нельзя забраковать,
        // а она даёт вторую запись того же цвета. Смена механизма 2026-09-24.
        style = {};
        style[propName] = getColor(synonym);
        return styleWrap(style);
      }
      // Одиночный цвет (не градиент, не переменная) — проверяем, нет ли записи
      // короче. Градиент (`bgF00-00F`) разбирается своим парсером, части в нём
      // проверять здесь нечем.
      assertColorAbbr(p);
      REGEXP_PLAIN_HEX.test(p.suffix) && assertShortestHex(p, p.suffix);
      return (v = p.suffix)
        ? (style = {}, style[propName] = colorGetBackground(v), styleWrap(style))
        : normalizeDefault(p);
    };
  }

  forIn(mapIn(SIDES_MAP, (sides) => reduce(
    sides, (dst, key) => {
      dst[key] = 1; return dst; 
    }, {},
  )), (sides, suffix) => {
    const priority = suffix ? (4 - size(sides)) : 0;
    const bsSidesSet = sidesSetter((side) => 'border' + side + '-style');
    const bcSidesSet = sidesSetter((side) => 'border' + side + '-color');
    const biSidesSet = sidesSetter((side) => 'border' + side + '-image');

    function sidesSetter(handle: (side: string) => string): (v: any) => Record<string, any> {
      const propsMap: Record<string, number> = {};
      forIn(sides, (_val, propSide) => {
        propsMap[handle(propSide)] = 1; 
      });
      return (v: any) => {
        /* istanbul ignore next — защита фабрики, а не живая ветка: единственный
           вызывающий (`handleProvider` ниже) передаёт сюда `getVal()[0]`, а тот
           всегда возвращает строку (`output.join(' ')`), битый же вход роняет
           сам `getVal`. Страховка оставлена: `sidesSetter` — фабрика, её
           результат живёт в замыкании и может быть вызван из нового места. */
        isDefined(v) || throwInvalid();
        const style: Record<string, any> = {};
        let pName: string;
        for (pName in propsMap) style[pName] = v; // eslint-disable-line
        return style;
      };
    }

    function handleProvider(
      sidesSet: (v: any) => Record<string, any>,
      // Порядок параметров унаследован; `symonyms` обязателен по смыслу, но
      // объявить его таким нельзя — он идёт после необязательных (TS1016).
      // Оба вызывающих передают словарь своего семейства.
      nosign?: any,
      one?: any,
      symonyms?: Record<string, string>,
      noPercent?: any,
    ): MnHandler {
      // Словарь задан на семейство, а не общий на все размеры: `mA` →
      // `margin:auto` валиден, а `pA` → `padding:auto` — нет. Допустимые слова
      // выводятся из значений словаря, поэтому длинная форма (`bThin`) работает
      // наравне с краткой (`bTN`).
      const keywords: Record<string, 1> = {};
      forIn(symonyms, (word: string) => {
        keywords[toKebabCase(word)] = 1;
      });
      return (p: any) => {
        let suffix: string; let synonym: any;
        if (!(suffix = p.suffix)) {
          return normalizeDefault(p, 0);
        }
        if (synonym = (symonyms as Record<string, string>)[suffix]) {
          return normalizeDefault(p, synonym);
        }
        const v = getVal(
          suffix, nosign, one, 'px', 0, symonyms, keywords, noPercent,
        );
        return styleWrap(sidesSet(v[0]), priority + v[1]);
      };
    }

    forIn({
      p: [
        'padding',
        0,
        1,
        // Ключевых слов у padding нет вовсе — только длины и CSS-wide.
        {},
      ],
      m: [
        'margin',
        0,
        0,
        {
          A: 'Auto',
        },
      ],
      b: [
        'border',
        '-width',
        1,
        {
          TN: 'Thin',
          M: 'Medium',
          TC: 'Thick',
        },
        // `border-width` — это `<line-width>`, то есть длина или одно из трёх
        // слов. Процентов не принимает, в отличие от `padding`/`margin`.
        1,
      ],
    }, (args: any[], pfx: string) => {
      const propName = args[0];
      const propSuffix = args[1] || '';
      mn(
        pfx + suffix, handleProvider(
          sidesSetter((side) => propName + side + propSuffix),
          args[2],
          suffix,
          args[3],
          args[4],
        ), '', 1,
      );
    });

    mn(
      's' + suffix, handleProvider(
        suffix
          ? sidesSetter((side) => replace(
            side, REGEXP_TRIM_KEBAB_LEFT, '',
          ))
          : (v) => {
            /* istanbul ignore next — та же защита, что в `sidesSetter` выше:
               `v` приходит из `getVal()[0]` и строкой быть обязан. */
            isDefined(v) || throwInvalid();
            return {
              top: v,
              bottom: v,
              left: v,
              right: v,
            };
          },
        0,
        1,
        {
          A: 'Auto',
        },
      ), '', 1,
    );
    mn('bs' + suffix, (p) => {
      let s, synonym;
      return (synonym = BORDER_STYLE_SYNONYMS[s = p.suffix])
        ? normalizeDefault(p, synonym)
        : (
          s
            // Стиль границы — закрытый перечень (`<line-style>`), но
            // проверки не было вовсе: `bs10` давало `border-style:10`,
            // `bsF00` — `border-style:f00`, `bsZzz` — `border-style:zzz`.
            // Без стороны свойство берёт до четырёх значений
            // (`border-style: solid dotted`), со стороной — одно.
            ? styleWrap(bsSidesSet(assertEnumValue(
              valueNormalize(s), BORDER_STYLE_KEYWORDS,
              suffix ? 0 : 1, 'bs' + suffix, s,
            )), priority + 1)
            : normalizeDefault(p, 'Solid')
        );
    });
    mn(
      'bc' + suffix, (p) => {
        let v: string; let synonym: any;
        const raw = rawColorValue(p.suffix);
        if (raw) {
          return styleWrap(bcSidesSet(raw), priority + 1);
        }
        return (synonym = COLOR_SYNONYMS[p.suffix || 'CT'])
          ? styleWrap(bcSidesSet(getColor(synonym)), priority + 1)
          : (
            (v = p.value)
              ? (assertColorAbbr(p),
              assertShortestHex(p, p.color),
              styleWrap(bcSidesSet(getColor(v)), priority + 1))
              // Суффикс есть, но PATTERN_COLOR его не разобрал (напр. второй
              // цвет через `_` — множественные border-color не поддерживаются,
              // см. HANDLERS.md) — бракуем токен, а не тихо подставляем чёрный
              // (`normalizeDefault(p)` без 2-го аргумента = дефолт essence
              // `bc0`).
              //
              // Проверка `p.suffix ?` убрана как недостижимая: пустой
              // суффикс перехватывает `COLOR_SYNONYMS[p.suffix || 'CT']` выше
              // (голый `bc` → currentColor), так что сюда доходит только непустой.
              : throwInvalid()
          );
      }, PATTERN_COLOR, 1,
    );
    mn('bi' + suffix, (p) => {
      let s;
      return styleWrap(biSidesSet((s = p.suffix)
        ? valueNormalize(s)
        : 'none'), priority + 1);
    });
  });


  forIn({
    sq: ['width', 'height'],
    w: ['width'],
    h: ['height'],
  }, (props, essencePrefix) => {
    const length = props.length;
    const priority = 2 - length;
    forEach([
      '',
      'min',
      'max',
    ], (sfx) => {
      // `max-*` принимает `none` и НЕ принимает `auto`; `width`/`min-*` —
      // наоборот. Словарь кратких записей сужается под свой вариант, поэтому
      // `wmaxN` работает, а `wN` (`width:none`) бракуется.
      const keywords = sfx === 'max' ? KEYWORDS_SIZE_MAX : KEYWORDS_SIZE;
      const symonyms: Record<string, string> = {};
      forIn(SIZE_SYNONYMS, (word: string, abbr: string) => {
        keywords[toKebabCase(word)] && (symonyms[abbr] = word);
      });
      const propMap = {};
      let propName, i = 0; // eslint-disable-line
      for (; i < length; i++) {
        propName = props[i];
        propMap[sfx ? (sfx + '-' + propName) : propName] = 1;
      }
      mn(
        essencePrefix + sfx, (p) => {
          const suffix = p.suffix;
          if (!suffix) {
            return normalizeDefault(p, '100%');
          }
          const synonym = symonyms[suffix];
          if (synonym) {
            return normalizeDefault(p, synonym);
          }
          const v = getVal(
            suffix, 1, 1, 'px', 0, symonyms, keywords,
          );
          const [value] = v;
          const style = {};
          let propName;
        for (propName in propMap) style[propName] = value; // eslint-disable-line
          return styleWrap(style, priority + v[1]);
        }, '', 1,
      );
    });
  });

  /**
   * `gap8` → `gap:8px` (обе оси разом). Для разных значений по осям —
   * атомарные `gapx` (column-gap, горизонталь) / `gapy` (row-gap, вертикаль),
   * по образцу `px`/`py` у padding/margin. Многозначной формы `gap8_16`
   * намеренно нет (принцип атомарности) — `gapx16 gapy8` вместо неё.
   */
  function gapHandlerProvider(propName: string) {
    return (p: any) => {
      const suffix = p.suffix;
      if (!suffix) {
        return normalizeDefault(p, '100%');
      }
      // `normal` — initial value у gap-семейства; размерам (`w`/`h`/`p`/`m`)
      // оно не подходит, поэтому словарь здесь свой.
      if (suffix === 'N') {
        return normalizeDefault(p, 'Normal');
      }
      const v = getVal(
        suffix, 1, 1, 'px', 0, GAP_SYNONYMS, KEYWORDS_NORMAL,
      );
      // 1 CSS-свойство — priority = 2 - 1, как у соседних w/h (props.length === 1)
      const priority = 1;
      const style: Record<string, any> = {};
      style[propName] = v[0];
      return styleWrap(style, priority + v[1]);
    };
  }
  mn(
    'gap', gapHandlerProvider('gap'), '', 1,
  );
  mn(
    'gapx', gapHandlerProvider('columnGap'), '', 1,
  );
  mn(
    'gapy', gapHandlerProvider('rowGap'), '', 1,
  );

  mn('tbl', styleWrap({
    display: 'table',
  }));
  mn('tbl.cell', {
    selectors: ['>*'],
    style: {
      display: 'table-cell',
      verticalAlign: 'middle',
    },
  });

  // flex horizontal align
  forIn({
    start: {
      boxPack: 'start',
      justifyContent: 'flex-start',
    },
    center: {
      boxPack: 'center',
      justifyContent: 'center',
    },
    end: {
      boxPack: 'end',
      justifyContent: 'flex-end',
    },
    around: {
      justifyContent: 'space-around',
    },
    between: {
      boxPack: 'justify',
      justifyContent: 'space-between',
    },
  }, (style, essenceName) => {
    const capitalized = upperFirst(essenceName);
    const name = 'fxa' + capitalized;
    mn(name, styleWrap(style, 1));
    mn('fxa' + capitalized[0], name);
  });

  // flex vertical align
  forIn({
    start: {
      boxAlign: 'start',
      alignItems: 'flex-start',
      alignContent: 'flex-start',
    },
    center: {
      boxAlign: 'center',
      alignItems: 'center',
      alignContent: 'center',
    },
    end: {
      boxAlign: 'end',
      alignItems: 'flex-end',
      alignContent: 'flex-end',
    },
    stretch: {
      boxAlign: 'stretch',
      alignItems: 'stretch',
      alignContent: 'stretch',
    },
  }, (style, essenceName) => {
    mn('fya' + upperFirst(essenceName), styleWrap(style, 1));
  });

  forIn({
    S: 'Start',
    C: 'Center',
    E: 'End',
    A: 'Around',
    ST: 'Stretch',
  }, (essenceName, abbr) => {
    mn('fya' + abbr, 'fya' + essenceName);
  });

  forIn({
    dn: 'transitionDuration',
    delay: 'transitionDelay',
  }, (propName, essenceName) => {
    mn(essenceName, (p) => {
      let num;
      return p.camel || p.negative ? 0 : ((num = p.num)
        ? styleWrap({
          [propName]: num + 'ms',
        }, 1)
        : normalizeDefault(p, 250)
      );
    });
  });

  forIn({
    c: ['color'],
    stroke: ['stroke'],
    fill: ['fill'],
    olc: ['outlineColor', 1],
    bgc: ['backgroundColor', 1],
    temc: ['textEmphasisColor', 1],
    tdc: ['textDecorationColor', 1],
    // WebkitTapHighlightColor — вендорное свойство без нестандартного аналога
    // (camelCase с ведущей заглавной буквы camelToKebabCase превращает в
    // '-webkit-tap-highlight-color', см. fundamentool). Добавлено 2026-09-23
    // взамен ручного mn.css({html:{'-webkit-tap-highlight-color':'#000'}})
    // в presets/main.ts — единственного оставшегося в проекте вызова mn.css.
    thc: ['WebkitTapHighlightColor', 1],
  }, (options: any[], pfx: string) => {
    const propName = options[0];
    const priority = options[1] || 0;
    mn(
      pfx, (p) => {
        let s: Record<string, any>; let v: string; let synonym: any;
        const raw = rawColorValue(p.suffix);
        if (raw) {
          s = {};
          s[propName] = raw;
          return styleWrap(s, priority);
        }
        return (synonym = COLOR_SYNONYMS[p.suffix || 'CT'])
          ? (s = {}, s[propName] = getColor(synonym), styleWrap(s, priority))
          : (
            v = p.value,
            v || throwInvalid(),
            // При несовпадении PATTERN_COLOR в `p.value` остаётся значение от
            // generic-разбора ядра, и `c-5` уходило в CSS как `color:-5`.
            // Цвет считается разобранным, только если сработала одна из веток
            // самого PATTERN_COLOR: код, переменная или слово.
            (p.color || p.vv || p.camel) || throwInvalid('Значение "' + p.suffix
              + '" не распознано как цвет: ожидается код (`F00`), переменная '
              + 'или ключевое слово'),
            assertColorAbbr(p),
            assertShortestHex(p, p.color),
            s = {},
            s[propName] = getColor(v),
            styleWrap(s, priority)
          );
      }, PATTERN_COLOR,
    );
  });

  forIn({
    // backgroundImage: url(...)
    bgi: 'backgroundImage',
    // listStyleImage: url(...)
    lisi: 'listStyleImage',
    maski: 'maskImage',
  }, (propName, name) => {
    mn(name, (p) => {
      const style: Record<string, any> = {};
      let url: string;
      // Переменная подставляется как значение целиком, а не заворачивается в
      // url: `bgi--hero` — это `background-image:var(--hero)` (сама
      // переменная и содержит `url(…)`), а не `url("--hero")`, которое
      // ссылалось бы на файл с таким именем (2026-09-23).
      style[propName] = (url = snakeLeftTrim(p.suffix))
        ? (cssVarValue(url) || ('url("' + url + '")'))
        : 'none';
      return styleWrap(style, 1);
    });
  });

  forIn({
    float: {
      lt: 'left',
      jt: 'none',
      rt: 'right',
    },
  }, (valsMap, propName) => {
    forIn(valsMap, (value, pfx) => {
      mn(pfx, (p) => {
        return p.suffix ? 0 : styleWrap({
          [propName]: value,
        });
      });
    });
  });

  mn(
    'x', (p) => {
      const scale = p.s;
      const angle = p.angle;
      const z = p.z;
      return styleWrap({
        transform:
        'translate(' + (floatNormalize(p.x || '0') + (p.xu || 'px')) + ','
        + (floatNormalize(p.y || '0') + (p.yu || 'px')) + ')'
        + (z ? (' translateZ('
          + floatNormalize(z) + (p.zu || 'px') + ')') : '')
        + (scale ? (' scale(' + (0.01 * floatNormalize(scale)) + ')') : '')
        + (angle ? (' rotate' + toUpper(p.dir)
        + '(' + assertAngle(
          '' + floatNormalize(angle),
          (REGEXP_ANGLE_TAIL.exec(p.suffix) as RegExpExecArray)[1],
          p.name + p.suffix,
        ) + ')') : ''),
      }); // eslint-disable-next-line
  }, '^' + PATTERN_DIGITS + ':x?(%):xu?([yY]' + PATTERN_DIGITS
    + ':y(%):yu?)?([zZ]' + PATTERN_DIGITS
    + ':z(%):zu?)?([sS]([0-9\\.]+):s)?([rR](x|y|z):dir'
    + PATTERN_DIGITS + ':angle([a-z]+):unit?)?$',
  );

  mn('spnr', (p) => {
    let v;
    return isNaN(v = (v = p.value) ? parseInt(v) : 3000) || v < 1 ? 0 : (
      setKeyframes(
        'spinner-animate', {
          from: {
            transform: 'rotateZ(0deg)',
          },
          to: {
            transform: 'rotateZ(360deg)',
          },
        }, 1,
      ),
      styleWrap({
        animation: 'spinner-animate ' + v + 'ms infinite linear',
      })
    );
  });

  forEach([
    'x',
    'y',
    'z',
  ], (suffix) => {
    const prefix = 'rotate' + toUpper(suffix) + '(';
    mn('r' + suffix, (p) => {
      let v;
      return (v = p.value) ? styleWrap({
        transform: prefix + assertAngle(
          v, p.unit, p.name + p.suffix,
        ) + ')',
      }) : normalizeDefault(p, 180);
    });
  });

  forIn(SHADOW_HANDLERS, ([propName, handler], pfx) => {
    mn(
      pfx, (p) => {
        let output;
        const suffix = p.suffix;
        const style = {};
        if (suffix[0] === '_') {
          output = valueNormalize(suffix);
        } else {
          const parsed = REGEXP_SHADOW_SUFFIX.exec(suffix);
          parsed || throwInvalid('Запись "' + p.name + suffix + '" разобрана не полностью: после значения '
              + 'допустимы только модификаторы x/y/r/m/c/in. Свободная форма пишется '
              + 'с ведущим "_" — например "' + p.name + '_0_2px_8px_--shadow"');
          const repeatCount = intval(
            p.m, 1, 0,
          );
          const value = p.value;
          if (!value || repeatCount < 1) {
            style[propName] = 'none';
            return styleWrap(style);
          }

          const colors = getColor(p.c || '0');
          const prefixIn = p.in ? 'inset ' : '';
          const colorsLength = colors.length;
          // Единица склейки была жёстко `px`: `bxsh10em` давало
          // `0px 0px 10px 0px #000` — единица молча терялась, и это ещё
          // проходило мимо валидатора (`box-shadow` не в его таблице).
          // Модификаторы x/y/r по грамматике суффикса — целые без единицы,
          // поэтому единица у записи одна на все её длины.
          const separator = ((parsed as RegExpExecArray)[1] || 'px') + ' ';
        let sample, v, color, i, ci = 0; // eslint-disable-line
          output = new Array(colorsLength);

          for (;ci < colorsLength; ci++) {
            color = colors[ci];
            sample = prefixIn
            + handler(
              p.x || 0, p.y || 0, value, p.r || 0, color,
            ).join(separator);
            v = new Array(repeatCount);
            for (i = repeatCount; i--;) {
              v[i] = sample;
            }
            output[ci] = v.join(',');
          }
        }
        style[propName] = output;
        return styleWrap(style);
      }, SHADOW_PATTERNS,
    );
  });


  mn(
    'r', (p) => {
      const v = getVal(
        p.suffix || 10000, 1, 0, 'px', 1,
      );
      return styleWrap({
        borderRadius: v[0],
      }, v[1]);
    }, '', 1,
  );


  // border-radius by sides
  forIn({
    lt: 'top-left',
    lb: 'bottom-left',
    rt: 'top-right',
    rb: 'bottom-right',
  }, (side, suffix) => {
    const propName = 'border-' + side + '-radius';
    mn(
      'r' + suffix, (p) => {
        const style = {};
        style[propName] = getVal(
          p.suffix || 10000, 1, 1, 'px', 1,
        )[0];
        return styleWrap(style, 2);
      }, '', 1,
    );
  });


  forIn({
    f: [
      'fontSize',
      '',
      1,
      1,
      {
        I: 'Inherit',
      },
    ],
    sw: [
      'strokeWidth',
      0,
      0,
      1,
    ],
    olw: [
      'outlineWidth',
      0,
      1,
      1,
      {
        TN: 'Thin',
        M: 'Medium',
        TC: 'Thick',
      },
      // Та же `<line-width>`, что у `border-width`: длина или слово, без
      // процентов.
      1,
    ],
    // `grid-gap` — сокращение для двух дорожек (`row column`), поэтому здесь
    // два значения допустимы, а у покомпонентных `ggc`/`ggr` — нет.
    gg: [
      'gridGap',
      0,
      1,
      0,
      {
        U: 'Unset',
        N: 'Normal',
      },
    ],
    ggc: [
      'gridColumnGap',
      0,
      2,
      1,
      {
        U: 'Unset',
        R: 'Revert',
        N: 'Normal',
      },
    ],
    ggr: [
      'gridRowGap',
      0,
      2,
      1,
      {
        U: 'Unset',
        R: 'Revert',
        N: 'Normal',
      },
    ],
  }, (options: any[], pfx: string) => {
    const [propName, defaultValue] = options;
    const priority = options[2] || 0;
    const one = options[3];
    const synonyms = options[4] || {};
    const noPercent = options[5];
    // Допустимые слова выводятся из значений самого словаря: если хендлер
    // объявил `N: 'Normal'`, то `normal` валиден и полной записью. Отдельная
    // таблица здесь не нужна — словарь уже задан на свойство, а не на семейство.
    const keywords: Record<string, 1> = {};
    forIn(synonyms, (word: string) => {
      keywords[toKebabCase(word)] = 1;
    });
    mn(pfx, (p) => {
      let style, suffix, synonym, v;
      return (synonym = synonyms[suffix = p.suffix])
        ? normalizeDefault(p, synonym)
        : (
          v = getVal(
            suffix || defaultValue,
            1, one, 'px', 0, synonyms, keywords, noPercent,
          ),
          style = {},
          style[propName] = v[0],
          styleWrap(style, priority + v[1])
        );
    });
  });


  forIn({
    '': 0,
    x: 1,
    y: 1,
  }, (priority, suffix) => {
    const propName = 'overflow' + toUpper(suffix);
    const handle = synonymProvider(
      propName, {
        '': 'Hidden',
        V: 'Visible',
        H: 'Hidden',
        S: 'Scroll',
        A: 'Auto',
        // `clip` — как `hidden`, но без создания scroll-контейнера.
        C: 'Clip',
      }, priority,
    );

    mn('ov' + suffix, function() {
      // eslint-disable-next-line
      const essence = handle.apply(this, arguments);
      if (essence) {
        const s = essence.style;
        const v = s && s[propName];
        if (v === 'scroll' || v === 'auto') {
          essence.exts = ['ovscT'];
        }
      }
      return essence;
    });
  });

  mn('pos', (p) => {
    let s, synonym, v;
    return (synonym = POSITION_SYNONYMS[s = p.suffix])
      ? normalizeDefault(p, synonym)
      : (
        /* istanbul ignore next — ветка `0` недостижима: пустой суффикс
           разбирает `POSITION_SYNONYMS['']` выше (голый `pos` → `relative`).
           Оставлена как страховка на случай правки карты синонимов. */
        s ? (
          // Перечень у `position` закрыт, поэтому сюда доходит либо слово из
          // него, либо ошибка: `pos10` давало `position:10`, `posZzz` —
          // `position:zzz`.
          v = assertEnumValue(
            valueNormalize(s), ENUM_KEYWORDS.position, 0, 'pos', s,
          ),
          styleWrap({
            position: v,
          }, POSITION_PRIORITIES[v] || 0)
        ) : 0
      );
  });

  mn({
    cfx: {
      exts: ['posS'],
      childs: {
        pale: {
          selectors: [':before', ':after'],
          style: {
            content: '" "',
            clear: 'both',
            display: 'table',
          },
        },
      },
    },

    // background: (...)
    bg: backgroundProvider('background'),

    // font-weight
    fw: (p) => {
      const camel = p.camel;
      const synonym = camel && FONT_WEIGHT_SYNONYMS[camel];
      // `fw6` → 600 (цифра-сокращение) и `fw600` → 600 (значение CSS как есть).
      // До 2026-09-22 второе молча давало 900: число всегда умножалось на 100
      // и зажималось в 1..9, то есть самая естественная запись была неверной.
      const num = p.num;
      return synonym ? normalizeDefault(p, synonym) : !p.negative && styleWrap({
        fontWeight: camel
          // Слово не проверялось: `fwZzz` давало `font-weight:zzz`, `fwA` —
          // `font-weight:a`, `fwF00` — `font-weight:f`. Список закрытый,
          // выводится из того же словаря кратких записей.
          ? assertKnownWord(
            toKebabCase(camel), camel, FONT_WEIGHT_SYNONYMS, FONT_WEIGHT_KEYWORDS,
          )
          : (num >= 100
            ? 100 * intval(
              num / 100, 1, 1, 9,
            )
            : 100 * intval(
              num, 1, 1, 9,
            )),
      }, 1);
    },

    // position
    rlv: 'posR',
    abs: 'posA',
    fixed: 'posF',
    'static': 'posS', // eslint-disable-line
    sticky: 'posSK',

    'break': styleWrap({ // eslint-disable-line
      whiteSpace: 'normal',
      wordBreak: 'break-word',
    }),
    z: (p) => {
      let num;
      // `z-index` — целое число или `auto`. Дробь давала `z-index:1.5`,
      // правило, которое браузер отбрасывает целиком.
      return p.camel ? 0 : ((num = p.num) ? (
        REGEXP_INTEGER.test(num) || throwInvalid('Значение "' + p.suffix
          + '" не распознано: z-index задаётся целым числом'),
        styleWrap({
          zIndex: num,
        })
      ) : normalizeDefault(p, 1));
    },
    /**
     * `opacity`. Число — проценты (`o50` → `.5`), как в 1.x. Дробь меньше единицы
     * трактуется как готовая доля (`o0.5` → `.5`): до 2026-09-22 такая запись
     * молча давала `opacity:0` (0.5 % округлялось в ноль), хотя это самый
     * естественный для CSS вариант записи.
     */
    o: (p) => {
      let v, num;
      return p.camel || p.negative ? 0 : (
        (v = cssVarValue(p.suffix || '')) ? styleWrap({
          opacity: v, 
        }) : ((num = p.num) ? styleWrap({
          opacity: (num > 0 && num < 1) ? toFixed(num) : toFixed(num * 0.01),
        }) : normalizeDefault(p))
      );
    },
    /**
     * `line-height`. **Один способ на каждый смысл:** голое число — безразмерный
     * множитель, как в CSS (`lh1.5` → `line-height:1.5`; потомки наследуют
     * коэффициент); любая единица пишется явно и проходит как есть
     * (`lh20px`, `lh1.2em`, `lh150%` → `line-height:150%`).
     *
     * Изменено 2026-09-22 по двум причинам. Первая: голое число молча получало
     * `px` (`lh1` → `line-height:1px`) — единственный хендлер, где умолчание
     * нотации «число = px» расходилось со смыслом CSS-свойства. Вторая: проценты
     * пересчитывались в множитель (`lh150%` → `1.5`), то есть на одно значение
     * приходилось два способа записи, да ещё и с подменой семантики —
     * `150%` наследуется вычисленным значением, а `1.5` коэффициентом.
     */
    lh: (p) => {
      let num, unit, v;
      return p.camel ? 0 : (
        (v = cssVarValue(p.suffix || '')) ? styleWrap({
          lineHeight: v,
        }) : (
          // Единица не проверялась: `lh10zz` давало `line-height:10zz`,
          // `lh10s` — `line-height:10s`. Безразмерная форма при этом
          // сохраняется — она и есть основная.
          unit = validateUnit(p.unit),
          (num = p.num) ? styleWrap({
            lineHeight: num == '0' ? num : (unit ? num + unit : num),
          }) : normalizeDefault(p, '1')
        )
      );
    },
    tsa: (p) => {
      let v;
      return p.negative ? 0 : (
        (v = cssVarValue(p.suffix || '')) ? styleWrap({
          textSizeAdjust: v,
        }) : (p.value ? styleWrap({
          textSizeAdjust: lengthOrWord(
            p, TEXT_SIZE_ADJUST_KEYWORDS, LENGTH_PERCENT,
            'px', TEXT_SIZE_ADJUST_SYNONYMS,
          ),
        }) : normalizeDefault(p, '100%'))
      );
    },
    fsa: (p) => {
      let v;
      return p.negative ? 0 : (
        (v = cssVarValue(p.suffix || '')) ? styleWrap({
          fontSizeAdjust: v,
        }) : (p.value ? styleWrap({
          // `N` здесь — краткая запись `none`, а не начало слова: она разобрана
          // до общего пути, поэтому остаётся отдельной веткой.
          fontSizeAdjust: p.camel == 'N'
            ? 'none'
            // Значение безразмерное (`font-size-adjust:0.5`): единицы по
            // умолчанию нет, и явная тоже недопустима — `fsa10px` давало
            // `font-size-adjust:10px`.
            : (p.unit && throwInvalid('Значение "' + p.suffix
              + '" не распознано: font-size-adjust задаётся числом без единицы'),
            lengthOrWord(
              p, FONT_SIZE_ADJUST_KEYWORDS, 0, '',
            )),
        }) : 0)
      );
    },
    // `outline-offset` — длина со знаком, без процентов и без ключевых слов
    // помимо CSS-wide.
    olo: (p) => {
      let v;
      return (v = cssVarValue(p.suffix || '')) ? styleWrap({
        outlineOffset: v,
      }) : (p.value ? styleWrap({
        outlineOffset: lengthOrWord(
          p, EMPTY_KEYWORDS, 0, 'px',
        ),
      }) : normalizeDefault(p));
    },

    of: synonymProvider('objectFit', {
      '': 'Cover',
      F: 'Fill',
      CT: 'Contain',
      CV: 'Cover',
      N: 'None',
      SD: 'ScaleDown',
    }),

    d: synonymProvider('display', {
      '': 'Block',
      B: 'Block',
      N: 'None',
      F: 'Flex',
      IF: 'InlineFlex',
      I: 'Inline',
      IB: 'InlineBlock',
      LI: 'ListItem',
      RI: 'RunIn',
      CP: 'Compact',
      TB: 'Table',
      ITB: 'InlineTable',
      TBCP: 'TableCaption',
      TBCL: 'TableColumn',
      TBCLG: 'TableColumnGroup',
      TBHG: 'TableHeaderGroup',
      TBFG: 'TableFooterGroup',
      TBR: 'TableRow',
      TBRG: 'TableRowGroup',
      TBC: 'TableCell',
      RB: 'Ruby',
      RBB: 'RubyBase',
      RBBG: 'RubyBaseGroup',
      RBT: 'RubyText',
      RBTG: 'RubyTextGroup',
      // Современные значения (добавлено 2026-09-22): раньше `dG` падало в
      // буквальный `display:g` — короткие формы должны работать, а не ломаться.
      G: 'Grid',
      IG: 'InlineGrid',
      FR: 'FlowRoot',
      CN: 'Contents',
      // `F` занято `flex`, `FR` — `flow-root`, поэтому `flow` — `FW`.
      FW: 'Flow',
      ILI: 'InlineListItem',
      RBBC: 'RubyBaseContainer',
      RBTC: 'RubyTextContainer',
      IFR: 'InlineFlowRoot',
    }),

    dir: synonymProvider('direction', {
      LTR: 'Ltr',
      RTL: 'Rtl',
      I: 'Inherit',
      R: 'Revert',
      RL: 'RevertLayer',
      U: 'Unset',
    }),

    ovb: synonymProvider('overscrollBehavior', OVERSCROLL_BEHAVIOR_PRIORITIES),
    ovbx: synonymProvider('overscrollBehaviorX', OVERSCROLL_BEHAVIOR_PRIORITIES),
    ovby: synonymProvider('overscrollBehaviorY', OVERSCROLL_BEHAVIOR_PRIORITIES),

    maskt: synonymProvider('maskType', {
      L: 'Luminance',
      A: 'Alpha',
      I: 'Inherit',
      R: 'Revert',
      RL: 'RevertLayer',
      U: 'Unset',
    }),

    maskm: synonymProvider('maskMode', {
      L: 'Luminance',
      A: 'Alpha',
      I: 'Inherit',
      R: 'Revert',
      RL: 'RevertLayer',
      U: 'Unset',
      MS: 'MatchSource',
    }),

    maskbg: backgroundProvider('maskImage'),

    cl: synonymProvider('clear', {
      '': 'Both',
      B: 'Both',
      N: 'None',
      L: 'Left',
      R: 'Right',
      IS: 'InlineStart',
      IE: 'InlineEnd',
    }),
    v: synonymProvider('visibility', {
      '': 'Hidden',
      V: 'Visible',
      H: 'Hidden',
      C: 'Collapse',
    }),
    ovs: synonymProvider('overflowStyle', {
      '': 'Scrollbar',
      S: 'Scrollbar',
      A: 'Auto',
      P: 'Panner',
      M: 'Move',
      MQ: 'Marquee',
    }),
    ovsc: synonymProvider('-webkitOverflowScrolling', {
      '': 'Touch',
      A: 'Auto',
      T: 'Touch',
    }),
    cp: synonymProvider('clip', {
      A: 'Auto',
      R: 'Rect\\(top_right_bottom_left\\)',
    }),
    rsz: synonymProvider('resize', {
      '': 'None',
      N: 'None',
      B: 'Both',
      H: 'Horizontal',
      V: 'Vertical',
      // Логические оси: `BL`, а не `B` — та уже занята `both`.
      BL: 'Block',
      IL: 'Inline',
    }),
    /**
     * `cursor`. Однобуквенные заняты исторически (`C` — crosshair, `P` — pointer,
     * `A` — auto), поэтому добавленные 2026-09-24 значения берут по две буквы.
     * Курсоры изменения размера — направление + `R`: `crER` (e-resize),
     * `crNWR` (nw-resize), `crNSR` (ns-resize).
     */
    cr: synonymProvider('cursor', {
      '': 'Pointer',
      A: 'Auto',
      D: 'Default',
      C: 'Crosshair',
      HA: 'Hand',
      HE: 'Help',
      M: 'Move',
      P: 'Pointer',
      T: 'Text',
      N: 'None',
      NA: 'NotAllowed',
      W: 'Wait',
      PR: 'Progress',
      CM: 'ContextMenu',
      CE: 'Cell',
      VT: 'VerticalText',
      AL: 'Alias',
      CO: 'Copy',
      ND: 'NoDrop',
      G: 'Grab',
      GG: 'Grabbing',
      ZI: 'ZoomIn',
      ZO: 'ZoomOut',
      AS: 'AllScroll',
      CR: 'ColResize',
      RR: 'RowResize',
      ER: 'EResize',
      NR: 'NResize',
      SR: 'SResize',
      WR: 'WResize',
      NER: 'NeResize',
      NWR: 'NwResize',
      SER: 'SeResize',
      SWR: 'SwResize',
      EWR: 'EwResize',
      NSR: 'NsResize',
      NESWR: 'NeswResize',
      NWSER: 'NwseResize',
    }),
    jc: synonymProvider('justifyContent', {
      '': 'Center',
      C: 'Center',
      FE: 'FlexEnd',
      FS: 'FlexStart',
      SA: 'SpaceAround',
      SB: 'SpaceBetween',
      // Добавлено 2026-09-22 — набор приведён к `ac`/`as`, где эти ключи уже были.
      S: 'Start',
      E: 'End',
      SE: 'SpaceEvenly',
      N: 'Normal',
      ST: 'Stretch',
      L: 'Left',
      R: 'Right',
    }),
    ai: synonymProvider('alignItems', {
      '': 'Center',
      C: 'Center',
      B: 'Baseline',
      FE: 'FlexEnd',
      FS: 'FlexStart',
      // 2026-09-22: буквы приведены к `as`/`ac` — `S` это Start, `ST` — Stretch.
      // Раньше `aiS` значило Stretch, и одна и та же буква у трёх родственных
      // свойств означала разное. Ломающее изменение, но v2 не публиковалась,
      // а в самой библиотеке `aiS` нигде не использовался.
      S: 'Start',
      ST: 'Stretch',
      E: 'End',
      N: 'Normal',
      SS: 'SelfStart',
      SE: 'SelfEnd',
      FB: 'First_baseline',
      LB: 'Last_baseline',
      AC: 'AnchorCenter',
    }),
    bxz: synonymProvider('boxSizing', {
      '': 'BorderBox',
      BB: 'BorderBox',
      CB: 'ContentBox',
    }),
    fs: synonymProvider(
      'fontStyle', {
        '': 'Italic',
        N: 'Normal',
        I: 'Italic',
        O: 'Oblique',
      }, 1,
    ),
    /**
     * `font-variant` — шорткат над семейством `font-variant-*`. Было два
     * синонима из ~30 значений; добавлены 2026-09-24. Практически ходовые тут
     * `fvTN` (`tabular-nums` — цифры одной ширины в таблицах), `fvSZ`
     * (`slashed-zero`) и капитель.
     */
    fv: synonymProvider(
      'fontVariant', {
        N: 'Normal',
        NO: 'None',
        SC: 'SmallCaps',
        ASC: 'AllSmallCaps',
        PC: 'PetiteCaps',
        APC: 'AllPetiteCaps',
        U: 'Unicase',
        TC: 'TitlingCaps',
        // Лигатуры.
        CL: 'CommonLigatures',
        NCL: 'NoCommonLigatures',
        DL: 'DiscretionaryLigatures',
        NDL: 'NoDiscretionaryLigatures',
        HL: 'HistoricalLigatures',
        NHL: 'NoHistoricalLigatures',
        C: 'Contextual',
        NC: 'NoContextual',
        HF: 'HistoricalForms',
        // Цифры.
        LN: 'LiningNums',
        ON: 'OldstyleNums',
        PN: 'ProportionalNums',
        TN: 'TabularNums',
        DF: 'DiagonalFractions',
        SF: 'StackedFractions',
        O: 'Ordinal',
        SZ: 'SlashedZero',
        // Восточноазиатские.
        S: 'Simplified',
        T: 'Traditional',
        FW: 'FullWidth',
        PW: 'ProportionalWidth',
        R: 'Ruby',
      }, 1,
    ),
    fef: synonymProvider(
      'fontEffect', {
        N: 'None',
        EG: 'Engrave',
        EB: 'Emboss',
        O: 'Outline',
      }, 1,
    ),
    fsm: synonymProvider(
      'fontSmooth', {
        A: 'Auto',
        N: 'Never',
        AW: 'Always',
        // Абсолютные размеры — порог, ниже которого сглаживание отключается.
        XXS: 'XxSmall',
        XS: 'XSmall',
        S: 'Small',
        M: 'Medium',
        L: 'Large',
        XL: 'XLarge',
        XXL: 'XxLarge',
        XXXL: 'XxxLarge',
      }, 1,
    ),
    fst: synonymProvider(
      'fontStretch', {
        N: 'Normal',
        UC: 'UltraCondensed',
        EC: 'ExtraCondensed',
        C: 'Condensed',
        SC: 'SemiCondensed',
        SE: 'SemiExpanded',
        E: 'Expanded',
        EE: 'ExtraExpanded',
        UE: 'UltraExpanded',
      }, 1,
    ),
    tcha: synonymProvider('touchAction', {
      A: 'Auto',
      N: 'None',
      M: 'Manipulation',
      I: 'Initial',
      R: 'Revert',
      U: 'Unset',
      RL: 'RevertLayer',
      PX: 'PanX',
      PY: 'PanY',
      PL: 'PanLeft',
      PR: 'PanRight',
      PU: 'PanUp',
      PD: 'PanDown',
      PZ: 'PinchZoom',
    }),
    ta: synonymProvider('textAlign', {
      L: 'Left',
      C: 'Center',
      R: 'Right',
      J: 'Justify',
      E: 'End',
      S: 'Start',
      MP: 'MatchParent',
    }),
    tal: synonymProvider(
      'textAlignLast', {
        A: 'Auto',
        L: 'Left',
        C: 'Center',
        R: 'Right',
        J: 'Justify',
        E: 'End',
        S: 'Start',
      }, 1,
    ),
    /**
     * `text-decoration` — шорткат: линия + стиль + толщина + цвет. Стили
     * (`solid`/`wavy`/…) и толщина (`auto`/`from-font`) добавлены 2026-09-24
     * ТОЛЬКО сюда: `text-decoration-line` их не принимает, а карту `TD_SYNONYMS`
     * они делят.
     */
    td: synonymProvider(
      'textDecoration', {
        ...TD_SYNONYMS,
        S: 'Solid',
        DB: 'Double',
        DT: 'Dotted',
        DS: 'Dashed',
        W: 'Wavy',
        A: 'Auto',
        FF: 'FromFont',
      // `numeric`: сокращение включает толщину линии, а она — длина
      // (`text-decoration: underline 2px`).
      }, 0, 0 as any, 1,
    ),
    tdl: synonymProvider(
      'textDecorationLine', TD_SYNONYMS, 1,
    ),
    tj: synonymProvider(
      'textJustify', {
        A: 'Auto',
        N: 'None',
        ICH: 'InterCharacter',
        IW: 'InterWord',
        II: 'InterIdeograph',
        IC: 'InterCluster',
        D: 'Distribute',
        K: 'Kashida',
        T: 'Tibetan',
      }, 0, {
        textAlign: 'justify',
      },
    ),
    tov: synonymProvider('textOverflow', {
      '': 'Ellipsis',
      C: 'Clip',
      E: 'Ellipsis',
    }),
    tt: synonymProvider('textTransform', {
      '': 'Uppercase',
      N: 'None',
      C: 'Capitalize',
      U: 'Uppercase',
      L: 'Lowercase',
      FL: 'FullWidth',
      FSK: 'FullSizeKana',
      MA: 'MathAuto',
    }),
    /**
     * `text-wrap`. Карта синонимов пересобрана 2026-09-24: прежние `N`/`NO`/`U`/`S`
     * (`normal`/`none`/`unrestricted`/`suppress`) — значения из черновика CSS Text 3,
     * которого не стало; ни одно из них не валидно по текущей спецификации, то есть
     * `twN` давал CSS, молча отбрасываемый браузером. Заодно не было сокращений у
     * ВСЕХ шести реальных значений, включая ходовые `balance` и `pretty`.
     */
    tw: synonymProvider('textWrap', {
      W: 'Wrap',
      NW: 'Nowrap',
      B: 'Balance',
      P: 'Pretty',
      S: 'Stable',
      A: 'Auto',
    }),
    /**
     * `letter-spacing`. Голое число получает `px` (`lts2` → `2px`), как и остальные
     * размеры в нотации; единицы указываются явно (`lts0.06em`). До 2026-09-22
     * значение выводилось без единицы (`lts1.5` → `letter-spacing:1.5`) — невалидный CSS,
     * который браузер отбрасывал.
     */
    lts: (p) => {
      let v;
      return p.suffix === 'N'
        ? normalizeDefault(p, 'Normal')
        : ((v = cssVarValue(p.suffix || '')) ? styleWrap({
          letterSpacing: v,
        }) : (
          (p.camel || p.num != null) ? styleWrap({
            letterSpacing: lengthOrWord(
              p, LETTER_SPACING_KEYWORDS, LENGTH_PERCENT, 'px',
            ),
          }) : 0
        ));
    },
    ws: synonymProvider('whiteSpace', {
      '': 'Nowrap',
      N: 'Normal',
      P: 'Pre',
      NW: 'Nowrap',
      PW: 'PreWrap',
      PL: 'PreLine',
      BS: 'BreakSpaces',
      // CSS Text 4: `white-space` стал шорткатом над `white-space-collapse`
      // и `text-wrap`. `P` уже занято `pre`, поэтому `preserve` — `PR`.
      C: 'Collapse',
      PR: 'Preserve',
      PRB: 'PreserveBreaks',
      PRS: 'PreserveSpaces',
      W: 'Wrap',
    }),
    /**
     * `white-space-collapse`. Карта пересобрана 2026-09-24: прежние
     * `N`/`K`/`L`/`BS`/`BA` (`normal`/`keep-all`/`loose`/`break-strict`/`break-all`)
     * — значения `word-break`/`line-break`, к этому свойству не относящиеся;
     * НИ ОДНО из них не валидно, то есть любой токен `wsc*` давал CSS, молча
     * отбрасываемый браузером.
     */
    wsc: synonymProvider('whiteSpaceCollapse', {
      C: 'Collapse',
      P: 'Preserve',
      PB: 'PreserveBreaks',
      PS: 'PreserveSpaces',
      BS: 'BreakSpaces',
    }),
    wb: synonymProvider('wordBreak', {
      N: 'Normal',
      K: 'KeepAll',
      BA: 'BreakAll',
      BW: 'BreakWord',
      AP: 'AutoPhrase',
    }),
    /**
     * `word-wrap` (исторический алиас `overflow-wrap`). Значения `none`,
     * `unrestricted`, `suppress` убраны 2026-09-24 — невалидны по спецификации,
     * давали нерабочий CSS; добавлено `anywhere`.
     */
    ww: synonymProvider('wordWrap', {
      N: 'Normal',
      NM: 'Normal',
      B: 'BreakWord',
      BW: 'BreakWord',
      A: 'Anywhere',
    }),
    bgr: synonymProvider(
      'backgroundRepeat', {
        '': 'Repeat',
        R: 'Repeat',
        N: 'NoRepeat',
        X: 'RepeatX',
        Y: 'RepeatY',
        SP: 'Space',
        RD: 'Round',
      }, 1,
    ),
    bga: synonymProvider(
      'backgroundAttachment', {
        F: 'Fixed',
        S: 'Scroll',
        L: 'Local',
      }, 1,
    ),
    bgbk: synonymProvider(
      'backgroundBreak', {
        BB: 'BoundingBox',
        EB: 'EachBox',
        C: 'Continuous',
      }, 1,
    ),
    bgcp: synonymProvider(
      'backgroundClip', {
        '': 'PaddingBox',
        BB: 'BorderBox',
        PB: 'PaddingBox',
        CB: 'ContentBox',
        NC: 'NoClip',
        T: 'Text',
        BA: 'BorderArea',
      }, 1,
    ),
    bgo: synonymProvider(
      'backgroundOrigin', {
        BB: 'BorderBox',
        PB: 'PaddingBox',
        CB: 'ContentBox',
      }, 1,
    ),
    bgs: synonymProvider(
      'backgroundSize', {
        A: 'Auto',
        CT: 'Contain',
        CV: 'Cover',
      }, 1,
    ),
    q: synonymProvider(
      'quotes', {
        A: 'Auto',
        N: 'None',
        RU: `'\\00AB'_'\\00BB'_'\\201E'_'\\201C'`,
        EN: `'\\201C'_'\\201D'_'\\2018'_'\\2019'`,
      }, 1,
    ),
    ols: synonymProvider(
      'outlineStyle', OUTLINE_STYLE_SYNONYMS, 1,
    ),
    cps: synonymProvider('captionSide', {
      T: 'Top',
      B: 'Bottom',
      L: 'Left',
      R: 'Right',
      TO: 'TopOutside',
      BO: 'BottomOutside',
    }),
    ec: synonymProvider('emptyCells', {
      S: 'Show',
      H: 'Hide',
      U: 'Unset',
    }),
    bdcl: synonymProvider(
      'borderCollapse', {
        C: 'Collapse',
        S: 'Separate',
      }, 1,
    ),
    lis: synonymProvider('listStyle', {
      N: 'None',
      S: 'Square',
      D: 'Disc',
      DC: 'Decimal',
      DCLZ: 'DecimalLeadingZero',
      LR: 'LowerRoman',
      UR: 'UpperRoman',
      C: 'Circle',
      I: 'Inside',
      O: 'Outside',
    }),
    lisp: synonymProvider(
      'listStylePosition', {
        I: 'Inside',
        O: 'Outside',
      }, 1,
    ),
    list: synonymProvider(
      'listStyleType', {
        N: 'None',
        S: 'Square',
        D: 'Disc',
        DC: 'Decimal',
        DCLZ: 'DecimalLeadingZero',
        LR: 'LowerRoman',
        UR: 'UpperRoman',
        C: 'Circle',
      }, 1,
    ),
    pgbb: synonymProvider(['pageBreakBefore', 'breakBefore'], BREAK_AFTER_SYNONYMS),
    pgba: synonymProvider(['pageBreakAfter', 'breakAfter'], BREAK_AFTER_SYNONYMS),
    pgbi: synonymProvider(['pageBreakInside', 'breakInside'], {
      A: 'Auto',
      AV: 'Avoid',
      AVP: 'AvoidPage',
      AVC: 'AvoidColumn',
      AVRN: 'AvoidRegion',
    }),
    us: synonymProvider('userSelect', {
      A: 'Auto',
      N: 'None',
      T: 'Text',
      C: 'Contain',
      E: 'Element',
      // `A` занято `auto`, поэтому `all` — `AL`.
      AL: 'All',
    }),
    e: synonymProvider('pointerEvents', {
      A: 'Auto',
      N: 'None',
      V: 'Visible',
      VP: '_visiblePainted',
      VF: '_visibleFill',
      VS: '_visibleStroke',
      P: 'Painted',
      F: 'Fill',
      S: 'Stroke',
      // `A` занято `auto`, поэтому `all` — `AL`.
      AL: 'All',
    }),
    /**
     * `object-position`. Общий хендлер здесь остаётся: атомарных
     * `object-position-x/y` в CSS не существует, разложить не на что.
     * Составные формы — свободным значением: `op_left_top`, `op50%_0`.
     *
     * `background-position` (`bgp`) убран 2026-09-24 — трек
     * `notation-ergonomics`, задача 5: общий хендлер порождал уникальный класс
     * на каждую комбинацию осей, тогда как атомарные `bgpx`/`bgpy`
     * переиспользуются между комбинациями.
     */
    op: synonymProvider(
      'objectPosition', POSITION_KEYWORDS, 1,
    ),
    /**
     * Оси `background-position`. Ключевые слова у них РАЗНЫЕ: горизонтальная
     * принимает `left`/`right`/`x-start`/`x-end`, вертикальная —
     * `top`/`bottom`/`y-start`/`y-end`. До 2026-09-24 карт не было вовсе, и
     * `bgpxL` давало мусор `background-position-x:l`.
     *
     * Помечены `numeric`: позиция задаётся не только словом, но и длиной или
     * процентом — `bgpx50%`, `bgpy10px`.
     */
    bgpx: synonymProvider(
      'backgroundPositionX', {
        L: 'Left',
        C: 'Center',
        R: 'Right',
        XS: 'XStart',
        XE: 'XEnd',
      }, 2, 0 as any, 1,
    ),
    bgpy: synonymProvider(
      'backgroundPositionY', {
        T: 'Top',
        C: 'Center',
        B: 'Bottom',
        YS: 'YStart',
        YE: 'YEnd',
      }, 2, 0 as any, 1,
    ),
    as: synonymProvider('alignSelf', {
      A: 'Auto',
      N: 'Normal',
      B: 'Baseline',
      C: 'Center',
      FS: 'FlexStart',
      FE: 'FlexEnd',
      SS: 'SelfStart',
      SE: 'SelfEnd',
      S: 'Start',
      E: 'End',
      ST: 'Stretch',
      FB: 'First_baseline',
      LB: 'Last_baseline',
      AC: 'AnchorCenter',
    }),
    /**
     * `justify-self` / `justify-items` — grid-раскладка. Буквы `S`/`ST`/`E`/`C`/`N`/`B`
     * согласованы с `jc`/`ai`/`as`/`ac`; `L`/`R` — как у `jc`, `justify-items`
     * и `justify-self` их тоже принимают (унаследовано от `text-align`).
     */
    js: synonymProvider('justifySelf', {
      A: 'Auto',
      N: 'Normal',
      B: 'Baseline',
      C: 'Center',
      S: 'Start',
      E: 'End',
      ST: 'Stretch',
      SS: 'SelfStart',
      SE: 'SelfEnd',
      L: 'Left',
      R: 'Right',
      FB: 'First_baseline',
      LB: 'Last_baseline',
      AC: 'AnchorCenter',
      FS: 'FlexStart',
      FE: 'FlexEnd',
    }),
    ji: synonymProvider('justifyItems', {
      N: 'Normal',
      B: 'Baseline',
      C: 'Center',
      S: 'Start',
      E: 'End',
      ST: 'Stretch',
      SS: 'SelfStart',
      SE: 'SelfEnd',
      L: 'Left',
      R: 'Right',
      LG: 'Legacy',
      AC: 'AnchorCenter',
      FS: 'FlexStart',
      FE: 'FlexEnd',
    }),
    ac: synonymProvider('alignContent', {
      S: 'Start',
      E: 'End',
      C: 'Center',
      FS: 'FlexStart',
      FE: 'FlexEnd',
      SB: 'SpaceBetween',
      SA: 'SpaceAround',
      ST: 'Stretch',
      SE: 'SpaceEvenly',
      N: 'Normal',
      B: 'Baseline',
    }),
    va: synonymProvider(
      'verticalAlign', {
        SUP: 'Super',
        // `S` свободна: `super` исторически занял `SUP`, а не `S`.
        S: 'Sub',
        SUB: 'Sub',
        T: 'Top',
        TT: 'TextTop',
        M: 'Middle',
        BL: 'Baseline',
        B: 'Bottom',
        TB: 'TextBottom',
      // `numeric`: сдвиг базовой линии задаётся длиной или процентом
      // (`vertical-align: -0.125em`).
      }, 0, 0 as any, 1,
    ),
    wm: synonymProvider('writingMode', {
      '': 'LrTb',
      BTL: 'BtLr',
      BTR: 'BtRl',
      LRB: 'LrBt',
      LRT: 'LrTb',
      RLB: 'RlTb',
      TBL: 'TbLr',
      TBR: 'TbRl',
      HT: 'HorizontalTb',
      HB: 'HorizontalBt',
      SRL: 'SidewaysRl',
      SLR: 'SidewaysLr',
      VR: 'VerticalRl',
      VL: 'VerticalLr',
    }),
    fxd: synonymProvider(
      'flexDirection', {
        C: 'Column',
        CR: 'ColumnReverse',
        R: 'Row',
        RR: 'RowReverse',
        U: 'Unset',
      }, 1,
    ),
    fxw: synonymProvider(
      'flexWrap', {
        NW: 'Nowrap',
        W: 'Wrap',
        WR: 'WrapReverse',
      }, 1,
    ),
    font: (p) => {
      let s;
      return (s = p.suffix) && styleWrap({
        font: valueNormalize(s),
      });
    },
    ff: (p) => {
      let s;
      return (s = p.suffix) && styleWrap({
        fontFamily: cssVarValue(s) || map(fontNameNormalize(s).split(REGEXP_COMMA), __wr)
          .join(','),
      }, 1);
    },
    cnt: (p) => {
      let s;
      return (s = p.suffix) == '_'
        ? normalizeDefault(p, '\'_\'')
        : styleWrap({
          // Особый случай против общего valueNormalize: суффикс из одних `_`
          // схлопывается в пустую строку, которая для `content` невалидна —
          // подставляем пробел в кавычках.
          content: s ? (valueNormalize(s) || '" "') : 'none',
        });
    },
    ft: ftProvider('filter'),
    ftb: ftProvider('backdropFilter'),
  });

  function ftProvider(propName: string): MnHandler {
    return (p: any) => {
      let v: string; let s: Record<string, any>;
      return (v = filter(map(p.suffix.split(REGEXP_FILTER_SEP),
        (v: string) => {
          let matchs: RegExpExecArray | null; let name: string; let options: any;
          return v && (matchs = REGEXP_FILTER_NAME.exec(v)) ? (
            options = FILTER_MAP[name = lowerFirst(matchs[1])],
            camelToKebabCase(options && options[0] || name)
                + '(' + (matchs[2] || options && options[1] || '')
                + (matchs[3] || options && options[2] || '') + ')'
          ) : 0;
        }), Boolean).join(' ')) ? (
          s = {},
          s[propName] = v,
          styleWrap(s)
        ) : 0;
    };
  }

  forIn({
    ar: ['aspectRatio'],

    col: ['columns'],
    wid: ['widows'],
    orp: ['orphans'],
    coi: ['counterIncrement'],
    cor: ['counterReset'],
    wos: [
      'wordSpacing',
      0,
      LENGTH_SIGN,
      0,
      {
        normal: 1,
      },
    ],
    apc: ['appearance'],

    ti: [
      'textIndent',
      0,
      LENGTH_PERCENT | LENGTH_SIGN,
    ],

    tn: ['transition'],
    tp: ['transitionProperty', 1],
    ttf: ['transitionTimingFunction', 1],



    g: ['grid'],
    gt: ['gridTemplate', 1],
    gtc: [
      'gridTemplateColumns',
      2,
      0,
      1,
    ],
    gtr: [
      'gridTemplateRows',
      2,
      0,
      1,
    ],
    gac: ['gridAutoColumns', 1],
    gar: ['gridAutoRows', 1],
    gaf: ['gridAutoFlow', 1],

    gr: ['gridRow', 1],
    gc: ['gridColumn', 1],

    fx: ['flex'],
    fxb: [
      'flexBasis',
      1,
      LENGTH_PERCENT,
      0,
      {
        auto: 1,
        content: 1,
        'min-content': 1,
        'max-content': 1,
        'fit-content': 1,
      },
    ],
    fxf: ['flexFlow', 1],
    fxg: ['flexGrow', 1],
    fxs: ['flexShrink', 1],

    or: ['order'],
    tds: ['textDecorationSkip', 1],
    tdsi: ['textDecorationSkipInk', 2],
    tdt: [
      'textDecorationThickness',
      1,
      LENGTH_PERCENT | LENGTH_SIGN,
      0,
      {
        auto: 1,
        'from-font': 1,
      },
    ],
    tdst: ['textDecorationStyle', 2],
    tuo: [
      'textUnderlineOffset',
      2,
      LENGTH_PERCENT | LENGTH_SIGN,
      0,
      {
        auto: 1,
      },
    ],
    tup: ['textUnderlinePosition', 2],

    ts: ['transformStyle'],
    mbm: ['mixBlendMode'],
    bsp: [
      'borderSpacing',
      0,
      LENGTH_MULTI,
    ],
    // bdrs: ['borderRadius'],
    zm: ['zoom'],
    tem: ['textEmphasis'],
    temp: ['textEmphasisPosition', 1],
    tems: ['textEmphasisStyle', 1],
    ir: ['imageRendering'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, (options: any[], essenceName: string) => {
    const propName: string = options[0];
    const priority: number | undefined = options[1];
    const lengthy: number | undefined = options[2];
    const autoRepeat: number | undefined = options[3];
    const keywords: Record<string, 1> | undefined = options[4];
    // §6.3: `priority || 0` вычислялся на каждый вызов хендлера, причём дважды —
    // выносим на холодный путь регистрации.
    const stylePriority = priority || 0;
    // Свойство с закрытым перечислением: значение обязано быть из списка.
    // Список ищется по имени свойства, а не выписывается в строку реестра —
    // сам факт наличия и означает «здесь перечисление».
    const enumWords = ENUM_KEYWORDS[propName];
    const valuePattern = VALUE_PATTERNS[propName];
    mn(essenceName, (p) => {
      let s, style, repeated;
      style = {};
      if (!(s = p.suffix)) {
        // Свойству-длине пустой суффикс даёт `0`, как у `p`/`m`/`b`; остальным
        // значения по умолчанию нет — они принимают произвольное слово, и
        // угадывать за автора нечего.
        return lengthy ? (style[propName] = '0', styleWrap(style, stylePriority)) : 0;
      }
      if (autoRepeat && (repeated = autoRepeatValue(s, essenceName))) {
        style[propName] = repeated;
        return styleWrap(style, stylePriority);
      }
      s = valueNormalize(s);
      // У свойства-длины голое слово почти всегда ошибка: `tiA` давало
      // `text-indent:a`, `wosN` — `word-spacing:n`. Список слов задан на
      // свойство; у остальных хендлеров блока значения произвольны
      // (`apcNone`, `irPixelated`), и проверять там нечего.
      lengthy && REGEXP_BARE_WORD.test(s) && !GLOBAL_KEYWORDS[s]
        && !(keywords && keywords[s])
        && throwInvalid('Значение "' + p.suffix + '" не распознано: у "'
          + essenceName + '" ожидается длина или ключевое слово этого свойства');
      // У свойства с закрытым перечислением проверяется значение ЦЕЛИКОМ, а не
      // только его словесная форма: `irF00` — не слово (`f00`), но и не
      // значение `image-rendering`. Подстановка и функция проходят: их
      // содержимое здесь разбирать нечем.
      if (valuePattern) {
        // Свойство берёт безразмерное число; слово у него — только из списка,
        // если список есть.
        valuePattern.test(s) || (enumWords && (enumWords[s] || GLOBAL_KEYWORDS[s]))
          || s.indexOf('(') > -1
          || throwInvalid('Значение "' + p.suffix + '" не распознано: у "'
            + essenceName + '" ожидается число без единицы');
      } else if (enumWords) {
        s = assertEnumValue(
          s, enumWords, ENUM_MULTI[propName], essenceName, p.suffix,
        );
      }
      style[propName] = lengthy
        ? assertLengthValue(
          defaultUnitNormalize(s), essenceName, p.suffix, lengthy,
        )
        : s;
      return styleWrap(style, stylePriority);
    });
  });

  mn(
    'ratio', (p) => {
      p.other && throwInvalid();
      const v = '' + toFixed(100 * floatval(
        p.oh || p.h || 100, 1, 1,
      )
      / floatval(
        p.w || 100, 1, 1,
      )) + '%';
      return {
        exts: ['rlv'],
        style: {
          paddingTop: p.add
            ? normalizeCalc(
              v,
              p.sa + floatNormalize(p.addv),
              validateUnit(p.addu || 'px'),
            )
            : v,
        },
        childs: {
          overlay: {
            selectors: ['>*'],
            exts: ['abs' + p.ni, 's' + p.ni],
          },
        },
      };
      // eslint-disable-next-line
  }, '^((((\\d+):w)x((\\d+):h))|(\\d+):oh)?(([-+]):sa([0-9\\.]+):addv([a-z%]+):addu?):add?|(.*):other', 1);

  mn({
    contrast: styleWrap({
      imageRendering: ['optimize-contrast', '-webkit-optimize-contrast'],
    }),
  });
};
