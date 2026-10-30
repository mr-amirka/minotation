const ZERO = '0';
const NAME_NONE = 'None';
const NAME_HIDDEN = 'Hidden';
const NAME_DOTTED = 'Dotted';
const NAME_DASHED = 'Dashed';
const NAME_SOLID = 'Solid';
const SOLID = 'solid';
const RELATIVE = 'relative';
const NAME_DOUBLE = 'Double';
const NAME_LEFT = 'Left';
const NAME_CENTER = 'Center';
const NAME_RIGHT = 'Right';
const NAME_TOP = 'Top';
const NAME_BOTTOM = 'Bottom';
const NAME_AUTO = 'Auto';
const NAME_NORMAL = 'Normal';
const NAME_INHERIT = 'Inherit';
const NAME_THIN = 'Thin';
const NAME_MEDIUM = 'Medium';
const NAME_THICK = 'Thick';
const NAME_CONTAIN = 'Contain';
const NAME_REVERT = 'Revert';
const NAME_REVERT_LAYER = 'RevertLayer';
const NAME_UNSET = 'Unset';
const PX = 'px';
const PERCENT = '%';
const CONTRAST = 'contrast';
const DEG = 'deg';
const COMMA = ',';
const PIPE = '|';
const UNDERSCORE = '_';
const VAR_OPEN = 'var(';
const CLOSE_PAREN = ')';
/** Начало пояснения в подсказке: `aiC (center)`. */
const HINT_OPEN = ' (';
const SPACE = ' ';
const SEMICOLON = ';';
const N = 'N';
const A = 'A';
const NONE = 'none';
const ALL = 'all';
const AUTO = 'auto';
const SPAN = 'span';
const SIDE_LEFT = 'left';
const SIDE_RIGHT = 'right';
const PRESERVE_3D = 'preserve-3d';
const MOZ_CRISP_EDGES = '-moz-crisp-edges';
const O_CRISP_EDGES = '-o-crisp-edges';
const WEBKIT_OPTIMIZE_CONTRAST = '-webkit-optimize-contrast';
const OPTIMIZE_SPEED = 'optimizeSpeed';
const OPTIMIZE_QUALITY = 'optimizeQuality';
const NORMAL = 'normal';
const DOUBLE_QUOTE = '"';
const DASH = '-';
const LIST_SEPARATOR = ', ';
const MSG_INSTEAD_OF = '" instead of "';
const MSG_SAME_VALUE = '" — same value';
const MSG_WRITE_SHORTER = 'Write it shorter: "';
const OPEN_PAREN = '(';
const MSG_VALUE = 'Value "';
const MSG_IS_INVALID_FOR = '" is invalid for "';
const MSG_COLON = '": ';
/** Начало цитаты слова после двоеточия: `…for "bgs": "cover" stands alone`. */
const MSG_COLON_QUOTE = MSG_COLON + DOUBLE_QUOTE;
const MS = 'ms';
const SLASH = '/';
const QUOTE = '\'';
const S = 's';
const POS = 'pos';
const MASK_IMAGE = 'maskImage';
const BORDER = 'border';
const BORDER_IMAGE_SOURCE = 'borderImageSource';
const HUNDRED_PERCENT = '100%';
const FLEX_START = 'flex-start';
const CENTER = 'center';
const FLEX_END = 'flex-end';
const STRETCH = 'stretch';
const NAME_START = 'Start';
const NAME_END = 'End';
const NAME_STRETCH = 'Stretch';
const NAME_FILL = 'Fill';
const R = 'r';
const NAME_VISIBLE = 'Visible';
const NAME_COVER = 'Cover';
const NAME_BLOCK = 'Block';
const NAME_INLINE = 'Inline';
const NAME_ALWAYS = 'Always';
const NAME_BOTH = 'Both';
const NAME_COLLAPSE = 'Collapse';
const NAME_TEXT = 'Text';
const NAME_FLEX_END = 'FlexEnd';
const NAME_FLEX_START = 'FlexStart';
const NAME_BASELINE = 'Baseline';
const NAME_SELF_START = 'SelfStart';
const NAME_SELF_END = 'SelfEnd';
const NAME_FIRST_BASELINE = 'First_baseline';
const NAME_LAST_BASELINE = 'Last_baseline';
const NAME_ANCHOR_CENTER = 'AnchorCenter';
const NAME_FIXED = 'Fixed';
const NAME_BORDER_BOX = 'BorderBox';
const NAME_CONTENT_BOX = 'ContentBox';
const NAME_WRAP = 'Wrap';
const NAME_NOWRAP = 'Nowrap';
const NAME_BREAK_WORD = 'BreakWord';
const NAME_PADDING_BOX = 'PaddingBox';
const NAME_FILL_BOX = 'FillBox';
const NAME_STROKE_BOX = 'StrokeBox';
const NAME_VIEW_BOX = 'ViewBox';
/** Повтор `background-repeat` / `mask-repeat`: `bgrN`, `mkrX`; пустой суффикс — `repeat`. */
const NAME_REPEAT = 'Repeat';
const REPEAT_SYNONYMS: Record<string, string> = {
  '': NAME_REPEAT,
  R: NAME_REPEAT,
  N: 'NoRepeat',
  X: 'RepeatX',
  Y: 'RepeatY',
  SP: 'Space',
  RD: 'Round',
};
/** Рамки `mask-origin` / `mask-clip`: `<coord-box>` и рамки SVG (`mkoCB`, `mkcpVB`). */
const MASK_BOX_SYNONYMS: Record<string, string> = {
  BB: NAME_BORDER_BOX,
  PB: NAME_PADDING_BOX,
  CB: NAME_CONTENT_BOX,
  FB: NAME_FILL_BOX,
  SB: NAME_STROKE_BOX,
  VB: NAME_VIEW_BOX,
};

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
const REGEXP_DASHES = /-/g;
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
const PATTERN_COLOR = '^(' + PATTERN_BASE_COLOR + '):value$';

const PATTERN_VAL = '^(((([A-Za-z]+):otherName|([-]):sign?'
  + PATTERN_DIGITS + ':num(/' + PATTERN_DIGITS
  + ':total?)?):value([a-z%]+):unit?)|'
  + PATTERN_VAR + '):vl(([-+]):sa(([0-9\\.]+):addv([a-z%]+):addu?|'
  + PATTERN_VAR_ADD + ')):add?$';


/** `axisMode: 'physical'` (D-101) — осевые формы `x`/`y` пишут физическую пару сторон. */
const AXIS_PHYSICAL = 'physical';
/** Оси `x`/`y`: суффиксы сторон в `SIDES_MAP` (`x` — ось строки, inline; `y` — ось блока, block) и оси `rotate*`. */
const AXIS_X = 'x';
const AXIS_Y = 'y';
const INSET = 'inset';
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

  y: [
    TOP,
    BOTTOM,
  ],
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

  x: [
    LEFT,
    RIGHT,
  ],
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

  lt: [
    TOP,
    LEFT,
  ],
  rt: [
    TOP,
    RIGHT,
  ],
  lb: [
    BOTTOM,
    LEFT,
  ],
  rb: [
    BOTTOM,
    RIGHT,
  ],
};
/**
 * Логические стороны (A2, D-097; RESEARCH/17 § 5.2): `s`/`e` — начало и конец оси строки, `bs`/`be` — оси блока.
 * Пишут одно логическое свойство в любом `axisMode` (`ps10` → `padding-inline-start:10px`).
 */
const LOGICAL_SIDES: Record<string, string> = {
  s: '-inline-start',
  e: '-inline-end',
  bs: '-block-start',
  be: '-block-end',
};
/**
 * K3 (D-103): имена по A2, занятые другими свойствами, — `pe` (pointer-events) и `bs` (border-style); их стороны
 * берут `pie` и `bisw`, `be` — `biew` в пару к `bisw` (D-117: `bis`/`bie` читались как «border-image-…», и `bis`
 * нужен слайсу `border-image`).
 */
const LOGICAL_RENAMED: Record<string, string> = {
  pe: 'pie',
  bs: 'bisw',
  be: 'biew',
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
const COLOR_SYNONYMS: Record<string, string> = {
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
const BORDER_STYLE_SYNONYMS: Record<string, string> = {
  N: NAME_NONE,
  H: NAME_HIDDEN,
  DT: NAME_DOTTED,
  DS: NAME_DASHED,
  S: NAME_SOLID,
  DB: NAME_DOUBLE,
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
  L: NAME_LEFT,
  C: NAME_CENTER,
  R: NAME_RIGHT,
  T: NAME_TOP,
  B: NAME_BOTTOM,
};
/** Часть `<position>` — ключевое слово по оси x (`left`/`right`). */
const POSITION_X = 1;
/** Часть `<position>` — ключевое слово по оси y (`top`/`bottom`). */
const POSITION_Y = 2;
/** Часть `<position>` — `center`: годится обеим осям. */
const POSITION_CENTER = 3;
/** Часть `<position>` — длина, процент или функция. */
const POSITION_OFFSET = 4;
/** Часть `<position>` — переменная: что в ней, неизвестно, поэтому проходит любое место. */
const POSITION_ANY = 5;
/** Ось каждого ключевого слова позиции: по ней проверяется порядок и сочетание частей. */
const POSITION_AXES: Record<string, number> = {
  left: POSITION_X,
  right: POSITION_X,
  top: POSITION_Y,
  bottom: POSITION_Y,
  [CENTER]: POSITION_CENTER,
};
/** Углы целым значением: `tfoTL` → `top left`. Только первой частью — дальше они дали бы три слова на две оси. */
const POSITION_CORNERS: Record<string, string[]> = {
  TL: [
    'top',
    SIDE_LEFT,
  ],
  TR: [
    'top',
    SIDE_RIGHT,
  ],
  BL: [
    'bottom',
    SIDE_LEFT,
  ],
  BR: [
    'bottom',
    SIDE_RIGHT,
  ],
};
const SIZE_SYNONYMS = {
  A: NAME_AUTO,
  N: NAME_NONE,
  FC: 'FitContent',
  // `ST`, как у выравнивания (`aiST`): `S` там — `start`.
  ST: NAME_STRETCH,
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
  N: NAME_NORMAL,
};
const TD_SYNONYMS = {
  '': NAME_NONE,
  N: NAME_NONE,
  U: 'Underline',
  O: 'Overline',
  L: 'LineThrough',
  I: NAME_INHERIT,
  BL: 'Blink',
  SPE: 'SpellingError',
  GRE: 'GrammarError',
};
const BREAK_AFTER_SYNONYMS = {
  A: NAME_AUTO,
  AW: NAME_ALWAYS,
  AV: 'Avoid',
  AVP: 'AvoidPage',
  AVC: 'AvoidColumn',
  AVRN: 'AvoidRegion',
  RN: 'Region',
  C: 'Column',
  P: 'Page',
  L: NAME_LEFT,
  R: NAME_RIGHT,
  RE: 'Recto',
  VE: 'Verso',
};
const FONT_WEIGHT_SYNONYMS: Record<string, string> = {
  N: NAME_NORMAL,
  B: 'Bold',
  BR: 'Bolder',
  LR: 'Lighter',
};
/** Слова `font-weight`; пишутся буквами (`fwBR`, а `fwBolder` бракуется, D-113). */
const FONT_WEIGHT_KEYWORDS: Record<string, 1> = {
  normal: 1,
  bold: 1,
  bolder: 1,
  lighter: 1,
};
const OUTLINE_STYLE_SYNONYMS = {
  N: NAME_NONE,
  DT: NAME_DOTTED,
  DS: NAME_DASHED,
  S: NAME_SOLID,
  DB: NAME_DOUBLE,
  G: 'Groove',
  R: 'Ridge',
  I: 'Inset',
  O: 'Outset',
  // `auto` — стиль по усмотрению браузера (обычно системное кольцо фокуса).
  A: NAME_AUTO,
  // Толщина: валидна у шортката `outline`, у `outline-style` игнорируется.
  TH: NAME_THIN,
  M: NAME_MEDIUM,
  TK: NAME_THICK,
};
const POSITION_SYNONYMS: Record<string, string> = {
  R: 'Relative',
  A: 'Absolute',
  F: NAME_FIXED,
  S: 'Static',
  SK: 'Sticky',
  WS: '-webkit-sticky',
};

const OVERSCROLL_BEHAVIOR_PRIORITIES = {
  A: NAME_AUTO,
  CT: NAME_CONTAIN,
  N: NAME_NONE,
  I: NAME_INHERIT,
  R: NAME_REVERT,
  RL: NAME_REVERT_LAYER,
  U: NAME_UNSET,
};

/**
 * Словарь «одно значение или пара через `_`»: к записям `first` добавляются
 * пары `A_B` → `WordA_WordB` (`valueNormalize` разворачивает `_` в пробел).
 * Пара из двух одинаковых частей не порождается — `start start` то же, что
 * `start`, и вторая запись дала бы второе правило.
 */
function withPairs(
  base: Record<string, string>,
  first: Record<string, string>,
  second: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {
    ...base,
    ...first,
  };
  const firstKeys = Object.keys(first);
  const secondKeys = Object.keys(second);
  let i = 0;
  let j: number;
  let a: string;
  let b: string;
  const firstCount = firstKeys.length;
  const secondCount = secondKeys.length;
  for (; i < firstCount; i++) {
    a = firstKeys[i];
    for (j = 0; j < secondCount; j++) {
      b = secondKeys[j];
      a === b || (out[a + UNDERSCORE + b] = first[a] + UNDERSCORE + second[b]);
    }
  }
  return out;
}

/**
 * `scroll-snap-type` (группа B, RESEARCH/17): ось и, через `_`, строгость —
 * `sstX` → `x`, `sstX_M` → `x mandatory`, `sstBH_P` → `both proximity`.
 * `B` — `block`, как у `display`.
 */
const SCROLL_SNAP_TYPE_SYNONYMS = withPairs(
  {
    N: NAME_NONE,
  }, {
    X: 'X',
    Y: 'Y',
    B: NAME_BLOCK,
    I: NAME_INLINE,
    BH: NAME_BOTH,
  }, {
    M: 'Mandatory',
    P: 'Proximity',
  },
);

/** `scroll-snap-align`: одно значение или пара «блок_строка» — `ssaS`, `ssaC_S`. */
const SCROLL_SNAP_ALIGN_WORDS: Record<string, string> = {
  N: NAME_NONE,
  S: NAME_START,
  E: NAME_END,
  C: NAME_CENTER,
};
const SCROLL_SNAP_ALIGN_SYNONYMS = withPairs(
  {}, SCROLL_SNAP_ALIGN_WORDS, SCROLL_SNAP_ALIGN_WORDS,
);

/**
 * Функции плавности словами — `atfL` → `linear`, `atfEIO` → `ease-in-out` (группа F, RESEARCH/17); у `ttf` те же буквы
 * (D-106): одна плавность пишется одинаково у анимации и у перехода.
 */
const TIMING_FUNCTION_SYNONYMS: Record<string, string> = {
  L: 'Linear',
  E: 'Ease',
  EI: 'EaseIn',
  EO: 'EaseOut',
  EIO: 'EaseInOut',
  SS: 'StepStart',
  SE: 'StepEnd',
};
/**
 * Режимы смешивания `background-blend-mode` (группа F): `bgbmM` → `multiply`. `C` — `color`, поэтому пары на «color»
 * получили вторую букву: `CD` — `color-dodge`, `CB` — `color-burn`. `plus-darker`/`plus-lighter` фону не положены —
 * они только у `mix-blend-mode` ({@link MIX_BLEND_MODE_SYNONYMS}).
 */
const BLEND_MODE_SYNONYMS: Record<string, string> = {
  N: NAME_NORMAL,
  M: 'Multiply',
  S: 'Screen',
  O: 'Overlay',
  D: 'Darken',
  L: 'Lighten',
  CD: 'ColorDodge',
  CB: 'ColorBurn',
  HL: 'HardLight',
  SL: 'SoftLight',
  DF: 'Difference',
  E: 'Exclusion',
  H: 'Hue',
  ST: 'Saturation',
  C: 'Color',
  LM: 'Luminosity',
};
/**
 * `overflow-wrap` (`owr`): буквы те же, что у `wb`: `BW` — `break-word`. Значения `none`, `unrestricted`, `suppress`
 * убраны 2026-09-24 ещё у `ww` — невалидны по спецификации.
 */
const OVERFLOW_WRAP_SYNONYMS: Record<string, string> = {
  N: NAME_NORMAL,
  BW: NAME_BREAK_WORD,
  A: 'Anywhere',
};
/** `ww` → `owr` (D-106): у `ww` было по две буквы на значение — `B`/`BW`, `N`/`NM`. */
const WW_RENAMED: Record<string, string> = {
  B: 'BW',
  NM: N,
};
/** `overflowWrapMode` (D-106): `'legacy'` — старое имя `word-wrap`, `'both'` — оба имени. */
const WRAP_LEGACY = 'legacy';
const WRAP_BOTH = 'both';
/** Режимы смешивания элемента (`mbm`, D-106): буквы фона плюс `PD` — `plus-darker`, `PL` — `plus-lighter`. */
const MIX_BLEND_MODE_SYNONYMS: Record<string, string> = {
  ...BLEND_MODE_SYNONYMS,
  PD: 'PlusDarker',
  PL: 'PlusLighter',
};
/**
 * `color-scheme` (группа F): `cschL`, `cschL_D` → `light dark`, `cschD_O` → `dark only`. Одно `only` невалидно —
 * схема нужна хотя бы одна, поэтому `O` бывает только второй частью.
 */
const COLOR_SCHEME_WORDS: Record<string, string> = {
  L: 'Light',
  D: 'Dark',
};
const COLOR_SCHEME_SYNONYMS = withPairs(
  {
    N: NAME_NORMAL,
  }, COLOR_SCHEME_WORDS, {
    ...COLOR_SCHEME_WORDS,
    O: 'Only',
  },
);
/**
 * Группы `font-variant-numeric` в порядке спецификации: из группы берётся одно слово, `lining-nums oldstyle-nums`
 * невалидно.
 */
const FONT_VARIANT_NUMERIC_GROUPS: Record<string, string>[] = [
  {
    LN: 'LiningNums',
    ON: 'OldstyleNums',
  },
  {
    PN: 'ProportionalNums',
    TN: 'TabularNums',
  },
  {
    DF: 'DiagonalFractions',
    SF: 'StackedFractions',
  },
  {
    O: 'Ordinal',
  },
  {
    SZ: 'SlashedZero',
  },
];
/**
 * `font-variant-numeric` (группа F): буквы через `_`, по одной из группы и в порядке спецификации — `fvnTN`,
 * `fvnTN_SZ` → `tabular-nums slashed-zero`, `fvnLN_TN_SZ`. Порядок проверяет {@link assertFontVariantNumericOrder}:
 * `fvnSZ_TN` дало бы то же значение второй записью, а значит второе правило (D-113).
 */
const FONT_VARIANT_NUMERIC_SYNONYMS: Record<string, string> = Object.assign({
  N: NAME_NORMAL,
}, ...FONT_VARIANT_NUMERIC_GROUPS);
/** Номер группы каждой буквы `font-variant-numeric`. */
const FONT_VARIANT_NUMERIC_GROUP_OF: Record<string, number> = {};
FONT_VARIANT_NUMERIC_GROUPS.forEach((group, index) => {
  for (const letter of Object.keys(group)) {
    FONT_VARIANT_NUMERIC_GROUP_OF[letter] = index;
  }
});

/**
 * Порядок букв `font-variant-numeric`: по одной из группы, группы — в порядке спецификации, `N` стоит одна.
 * Незнакомую часть пропускает: её бракует общий разбор («no such abbreviation» или «write it shorter»).
 */
function assertFontVariantNumericOrder(name: string, suffix: string): void {
  const parts = suffix.split(UNDERSCORE);
  const l = parts.length;
  const groupOf = FONT_VARIANT_NUMERIC_GROUP_OF;
  const prefix = MSG_VALUE + suffix + MSG_IS_INVALID_FOR + name + MSG_COLON;
  let i = 0;
  let group: number | undefined;
  let last = -1;
  let used = 0;
  let unordered = 0;
  let unknown = 0;
  for (; i < l; i++) {
    parts[i] === N && throwInvalid(prefix + '"N" (normal) stands alone');
    if ((group = groupOf[parts[i]]) === undefined) {
      unknown = 1;
      continue;
    }
    used & (1 << group) && throwInvalid(prefix + 'one letter of a group — "'
      + Object.keys(FONT_VARIANT_NUMERIC_GROUPS[group]).join('" or "') + DOUBLE_QUOTE);
    used |= 1 << group;
    group < last ? (unordered = 1) : (last = group);
  }
  unordered && !unknown && throwInvalid('Write "' + name + parts.sort((a, b) => groupOf[a] - groupOf[b])
    .join(UNDERSCORE) + MSG_INSTEAD_OF + name + suffix + MSG_SAME_VALUE + ': the order of the specification');
}

/**
 * Буквы выравнивания: одни и те же у `ac`/`jc`, `ai`/`ji`, `as`/`js` и у пар `plc`/`pli`/`pls`, где первая часть —
 * `align-*`, вторая — `justify-*` (группа C).
 */
const ALIGN_CONTENT_WORDS: Record<string, string> = {
  S: NAME_START,
  E: NAME_END,
  C: NAME_CENTER,
  FS: NAME_FLEX_START,
  FE: NAME_FLEX_END,
  SB: 'SpaceBetween',
  SA: 'SpaceAround',
  ST: NAME_STRETCH,
  SE: 'SpaceEvenly',
  N: NAME_NORMAL,
  B: NAME_BASELINE,
};

const JUSTIFY_CONTENT_WORDS: Record<string, string> = {
  C: NAME_CENTER,
  FE: NAME_FLEX_END,
  FS: NAME_FLEX_START,
  SA: 'SpaceAround',
  SB: 'SpaceBetween',
  // Добавлено 2026-09-22 — набор приведён к `ac`/`as`, где эти ключи уже были.
  S: NAME_START,
  E: NAME_END,
  SE: 'SpaceEvenly',
  N: NAME_NORMAL,
  ST: NAME_STRETCH,
  L: NAME_LEFT,
  R: NAME_RIGHT,
};

const ALIGN_ITEMS_WORDS: Record<string, string> = {
  C: NAME_CENTER,
  B: NAME_BASELINE,
  FE: NAME_FLEX_END,
  FS: NAME_FLEX_START,
  // 2026-09-22: буквы приведены к `as`/`ac` — `S` это Start, `ST` — Stretch.
  // Раньше `aiS` значило Stretch, и одна и та же буква у трёх родственных
  // свойств означала разное. Ломающее изменение, но v2 не публиковалась,
  // а в самой библиотеке `aiS` нигде не использовался.
  S: NAME_START,
  ST: NAME_STRETCH,
  E: NAME_END,
  N: NAME_NORMAL,
  SS: NAME_SELF_START,
  SE: NAME_SELF_END,
  FB: NAME_FIRST_BASELINE,
  LB: NAME_LAST_BASELINE,
  AC: NAME_ANCHOR_CENTER,
};

const JUSTIFY_ITEMS_WORDS: Record<string, string> = {
  N: NAME_NORMAL,
  B: NAME_BASELINE,
  C: NAME_CENTER,
  S: NAME_START,
  E: NAME_END,
  ST: NAME_STRETCH,
  SS: NAME_SELF_START,
  SE: NAME_SELF_END,
  L: NAME_LEFT,
  R: NAME_RIGHT,
  LG: 'Legacy',
  AC: NAME_ANCHOR_CENTER,
  FS: NAME_FLEX_START,
  FE: NAME_FLEX_END,
};

const ALIGN_SELF_WORDS: Record<string, string> = {
  A: NAME_AUTO,
  N: NAME_NORMAL,
  B: NAME_BASELINE,
  C: NAME_CENTER,
  FS: NAME_FLEX_START,
  FE: NAME_FLEX_END,
  SS: NAME_SELF_START,
  SE: NAME_SELF_END,
  S: NAME_START,
  E: NAME_END,
  ST: NAME_STRETCH,
  FB: NAME_FIRST_BASELINE,
  LB: NAME_LAST_BASELINE,
  AC: NAME_ANCHOR_CENTER,
};

const JUSTIFY_SELF_WORDS: Record<string, string> = {
  A: NAME_AUTO,
  N: NAME_NORMAL,
  B: NAME_BASELINE,
  C: NAME_CENTER,
  S: NAME_START,
  E: NAME_END,
  ST: NAME_STRETCH,
  SS: NAME_SELF_START,
  SE: NAME_SELF_END,
  L: NAME_LEFT,
  R: NAME_RIGHT,
  FB: NAME_FIRST_BASELINE,
  LB: NAME_LAST_BASELINE,
  AC: NAME_ANCHOR_CENTER,
  FS: NAME_FLEX_START,
  FE: NAME_FLEX_END,
};

const POSITION_PRIORITIES: Record<string, number> = {
  relative: 0,
  absolute: 1,
  fixed: 2,
  static: 3,
  sticky: 4,
};

const SHADOW_HANDLERS: Record<string, [string, (x: any, y: any, value: any, r: any, color: any) => any[]]> = {
  bxsh: [
    'boxShadow',
    function(
      x, y, value, r, color,
    ) {
      return [
        x,
        y,
        value,
        r,
        color,
      ];
    },
  ],
  tsh: [
    'textShadow',
    function(
      x, y, value, r, color,
    ) {
      return [
        x,
        y,
        value,
        color,
      ];
    },
  ],
};
const FILTER_MAP: Record<string, Array<string | number>> = {
  blur: [
    'blur',
    4,
    PX,
  ],
  gray: [
    'grayscale',
    100,
    PERCENT,
  ],
  bright: [
    'brightness',
    100,
    PERCENT,
  ],
  contrast: [
    CONTRAST,
    100,
    PERCENT,
  ],
  hue: [
    'hue-rotate',
    180,
    DEG,
  ],
  invert: [
    'invert',
    100,
    PERCENT,
  ],
  saturate: [
    'saturate',
    100,
    PERCENT,
  ],
  sepia: [
    'sepia',
    100,
    PERCENT,
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
  + 'em,ex,px,cm,mm,in,pt,pc,ch,ic,lh,vw,vh,vi,vb,q,%').split(COMMA);

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
const SHADOW_UNITS = UNITS.filter((unit) => unit !== PERCENT && unit !== 'in');
/** Единицы угла — всё, чем измеряется поворот в CSS. */
const ANGLE_UNITS = [
  DEG,
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
/**
 * Порядок модификаторов тени — **жёсткий**: `blur x y r m c in`.
 *
 * Свободный порядок был следствием реализации: `SHADOW_PATTERNS` — независимые
 * regex'ы, каждый искал свой фрагмент где угодно, поэтому `bxsh19c43Fx5y5r3`
 * давало то же, что `bxsh19x5y5r3c43F`. Решение владельца 2026-09-27 — сделать
 * порядок жёстким, по тому же доводу, что и у `tn`: одно значение не должно
 * записываться по-разному.
 *
 * Регулярка анкорена и собрана в этом порядке, так что она и проверяет запись,
 * и разбирает её — отдельный обход паттернами больше не нужен.
 *
 * CSS-переменная в позиции blur пишется **явно**, через `B`: `bxshB--blur`.
 * Буква заглавная по той же причине, что `X`/`Y`/`R`/`M`: строчная слилась бы
 * с именем тега — `bxshb…` ядро прочитало бы как тег `bxshb`, не нашло бы
 * хендлера и молча пропустило токен как чужой класс.
 * Без буквы переменная означает всю тень целиком (`bxsh--shadow` →
 * `box-shadow:var(--shadow)`), как `--x` у любого другого свойства. Раньше она
 * молча попадала в позицию blur, а прочие слоты добирались умолчаниями —
 * автор получал правило, которого не писал (решение владельца 2026-09-29).
 */
const REGEXP_SHADOW_SUFFIX = new RegExp('^(?:([0-9.]+)('
  + SHADOW_UNITS.join(PIPE) + ')?|B(---?[^;\\s]+;?))?'
  + '(?:[xX](-?[0-9]+))?'
  + '(?:[yY](-?[0-9]+))?'
  + '(?:[rR](-?[0-9]+))?'
  + '(?:[mM]([0-9]+))?'
  + '(?:c(' + PATTERN_BASE_COLOR.replace(REGEXP_ROUTE_KEY, '') + '))?'
  + '(in)?$');
/** Позиции групп в {@link REGEXP_SHADOW_SUFFIX}. */
const MN_SHADOW_VALUE = 1;
const MN_SHADOW_UNIT = 2;
const MN_SHADOW_BLUR_VAR = 3;
const MN_SHADOW_X = 4;
const MN_SHADOW_Y = 5;
const MN_SHADOW_R = 6;
const MN_SHADOW_M = 7;
const MN_SHADOW_COLOR = 8;

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
/** Имена контейнера через пробел — идентификаторы CSS или переменная: `sidebar`, `side main`, `var(--c)`. */
const REGEXP_CONTAINER_NAMES = /^(?:var\(--[\w-]+\)|(?:-?[a-zA-Z_][\w-]*)(?: -?[a-zA-Z_][\w-]*)*)$/;

/** Имена контейнера из суффикса — как записаны (D-091): ведущий `_` снят, `_` — пробел, `--c` — `var(--c)`. */
function containerNames(suffix: string): string {
  const raw = suffix[0] === UNDERSCORE ? suffix.slice(1) : suffix;
  return raw.indexOf('--') === 0 ? VAR_OPEN + raw + CLOSE_PAREN : raw.split(UNDERSCORE).join(SPACE);
}

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
  return m ? (m[1].length === 3 ? 'env(--' : 'var(--') + m[2] + CLOSE_PAREN : undefined;
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
/**
 * `;` вплотную перед следующей переменной — там он ещё и граница частей.
 *
 * Ровно два дефиса: три означают минус перед переменной, то есть вычитание в
 * `calc` (`w--a;---b` → `calc(var(--a) - var(--b))`), и разделителем `;` там
 * не является. Пробел перед `env()` пишется явно: `w--a;_---b`.
 */
const REGEXP_VAR_NEXT = /;(?=--(?!-))/g;
const REGEXP_UNDERSCORE_ALL = /_/g;
const REGEXP_VAR_UNDERSCORE = /\0/g;
function varUnderscoreHide(_all: string, name: string): string {
  return name.replace(REGEXP_UNDERSCORE_ALL, '\0') + SEMICOLON;
}
function splitValueParts(
  v: string, byEscaped?: 1, keepHidden?: 1,
): string[] {
  const parts = (v.indexOf(SEMICOLON) < 0
    ? v
    // `;` сразу перед следующей переменной — и терминатор имени, и граница
    // частей: `g--a;--b` → `grid:var(--a) var(--b)`. Писать там ещё и `_`
    // (`g--a;_--b`) было лишним церемониалом — между двумя переменными
    // подряд другого смысла у `;` и нет. Запятая пишется явно: `g--a;,--b`.
    : v.replace(REGEXP_VAR_NEXT, ';_').replace(REGEXP_VAR_TERMINATED, varUnderscoreHide)
  ).split(byEscaped ? REGEXP_UNESCAPED_UNDERSCORE : UNDERSCORE);
  if (keepHidden) {
    return parts;
  }
  let i = parts.length;
  while (i--) {
    parts[i] = parts[i].replace(REGEXP_VAR_UNDERSCORE, UNDERSCORE);
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
  if (v.indexOf(SPACE) < 0) {
    return v !== ZERO && REGEXP_BARE_NUMBER.test(v) ? v + PX : v;
  }
  const parts = v.split(SPACE);
  let i = parts.length;
  let part: string;
  while (i--) {
    part = parts[i];
    if (part !== ZERO && REGEXP_BARE_NUMBER.test(part)) {
      parts[i] = part + PX;
    }
  }
  return parts.join(SPACE);
}
/**
 * Готовая длина: `0` либо число со знаком и одной из единиц. Одна сборка на все проверки длин: длина, длина без
 * процента, размер дорожки (`1fr`), длина или число (`border-image-width`) не разъезжаются в записи числа.
 * @param units допустимые единицы
 * @param unitOptional число без единицы тоже годится (`2` — кратное, как у `border-image-width`)
 * @returns регулярное выражение на часть значения целиком
 * @example lengthPartRegExp(['px', 'em']).test('-1.5em') // true
 * @example lengthPartRegExp(['px'], 1).test('2') // true
 */
function lengthPartRegExp(units: string[], unitOptional?: 1): RegExp {
  return new RegExp('^(?:0|[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:' + units.join(PIPE) + ')' + (unitOptional ? '?' : '')
    + ')$');
}
/**
 * Готовая длина: `0`, либо число с единицей из {@link UNITS}.
 *
 * Собирается из того же списка, чтобы не разъехаться с ним при правке:
 * добавили единицу — проверка узнала сама.
 */
const REGEXP_LENGTH_PART = lengthPartRegExp(UNITS);
/**
 * Что именно принимает свойство-длина — флаги, третья позиция в таблице ниже.
 *
 * Признаков три, и свойства делятся по каждому независимо, поэтому одного флага
 * «это длина» мало: `text-indent:10%` валиден, `word-spacing:10%` — нет;
 * `border-spacing:10px 20px` валиден, `text-indent:10px 20px` — нет;
 * `text-indent:-5px` валиден, `flex-basis:-5px` — нет. Каждое разрешение
 * сверено с арбитром (`css-tree` + `mdn-data`), а не поставлено на глаз.
 *
 * Длина без единственной поблажки — {@link LENGTH_PLAIN}: голый `0` в таблице означает «не длина».
 * Комбинируются через `|`, например `LENGTH_PERCENT | LENGTH_SIGN` у `text-indent`.
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
  A: NAME_AUTO,
  N: NAME_NONE,
};
const FONT_SIZE_ADJUST_KEYWORDS: Record<string, 1> = {
  none: 1,
  'from-font': 1,
};
/** Краткие записи `fsa`: `fsaN` → `none`, `fsaFF` → `from-font` (как `tdFF`, D-113). */
const FONT_SIZE_ADJUST_SYNONYMS: Record<string, string> = {
  N: NAME_NONE,
  FF: 'FromFont',
};
/**
 * Строка слов через пробел → множество для проверки значения.
 *
 * Компактнее объектного литерала и в исходнике, и в бандле, а разворачивается
 * один раз на холодном пути регистрации.
 */
function wordsSet(words: string): Record<string, 1> {
  const parts = words.split(SPACE);
  const set: Record<string, 1> = {};
  let i = parts.length;
  while (i--) {
    set[parts[i]] = 1;
  }
  return set;
}

/**
 * Длина у свойства со словарём — флаг `numeric` у `synonymProvider` (D-104): бывает ли она отрицательной, сколько
 * длин в значении и какие слова стоят только поодиночке. Голое число получает `px`, как у прочих длин.
 */
interface LengthRule {
  signed: boolean;
  max: number;
  solo?: Record<string, 1>;
  /** Форма числовой части, если не любая длина ({@link REGEXP_LENGTH_PART}): без процента, число без единицы. */
  part?: RegExp;
  /** Голое число остаётся без единицы, а не получает `px`: слайс `border-image` — пиксели картинки. */
  unitless?: 1;
  /** Буква одна значением не бывает: `fill` — только рядом со слайсом (`bis30_F`, а не `bisF`). */
  needsNumber?: 1;
  /** Что ожидалось на месте числовой части — для ошибки (по умолчанию `a length`). */
  expected?: string;
  /** Одна числовая часть — для «at most N …» (по умолчанию `length`). */
  noun?: string;
}
/**
 * `background-size`, `mask-size`: ширина и высота — не отрицательные, не больше двух, `cover`/`contain` — только
 * одни. Раньше `bgs-10px` давало `background-size:-10px`, `bgs10px_20px_30px` — три длины, `bgs_cover_10px` —
 * `cover 10px`, и браузер отбрасывал все три.
 */
const SIZE_LENGTHS: LengthRule = {
  signed: false,
  max: 2,
  solo: wordsSet('cover contain'),
};
/** Сдвиг: `vertical-align`, `background-position-x`/`-y`, толщина в `text-decoration` — одна длина со знаком. */
const OFFSET_LENGTH: LengthRule = {
  signed: true,
  max: 1,
};
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
/**
 * Краткие записи слов у хендлеров общей таблицы (D-094): `fxN` → `flex:none`, `arA` → `aspect-ratio:auto`, как
 * `dN` у `display`. Полное слово при краткой записи бракуется с подсказкой — одно значение, одна запись.
 */
/** Старое `apcNone` → новое `apN` (D-094): полное слово — сразу краткой записью. */
const APPEARANCE_RENAMED: Record<string, string> = {
  None: N,
  Auto: A,
};

/** Краткая запись `none` у свойств, где других букв нет: `biN`, `tnN` (D-111). */
const NONE_ABBREVIATIONS: Record<string, string> = {
  N: NONE,
};

/** Буквы `text-emphasis-style` (и шортката `tem`): `temsF_C` → `filled circle`. */
const TEXT_EMPHASIS_LETTERS: Record<string, string> = {
  N: NONE,
  F: 'filled',
  O: 'open',
  D: 'dot',
  C: 'circle',
  DC: 'double-circle',
  T: 'triangle',
  S: 'sesame',
};

const VALUE_ABBREVIATIONS: Record<string, Record<string, string>> = {
  // `tpA`/`tpN` давали `transition-property:a`/`n` (D-106).
  transitionProperty: {
    A: ALL,
    N: NONE,
  },
  // Буквы виджетов (D-113); `textarea`/`textfield` и `menulist`/`meter` ждут решения владельца — RESEARCH/22, Q3.
  appearance: {
    N: NONE,
    A: AUTO,
    S: 'searchfield',
    C: 'checkbox',
    R: 'radio',
    L: 'listbox',
    PB: 'progress-bar',
    B: 'button',
    MB: 'menulist-button',
  },
  flex: {
    N: NONE,
    A: AUTO,
    C: 'content',
    FC: 'fit-content',
  },
  flexBasis: {
    A: AUTO,
    C: 'content',
    FC: 'fit-content',
  },
  grid: {
    N: NONE,
    A: AUTO,
    AF: 'auto-flow',
    D: 'dense',
  },
  gridTemplate: {
    N: NONE,
    A: AUTO,
  },
  gridAutoFlow: {
    R: 'row',
    C: 'column',
    D: 'dense',
  },
  // Как у `fxd` и `fxw`: `fxfR_W` → `row wrap`.
  flexFlow: {
    R: 'row',
    RR: 'row-reverse',
    C: 'column',
    CR: 'column-reverse',
    NW: 'nowrap',
    W: 'wrap',
    WR: 'wrap-reverse',
  },
  transformStyle: {
    F: 'flat',
    P: PRESERVE_3D,
  },
  gridTemplateColumns: {
    N: NONE,
    A: AUTO,
    S: 'subgrid',
  },
  gridTemplateRows: {
    N: NONE,
    A: AUTO,
    S: 'subgrid',
  },
  gridAutoColumns: {
    A: AUTO,
  },
  gridAutoRows: {
    A: AUTO,
  },
  // `gcA` давало `grid-column:a` — линию с именем `a`; `A` у остальных хендлеров — `auto`.
  gridRow: {
    A: AUTO,
    S: SPAN,
  },
  perspective: {
    N: NONE,
  },
  willChange: {
    A: AUTO,
    SP: 'scroll-position',
    C: 'contents',
    T: 'transform',
    O: 'opacity',
  },
  clipPath: {
    N: NONE,
    BB: 'border-box',
    PB: 'padding-box',
    CB: 'content-box',
    MB: 'margin-box',
    FB: 'fill-box',
    SB: 'stroke-box',
    VB: 'view-box',
  },
  gridColumn: {
    A: AUTO,
    S: SPAN,
  },
  gridRowStart: {
    A: AUTO,
    S: SPAN,
  },
  gridRowEnd: {
    A: AUTO,
    S: SPAN,
  },
  gridColumnStart: {
    A: AUTO,
    S: SPAN,
  },
  gridColumnEnd: {
    A: AUTO,
    S: SPAN,
  },
  aspectRatio: {
    A: AUTO,
  },
  columns: {
    A: AUTO,
  },
  textDecorationSkip: {
    N: NONE,
    O: 'objects',
    S: 'spaces',
    LS: 'leading-spaces',
    TS: 'trailing-spaces',
    E: 'edges',
    BD: 'box-decoration',
  },
  // `AL` — как у `user-select` (`usAL`): `A` здесь — `auto`.
  textDecorationSkipInk: {
    N: NONE,
    A: AUTO,
    AL: ALL,
  },
  textDecorationThickness: {
    A: AUTO,
    FF: 'from-font',
  },
  textDecorationStyle: {
    S: 'solid',
    D: 'double',
    DT: 'dotted',
    DS: 'dashed',
    W: 'wavy',
  },
  textUnderlineOffset: {
    A: AUTO,
  },
  textUnderlinePosition: {
    A: AUTO,
    FF: 'from-font',
    U: 'under',
    L: SIDE_LEFT,
    R: SIDE_RIGHT,
  },
  textEmphasis: TEXT_EMPHASIS_LETTERS,
  textEmphasisStyle: TEXT_EMPHASIS_LETTERS,
  textEmphasisPosition: {
    A: AUTO,
    O: 'over',
    U: 'under',
    R: SIDE_RIGHT,
    L: SIDE_LEFT,
  },
  imageRendering: {
    A: AUTO,
    CE: 'crisp-edges',
    P: 'pixelated',
    S: 'smooth',
    OC: 'optimize-contrast',
    OS: OPTIMIZE_SPEED,
    OQ: OPTIMIZE_QUALITY,
    MCE: MOZ_CRISP_EDGES,
    OCE: O_CRISP_EDGES,
    WOC: WEBKIT_OPTIMIZE_CONTRAST,
  },
  wordSpacing: {
    N: NORMAL,
  },
  zoom: {
    N: NORMAL,
    R: 'reset',
  },
};

/**
 * Старая запись после переименования: сообщение с новой, CSS нет. Убирается через один выпуск — задача
 * в PLAN; это сообщение, а не вторая реализация.
 * @param decision решение, которым переименовано: D-094 (по умолчанию) или D-106 (`ww` → `owr`)
 */
function throwRenamed(
  token: string, replacement: string, decision?: string,
): never {
  throw new MnParseError(DOUBLE_QUOTE + token + '" was renamed: write "' + replacement + '" ('
    + (decision || 'D-094') + '). The old spelling gives no CSS and is removed in the next release.', {
    token,
    handler: '',
    arg: '',
  });
}

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
    // Другие записи слова — для подсказки «Write it shorter: "tsP"» (D-113): `tsPreserve3d`, `tsPreserve3D`.
    preserve3d: PRESERVE_3D,
    'preserve3-d': PRESERVE_3D,
  },
  // Группа F: геометрические рамки `clip-path`; фигура (`circle(…)`) — функция и проходит мимо списка.
  clipPath: wordsSet('none border-box padding-box content-box margin-box fill-box stroke-box view-box'),
  textEmphasisStyle: wordsSet('none filled open dot circle double-circle'
    + ' triangle sesame'),
  // `right`/`left` валидны только вторым словом (`over right`): грамматика —
  // `[over | under] && [right | left]?`. Порядок здесь не проверяется, слова
  // берутся списком.
  textEmphasisPosition: wordsSet('auto over under right left'),
  zoom: wordsSet('normal reset'),
  aspectRatio: wordsSet(AUTO),
  position: {
    ...wordsSet('static relative absolute sticky fixed -webkit-sticky'),
    'webkit-sticky': '-webkit-sticky',
  },
  imageRendering: {
    ...wordsSet('auto crisp-edges pixelated smooth optimize-contrast'),
    'moz-crisp-edges': MOZ_CRISP_EDGES,
    '-moz-crisp-edges': MOZ_CRISP_EDGES,
    'o-crisp-edges': O_CRISP_EDGES,
    '-o-crisp-edges': O_CRISP_EDGES,
    'webkit-optimize-contrast': WEBKIT_OPTIMIZE_CONTRAST,
    '-webkit-optimize-contrast': WEBKIT_OPTIMIZE_CONTRAST,
    // `optimizeSpeed`/`optimizeQuality` записаны в спецификации camelCase —
    // это legacy из SVG. Кебабизация суффикса их ломает, поэтому возвращаем.
    'optimize-speed': OPTIMIZE_SPEED,
    optimizespeed: OPTIMIZE_SPEED,
    'optimize-quality': OPTIMIZE_QUALITY,
    optimizequality: OPTIMIZE_QUALITY,
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
/**
 * Слово CSS в записи нотации: `crisp-edges` → `CrispEdges`, как его пишут после
 * имени хендлера (`irCrispEdges`).
 */
function notationWord(word: string): string {
  return word.split(DASH).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

/**
 * Хвост сообщения со списком допустимых записей — чтобы не идти за ним в
 * справочник. Строится только на пути ошибки: на обычную компиляцию не влияет.
 */
function availableHint(items: string[]): string {
  // Пустым список не бывает: подсказку строят только хендлеры со словарём
  // сокращений или перечислением, а пустых среди них нет.
  return '. Available: ' + items.join(LIST_SEPARATOR);
}

/** Слово без регистра и дефисов: `-webkit-sticky`, `WebkitSticky` и `webkit-sticky` совпадают. */
function squashWord(word: string): string {
  return word.toLowerCase().replace(REGEXP_DASHES, '');
}

/**
 * Допустимые значения перечисления в записи нотации — каждое каноническое слово один раз. Запись со строкой — алиас:
 * в подсказку идёт каноническое (`optimizeSpeed`, а не `optimizespeed`), и только если алиас пишет то же слово
 * (без регистра и дефисов): `optimize-speed` → `optimizeSpeed` — да, `contrast` → `optimize-contrast` — нет.
 */
function enumHint(
  words: Record<string, 1 | string>, essenceName: string, abbreviations?: Record<string, string>,
): string {
  const items: string[] = [];
  const short: Record<string, string> = {};
  let abbr: string;
  // Словари букв пишут слово по-разному (`Solid`, `-webkit-sticky`, `optimizeSpeed`), поэтому сверка — без регистра
  // и дефисов.
  for (abbr in abbreviations) { // eslint-disable-line
    short[squashWord((abbreviations as Record<string, string>)[abbr])] = abbr;
  }
  const seen: Record<string, 1> = {};
  let canon: string;
  let key: string;
  // Слово с краткой записью предлагается краткой (D-094): `apN (none)`, а не `apNone`. Алиас, который пишет то же
  // слово иначе (`optimizespeed` → `optimizeSpeed`), даёт одну строку, а не две.
  for (const word of Object.keys(words)) {
    canon = words[word] === 1 ? word : words[word] as string;
    key = squashWord(canon);
    key === squashWord(word) && !seen[key] && (seen[key] = 1, items.push((abbr = short[key])
      ? essenceName + abbr + HINT_OPEN + canon + CLOSE_PAREN : essenceName + notationWord(canon)));
  }
  return availableHint(items);
}

/**
 * Полное слово, у которого есть краткая запись (D-094), бракуется с подсказкой: `fxNone` → «Write it shorter: "fxN"». Иное
 * значение возвращается как есть.
 */
function assertNotLongForm(
  value: string, abbreviations: Record<string, string>, essenceName: string, raw: string,
): string {
  let abbr: string;
  for (abbr in abbreviations) { // eslint-disable-line
    abbreviations[abbr] === value && throwInvalid(MSG_WRITE_SHORTER + essenceName + abbr + MSG_INSTEAD_OF + essenceName
      + raw + MSG_SAME_VALUE);
  }
  return value;
}

/**
 * Записи картинки у читателя `bg` / `mk` / `bi` — для сообщений об ошибке: одна строка на все три места.
 * @param name имя хендлера
 * @returns «a gradient (`bgF00-00F`), a variable or `bgN`»
 */
function imageForms(name: string): string {
  return 'a gradient (`' + name + 'F00-00F`), a variable or `' + name + 'N`';
}
/**
 * Картинка по пути — `_`-форма `bgi`, `lisi`, `mki` и `bi` (D-122): `bgi_hero\.jpg` → `url("hero.jpg")`. Одна запись на
 * значение: у переменной (`bgi_--x`) и ключевого слова (`bgi_none`, `bgi_inherit`) своя запись без `_`, функция в токене
 * не пишется (`bgi_url\(a\.png\)`, D-121), пустой путь — ошибка; каждый случай бракуется с подсказкой.
 * @param path путь без ведущего `_`, как написан
 * @param name имя хендлера — для сообщений
 * @returns `url("…")`
 * @example imagePathValue('img/a.png', 'bgi') // 'url("img/a.png")'
 */
function imagePathValue(path: string, name: string): string {
  const word = path.toLowerCase();
  const written = name + UNDERSCORE + path;
  const head = MSG_VALUE + UNDERSCORE + path + MSG_IS_INVALID_FOR + name + '": ';
  path || throwInvalid(head + 'the path after "_" is empty — as "' + name + '_a\\.png"');
  cssVarValue(path) && throwInvalid('Write the variable without "_": "' + name + path + MSG_INSTEAD_OF + written
    + MSG_SAME_VALUE);
  word === NONE && throwInvalid(MSG_WRITE_SHORTER + name + N + MSG_INSTEAD_OF + written + MSG_SAME_VALUE);
  GLOBAL_KEYWORDS[word] && throwInvalid('Write the keyword as a word: "' + name + notationWord(word) + MSG_INSTEAD_OF
    + written + MSG_SAME_VALUE);
  path.indexOf(OPEN_PAREN) > -1 && throwInvalid(head + 'a function is not written in a class — the path alone, as "'
    + name + '_a\\.png"');
  return 'url("' + path + '")';
}

/**
 * Суффикс с буквой на месте полного слова — для подсказки (D-113): `1_Auto` → `1_A`, `_1_auto` → `1_A`. Ведущий `_`
 * сырого режима снимается: буквы пишутся без него. Заменяется первая часть, записанная этим словом.
 */
function shorterSuffix(
  suffix: string, written: string, abbr: string,
): string {
  const parts = suffix.split(UNDERSCORE);
  const l = parts.length;
  let i = 0;
  for (; i < l; i++) {
    if (parts[i] === written) {
      parts[i] = abbr;
      break;
    }
  }
  const out = parts.join(UNDERSCORE);
  return out[0] === UNDERSCORE ? out.slice(1) : out;
}

function assertEnumValue(
  v: string,
  words: Record<string, 1 | string>,
  multi: 1 | 0 | undefined,
  essenceName: string,
  raw: string,
  abbreviations?: Record<string, string>,
): string {
  // Подстановка и любая функция проходят: их содержимое здесь разбирать нечем,
  // а по спецификации `var()` валиден у любого свойства. CSS-wide keywords
  // валидны везде и в списке свойства не перечисляются.
  if (v.indexOf(OPEN_PAREN) > -1 || GLOBAL_KEYWORDS[v]) {
    return v;
  }
  const prefix = MSG_VALUE + raw + MSG_IS_INVALID_FOR + essenceName + MSG_COLON;
  const parts = v.split(SPACE);
  let i = parts.length;
  let canon: 1 | string | undefined;
  (i < 2 || multi) || throwInvalid(prefix + 'expected a single value');
  while (i--) {
    canon = words[parts[i].toLowerCase()];
    canon || throwInvalid(prefix + 'the set of values is closed' + enumHint(
      words, essenceName, abbreviations,
    ));
    canon === 1 || (parts[i] = canon as string);
  }
  return parts.join(SPACE);
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
/**
 * Значения `font`, которые нельзя выразить атомарными тегами.
 *
 * Системные шрифты задают весь набор шрифтовых свойств одним словом — так же,
 * как `font: inherit` наследует их разом. Размер, высота строки и семейство
 * сюда не входят: для них есть `f`, `lh`, `ff`.
 */
const FONT_KEYWORDS: Record<string, 1> = {
  caption: 1,
  icon: 1,
  menu: 1,
  'message-box': 1,
  'small-caption': 1,
  'status-bar': 1,
};
/** Буквы системных шрифтов (D-113): `fontMB` → `font:message-box`. */
const FONT_SYNONYMS: Record<string, string> = {
  C: 'caption',
  I: 'icon',
  M: 'menu',
  MB: 'message-box',
  SC: 'small-caption',
  SB: 'status-bar',
};
/**
 * Слоты `transition` в фиксированном порядке:
 * `свойство длительность плавность задержка`.
 *
 * Грамматика CSS порядок не фиксирует — `<single-transition>` это набор `||`,
 * и `all 0.2s` с `0.2s all` равноправны. Нотация фиксирует один: так проверка
 * становится однозначной, ошибка называется словами («в позиции 2 ожидается
 * длительность»), и не плодится зоопарк записей одного и того же. Тот же
 * размен в пользу единообразия, что снял общий `ol`.
 *
 * Проверки не было вовсе: `tn200` давало `transition:200` (число без единицы),
 * `tnAll` — `transition:all` без длительности, `tn10zz` — `transition:10zz`.
 */
/** Время: число с `s`/`ms`, либо голое число — оно получает `ms`, как у `dn`. */
const REGEXP_TIME = /^[0-9]*\.?[0-9]+(m?s)?$/;
/**
 * Имя CSS-свойства у `tn`: `all`, `none` или несколько имён через `;` — сокращение `tn` для общих параметров.
 *
 * Список свойств CSS открыт, поэтому проверяется форма, а не словарь. `;` здесь
 * разделитель списка, а не терминатор имени переменной: имя переменной
 * начинается с `--`, и до этой проверки оно уже развёрнуто в `var(…)`. Имя — от
 * двух знаков: свойства из одной буквы в CSS нет, а `tnA_200` давало
 * `transition:a 200ms` (D-106); теперь `A` — буква `all` ({@link TRANSITION_LETTERS}, D-109).
 */
const REGEXP_PROPERTY_LIST = /^-?[a-z][a-z0-9-]+(?:;-?[a-z][a-z0-9-]+)*;?$/;
/**
 * Заглавная в начале элемента списка значений — после `,` или `;`: не принимается (D-107), см. `toKebabCase`.
 * Вторая регулярка — с флагом `g` для подсказки; `.test` на ней нельзя: `lastIndex` хранит состояние.
 */
const REGEXP_LIST_ITEM_CAPITAL = /[,;][A-Z]/;
const REGEXP_LIST_ITEM_CAPITALS = /([,;])([A-Z])/g;
function lowerItemStart(
  _match: string, separator: string, letter: string,
): string {
  return separator + letter.toLowerCase();
}
/**
 * Буквы у `tn` (D-109): плавность — те же, что у `ttf`/`atf` ({@link TIMING_FUNCTION_SYNONYMS}), `A` — `all` в слоте
 * свойства, как у `tp`. Слот: 1 — свойство, 3 — плавность. Ключ — в обеих формах части: как написана (сырой режим
 * `tn_opacity_200_EI`) и после кебаба (`tnOpacity_200_EI` → `e-i`, `tnA_200` → `a`). Одна буква или буквы через
 * дефис другим не бывают: имя свойства — от двух знаков, буквы в нём не разделены дефисами.
 */
const TRANSITION_LETTERS: Record<string, [slot: number, value: string]> = {};
/** Длинное слово → его буква: `tn_opacity_200_ease-in` отвечает «пиши "EI"» (D-015, D-109). */
const TRANSITION_LONG_WORDS: Record<string, string> = {};
function addTransitionLetter(
  letters: string, slot: number, value: string,
): void {
  TRANSITION_LETTERS[letters] = TRANSITION_LETTERS[letters.toLowerCase().split('').join(DASH)] = [
    slot,
    value,
  ];
  TRANSITION_LONG_WORDS[value] = letters;
}
addTransitionLetter(
  A, 1, ALL,
);
for (const letters in TIMING_FUNCTION_SYNONYMS) {
  // `EaseIn` → `ease-in`: слова таблицы — CamelCase без цифр.
  addTransitionLetter(
    letters, 3, TIMING_FUNCTION_SYNONYMS[letters].replace(/(?!^)[A-Z]/g, '-$&').toLowerCase(),
  );
}
/** Одно имя CSS-свойства — от двух знаков, как в {@link REGEXP_PROPERTY_LIST}. */
const REGEXP_PROPERTY_NAME = /^-?[a-z][a-z0-9-]+$/;
/** Функции плавности: `cubic-bezier(…)`, `steps(…)`, `linear(…)`. */
const REGEXP_EASING_FUNCTION = /^(?:cubic-bezier|steps|linear)\(/;
/** Подстановка — годится в любой слот, что внутри неё, здесь не видно. */
const REGEXP_SUBSTITUTION = /^(?:var|env)\(/;
/**
 * Делит по запятым ВЕРХНЕГО уровня — запятые внутри скобок остаются в части.
 *
 * `cubic-bezier(0,0,1,1)` иначе распадается на четыре куска, и переход
 * бракуется на ровном месте.
 * @param v значение
 * @returns части по порядку
 * @example splitTopLevel('a(1,2),b') // ['a(1,2)', 'b']
 */
function splitTopLevel(v: string): string[] {
  const out: string[] = [];
  const l = v.length;
  let depth = 0;
  let from = 0;
  let i = 0;
  let c: string;
  for (; i < l; i++) {
    c = v[i];
    if (c === OPEN_PAREN) {
      depth++;
    } else if (c === CLOSE_PAREN) {
      depth--;
    } else if (c === COMMA && !depth) {
      out.push(v.slice(from, i));
      from = i + 1;
    }
  }
  out.push(v.slice(from));
  return out;
}
/**
 * Разбирает один переход по слотам и возвращает его в каноническом виде.
 *
 * Слот определяется по форме части, а порядок обязан не убывать: увидев
 * длительность, дальше нельзя вернуться к имени свойства. Голое число в слоте
 * времени получает `ms` — как у `dn`/`delay`.
 */
function transitionValue(parts: string[], raw: string): string[] {
  const l = parts.length;
  const out: string[] = new Array(l);
  let i = 0;
  let slot = 0;
  let hasDuration = 0;
  let part: string;
  let at: number;
  let time: RegExpExecArray | null;
  let names: string[] | 0 = 0;
  let letter: [number, string] | undefined;
  const prefix = MSG_VALUE + raw + '" is invalid for "tn": the order is ';
  for (; i < l; i++) {
    part = parts[i];
    if (REGEXP_SUBSTITUTION.test(part)) {
      // Подстановка годится в любой слот и порядок не сдвигает.
      out[i] = part;
      continue;
    }
    TRANSITION_LONG_WORDS[part] && throwInvalid(MSG_VALUE + raw + '" is invalid for "tn": write it shorter — "'
      + TRANSITION_LONG_WORDS[part] + '" instead of "' + part + DOUBLE_QUOTE);
    if (letter = TRANSITION_LETTERS[part]) {
      at = letter[0];
      out[i] = letter[1];
    } else if (time = REGEXP_TIME.exec(part)) {
      // Первое время — длительность, второе — задержка. После плавности может
      // идти только задержка: место длительности — перед плавностью.
      at = hasDuration ? 4 : 2;
      at === 4 || slot < 3 || throwInvalid(prefix + 'property, duration, '
        + 'easing, delay — duration goes before easing');
      hasDuration = 1;
      out[i] = time[1] ? part : part + MS;
    } else if (REGEXP_EASING_FUNCTION.test(part)) {
      at = 3;
      out[i] = part;
    } else if (REGEXP_PROPERTY_LIST.test(part)) {
      at = 1;
      // Несколько свойств с одними параметрами — через `;`. В CSS такого
      // сокращения нет: там пришлось бы перечислять каждое свойство целым
      // блоком (`color .2s, background .2s, border-color .2s`).
      part.indexOf(SEMICOLON) > -1 && (names = part.split(SEMICOLON));
      out[i] = part;
    } else {
      return throwInvalid(prefix + 'property, duration, easing, delay; '
        + DOUBLE_QUOTE + part + '" fits none of them');
    }
    at > slot || throwInvalid(prefix + 'property, duration, easing, '
      + 'delay — "' + part + '" is out of place');
    slot = at;
  }
  if (!names) {
    return [out.join(SPACE)];
  }
  // Список свойств разворачивается в отдельный переход на каждое: остальные
  // слоты у них общие.
  const tail = out.slice(1).join(SPACE);
  const namesLength = names.length;
  const expanded: string[] = new Array(namesLength);
  for (i = 0; i < namesLength; i++) {
    names[i] || throwInvalid(prefix + 'empty property name in the list "' + out[0] + DOUBLE_QUOTE);
    expanded[i] = tail ? (names[i] + SPACE + tail) : names[i];
  }
  return expanded;
}
/** Имя `@keyframes`: идентификатор CSS. */
const REGEXP_KEYFRAMES_NAME = /^-?[a-zA-Z_][a-zA-Z0-9_-]*$/;
/** Число повторов анимации: `2`, `1.5`, `infinite`. */
const REGEXP_ITERATION_COUNT = /^(?:[0-9]*\.?[0-9]+|infinite)$/;
const ANIMATION_DIRECTIONS = wordsSet('normal reverse alternate alternate-reverse');
const ANIMATION_FILL_MODES = wordsSet('none forwards backwards both');
const ANIMATION_PLAY_STATES = wordsSet('running paused');

/**
 * Именованные анимации (группа G, D-097) — четыре анимации Tailwind: значение без имени и ключевые кадры. Кадры
 * регистрируются при первом использовании имени в `an` и не перезаписывают уже заданные под этим именем
 * (`mn.setKeyframes('spin', …)` автора выигрывает). Голое имя (`anSpin`) получает ещё и длительность, плавность и
 * повторы; в форме с частями (`an_spin_2s`) значение остаётся как написано.
 */
const NAMED_ANIMATIONS: Record<string, [string, Record<string, Record<string, string>>]> = {
  spin: [
    '1s linear infinite',
    {
      to: {
        transform: 'rotate(360deg)',
      },
    },
  ],
  ping: [
    '1s cubic-bezier(0,0,.2,1) infinite',
    {
      '75%,100%': {
        transform: 'scale(2)',
        opacity: ZERO,
      },
    },
  ],
  pulse: [
    '2s cubic-bezier(.4,0,.6,1) infinite',
    {
      '50%': {
        opacity: '.5',
      },
    },
  ],
  bounce: [
    '1s infinite',
    {
      '0%,100%': {
        transform: 'translateY(-25%)',
        animationTimingFunction: 'cubic-bezier(.8,0,1,1)',
      },
      '50%': {
        transform: NONE,
        animationTimingFunction: 'cubic-bezier(0,0,.2,1)',
      },
    },
  ],
};

/**
 * Одна анимация по слотам в фиксированном порядке, как у `tn` (запрос web-games, 2026-10-14):
 * `имя длительность плавность задержка повторы направление заполнение состояние`. Любой слот
 * можно пропустить, порядок — не убывает. Голое число в слоте времени — `ms`; голое число после
 * задержки — число повторов. `none` до длительности — имя, после — заполнение.
 *
 * Плавность — буквами, как у `tn` и `atf` (D-111): `an_fade_0.2s_EO`. Буква — плавность только после имени или
 * длительности: первая часть — всегда имя (`an_e_1s` — анимация `e`: значение до кебаба одно и то же, что `anE_1s`).
 * Длинное слово (`ease-out`) — ошибка с буквой, как у `tn` (D-015, D-109).
 */
function animationValue(parts: string[], raw: string): string {
  const l = parts.length;
  const out: string[] = new Array(l);
  const prefix = MSG_VALUE + raw + '" is invalid for "an": the order is name, duration, easing, delay,'
    + ' iteration count, direction, fill mode, play state';
  let i = 0;
  let slot = 0;
  let times = 0;
  let part: string;
  let at: number;
  let time: RegExpExecArray | null;
  let letter: [number, string] | undefined;
  for (; i < l; i++) {
    part = parts[i];
    if (REGEXP_SUBSTITUTION.test(part)) {
      out[i] = part;
      continue;
    }
    (letter = TRANSITION_LETTERS[TRANSITION_LONG_WORDS[part]]) && letter[0] === 3
      && throwInvalid(MSG_VALUE + raw + '" is invalid for "an": write it shorter — "' + TRANSITION_LONG_WORDS[part]
        + MSG_INSTEAD_OF + part + DOUBLE_QUOTE + (slot ? '' : '; easing goes after the name or the duration'));
    if (slot && (letter = TRANSITION_LETTERS[part]) && letter[0] === 3) {
      at = 3;
      out[i] = letter[1];
    } else if (times < 2 && slot < 5 && (time = REGEXP_TIME.exec(part))) {
      // Первое время — длительность, второе — задержка (после плавности — только задержка).
      at = times || slot === 3 ? 4 : 2;
      times = at === 4 ? 2 : 1;
      out[i] = time[1] ? part : part + MS;
    } else if (REGEXP_EASING_FUNCTION.test(part)) {
      // Слова плавности сюда не доходят — у каждого есть буква (D-111); остались функции.
      at = 3;
      out[i] = part;
    } else if (REGEXP_ITERATION_COUNT.test(part)) {
      at = 5;
      out[i] = part;
    } else if (ANIMATION_DIRECTIONS[part]) {
      at = 6;
      out[i] = part;
    } else if (ANIMATION_FILL_MODES[part] && (part !== NONE || slot > 1)) {
      at = 7;
      out[i] = part;
    } else if (ANIMATION_PLAY_STATES[part]) {
      at = 8;
      out[i] = part;
    } else if (REGEXP_KEYFRAMES_NAME.test(part)) {
      at = 1;
      out[i] = part;
    } else {
      return throwInvalid(prefix + '; "' + part + '" fits none of them');
    }
    at > slot || throwInvalid(prefix + ' — "' + part + '" is out of place');
    slot = at;
  }
  return out.join(SPACE);
}

/**
 * Склеивает части тени, дописывая единицу каждой длине.
 *
 * Последняя часть — цвет, единицы не получает. Подстановка тоже: `var(--blur)`
 * уже несёт единицу внутри себя, а `var(--blur)px` — мусор.
 */
function shadowJoin(parts: string[], unit: string): string {
  const last = parts.length - 1;
  const out: string[] = new Array(parts.length);
  let i = 0;
  let part: string;
  for (; i <= last; i++) {
    part = '' + parts[i];
    out[i] = (i === last || part.indexOf(OPEN_PAREN) > -1) ? part : part + unit;
  }
  return out.join(SPACE);
}
/**
 * Разбор составных значений по слотам — по одному описанию на свойство.
 *
 * Все пять свойств были permissive pass-through: значение кебабилось и уходило
 * в CSS как есть, поэтому `fxN` давало `flex:n`, `colA` — `columns:a`,
 * `temF00` — `text-emphasis:f00`, `coi10` — `counter-increment:10`. Ни одно из
 * этих правил браузер не применяет.
 *
 * Порядок слотов, как и у `tn`, фиксирован: грамматика CSS его не задаёт
 * (везде `||`), но одно значение не должно записываться по-разному.
 */
/** Целое: число повторов, число колонок, значение счётчика. */
const REGEXP_SLOT_INTEGER = /^[-+]?\d+$/;
/** Число с дробной частью — `flex-grow`, `flex-shrink`. */
const REGEXP_SLOT_NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)$/;
/** Имя счётчика или области — произвольный идентификатор CSS. */
const REGEXP_SLOT_IDENT = /^-?[A-Za-z_][\w-]*$/;
/** Ключевые слова `flex-basis`, кроме длины. */
const FLEX_BASIS_KEYWORDS = wordsSet('auto content min-content max-content fit-content');
/** Стиль `text-emphasis` — тот же список, что у атомарного `tems`. */
const TEXT_EMPHASIS_STYLE = wordsSet('none filled open dot circle double-circle'
  + ' triangle sesame');

/**
 * `flex`: `<grow> [<shrink>] [<basis>]` либо одно слово (`none`, `auto`,
 * `content`). Порядок слотов фиксирован — в CSS он такой же, там `<grow>` и
 * `<shrink>` идут подряд.
 */
function flexValue(parts: string[], raw: string): string {
  const l = parts.length;
  const prefix = MSG_VALUE + raw + '" is invalid for "fx": ';
  if (l === 1 && (FLEX_BASIS_KEYWORDS[parts[0]] || parts[0] === NONE)) {
    return parts[0];
  }
  l < 4 || throwInvalid(prefix + 'at most three parts: grow, shrink, basis');
  let i = 0;
  let part: string;
  for (; i < l; i++) {
    part = parts[i];
    if (part.indexOf(OPEN_PAREN) > -1) {
      continue;
    }
    if (i < 2) {
      REGEXP_SLOT_NUMBER.test(part)
        || throwInvalid(prefix + (i ? 'shrink' : 'grow') + ' is a unitless number');
      continue;
    }
    (FLEX_BASIS_KEYWORDS[part] || REGEXP_LENGTH_PART.test(part))
      || throwInvalid(prefix + 'basis is a length or a keyword');
  }
  return parts.join(SPACE);
}

/**
 * `columns`: `<count> [<width>]` либо `auto`. В CSS порядок свободный
 * (`30em 3` тоже валидно) — нотация принимает один.
 */
function columnsValue(parts: string[], raw: string): string {
  const l = parts.length;
  const prefix = MSG_VALUE + raw + '" is invalid for "col": ';
  l < 3 || throwInvalid(prefix + 'at most two parts: column count and width');
  let i = 0;
  let part: string;
  for (; i < l; i++) {
    part = parts[i];
    if (part === AUTO || part.indexOf(OPEN_PAREN) > -1) {
      continue;
    }
    (i ? REGEXP_LENGTH_PART.test(part) : REGEXP_SLOT_INTEGER.test(part))
      || throwInvalid(prefix + (i
        ? 'column width is a length'
        : 'column count is an integer; width goes second'));
  }
  return parts.join(SPACE);
}

/** `text-emphasis`: `<style> [<color>]`, стиль из закрытого списка. */
function textEmphasisValue(parts: string[], raw: string): string {
  const l = parts.length;
  const prefix = MSG_VALUE + raw + '" is invalid for "tem": ';
  l < 3 || throwInvalid(prefix + 'at most two parts: style and color');
  let i = 0;
  let part: string;
  for (; i < l; i++) {
    part = parts[i];
    (part.indexOf(OPEN_PAREN) > -1 || TEXT_EMPHASIS_STYLE[part] || part[0] === '#')
      || throwInvalid(prefix + 'a style from the `tems` list, then a color');
  }
  return parts.join(SPACE);
}

/** Счётчики: пары `<имя> [<число>]`, либо `none`. */
function counterValue(
  parts: string[], raw: string, essenceName: string,
): string {
  const l = parts.length;
  const prefix = MSG_VALUE + raw + MSG_IS_INVALID_FOR + essenceName + MSG_COLON;
  if (l === 1 && parts[0] === NONE) {
    return parts[0];
  }
  let i = 0;
  let part: string;
  let expectName = 1;
  for (; i < l; i++) {
    part = parts[i];
    if (part.indexOf(OPEN_PAREN) > -1) {
      // Подстановка на месте имени: что в ней, здесь не видно, поэтому
      // считаем имя заданным.
      expectName = 0;
      continue;
    }
    if (REGEXP_SLOT_INTEGER.test(part)) {
      expectName && throwInvalid(prefix + 'counter name first, then its value');
      expectName = 1;
      continue;
    }
    REGEXP_SLOT_IDENT.test(part) || throwInvalid(prefix + 'expected a counter name');
    expectName = 0;
  }
  return parts.join(SPACE);
}
/**
 * Функции фильтра — список закрыт спецификацией (`<filter-function>`).
 *
 * Неизвестное имя раньше прокидывалось как есть, и `ftbF00` давало
 * `backdrop-filter:f(00)` (`F00` разбиралось как имя `f` с аргументом `00`),
 * `ftb_solid` — `solid()`. Ни одна из этих записей не работает.
 */
const FILTER_FUNCTIONS = wordsSet('blur brightness contrast drop-shadow grayscale'
  + ' hue-rotate invert opacity saturate sepia');
/**
 * Что может получиться у `bg`/`maskbg`: цвет, вызов функции (градиент,
 * `rgba`, `var`) или ключевое слово цвета.
 *
 * Мини-язык этого хендлера закрыт по решению владельца 2026-09-26: картинка,
 * позиция, размер и повтор задаются атомарными `bgi`, `bgpx`/`bgpy`, `bgs`,
 * `bgr`.
 */
const REGEXP_BACKGROUND_RESULT = /^(?:#[0-9a-f]{3,8}|[a-zA-Z-]+\(|currentColor|transparent)/;
/** Начало градиента в готовом значении — до списка стопов. */
const REGEXP_GRADIENT_HEAD = /^(?:repeating-)?(?:linear|radial|conic)-gradient\(/;
/** Стоп градиента: цвет, подстановка или ключевое слово цвета. */
const REGEXP_GRADIENT_STOP
  = /^(?:#[0-9a-f]{3,8}|(?:var|env|rgba?|hsla?)\(|currentColor|transparent)/i;
/**
 * Бракует градиент, у которого стоп не является цветом.
 *
 * Мини-язык `bg` собирает градиент из частей суффикса, не проверяя их, поэтому
 * `bg100%-20px` давало `linear-gradient(180deg,100% 0%,20px 100%)` — правило
 * синтаксически целое, но нерабочее.
 *
 * @param value градиент — вызывающие отбирают его {@link isGradientValue}: цвет-fallback сюда не попадает
 */
function assertGradientStops(
  value: string, raw: string, name: string,
): void {
  // Первый аргумент — направление (`180deg`, `circle`), дальше идут стопы. Запятые — только верхнего уровня:
  // по всем `rgba(255,0,0,.5)` распадался на `0`, `0`, `.5) 0%`, и градиент с прозрачным стопом
  // (`bgF00.5-00F`) бракувался целиком (до 2026-10-30).
  const stops = splitTopLevel(value.slice(value.indexOf(OPEN_PAREN) + 1, -1));
  let i = stops.length;
  while (--i > 0) {
    REGEXP_GRADIENT_STOP.test(stops[i].trim())
      || throwInvalid(MSG_VALUE + raw + MSG_IS_INVALID_FOR + name
        + '": gradient stops must be colors or variables');
  }
}
/** Слова, допустимые в `grid` помимо дорожек. */
const GRID_KEYWORDS = wordsSet('none auto-flow dense');
/** Область сетки — строка в кавычках: `"a b"`. */
const REGEXP_GRID_AREA = /^(?:"[^"]*"|'[^']*')$/;
/** Начало строки в кавычках, которая ещё не закрыта. */
const REGEXP_QUOTE_OPEN = /^["'][^"']*$/;
/**
 * Склеивает части, разорванные пробелом внутри кавычек.
 *
 * `gt_"a_b"_1fr` даёт значение `"a b" 1fr`, а разбиение по пробелам —
 * `['"a', 'b"', '1fr']`. Проверке нужна целая область.
 */
function joinQuoted(parts: string[]): string[] {
  const l = parts.length;
  const out: string[] = [];
  let i = 0;
  let open = 0;
  for (; i < l; i++) {
    if (open) {
      out[out.length - 1] += SPACE + parts[i];
      REGEXP_GRID_AREA.test(out[out.length - 1]) && (open = 0);
      continue;
    }
    out.push(parts[i]);
    REGEXP_QUOTE_OPEN.test(parts[i]) && (open = 1);
  }
  return out;
}

/**
 * `grid` и `grid-template`.
 *
 * Были permissive pass-through, поэтому `g10zz` давало `grid:10zz`, `gZzz` —
 * `grid:zzz`, `g10px` — `grid:10px`.
 *
 * Отдельно стоит форма `g_1fr_1fr`: она работала, но по грамматике
 * **невалидна** — `grid` это либо `none`, либо области в кавычках, либо
 * `строки / столбцы`. Одним списком дорожек задаётся `gtc`/`gtr`, не `g`.
 *
 * Части значения: область (`"a b"`), разделитель `/`, ключевое слово
 * (`auto-flow`, `dense`, `none`), размер дорожки, имя линии или функция.
 */
function gridValue(
  source: string[], raw: string, essenceName: string,
): string {
  // Область из нескольких слов (`"a b"`) приходит разбитой по пробелам —
  // склеиваем обратно, иначе `"a` не опознаётся как область.
  const parts = joinQuoted(source);
  const l = parts.length;
  const prefix = MSG_VALUE + raw + MSG_IS_INVALID_FOR + essenceName + MSG_COLON;
  let i = 0;
  let part: string;
  let hasShape = 0;
  for (; i < l; i++) {
    part = parts[i];
    if (part === SLASH || REGEXP_GRID_AREA.test(part)) {
      // И то, и другое задаёт форму сетки: `строки / столбцы` либо области.
      hasShape = 1;
      continue;
    }
    if (GRID_KEYWORDS[part]) {
      part === NONE && (hasShape = 1);
      continue;
    }
    (part.indexOf(OPEN_PAREN) > -1
      || TRACK_KEYWORDS[part]
      || REGEXP_TRACK_SIZE.test(part)
      || REGEXP_LINE_NAME.test(part))
      || throwInvalid(prefix + 'expected a quoted area, a track size, '
        + '`auto-flow` or the "/" separator');
  }
  // Список дорожек без «/» и без областей — это `gtc`/`gtr`, а не `g`:
  // `grid: 1fr 1fr` по грамматике невалиден.
  hasShape || throwInvalid(prefix + 'quoted areas or '
    + '"rows / columns" are required; a single track list goes to "gtc"/"gtr"');
  return parts.join(SPACE);
}

/** Повтор рамочной картинки (`border-image-repeat`) — те же буквы, что у повтора фона (`bgrRD`) и `stretch` (`aiST`). */
const BORDER_IMAGE_REPEAT_SYNONYMS: Record<string, string> = {
  ST: NAME_STRETCH,
  R: NAME_REPEAT,
  RD: 'Round',
  SP: 'Space',
};
/** Слайс рамки: число без единицы или процент. */
const REGEXP_BORDER_SLICE = /^[0-9]*\.?[0-9]+%?$/;
/** `border-image-slice`: до четырёх слайсов — чисел без единицы (пиксели картинки) или процентов. */
const BORDER_IMAGE_SLICES: LengthRule = {
  signed: false,
  max: 4,
  part: REGEXP_BORDER_SLICE,
  unitless: 1,
  needsNumber: 1,
  expected: 'a slice: a number without a unit (pixels of the image) or a percentage',
  noun: 'slice',
};
/**
 * `border-image-width`: до четырёх длин, процентов или чисел. Голое число остаётся числом — в CSS это кратное ширины
 * рамки (`biw2` → `border-image-width:2`: при `b10` кольцо 20px), `px` к нему не приписывается: единица по умолчанию
 * ставится только там, где число без неё ничего не значит (D-123, D-013); пиксели — с единицей, `biw10px`.
 */
const BORDER_IMAGE_WIDTHS: LengthRule = {
  signed: false,
  max: 4,
  part: lengthPartRegExp(UNITS, 1),
  unitless: 1,
  expected: 'a length with a unit (`10px`), a percentage or a number — multiples of the border width (`2`)',
};
/**
 * `border-image-outset`: до четырёх длин без процентов или чисел. Голое число — кратное ширины рамки, как у `biw`
 * (D-123): `bio2` → `border-image-outset:2`, при `b10` кольцо выносится на 20px; пиксели — с единицей, `bio10px`.
 */
const BORDER_IMAGE_OUTSETS: LengthRule = {
  signed: false,
  max: 4,
  part: lengthPartRegExp(UNITS.filter((unit) => unit !== PERCENT), 1),
  unitless: 1,
  expected: 'a length with a unit (`10px`) or a number — multiples of the border width (`2`); no percentage',
};
/** Готовое значение — градиент (а не цвет-fallback из `colorGetBackground`). */
function isGradientValue(v: string): boolean {
  return REGEXP_GRADIENT_HEAD.test(v);
}
/**
 * Ключевые слова дорожек.
 *
 * `none` и `subgrid` есть только у ЯВНЫХ шаблонов (`gtc`/`gtr`): у неявных
 * (`gac`/`gar`) грамматика — просто список размеров, и `gacNone` давало
 * невалидное `grid-auto-columns:none`.
 */
const TRACK_KEYWORDS = wordsSet('auto min-content max-content');
const TEMPLATE_TRACK_KEYWORDS = wordsSet('none auto min-content max-content subgrid');
/** Размер дорожки: длина, процент или доля свободного места (`1fr`). */
const REGEXP_TRACK_SIZE = lengthPartRegExp(UNITS.concat('fr'));
/**
 * Номер линии сетки: целое со знаком, возможно с `/` для второй границы —
 * `1`, `-1`, `1/3`.
 */
const REGEXP_GRID_LINE = /^[-+]?\d+(?:\/[-+]?\d+)?$/;
/** Имя линии сетки — в квадратных скобках: `[a] 1fr`. */
const REGEXP_LINE_NAME = /^\[[^\]]*\]$/;

/**
 * Дорожки сетки: `gtc`, `gtr`, `gac`, `gar`.
 *
 * Были permissive pass-through: `gtcZzz` давало
 * `grid-template-columns:zzz`, `gtc10zz` — `10zz`, `gtc10` — `10` (размер
 * дорожки без единицы невалиден, в отличие от голого числа в других местах
 * нотации).
 *
 * Функции (`repeat()`, `minmax()`, `fit-content()`) и имена линий (`[a]`)
 * проходят как есть: их содержимое здесь не разобрать, а валидны они по
 * грамматике.
 */
function trackValue(
  parts: string[], raw: string, essenceName: string,
): string {
  const l = parts.length;
  // У явных шаблонов (`gtc`/`gtr`) список слов шире, чем у неявных
  // (`gac`/`gar`) — см. TRACK_KEYWORDS. Различает вторая буква тега.
  const words = essenceName[1] === 't' ? TEMPLATE_TRACK_KEYWORDS : TRACK_KEYWORDS;
  let i = 0;
  let part: string;
  for (; i < l; i++) {
    part = parts[i];
    (part.indexOf(OPEN_PAREN) > -1
      || words[part]
      || REGEXP_TRACK_SIZE.test(part)
      || REGEXP_LINE_NAME.test(part))
      || throwInvalid(MSG_VALUE + raw + MSG_IS_INVALID_FOR + essenceName
        + '": a track is a size (length, percent, fr), a keyword or a function');
  }
  return parts.join(SPACE);
}

/**
 * Позиция в сетке: `gr`, `gc`. По грамматике это `<grid-line>`, то есть почти
 * любой идентификатор (`span2` и `zzz` — законные имена линий), поэтому
 * проверять остаётся немногое: длина в этой позиции бессмысленна.
 */
function gridLineValue(
  parts: string[], raw: string, essenceName: string,
): string {
  const l = parts.length;
  const prefix = MSG_VALUE + raw + MSG_IS_INVALID_FOR + essenceName + MSG_COLON;
  // Две позиции разделяются `/`, а не пробелом: `gr10_20` давало
  // `grid-row:10 20` — по грамматике там `<grid-line> [ / <grid-line> ]?`.
  (l < 2 || parts.indexOf(SLASH) > -1 || parts[0] === SPAN)
    || throwInvalid(prefix + 'the second position goes after "/" — `gr1/3`');
  let i = 0;
  let part: string;
  for (; i < l; i++) {
    part = parts[i];
    if (part.indexOf(OPEN_PAREN) > -1 || part === SLASH || REGEXP_SLOT_IDENT.test(part)) {
      continue;
    }
    // Номер линии — целое со знаком. Дробь, длина и результат вычитания
    // номером быть не могут: `gr1.5` давало `grid-row:1.5`, `gr10-5` —
    // `grid-row:10-5`, `gr10zz` — `grid-row:10zz`.
    REGEXP_GRID_LINE.test(part)
      || throwInvalid(prefix + 'a position is a line number (integer), a line name or `span N`');
  }
  return parts.join(SPACE);
}

/** Номер линии в `<grid-line>`: целое, не ноль. */
const REGEXP_GRID_LINE_NUMBER = /^[-+]?0*[1-9]\d*$/;

/**
 * Одна линия сетки: `grs`, `gre`, `gcs`, `gce` (группа C, RESEARCH/17). По грамматике это `<grid-line>`:
 * `auto`, имя, номер с именем или без, `span` с номером и/или именем — по одному каждого. Второй позиции нет, и
 * `gcs1/3` дало бы невалидное `grid-column-start:1/3`: пара пишется через `gc`.
 */
/**
 * `tab-size` (группа F): целое число пробелов без единицы (`tbs4` → `tab-size:4` — `px` здесь не дописывается, число
 * и есть значение) или длина; не отрицательное и без процента. Дробь грамматика не берёт: `tbs1.5` давало
 * `tab-size:1.5`.
 */
function tabSizeValue(
  parts: string[], raw: string, essenceName: string,
): string {
  const v = parts[0];
  parts.length < 2 && v[0] !== DASH && (v.indexOf(OPEN_PAREN) > -1 || REGEXP_VALUE_INTEGER.test(v)
  || REGEXP_LENGTH_PART.test(v) && v.indexOf(PERCENT) < 0)
  || throwInvalid(MSG_VALUE + raw + MSG_IS_INVALID_FOR + essenceName
    + '": a whole number of spaces or a length — not negative, not a percent');
  return v;
}

/** Имя свойства в списке `will-change`: идентификатор, не число и не длина. */
// От двух знаков: `wcB` давало `will-change:b` (D-106).
const REGEXP_WILL_CHANGE_ITEM = /^-?[a-z_][a-z0-9_-]+$/;
/** Слова, которых в списке `will-change` быть не может: `auto` — только целиком, остальные — никогда. */
const WILL_CHANGE_RESERVED: Record<string, 1> = wordsSet('auto none all will-change');
/**
 * `will-change` (группа F): `auto` либо имена свойств через запятую — `wcT`, `wc_transform,opacity`. Список свойств
 * открыт, поэтому проверяется форма имени: `wc10` давало `will-change:10`, `wc10_20` — `will-change:10 20`.
 */
function willChangeValue(
  parts: string[], raw: string, essenceName: string,
): string {
  const v = parts[0];
  const items = v.split(COMMA);
  const l = items.length;
  let valid = parts.length < 2;
  let i = v === AUTO ? l : 0;
  let item: string;
  for (; valid && i < l; i++) {
    item = items[i];
    valid = item.indexOf(OPEN_PAREN) > -1 || REGEXP_WILL_CHANGE_ITEM.test(item) && !WILL_CHANGE_RESERVED[item];
  }
  valid || throwInvalid(MSG_VALUE + raw + MSG_IS_INVALID_FOR + essenceName
    + '": "A" (auto) or property names separated by commas, as "wcT" or "wc_transform,opacity"');
  return v;
}

/** Слово `auto` у свойства-цвета, где буква `A` занята кодом `#aaa`: `ccAuto`. */
const AUTO_KEYWORD: Record<string, 1> = {
  [AUTO]: 1,
};
/** Число строк у `lcl`: целое от 1. */
const REGEXP_LINE_COUNT = /^[1-9]\d*$/;
function gridLineSingleValue(
  parts: string[], raw: string, essenceName: string,
): string {
  const l = parts.length;
  const prefix = MSG_VALUE + raw + MSG_IS_INVALID_FOR + essenceName + MSG_COLON;
  let numbers = 0;
  let names = 0;
  let span = 0;
  let negative = 0;
  let functions = 0;
  let i = 0;
  let part: string;
  for (; i < l; i++) {
    part = parts[i];
    // Функция (`calc()`, `var()`) может дать и номер, и имя — разбирать её нечем.
    if (part.indexOf(OPEN_PAREN) > -1) {
      functions++;
      continue;
    }
    part.indexOf(SLASH) < 0 || throwInvalid(prefix + 'one line only — both ends are written with "'
      + essenceName.slice(0, 2) + raw + DOUBLE_QUOTE);
    part === SPAN
      ? span++
      : REGEXP_GRID_LINE_NUMBER.test(part)
        ? (numbers++, part[0] === '-' && (negative = 1))
        : (part !== AUTO && REGEXP_SLOT_IDENT.test(part))
          ? names++
          : (l > 1 || part !== AUTO) && throwInvalid(prefix
            + 'a line is "A" (auto), a number (not 0), a name or "span" with a number or a name');
  }
  (span < 2 && numbers < 2 && names < 2)
    || throwInvalid(prefix + 'at most one number, one name and one "span"');
  (!span || numbers || names || functions)
    || throwInvalid(prefix + '"span" needs a number or a name — "' + essenceName + 'S_2"');
  span && negative && throwInvalid(prefix + 'a "span" counts lines forward — its number is positive');
  return parts.join(SPACE);
}

/** `flex-flow` — направление и перенос, оба из закрытых списков. */
const FLEX_FLOW_KEYWORDS = wordsSet('row row-reverse column column-reverse'
  + ' nowrap wrap wrap-reverse');

/** `flex-flow`: `<direction> || <wrap>`, перечень закрыт. */
function flexFlowValue(parts: string[], raw: string): string {
  const l = parts.length;
  const prefix = MSG_VALUE + raw + '" is invalid for "fxf": ';
  l < 3 || throwInvalid(prefix + 'at most two parts: direction and wrap');
  let i = 0;
  for (; i < l; i++) {
    (parts[i].indexOf(OPEN_PAREN) > -1 || FLEX_FLOW_KEYWORDS[parts[i]])
      || throwInvalid(prefix + 'expected a direction (row/column, optionally -reverse) '
        + 'or a wrap (nowrap/wrap/wrap-reverse)');
  }
  return parts.join(SPACE);
}

/**
 * `transition-property`: `none` либо имена свойств через запятую, как в CSS и как было в старой версии
 * (`tp_color,opacity`, D-106). Список свойств CSS открыт, поэтому проверяется форма имени — число, длина,
 * одна буква свойством быть не могут. `;` — сокращение `tn` для общих параметров; у `tp` параметров нет, и
 * `tp_color;opacity` давало `transition-property:color;opacity` — `;` обрывал объявление в CSS.
 */
function transitionPropertyValue(parts: string[], raw: string): string {
  const items = splitTopLevel(parts[0]);
  const l = items.length;
  let valid = parts.length < 2;
  let i = 0;
  let item: string;
  for (; valid && i < l; i++) {
    item = items[i];
    // `none` — только одно: в списке CSS его не принимает.
    valid = item.indexOf(OPEN_PAREN) > -1
      || REGEXP_PROPERTY_NAME.test(item) && (l < 2 || item !== NONE);
  }
  valid || throwInvalid(MSG_VALUE + raw + '" is invalid for "tp": "A" (all), "N" (none) or CSS property names '
    + 'separated by commas, as "tp_color,opacity"');
  return parts[0];
}

/**
 * `font-family`: имя шрифта — идентификатор, строка в кавычках или родовое
 * семейство. Число и длина именем шрифта быть не могут: `ff10px` давало
 * `font-family:10px`.
 */
const REGEXP_FONT_NAME = /^(?:"[^"]*"|'[^']*'|-?[A-Za-z_][\w-]*(?: [\w-]+)*)$/;
function assertFontNames(parts: string[], raw: string): void {
  const l = parts.length;
  let i = 0;
  for (; i < l; i++) {
    (parts[i].indexOf(OPEN_PAREN) > -1 || REGEXP_FONT_NAME.test(parts[i]))
      || throwInvalid(MSG_VALUE + raw + '" is invalid for "ff": expected '
        + 'a font name — an identifier or a quoted string');
  }
}

/**
 * Свойство → разбор его значения по слотам. Ключ — имя свойства, как и у
 * {@link ENUM_KEYWORDS}: сам факт наличия означает «здесь слоты».
 */
const SLOT_VALIDATORS: Record<string, (
  parts: string[], raw: string, essenceName: string,
) => string> = {
  flexFlow: flexFlowValue,
  transitionProperty: transitionPropertyValue,
  grid: gridValue,
  gridTemplate: gridValue,
  gridTemplateColumns: trackValue,
  gridTemplateRows: trackValue,
  gridAutoColumns: trackValue,
  gridAutoRows: trackValue,
  gridRow: gridLineValue,
  gridColumn: gridLineValue,
  tabSize: tabSizeValue,
  willChange: willChangeValue,
  gridRowStart: gridLineSingleValue,
  gridRowEnd: gridLineSingleValue,
  gridColumnStart: gridLineSingleValue,
  gridColumnEnd: gridLineSingleValue,
  flex: flexValue,
  columns: columnsValue,
  textEmphasis: textEmphasisValue,
  counterIncrement: counterValue,
  counterReset: counterValue,
};
/** Кавычка или обратный слэш внутри строки — экранируются в CSS. */
const REGEXP_QUOTE_ESCAPE = /(["\\])/g;
/**
 * Экранирует то, что нельзя оставить внутри строкового значения как есть.
 *
 * `content: "he said "hi""` синтаксически обрывается на второй кавычке;
 * правильная запись — `"he said \"hi\""`.
 */
function quoteEscape(v: string): string {
  return v.replace(REGEXP_QUOTE_ESCAPE, '\\$1');
}
/**
 * Краткие записи `content`.
 *
 * `S` — пробел (space). Единственная запись для него: `cnt__` бракуется,
 * чтобы одно значение не имело двух форм. Кавычки двойные, как у всех
 * остальных значений — одиночные в прежнем `content:' '` были разнобоем.
 *
 * Пустую строку пробел не заменяет: `content:""` создаёт псевдоэлемент
 * (обычный приём для `::before`/`::after` с оформлением), `content:none` не
 * создаёт его вовсе. Пустая строка пишется как `cnt_` — ведущий `_` означает
 * «дальше текст», а текста после него нет.
 */
const CONTENT_SYNONYMS: Record<string, string> = {
  S: '" "',
  N: NONE,
  // Кавычки по `quotes` (D-113): `cntOQ` → `open-quote`.
  OQ: 'open-quote',
  CQ: 'close-quote',
  NOQ: 'no-open-quote',
  NCQ: 'no-close-quote',
};
/** Ключевые слова `content` — всё, что пишется без кавычек и не функция. */
const CONTENT_KEYWORDS: Record<string, 1> = {
  none: 1,
  normal: 1,
  'open-quote': 1,
  'close-quote': 1,
  'no-open-quote': 1,
  'no-close-quote': 1,
};
/** Проценты допустимы: `text-indent:10%`, но не `word-spacing:10%`. */
const LENGTH_PERCENT = 1;
/** Несколько значений через `_`: `border-spacing:10px 20px`. */
const LENGTH_MULTI = 2;
/** Отрицательные значения: `text-indent:-5px`, но не `flex-basis:-5px`. */
const LENGTH_SIGN = 4;
/**
 * Длина без поблажек — `perspective:500px`, но не `50%`, `-5px` или два значения. Флаг нужен, потому что `0` в
 * таблице читается как «не длина».
 */
const LENGTH_PLAIN = 8;
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
  if (v.indexOf(OPEN_PAREN) > -1) {
    return v;
  }
  const prefix = MSG_VALUE + raw + MSG_IS_INVALID_FOR + essenceName + MSG_COLON;
  const parts = v.split(SPACE);
  let i = parts.length;
  let part: string;
  (i < 2 || (allow & LENGTH_MULTI))
    || throwInvalid(prefix + 'expected a single value');
  // `border-spacing` берёт максимум два (горизонтальный и вертикальный
  // интервал): `bsp10_20_30_40` давало четыре.
  (i < 3 || !(allow & LENGTH_MULTI))
    || throwInvalid(prefix + 'expected at most two values');
  while (i--) {
    part = parts[i];
    // Слово сюда доходит только разрешённое: список ключевых слов свойства
    // проверен выше по `assertKnownWord`-правилу вызывающего блока.
    REGEXP_LENGTH_PART.test(part) || REGEXP_BARE_WORD.test(part)
      || throwInvalid(prefix + 'expected a length');
    (part.indexOf(PERCENT) < 0 || (allow & LENGTH_PERCENT))
      || throwInvalid(prefix + 'expected a length, percent is not allowed');
    (part[0] !== DASH || (allow & LENGTH_SIGN))
      || throwInvalid(prefix + 'negative value is not allowed');
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
    REGEXP_AUTO_REPEAT_LIKE.test(suffix) && throwInvalid(DOUBLE_QUOTE + essenceName + suffix + '" looks like the auto-repeat shorthand but '
        + 'does not parse. Form: "' + essenceName + 'AF240" or "' + essenceName
        + 'AF240_1fr" (AF — auto-fit, AFL — auto-fill)');
    return;
  }
  return 'repeat(auto-fi' + (m[1] ? 'll' : 't') + ', minmax('
    + defaultUnitNormalize(m[2]) + LIST_SEPARATOR
    + (m[3] ? defaultUnitNormalize(m[3]) : '1fr') + '))';
}

/**
 * Берёт имя шрифта в кавычки, если оно из нескольких слов.
 *
 * Уже закавыченное имя второй раз не оборачивается: `ff_"My_Font"` давало
 * `font-family:""My Font""` — вложенные кавычки, и правило браузер отбрасывает
 * (2026-09-27).
 */
function __wr(v: string): string {
  if (v[0] === DOUBLE_QUOTE || v[0] === QUOTE) {
    return v;
  }
  return v[0] == DASH
    ? DOUBLE_QUOTE + v.slice(1) + DOUBLE_QUOTE
    : (
      v.indexOf(SPACE) > -1 ? DOUBLE_QUOTE + v + DOUBLE_QUOTE : v
    );
}
function calc(
  v: any, sign: string, add: any,
): string {
  return 'calc(' + v + SPACE + sign + SPACE + add + CLOSE_PAREN;
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
function normalizeDefault(p: MnEssenceParams, def?: string | number): MnHandlerResult {
  return {
    exts: [p.name + (def || 0) + p.ni],
  };
}

import {
  MnInstance,
  MnHandler,
  MnHandlerResult,
} from '../../types';
import type {
  MnPresetObject,
} from '../../core/types';
import {
  MnParseError,
} from '../../core/types';
import type {
  MnEssenceParams,
} from '../../core/types';
import {
  handlerWrap,
} from '../../core/utils';

/**
 * Значение вида `-слово` (`-bold`, `-only`, `-red-500`, `-caption`): в записи minotation таких
 * нет (проверено 2026-09-27: `--v`, `w-5`, `w10-5`, `_a-b`, `From-font` под него не подходят),
 * а у классов других систем — сплошь (`fw-bold` — Bootstrap, `sr-only` — Bootstrap/Tailwind).
 */
const REGEXP_SUSPECT_VALUE = /^-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function throwSuspect(p: MnEssenceParams): never {
  throw new MnParseError(DOUBLE_QUOTE + p.name + p.suffix + MSG_COLON_QUOTE + p.suffix + '" is not a value of "' + p.name
    + '" — this looks like a class of another CSS framework, it gives no CSS', {
    token: p.name + p.suffix,
    handler: p.name,
    arg: p.suffix,
    warningType: 'suspect-class',
  });
}

/**
 * Хендлеры пресета сами распознают класс другой системы (D-065, D-066): значение `-слово`
 * не разбирается, а даёт отчёт `suspect-class` (`suspectClassMode`). Одна проверка на все
 * хендлеры пресета — при регистрации, а не в каждом: раньше 25 из них такие значения
 * принимали и давали неверный CSS (`fw-bold` → `font-weight:100`). Паттерн разбора
 * (`mn(name, handler, pattern)`) оборачивается здесь же, чтобы проверка шла раньше него.
 */
/** Подсказка в ошибке хендлера: значение подходит другому свойству (D-094). */
type CrossHint = [test: (suffix: string) => boolean, tag: string, property: string];

/** Значения курсора, которые не цвет: `cP` — не `#P`, а, видимо, `crP`. */
const CURSOR_WORDS: Record<string, 1> = {
  P: 1,
  T: 1,
  M: 1,
  N: 1,
  W: 1,
  G: 1,
  GG: 1,
  NA: 1,
  HA: 1,
  HE: 1,
  PR: 1,
};

/** Значения позиции: `pA` — не отступ, а `posA`. */
const POSITION_WORDS: Record<string, 1> = {
  A: 1,
  R: 1,
  F: 1,
  S: 1,
};

/** Значения `float`: `fL` — не размер шрифта, а `flL`. */
const FLOAT_WORDS: Record<string, 1> = {
  L: 1,
  R: 1,
  N: 1,
  IS: 1,
  IE: 1,
};

/** Значения `box-sizing`: `bsBB` — не стиль рамки, а `bxzBB`. */
const BOX_SIZING_WORDS: Record<string, 1> = {
  BB: 1,
  CB: 1,
};

/**
 * Частые промахи по имени (замер угадываемости, D-094): угаданное имя занято другим свойством, и для него значение
 * неверно — к ошибке добавляется «did you mean». Проверка значения — до вызова хендлера, дешёвая; сам хендлер
 * вызывается как всегда.
 */
const CROSS_HINTS: Record<string, CrossHint[]> = {
  fs: [
    [
      startsWithDigit,
      'f',
      'font-size',
    ],
  ],
  td: [
    [
      (suffix) => suffix[suffix.length - 1] === S && startsWithDigit(suffix),
      'dn',
      'transition-duration',
    ],
  ],
  // `pe10`, `bs1` — привычка Tailwind (A2): эти стороны названы `pie`, `bisw` (K3, D-103, D-117).
  pe: [
    [
      startsWithDigit,
      'pie',
      'padding-inline-end',
    ],
  ],
  bs: [
    [
      (suffix) => !!BOX_SIZING_WORDS[suffix],
      'bxz',
      'box-sizing',
    ],
    [
      startsWithDigit,
      'bisw',
      'border-inline-start-width',
    ],
  ],
  c: [
    [
      (suffix) => !!CURSOR_WORDS[suffix],
      'cr',
      'cursor',
    ],
  ],
  p: [
    [
      (suffix) => !!POSITION_WORDS[suffix],
      POS,
      'position',
    ],
  ],
  f: [
    [
      (suffix) => !!FLOAT_WORDS[suffix],
      'fl',
      'float',
    ],
  ],
};

/** Значение начинается с цифры (`10`, `1px`). */
function startsWithDigit(suffix: string): boolean {
  return suffix[0] >= ZERO && suffix[0] <= '9';
}

/** Первая подсказка, чьё условие подходит значению; `undefined` — подсказки нет. */
function findCrossHint(hints: CrossHint[], suffix: string): CrossHint | undefined {
  const l = hints.length;
  let i = 0;
  for (; i < l; i++) {
    if (hints[i][0](suffix)) {
      return hints[i];
    }
  }
  return undefined;
}

/** Вызов хендлера; его ошибка разбора получает подсказку `did you mean "flL" (float)?`. */
function withCrossHint(
  handler: MnHandler, p: MnEssenceParams, hint: CrossHint,
): ReturnType<MnHandler> {
  try {
    return handler(p);
  } catch (ex) {
    // Эти хендлеры бракуют только разбором (`throwInvalid`, `throwSuspect`) — ошибка всегда `MnParseError`.
    throw new MnParseError((ex as MnParseError).message + ' — did you mean "' + hint[1] + p.suffix + '" ('
      + hint[2] + ')?', (ex as MnParseError).context);
  }
}

function withSuspectCheck(instance: MnInstance): MnInstance {
  const guard = (handler: MnHandler, name: string): MnHandler => {
    const hints = CROSS_HINTS[name];
    const checked: MnHandler = (p) => (REGEXP_SUSPECT_VALUE.test(p.suffix) ? throwSuspect(p) : handler(p));
    return hints ? (p) => {
      const hint = findCrossHint(hints, p.suffix);
      return hint ? withCrossHint(
        checked, p, hint,
      ) : checked(p);
    } : checked;
  };
  return new Proxy(instance, {
    apply(
      target, thisArg, args: unknown[],
    ) {
      const first = args[0];
      const essence = args[1];
      const pattern = args[2] as string | string[] | undefined;
      const map: Record<string, unknown> = {};
      let name: string;
      if (typeof first === 'string') {
        return typeof essence === 'function'
          ? target(
            first, guard(pattern
              ? handlerWrap(essence as MnHandler as never, pattern) as MnHandler
              : essence as MnHandler, first) as never, '', args[3] as number,
          )
          : target(...(args as Parameters<MnInstance>));
      }
      // Форма-карта `mn({ fw: handler, cfx: { … } })`: хендлеры в ней — те же хендлеры.
      for (name in first as Record<string, unknown>) { // eslint-disable-line
        map[name] = typeof (first as Record<string, unknown>)[name] === 'function'
          ? guard((first as Record<string, MnHandler>)[name], name)
          : (first as Record<string, unknown>)[name];
      }
      return target(map as never);
    },
  });
}

export default {
  name: 'presetStandard',
  ecosystems: ['minotation'],
  setup: (instance: MnInstance) => {
    const mn = withSuspectCheck(instance);
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
    /** Обратные индексы словарей кратких записей: слово CSS → буква. Строятся при первом обращении к словарю. */
    const lettersByWord = new WeakMap<Record<string, any>, Record<string, string>>();
    /**
     * Буква, которой словарь хендлера записывает слово CSS (`auto` → `A`), или `undefined`. Словарь задаёт слова в
     * любой форме (`Auto`, `NoRepeat`, `scroll-position`) — сравниваются нормализованные.
     * @param aliases — перечень свойства с другими записями слов (`optimizespeed` → `optimizeSpeed`)
     */
    function letterOf(
      word: string, symonyms: Record<string, any>, aliases?: Record<string, 1 | string>,
    ): string | undefined {
      let index = lettersByWord.get(symonyms);
      if (!index) {
        const built: Record<string, string> = index = {};
        forIn(symonyms, (w: any, abbr: string) => {
          let v: string;
          abbr && typeof w === 'string' && !built[v = valueNormalize(w)] && (built[v] = abbr);
        });
        lettersByWord.set(symonyms, index);
      }
      // Другая запись того же слова в перечне (`moz-crisp-edges` → `-moz-crisp-edges`) — то же слово.
      const alias = aliases && aliases[word];
      return index[word] || (typeof alias === 'string' ? index[valueNormalize(alias)] : undefined);
    }
    /**
     * Бракует полное слово, у которого в словаре хендлера есть буква (D-113): две записи одного значения дают в CSS
     * два правила. Подсказка — тот же токен с буквой на месте слова: `m1_Auto` → «Write it shorter: "m1_A"».
     * @param word — слово CSS (`auto`)
     * @param written — как оно записано в суффиксе (`Auto`, `auto`)
     */
    function assertNoLetter(
      word: string, written: string, symonyms: Record<string, any>, name: string, suffix: string,
    ): void {
      const abbr = letterOf(word, symonyms);
      abbr && throwInvalid(MSG_WRITE_SHORTER + name + shorterSuffix(
        suffix, written, abbr,
      )
        + MSG_INSTEAD_OF + name + suffix + MSG_SAME_VALUE);
    }
    /**
     * Значение из нескольких частей через буквы хендлера (D-113): буква работает в любой части (`bsS_DT` →
     * `solid dotted`, `fx1_1_A` → `1 1 auto`), полное слово с буквой бракуется в любой части и в любом режиме
     * (`bs_solid`, `fx1_1_Auto`). Подсказка переписывает весь токен буквами: `bs_solid_dotted` → «Write it shorter:
     * "bsS_DT"». Остальное нормализуется, как {@link valueNormalize}: переменные, кавычки, сырой режим.
     * @param aliases — перечень свойства с другими записями слов: они тоже полные записи
     * @returns значение CSS, части через пробел (проверка по перечню свойства — за вызывающим)
     */
    function lettersValue(
      p: MnEssenceParams, letters: Record<string, any>, aliases?: Record<string, 1 | string>,
    ): string {
      const suffix = p.suffix;
      const raw = suffix[0] == UNDERSCORE;
      const parts = splitValueParts(
        raw ? snakeLeftTrim(suffix) : suffix, 1, 1,
      );
      const l = parts.length;
      const shorter: string[] = new Array(l);
      let i = 0;
      let part: string;
      let letter: any;
      let word: string;
      let abbr: string | undefined;
      let long = 0;
      // Открытая кавычка: строка (`g"a_N_b"` — имена областей) букв не содержит.
      let quote = '';
      for (; i < l; i++) {
        shorter[i] = part = parts[i];
        if (quote || part[0] === DOUBLE_QUOTE || part[0] === QUOTE) {
          quote || (quote = part[0], part = part.slice(1));
          part[part.length - 1] === quote && (quote = '');
          parts[i] = valueNormalize(raw ? UNDERSCORE + parts[i] : parts[i]);
          continue;
        }
        // Буква — только в обычном режиме: сырой оставляет текст как написан (`_A` — это `A`).
        if (part && !raw && typeof (letter = letters[part]) === 'string') {
          parts[i] = valueNormalize(letter);
          continue;
        }
        parts[i] = word = valueNormalize(raw ? UNDERSCORE + part : part);
        if (abbr = letterOf(
          word.toLowerCase(), letters, aliases,
        )) {
          long = 1;
          shorter[i] = abbr;
        } else {
          shorter[i] = REGEXP_BARE_WORD.test(word) ? notationWord(word) : part;
        }
      }
      long && throwInvalid(MSG_WRITE_SHORTER + p.name + shorter.join(UNDERSCORE)
        + MSG_INSTEAD_OF + p.name + suffix + MSG_SAME_VALUE);
      return parts.join(SPACE);
    }
    function assertAngle(
      value: string, unit: string | undefined, raw: string,
    ): string {
      REGEXP_BARE_NUMBER.test(value) || throwInvalid(MSG_VALUE + raw
      + '" is invalid: rotation is a number');
      (!unit || indexOf(ANGLE_UNITS, unit) > -1) || throwInvalid('Unit "' + unit
      + '" is invalid: rotation is measured in angle units (' + ANGLE_UNITS.join(LIST_SEPARATOR) + CLOSE_PAREN);
      return value + (unit || DEG);
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
   * Слово, у которого в словаре хендлера есть буква, полной записью бракуется (D-113): `mAuto`, `m1_Auto`,
   * `bThin`, `fwBold` — вторые записи `mA`, `m1_A`, `bTN`, `fwB`.
   *
   * @param value — уже кебабнутое значение
   * @param raw — как оно записано в токене (для сообщения и поиска по словарю)
   * @param symonyms — словарь кратких записей хендлера
   * @param keywords — допустимые ключевые слова конкретного свойства
   * @param name — имя хендлера (для подсказки с буквой)
   * @param suffix — суффикс токена целиком (для подсказки с буквой)
   */
    function assertKnownWord(
      value: string,
      raw: string,
      symonyms?: Record<string, any>,
      keywords?: Record<string, 1>,
      name?: string,
      suffix?: string,
    ): string {
      symonyms && !symonyms[raw] && assertNoLetter(
        value, raw, symonyms, name as string, suffix as string,
      );
      if (GLOBAL_KEYWORDS[value]
      || (symonyms && symonyms[raw])
      || (keywords && keywords[value])) {
        return value;
      }
      return throwInvalid(MSG_VALUE + raw + '" is invalid: expected a number '
      + 'with a unit, a variable, calc or a keyword of this property');
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
    /**
   * У свойства только процент: ни другой единицы, ни голого нуля.
   *
   * Ноль — особый случай: {@link lengthOrWord} отдаёт его без единицы, как
   * и положено длинам, но `text-size-adjust:0` невалиден.
   */
    function assertPercentOnly(p: MnEssenceParams): void {
      (p.num === ZERO || (p.unit && p.unit !== PERCENT))
      && throwInvalid(MSG_VALUE + p.suffix + '" is invalid: '
        + 'text-size-adjust takes a percentage');
    }
    function lengthOrWord(
      p: MnEssenceParams,
      keywords: Record<string, 1>,
      allow: number,
      defaultUnit: string,
      symonyms?: Record<string, string>,
    ): string {
      const camel = p.camel;
      if (camel) {
        return assertKnownWord(
          toKebabCase(symonyms && symonyms[camel] || camel),
          camel, symonyms, keywords, p.name, p.suffix,
        );
      }
      const num = p.num;
      if (num == ZERO) {
        return num;
      }
      const unit = p.unit;
      unit === PERCENT && !(allow & LENGTH_PERCENT) && throwInvalid(MSG_VALUE
      + p.suffix + '" is invalid: percent is not allowed for this property');
      // Знак здесь не проверяется: все четыре свойства этого пути
      // (`outline-offset`, `letter-spacing`, `text-size-adjust`,
      // `font-size-adjust`) отрицательные значения принимают. Появится пятое,
      // которое не принимает, — проверка добавится вместе с ним, а мёртвой
      // ветки до тех пор нет.
      return (p.sign || '') + (num as string) + (validateUnit(unit) || defaultUnit);
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
      sign === DASH && positive
      && throwInvalid(MSG_VALUE + suffix
        + '" is invalid: negative value is not allowed for this property');
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
      noPercent && throwInvalid(MSG_VALUE + suffix
      + '" is invalid: this property takes a length, percent is not allowed');
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
      name?: string,
    ): [string, number] {
    // Все 6 вызовов getVal в этом файле передают defaultUnit='px' явно —
    // фолбэк недостижим (подтверждено и в v1, 2026-09-23). Параметр остаётся
    // опциональным в сигнатуре (иначе конфликт с предшествующими optional
    // positive/one — TS1016), реальное значение гарантирует вызывающая сторона.
    /* istanbul ignore next */
      defaultUnit = defaultUnit || PX;
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
            otherName, symonyms, keywords, name, '' + suffix,
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
        val = num == ZERO
          ? num
          : (
            vv ? (
              (p.env ? 'env(' : VAR_OPEN) + vv
              + (p.va ? (validateUnit(p.vu) ? '' : defaultUnit) : '') + CLOSE_PAREN
            ) : (assertSign(
              p.sign, positive, suffix,
            ), p.sign || '') + (
              total
                ? (assertPercent(noPercent, suffix),
                toFixed(100 * floatNormalize(num, positive) / floatNormalize(total, positive)) + PERCENT)
                : (p.unit === PERCENT && assertPercent(noPercent, suffix),
                toFixed(num as string) + validateUnit(p.unit || defaultUnit))
            )
          );
        output[i] = add ? calc(
          val,
          sa as string,
          vva
            ? ((p.nva ? 'env(' : VAR_OPEN) + vva
              + (p.vaa ? (validateUnit(p.vua) ? '' : defaultUnit) : '') + CLOSE_PAREN)
            : ('' + floatNormalize(p.addv)
              + validateUnit(p.addu || defaultUnit)),
        ) : val;
      }
      return [
        output.join(SPACE),
        l - 1,
      ];
    }

    /**
     * Camel case значения → kebab case. Заглавная сразу после `,`/`;` не принимается (D-107): у элемента списка
     * одно написание — со строчной (`tnColor;opacity_200`). До D-106 такая заглавная давала дефис (`-opacity`),
     * в D-106 — второе написание того же класса. Префикс производителя пишется явным дефисом:
     * `wcTransform,-webkitTransform` → `transform,-webkit-transform`.
     */
    function toKebabCase(v: string): string {
      REGEXP_LIST_ITEM_CAPITAL.test(v) && throwInvalid(MSG_VALUE + v + '": after "," and ";" a list item starts with a '
        + 'lower-case letter — write "' + v.replace(REGEXP_LIST_ITEM_CAPITALS, lowerItemStart) + DOUBLE_QUOTE);
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
      const raw = v[0] == UNDERSCORE;
      const parts = splitValueParts(
        raw ? snakeLeftTrim(v) : v, 1, 1,
      );
      let i = parts.length;
      let part: string;
      while (i--) {
        part = parts[i];
        parts[i] = cssVarValue(part)
        || varListValue(part)
        // Строка в кавычках — готовое значение, кебабить её нельзя:
        // `qRU` давало `'\00-a-b'` вместо `'\00AB'` (заглавные буквы
        // escape-последовательности уходили в дефисы).
        || ((raw || part[0] === DOUBLE_QUOTE || part[0] === QUOTE)
          ? part
          : toKebabCase(part));
      }
      // `\0` возвращается в `_` ТОЛЬКО после spaceNormalize — иначе та превратила
      // бы его в пробел уже внутри имени переменной (см. splitValueParts).
      return spaceNormalize(parts.join(UNDERSCORE)).replace(REGEXP_VAR_UNDERSCORE, UNDERSCORE);
    }
    /**
   * Разворачивает список значений через запятую, когда имя переменной в нём
   * явно завершено точкой с запятой: `--a;,--b` → `var(--a),var(--b)`.
   *
   * Без `;` запятая после имени — это ФОЛБЭК, а не разделитель:
   * `--mono,serif` → `var(--mono,serif)`, и так и должно остаться. Поэтому
   * список распознаётся только по наличию `;` — там, где автор сам сказал, где
   * имя кончается.
   *
   * До 2026-09-26 такая запись не разбиралась вовсе: `g_--a;,--b` давало
   * `grid:--a;,--b` — переменные не разворачивались, а `;` уезжал в CSS
   * литералом.
   *
   * @returns `undefined`, если это не список — тогда часть обрабатывается как
   *   раньше.
   */
    function varListValue(part: string): string | undefined {
      if (part.indexOf(SEMICOLON) < 0 || part.indexOf(COMMA) < 0) {
        return;
      }
      const items = splitTopLevel(part);
      const l = items.length;
      const out: string[] = new Array(l);
      let i = 0;
      let item: string;
      for (; i < l; i++) {
        item = items[i];
        out[i] = cssVarValue(item) || item;
      }
      return out.join(COMMA);
    }
    function fontNameNormalize(s: string): string {
      const c = s[0];
      return spaceNormalize(c == UNDERSCORE
        ? snakeLeftTrim(s)
        : (
          c == QUOTE || c == DASH
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
      // Свойство принимает не только слова из словаря, но и длину — по
      // правилу `SIZE_LENGTHS` или `OFFSET_LENGTH` (D-104).
      numeric?: LengthRule,
      // Значение свойства составное (`display: inline flow-root`), поэтому у
      // него остаётся сырой режим — перечислить такие сочетания словарём нельзя.
      composite?: 1,
    ): MnHandler {
      let props: Record<string, number>;
      const signed = numeric && numeric.signed;
      const lengthExpected = '": expected ' + (numeric && numeric.expected || 'a length')
        + (signed ? '' : ', zero or positive');
      const numericPart = numeric && numeric.part || REGEXP_LENGTH_PART;
      // Обратный индекс: длинное слово → краткая запись, строится из самого
      // словаря, поэтому новый синоним сразу начинает бракать свою длинную форму.
      const byWord: Record<string, string> = {};
      forIn(synonyms, (word: string, abbr: string) => {
        abbr && (byWord[valueNormalize(word)] = abbr);
      });
      // Допустимые слова — значения самого словаря: словарь задан на свойство,
      // поэтому отдельная таблица не нужна.
      const keywords: Record<string, 1> = {};
      // Есть ли у хендлера буквы: у `bio` (только длины) их нет.
      let lettered = 0;
      forIn(synonyms, (word: string) => {
        keywords[valueNormalize(word)] = 1;
        lettered = 1;
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
     *
     * Ведущий `_` («значение уже готово») открыт только у свойств, помеченных
     * `composite`. Раньше он работал у всех, и `ov_solid` давало
     * `overflow:solid`, `of_solid` — `object-fit:solid`: у свойства с закрытым
     * перечнем «готового значения, которого автор нотации не предусмотрел», не
     * бывает, так что выход там только пропускал мусор. Составных среди 38
     * свойств этого пути пять — `display`, `list-style`, `overscroll-behavior`,
     * `text-decoration`, `touch-action` (2026-09-26).
     */
      function assertSynonymAbbr(p: MnEssenceParams, value: string): void {
      // Сюда доходит только запись, которой НЕТ в словаре кратких форм
      // (её перехватывает `synonyms[p.suffix]` выше), поэтому если у значения
      // есть аббревиатура — записано точно длинной формой.
        const abbr = byWord[value];
        if (abbr) {
          throwInvalid(MSG_WRITE_SHORTER + p.name + abbr
          + MSG_INSTEAD_OF + p.name + p.suffix + MSG_SAME_VALUE);
        }
        // Составное значение проверяется ПО ЧАСТЯМ, а не пропускается целиком:
        // перечень у таких свойств тоже закрыт, просто значение из нескольких
        // слов. Пропуск оставлял дыру — `d_solid` давало `display:solid`,
        // `ovb_solid` — `overscroll-behavior:solid` (2026-09-27).
        if (composite && value.indexOf(SPACE) > -1) {
          const parts = value.split(SPACE);
          let i = parts.length;
          let lengths = 0;
          while (i--) {
            lengths += assertSynonymPart(p, parts[i]);
          }
          numeric && assertLengthCount(
            p, parts, lengths, numeric,
          );
          return;
        }
        assertSynonymPart(p, value);
      }
      /** Список сокращений хендлера: `aiC (center), aiFE (flex-end), …`. */
      function abbrHint(name: string): string {
        const items: string[] = [];
        // Буква, которая одна значением не бывает, показывается с числом: `bis1_F`, а не `bisF` (тот бракуется).
        const head = numeric && numeric.needsNumber ? name + '1' + UNDERSCORE : name;
        forIn(synonyms, (word: string, abbr: string) => {
          abbr && items.push(head + abbr + HINT_OPEN + valueNormalize(word) + CLOSE_PAREN);
        });
        return availableHint(items);
      }
      /**
       * Составное значение с длинами: длин не больше `rule.max`, а слово из `rule.solo` стоит одно —
       * `bgs10_20_30` и `bgs_cover_10` бракуются.
       */
      function assertLengthCount(
        p: MnEssenceParams, parts: string[], lengths: number, rule: LengthRule,
      ): void {
        const solo = rule.solo;
        let i = parts.length;
        lengths > rule.max && throwInvalid(MSG_VALUE + p.suffix + MSG_IS_INVALID_FOR + p.name
          + '": at most ' + rule.max + SPACE + (rule.noun || 'length') + (rule.max > 1 ? S : ''));
        while (solo && i--) {
          solo[parts[i]] && throwInvalid(MSG_VALUE + p.suffix + MSG_IS_INVALID_FOR + p.name + MSG_COLON_QUOTE
            + parts[i] + '" stands alone');
        }
      }
      /**
       * Одна часть значения: слово из словаря, число (если оно тут законно) или функция. Возвращает 1, если часть —
       * длина: составное значение считает их.
       */
      function assertSynonymPart(p: MnEssenceParams, value: string): number {
        if (value.indexOf(OPEN_PAREN) > -1
        // Строка в кавычках — готовое значение (`q_"a"_"b"`), словарём его
        // не перечислить.
        || value[0] === DOUBLE_QUOTE || value[0] === QUOTE
        || GLOBAL_KEYWORDS[value] || keywords[value]) {
          return 0;
        }
        // У хендлера без букв (`bio` — только длины) слово бракуется тем, что ожидалось: «expected a length…».
        REGEXP_BARE_WORD.test(value) && (lettered || !numeric)
          ? throwInvalid(MSG_VALUE + p.suffix + MSG_IS_INVALID_FOR + p.name
          + '": no such abbreviation, and it is not a keyword' + abbrHint(p.name))
          : (numeric
          // Число у такого свойства — длина или процент, а не что угодно:
          // `bgpx10zz` давало `background-position-x:10zz`, `va10s` —
          // `vertical-align:10s`. Размер не бывает отрицательным: `bgs-10px`
          // давало `background-size:-10px`, которое браузер отбрасывает.
            ? (numericPart.test(value) && (signed || value[0] !== DASH)
            || throwInvalid(MSG_VALUE + p.suffix + MSG_IS_INVALID_FOR + p.name + lengthExpected))
            : throwInvalid(MSG_VALUE + p.suffix + MSG_IS_INVALID_FOR
            + p.name + '": the set of values is closed, a number is not allowed'
            + abbrHint(p.name)));
        return 1;
      }
      return isArray(propName)
        ? (props = flags(propName), ((p: MnEssenceParams) => {
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
        : ((p: MnEssenceParams) => {
          let s: string; let style: Record<string, any>; let synonym: any;
          if (synonym = synonyms[s = p.suffix]) {
            numeric && numeric.needsNumber && throwInvalid(MSG_VALUE + s + MSG_IS_INVALID_FOR + p.name + MSG_COLON_QUOTE
              + valueNormalize(synonym) + '" does not stand alone — add ' + numeric.expected);
            style = {};
            style[propName as string] = valueNormalize(synonym);
            return styleWrap(style, priority);
          }
          if (!s) {
            return _style ? styleWrap(_style, priority) : 0;
          }
          // Составное значение: буквы — в каждой части (`td1_U_W`, `bgs10_A`), полное слово с буквой бракуется в
          // любой части (D-113).
          s = composite ? lettersValue(p, synonyms) : valueNormalize(s);
          numeric && !numeric.unitless && (s = defaultUnitNormalize(s));
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
      const rgba8 = l === 8;
      const rgba4 = l === 4;
      if ((l === 2 || rgba4 || l === 7) && hex[l - 1].toLowerCase() === 'f') {
        return hex.slice(0, l - 1);
      }
      if (rgba8 && hex.slice(6).toLowerCase() === 'ff') {
        return hex.slice(0, 6);
      }
      if (l === 6 || rgba8) {
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
      if ((l === 3 || rgba4)
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
      2: [
        1,
        15,
      ],
      4: [
        1,
        15,
      ],
      7: [
        1,
        15,
      ],
      8: [
        2,
        255,
      ],
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
    /** Функция, записанная в токене: `Rgb\(0,0,0\)`, `Url\(a\.png\)` — в цвете и картинке не принимается (D-121). */
    const REGEXP_COLOR_FUNCTION = /^[a-z][a-z0-9-]*\(/i;
    /** CSS-переменная с альфой: `--warn.3` → 30% непрозрачности. */
    const REGEXP_VAR_WITH_ALPHA = /^(---?[^.;\s]+)\.([0-9]+)$/;
    /**
   * Значение цвета, которое НЕ разбирается как код, — переменная с альфой: `bc--warn.3` → `color-mix(in srgb,
   * var(--warn) 30%, transparent)` (D-016 п. 1). Точка-альфа уже работает для кодов (`cF00.5` → `rgba(…,.5)`), здесь
   * то же правило распространено на переменные. Возвращает готовый CSS или `undefined`, если это обычный цвет.
   *
   * Функция в токене (`cRgb\(0,0,0\)`, `bgUrl\(a\.png\)`) бракуется (D-121): цвет пишется кодом, буквой или
   * переменной, картинка по пути — `_`-формой своего хендлера (`bgi_a\.png`, `mki_a\.png`, `bi_a\.png`). До D-121
   * любая функция уходила в CSS как есть (D-016 п. 2), и проходили `rgba(1,2)`, `foo(1)`.
   *
   * Разбирается СЫРОЙ суффикс: `PATTERN_COLOR` обрезает функцию на первой скобке (`Color-mix(a,b)` → `camel:
   * 'Color'`), поэтому по разобранным полям её не распознать.
   * @param suffix сырой суффикс токена
   * @param name имя хендлера — для сообщения
   * @param imageHint для картинки: запись по пути, на которую указывает ошибка (`bgi_a\.png`); без него — цвет
   * @returns готовый CSS или `undefined`
   */
    function rawColorValue(
      suffix: string, name: string, imageHint?: string,
    ): string | undefined {
      if (!suffix) {
        return;
      }
      REGEXP_COLOR_FUNCTION.test(suffix) && throwInvalid(MSG_VALUE + suffix + MSG_IS_INVALID_FOR + name
        + '": a function is not written in a class — ' + (imageHint
        ? 'an image is ' + imageForms(name) + '; a picture by its path is `'
          + imageHint + '`'
        : 'a color is a code (`' + name + '0`, `' + name + 'F00.5`), a letter (`' + name + 'T`) or a variable (`'
          + name + '--x`, `' + name + '--x.3`)'));
      const withAlpha = REGEXP_VAR_WITH_ALPHA.exec(suffix);
      if (withAlpha) {
      // `.3` → 30%, `.67` → 67% — как у кодов.
        return 'color-mix(in srgb, var(' + withAlpha[1] + ') '
        + toFixed(parseFloat('0.' + withAlpha[2]) * 100) + '%, transparent)';
      }
    }
    /**
   * Бракует цвет, у которого есть более короткая или более читаемая запись.
   *
   * `hex` объявлен как `string | number | undefined`, а не `string`: поле
   * приходит из индексной сигнатуры {@link MnEssenceParams} и у части токенов
   * отсутствует. Приводить его к строке на месте вызова нельзя — `'' +
   * undefined` даёт `"undefined"`, и проверка ниже перестала бы срабатывать.
   */
    function assertShortestHex(
      p: MnEssenceParams, hex?: string | number, head = '', tail = '',
    ): void {
      if (!hex) {
        return;
      }
      hex = '' + hex;
      const shorter = shorterHex(hex);
      const best = canonicalAlpha(shorter || hex) || shorter;
      if (best && best !== hex) {
        // `head`/`tail` — остальная часть значения, когда цветов в нём несколько
        // (`sbcF00_0000` → подсказка `sbcF00_0`, а не `sbc0`).
        throwInvalid('Write the color as "' + p.name + head + best + tail
        + MSG_INSTEAD_OF + p.name + head + hex + tail + MSG_SAME_VALUE);
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
    function assertColorAbbr(p: MnEssenceParams): void {
      const camel = p.camel;
      if (!camel) {
        return;
      }
      const abbr = COLOR_SYNONYM_BY_WORD[camel.toLowerCase()];
      if (abbr) {
        throwInvalid('Write the color shorter: "' + p.name + abbr
      + MSG_INSTEAD_OF + p.name + camel + DOUBLE_QUOTE);
      }
      // `p.camel` заполняет не только разбор цвета, но и generic-разбор ядра:
      // у `cF00` там окажется `F` (первая заглавная буква кода). Словом значение
      // считается, только если камель — это ВЕСЬ суффикс и кода/переменной нет.
      if (camel !== p.suffix || p.color || p.vv
      || REGEXP_PLAIN_HEX.test(p.suffix)) {
        return;
      }
      GLOBAL_KEYWORDS[toKebabCase(camel)] || throwInvalid(MSG_VALUE + camel
      + '" is not a color: expected a code (`F00`), a variable or '
      + 'a keyword');
    }
    /** Одиночный hex без альфы/градиента — только цифры. */
    const REGEXP_PLAIN_HEX = /^[0-9A-Fa-f]+$/;

    /**
     * Фон или картинка: цвет (`bgF00`), градиент (`bgF00-00F`, `bg--a;--b`), переменная, `N` — `none`. Один читатель
     * на `bg`, `mk` и `bi` (D-119): исправление формы сразу у всех. Функция в токене не пишется (D-121): картинка по
     * пути — `_`-форма (D-122), у `bg` и `mk` — в своём хендлере картинки (`bgi_a\.png`, `mki_a\.png`), у `bi` — в нём
     * самом (`bi_a\.png`).
     * @param propName свойство (`background`, `maskImage`, `borderImageSource`)
     * @param imageOnly свойство принимает только картинку: одиночный цвет бракуется, цвет-fallback `altColor` не
     *   выводится (`mask-image`, `border-image-source`)
     * @param pathHandler хендлер, где пишется картинка по пути (`bgi`); не задан — путь берёт сам хендлер (`bi_a\.png`)
     * @returns хендлер
     */
    function backgroundProvider(
      propName: string, imageOnly?: 1, pathHandler?: string,
    ): MnHandler {
      const property = toKebabCase(propName);
      const pathHint = (p: MnEssenceParams): string => '; a picture by its path is `' + (pathHandler || p.name)
        + '_a\\.png`';
      const notColor = (p: MnEssenceParams, v: string): never => throwInvalid(MSG_VALUE + v + MSG_IS_INVALID_FOR
        + p.name + '": an image is ' + imageForms(p.name)
        + pathHint(p) + '; `' + property + '` does not accept a single color');
      return (p: MnEssenceParams) => {
        let v: string; let style: Record<string, any>;
        p.negative && throwInvalid();
        if (!pathHandler && p.suffix[0] === UNDERSCORE) {
          style = {};
          style[propName] = imagePathValue(p.suffix.slice(1), p.name);
          return styleWrap(style);
        }
        // `none` — буквой, как у остальных хендлеров (D-113): `bgN`, `mkN` бракувались как «not a color».
        if (p.suffix === 'N') {
          style = {};
          style[propName] = NONE;
          return styleWrap(style);
        }
        if (REGEXP_LEADING_HASH_HEX.test(p.suffix)) {
          throwInvalid('Redundant "#": write the color without it — "'
          + p.name + p.suffix.slice(1) + MSG_INSTEAD_OF + p.name + p.suffix + DOUBLE_QUOTE);
        }
        // Синонимы проверяем ДО разбора как цвета: буквы аббревиатур бывают
        // валидными hex-цифрами, и без этого `bgAC` (AccentColor) уходил в
        // `#aaa`, `bgBB` (ButtonBorder) — в `#bb` (2026-09-24).
        const raw = rawColorValue(
          p.suffix, p.name, (pathHandler || p.name) + '_a\\.png',
        );
        if (raw) {
          style = {};
          style[propName] = raw;
          return styleWrap(style);
        }
        const synonym = COLOR_SYNONYMS[p.suffix];
        // `mkT`, `biCT` — тоже одиночный цвет.
        synonym && imageOnly && notColor(p, p.suffix);
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
        if (!(v = p.suffix)) {
          // Значение по умолчанию (`0`) — цвет, картинкой оно не бывает: голый `mk`, `bi` — «needs a value», а не
          // «Value "0" is invalid».
          return imageOnly ? 0 : normalizeDefault(p);
        }
        // `colorGetBackground` возвращает СПИСОК значений (браузерные варианты
        // одного фона), поэтому проверяется первое — форма у них одна.
        const result = colorGetBackground(v);
        const first: string = '' + result[0];
        // Проверяется РЕЗУЛЬТАТ, а не суффикс: мини-язык фона богаче, чем можно
        // описать одной регуляркой на вход (угол `_g90`, радиальный `_r`,
        // повторяющийся `_rpt`, переменные через `;`). Зато результат всегда
        // одной из трёх форм — цвет, функция или подстановка.
        //
        // Числовые формы доходили до вывода как есть: `bg10zz` давало
        // `background:10zz`, `bg1/2` — `background:1/2`, `bg10_20` —
        // `background:10_20`.
        REGEXP_BACKGROUND_RESULT.test(first)
        || throwInvalid(MSG_VALUE + v + MSG_IS_INVALID_FOR + p.name + (imageOnly
          ? '": expected ' + imageForms(p.name)
          : '": expected a color (`F00`), a gradient (`F00-00F`) or a variable') + pathHint(p));
        // Проверки формы результата мало: мусор ВНУТРИ градиента в неё
        // укладывается — `bg100%-20px` собиралось в
        // `linear-gradient(180deg,100% 0%,20px 100%)`. Поэтому у градиента
        // проверяется каждый стоп — у КАЖДОГО градиента списка: с `altColor`
        // первым идёт цвет-fallback, и проверка одного `first` пропускала
        // `bgF00-zz` (до 2026-10-30).
        const gradients = filter(result, isGradientValue);
        forEach(gradients, (gradient: string) => assertGradientStops(
          gradient, v, p.name,
        ));
        // `mask-image` и `border-image-source` цвета не принимают вовсе — только
        // картинку. Одиночный цвет там давал заведомо нерабочее правило
        // (`maskbgF00` → `mask-image:#f00`). Цвет-fallback из `altColor` им
        // тоже не годится — остаются одни градиенты; раньше по этому fallback
        // бракувался любой `mk` с `altColor`.
        imageOnly && (first[0] === '#' || first.indexOf('rgba(') === 0)
        && !gradients.length && notColor(p, v);
        style = {};
        style[propName] = imageOnly && gradients.length ? gradients : result;
        return styleWrap(style);
      };
    }

    forIn(mapIn({
      ...SIDES_MAP,
      ...mapIn(LOGICAL_SIDES, (side) => [side]),
    }, (sides) => reduce(
      sides, (dst, key) => {
        dst[key] = 1; return dst;
      }, {},
    )), (sides, suffix) => {
      const priority = suffix ? (4 - size(sides)) : 0;
      // Ось `x`/`y` (D-101): по умолчанию логическое свойство (`padding-inline`), `axisMode: 'physical'` —
      // физическая пара. Остальные стороны (`t`, `xt`, `lb`…) — физические всегда.
      const axis = suffix === AXIS_X ? '-inline' : suffix === AXIS_Y ? '-block' : '';
      const logicalSide = LOGICAL_SIDES[suffix];
      const bsSidesSet = axisSetter((side) => BORDER + side + '-style');
      const bcSidesSet = axisSetter((side) => BORDER + side + '-color');

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

      /**
       * {@link sidesSetter} с осью: для `x`/`y` выбирает логическое свойство или физическую пару по
       * `axisMode` инстанса — в момент компиляции токена, поэтому `setOptions` + `recompile` переключают живой
       * инстанс. Для остальных сторон — сам `sidesSetter`.
       * @param handle имя свойства по стороне (`'-left'` → `padding-left`, `'-inline'` → `padding-inline`)
       * @param logical имя логического свойства, если `handle(axis)` его не даёт (`inset-inline`)
       */
      function axisSetter(handle: (side: string) => string, logical?: string): (v: any) => Record<string, any> {
        const physicalSet = sidesSetter(handle);
        if (!axis) {
          return physicalSet;
        }
        const logicalName = logical || handle(axis);
        return (v: any) => {
          if (instance.options.axisMode === AXIS_PHYSICAL) {
            return physicalSet(v);
          }
          const style: Record<string, any> = {};
          style[logicalName] = v;
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
      // выводятся из значений словаря; полная запись слова с буквой (`bThin`)
      // бракуется в пользу краткой (`bTN`, D-113). Буква разбирается тем же
      // `getVal`, что и любая часть, — значение сразу, а не алиас на полную
      // запись (алиас делал полную запись несущей).
        const keywords: Record<string, 1> = {};
        forIn(symonyms as Record<string, string>, (word: string) => {
          keywords[toKebabCase(word)] = 1;
        });
        return (p: MnEssenceParams) => {
          let suffix: string;
          if (!(suffix = p.suffix)) {
            return normalizeDefault(p, 0);
          }
          const v = getVal(
            suffix, nosign, one, PX, 0, symonyms, keywords, noPercent, p.name,
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
            A: NAME_AUTO,
          },
        ],
        b: [
          BORDER,
          '-width',
          1,
          {
            TN: NAME_THIN,
            M: NAME_MEDIUM,
            TC: NAME_THICK,
          },
          // `border-width` — это `<line-width>`, то есть длина или одно из трёх
          // слов. Процентов не принимает, в отличие от `padding`/`margin`.
          1,
        ],
        // Группа B (RESEARCH/17): отступы прокрутки. `scroll-margin` — только
        // длина, зато со знаком; `scroll-padding` — длина, процент или `auto`.
        sm: [
          'scroll-margin',
          0,
          0,
          {},
          1,
        ],
        sp: [
          'scroll-padding',
          0,
          1,
          {
            A: NAME_AUTO,
          },
        ],
      }, (args: any[], pfx: string) => {
        const propName = args[0];
        const propSuffix = args[1] || '';
        const name = pfx + suffix;
        mn(
          LOGICAL_RENAMED[name] || name, handleProvider(
            axisSetter((side) => propName + side + propSuffix),
            args[2],
            suffix,
            args[3],
            args[4],
          ), '', 1,
        );
      });

      mn(
        S + suffix, handleProvider(
          suffix
            ? axisSetter((side) => (logicalSide ? INSET + side : replace(
              side, REGEXP_TRIM_KEBAB_LEFT, '',
            )), INSET + axis)
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
            A: NAME_AUTO,
          },
        ), '', 1,
      );
      mn('bs' + suffix, (p) => {
        const s = p.suffix;
        return styleWrap(bsSidesSet(s
        // Стиль границы — закрытый перечень (`<line-style>`), но
        // проверки не было вовсе: `bs10` давало `border-style:10`,
        // `bsF00` — `border-style:f00`, `bsZzz` — `border-style:zzz`.
        // Без стороны свойство берёт до четырёх значений
        // (`border-style: solid dotted`), со стороной — одно. Буквы — в каждой
        // части (`bsS_DT`), полные слова бракуются (D-113).
          ? assertEnumValue(
            lettersValue(p, BORDER_STYLE_SYNONYMS), BORDER_STYLE_KEYWORDS,
            suffix ? 0 : 1, 'bs' + suffix, s, BORDER_STYLE_SYNONYMS,
          )
          : SOLID), priority + 1);
      });
      mn(
        'bc' + suffix, (p) => {
          let v: string | undefined; let synonym: any;
          const raw = rawColorValue(p.suffix, p.name);
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
    });

    /**
     * `border-image` по частям (D-119): у каждой части своё свойство и свой хендлер, как `olw`/`ols`/`olc` у
     * `outline` — атомарный класс переиспользуется, а сборный давал по классу на каждое сочетание.
     *
     * - `bi` — `border-image-source`: тот же читатель картинки, что у `bg` и `mk` (`bi8D5524-6D3504`, `biUrl\(a\.png\)`,
     *   `bi--img`, `biN`). До D-119 (2026-10-30) `bi` писал сокращение `border-image` и находил градиент своим регулярным
     *   выражением, а оно с записью `bg` уже разошлось: `bi--a;--b` давало `border-image:var(--a) var(--b)`.
     * - `bis` — слайс: числа без единицы (пиксели картинки) или проценты, `F` — `fill` (`bis30`, `bis30_F`).
     *   По умолчанию слайс 100%, и градиент виден только в углах — для рамки градиентом нужен `bis1`.
     * - `biw` — ширина кольца картинки (`biw10` → `10px`, `biwA`), `bio` — вынос за рамку (`bio5`), `bir` — повтор
     *   (`birRD`, `birR_ST`).
     *
     * Сторон у свойства нет: до 2026-10-30 `bil5` давало `border-left-image:5` — такого свойства в CSS нет.
     */
    mn({
      bi: backgroundProvider(BORDER_IMAGE_SOURCE, 1),
      bis: synonymProvider(
        'borderImageSlice', {
          F: NAME_FILL,
        }, 0, 0 as any, BORDER_IMAGE_SLICES, 1,
      ),
      biw: synonymProvider(
        'borderImageWidth', {
          A: NAME_AUTO,
        }, 0, 0 as any, BORDER_IMAGE_WIDTHS, 1,
      ),
      bio: synonymProvider(
        'borderImageOutset', {}, 0, 0 as any, BORDER_IMAGE_OUTSETS, 1,
      ),
      bir: synonymProvider(
        'borderImageRepeat', BORDER_IMAGE_REPEAT_SYNONYMS, 0, 0 as any, undefined, 1,
      ),
    });

    forIn({
      sq: [
        'width',
        'height',
      ],
      w: ['width'],
      h: ['height'],
      // Логические размеры (A2, D-097): `iz` — по оси строки, `bz` — по оси блока; `izmin`, `bzmax`… как `wmin`.
      iz: ['inline-size'],
      bz: ['block-size'],
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
        const propMap: Record<string, number> = {};
      let propName, i = 0; // eslint-disable-line
        for (; i < length; i++) {
          propName = props[i];
          propMap[sfx ? (sfx + DASH + propName) : propName] = 1;
        }
        mn(
          essencePrefix + sfx, (p) => {
            const suffix = p.suffix;
            if (!suffix) {
              return normalizeDefault(p, HUNDRED_PERCENT);
            }
            const v = getVal(
              suffix, 1, 1, PX, 0, symonyms, keywords, 0, p.name,
            );
            const [value] = v;
            const style: Record<string, any> = {};
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
      return (p: MnEssenceParams) => {
        const suffix = p.suffix;
        if (!suffix) {
          return normalizeDefault(p, HUNDRED_PERCENT);
        }
        // `normal` — initial value у gap-семейства; размерам (`w`/`h`/`p`/`m`)
        // оно не подходит, поэтому словарь здесь свой (`gapN`).
        const v = getVal(
          suffix, 1, 1, PX, 0, GAP_SYNONYMS, KEYWORDS_NORMAL, 0, p.name,
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

    /**
     * Флекс-выравнивание буквами — `fxaC`, `fyaST`: объявление с префиксной парой старого `box-*`. Полное слово
     * (`fxaCenter`, `fya_stretch`) — вторая запись того же правила, бракуется с подсказкой (D-113); незнакомая буква —
     * со списком букв.
     */
    function flexAlignProvider(name: string, styles: Record<string, [string, Record<string, string>]>): MnHandler {
      const words: Record<string, string> = {};
      const items: string[] = [];
      forIn(styles, (entry: [string, Record<string, string>], letter: string) => {
        words[letter] = entry[0];
        items.push(name + letter + HINT_OPEN + valueNormalize(entry[0]) + CLOSE_PAREN);
      });
      return (p) => {
        const s = p.suffix;
        const entry = styles[s];
        if (entry) {
          return styleWrap(entry[1], 1);
        }
        if (!s) {
          return 0;
        }
        assertNoLetter(
          valueNormalize(s).toLowerCase(), snakeLeftTrim(s), words, name, s,
        );
        throwInvalid(MSG_VALUE + s + MSG_IS_INVALID_FOR + name + '": no such abbreviation' + availableHint(items));
      };
    }

    mn({
      // По горизонтали; `A` и `B` — `space-around` и `space-between`.
      fxa: flexAlignProvider('fxa', {
        S: [
          NAME_START,
          {
            boxPack: 'start',
            justifyContent: FLEX_START,
          },
        ],
        C: [
          NAME_CENTER,
          {
            boxPack: CENTER,
            justifyContent: CENTER,
          },
        ],
        E: [
          NAME_END,
          {
            boxPack: 'end',
            justifyContent: FLEX_END,
          },
        ],
        A: [
          'Around',
          {
            justifyContent: 'space-around',
          },
        ],
        B: [
          'Between',
          {
            boxPack: 'justify',
            justifyContent: 'space-between',
          },
        ],
      }),
      // По вертикали. `A` (Around) нет: у `align-items` такого значения не бывает.
      fya: flexAlignProvider('fya', {
        S: [
          NAME_START,
          {
            boxAlign: 'start',
            alignItems: FLEX_START,
            alignContent: FLEX_START,
          },
        ],
        C: [
          NAME_CENTER,
          {
            boxAlign: CENTER,
            alignItems: CENTER,
            alignContent: CENTER,
          },
        ],
        E: [
          NAME_END,
          {
            boxAlign: 'end',
            alignItems: FLEX_END,
            alignContent: FLEX_END,
          },
        ],
        ST: [
          NAME_STRETCH,
          {
            boxAlign: STRETCH,
            alignItems: STRETCH,
            alignContent: STRETCH,
          },
        ],
      }),
    });

    forIn({
      dn: 'transitionDuration',
      delay: 'transitionDelay',
    }, (propName, essenceName) => {
      mn(essenceName, (p) => {
        let num;
        return p.camel || p.negative ? 0 : ((num = p.num)
          ? styleWrap({
            [propName]: num + MS,
          }, 1)
          : normalizeDefault(p, 250)
        );
      });
    });

    forIn({
      c: ['color'],
      stroke: ['stroke'],
      fill: ['fill'],
      olc: [
        'outlineColor',
        1,
      ],
      bgc: [
        'backgroundColor',
        1,
      ],
      temc: [
        'textEmphasisColor',
        1,
      ],
      tdc: [
        'textDecorationColor',
        1,
      ],
      // WebkitTapHighlightColor — вендорное свойство без нестандартного аналога
      // (camelCase с ведущей заглавной буквы camelToKebabCase превращает в
      // '-webkit-tap-highlight-color', см. fundamentool). Добавлено 2026-09-23
      // взамен ручного mn.css({html:{'-webkit-tap-highlight-color':'#000'}})
      // в presets/main/index.ts — единственного оставшегося в проекте вызова mn.css.
      thc: [
        'WebkitTapHighlightColor',
        1,
      ],
      // Группа F (RESEARCH/17): цвет галочек и полей формы, цвет каретки. `auto` — словом (`ccAuto`): буква `A` —
      // код цвета `#aaa`.
      acc: [
        'accentColor',
        1,
        AUTO_KEYWORD,
      ],
      cc: [
        'caretColor',
        1,
        AUTO_KEYWORD,
      ],
    }, (options: any[], pfx: string) => {
      const propName = options[0];
      const priority = options[1] || 0;
      // Слова свойства сверх цвета — `auto` у `caret-color`.
      const keywords: Record<string, 1> | undefined = options[2];
      mn(
        pfx, (p) => {
          let s: Record<string, any>; let v: string | undefined; let synonym: any;
          const word = keywords && toKebabCase(p.suffix);
          if (word && keywords[word]) {
            s = {};
            s[propName] = word;
            return styleWrap(s, priority);
          }
          const raw = rawColorValue(p.suffix, p.name);
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
              // `p.camel` заполняет и общий разбор ядра: у `F00.active` это `F`, и
              // хвост молча терялся (`color:#fff`, найдено 2026-10-12). Слово — цвет,
              // только если оно и есть всё значение.
              (p.color || p.vv || p.camel && p.camel === p.suffix) || throwInvalid(MSG_VALUE + p.suffix
              + '" is not a color: expected a code (`F00`), a variable '
              + 'or a keyword'),
              assertColorAbbr(p),
              assertShortestHex(p, p.color),
              s = {},
              s[propName] = getColor(v as string),
              styleWrap(s, priority)
            );
        }, PATTERN_COLOR,
      );
    });

    /** Код цвета в части значения: hex и, через точку, альфа (`F00.5`). */
    const REGEXP_HEX_ALPHA = /^[0-9A-Fa-f]+(\.[0-9]+)?$/;
    /**
     * Один цвет из значения, где цветов несколько: синоним, функция, переменная
     * (в том числе с альфой) или код. Те же проверки, что у `c`: длинное слово
     * при наличии краткого, неукороченный код, не-цвет — ошибка.
     *
     * Возвращает список, как `getColor`: с `altColor` у кода с альфой там
     * запасное значение и основное.
     */
    function colorPart(
      p: MnEssenceParams, parts: string[], index: number,
    ): string[] {
      const part = parts[index];
      const synonym = COLOR_SYNONYMS[part];
      if (synonym) {
        return getColor(synonym);
      }
      const raw = rawColorValue(part, p.name) || cssVarValue(part);
      if (raw) {
        return [raw];
      }
      // Подсказка называет весь токен: `sbcCT_0`, а не `CT`.
      const head = p.name + parts.slice(0, index).join(UNDERSCORE) + (index ? UNDERSCORE : '');
      const tail = index < parts.length - 1 ? UNDERSCORE + parts.slice(index + 1).join(UNDERSCORE) : '';
      const abbr = COLOR_SYNONYM_BY_WORD[part.toLowerCase()];
      abbr && throwInvalid('Write the color shorter: "' + head + abbr + tail
      + MSG_INSTEAD_OF + head + part + tail + DOUBLE_QUOTE);
      REGEXP_HEX_ALPHA.test(part) || throwInvalid(MSG_VALUE + part
      + '" is not a color: expected a code (`F00`), a variable or a keyword');
      assertShortestHex(
        p, part, head.slice(p.name.length), tail,
      );
      return getColor(part);
    }

    /**
     * `scrollbar-color` (группа B, RESEARCH/17): `sbcA` → `auto`, иначе ровно два
     * цвета через `_` — ползунок и дорожка: `sbcF00_0` → `#f00 #000`. Одна
     * переменная — значение целиком (`sbc--bar`), как у тени.
     *
     * С `altColor` у кода с альфой цвет приходит парой «запасное, основное» —
     * тогда и свойство пишется дважды: сначала обе запасные части, потом обе
     * основные.
     */
    mn('sbc', (p) => {
      const suffix = p.suffix;
      if (suffix === A) {
        return styleWrap({
          scrollbarColor: AUTO,
        });
      }
      const parts = splitValueParts(suffix);
      if (parts.length === 1) {
        const whole = cssVarValue(suffix) || (GLOBAL_KEYWORDS[toKebabCase(suffix)] && toKebabCase(suffix));
        whole || throwInvalid(MSG_VALUE + suffix + MSG_IS_INVALID_FOR + p.name
        + '": expected "A" (auto), two colors — thumb_track, as "sbcF00_0" — or a variable');
        return styleWrap({
          scrollbarColor: whole,
        });
      }
      parts.length === 2 || throwInvalid(MSG_VALUE + suffix + MSG_IS_INVALID_FOR + p.name
      + '": two colors are expected — thumb_track, as "sbcF00_0"');
      const thumb = colorPart(
        p, parts, 0,
      );
      const track = colorPart(
        p, parts, 1,
      );
      const main = thumb[thumb.length - 1] + SPACE + track[track.length - 1];
      const fallback = thumb[0] + SPACE + track[0];
      return styleWrap({
        scrollbarColor: fallback === main ? main : [
          fallback,
          main,
        ],
      });
    });

    /**
     * `place-content` / `-items` / `-self` (группа C, RESEARCH/17): `align` и, через `_`, `justify`. Буквы частей —
     * те же, что у пары хендлеров: `plc` = `ac` + `jc`, `pli` = `ai` + `ji`, `pls` = `as` + `js`. `pliC` →
     * `center`, `plcSB_C` → `space-between center`. Одна часть задаёт обе оси, поэтому в ней — только буквы `align`:
     * `plcL` ошибка, как и `place-content: left` в CSS.
     */
    function placeProvider(
      propName: string, slots: Record<string, string>[], slotNames: string[],
    ): MnHandler {
      const byWord: Record<string, string>[] = [];
      let i = 0;
      for (; i < 2; i++) {
        byWord[i] = {};
        forIn(slots[i], (word: string, abbr: string) => {
          byWord[i][valueNormalize(word)] = abbr;
        });
      }
      return (p: MnEssenceParams) => {
        const suffix = p.suffix;
        const style: Record<string, string> = {};
        const parts = splitValueParts(suffix);
        const l = parts.length;
        // Одно слово CSS-wide — значение целиком, как у `sbc`. Переменная с `_` в имени закрывается `;`
        // (`plc--my_gap;`), иначе `_` делит части: `plc--a_C` → `var(--a) center`.
        const kebab = toKebabCase(suffix);
        if (l === 1 && GLOBAL_KEYWORDS[kebab]) {
          style[propName] = kebab;
          return styleWrap(style);
        }
        l < 3 || throwInvalid(MSG_VALUE + suffix + MSG_IS_INVALID_FOR + p.name + '": at most two parts — '
        + slotNames[0] + '_' + slotNames[1] + ', as "' + p.name + 'C_S"');
        const words: string[] = [];
        let part: string;
        let word: string;
        let head: string;
        let tail: string;
        let abbr: string;
        let j = 0;
        for (; j < l; j++) {
          part = parts[j];
          word = slots[j][part];
          if (word) {
            words.push(valueNormalize(word));
            continue;
          }
          word = cssVarValue(part) || '';
          if (word) {
            words.push(word);
            continue;
          }
          // Подсказка называет весь токен: `pliC_S`, а не `S`.
          head = p.name + (j ? parts[0] + UNDERSCORE : '');
          tail = j < l - 1 ? UNDERSCORE + parts[1] : '';
          abbr = byWord[j][valueNormalize(part)];
          abbr && throwInvalid(MSG_WRITE_SHORTER + head + abbr + tail + MSG_INSTEAD_OF + head + part + tail
          + DOUBLE_QUOTE);
          throwInvalid(MSG_VALUE + part + MSG_IS_INVALID_FOR + p.name + '": the ' + (j ? 'second' : 'first')
          + ' part is ' + slotNames[j] + availableHint(placeHintItems(
            slots[j], head, tail,
          )));
        }
        style[propName] = words.join(SPACE);
        return styleWrap(style);
      };
    }

    /** Варианты одной части `place-*` целыми токенами: `pliC_S (start)`. */
    function placeHintItems(
      words: Record<string, string>, head: string, tail: string,
    ): string[] {
      const items: string[] = [];
      forIn(words, (word: string, abbr: string) => {
        items.push(head + abbr + tail + HINT_OPEN + valueNormalize(word) + CLOSE_PAREN);
      });
      return items;
    }

    mn({
      plc: placeProvider(
        'placeContent', [
          ALIGN_CONTENT_WORDS,
          JUSTIFY_CONTENT_WORDS,
        ], [
          'align-content',
          'justify-content',
        ],
      ),
      pli: placeProvider(
        'placeItems', [
          ALIGN_ITEMS_WORDS,
          JUSTIFY_ITEMS_WORDS,
        ], [
          'align-items',
          'justify-items',
        ],
      ),
      pls: placeProvider(
        'placeSelf', [
          ALIGN_SELF_WORDS,
          JUSTIFY_SELF_WORDS,
        ], [
          'align-self',
          'justify-self',
        ],
      ),
    });

    /**
     * `<position>` из букв и длин (группа D, RESEARCH/17) — общий разбор `op` (object-position), `pspo`
     * (perspective-origin) и `tfo` (transform-origin). Буквы `L`/`C`/`R`/`T`/`B`, углы `TL`/`TR`/`BL`/`BR` первой
     * частью, голое число — `px`: `opL_T` → `left top`, `tfoTL` → `top left`, `op50%_0`, `opR_10_B_20` →
     * `right 10px bottom 20px`. Ведущий `_` — запись словами CSS, как раньше: `op_left_top`.
     *
     * Сочетания сверены с грамматикой: два слова — в любом порядке, но не на одной оси (`opL_R` ошибка); с длиной
     * порядок x, затем y (`opT_10` ошибка, `op10_T` — нет); четыре части — сторона и отступ от неё дважды, стороны
     * на разных осях и без `center`. У `transform-origin` четвёртой формы нет, зато есть третья часть — z, длина без
     * процента: `tfoC_C_10` → `center center 10px`.
     *
     * @param priority — приоритет правила; у `op` он `1`, как был до общего разбора
     * @param z — свойство берёт третью часть z (`transform-origin`); без неё частей 1, 2 или 4
     */
    function positionProvider(
      propName: string, priority?: number, z?: 1,
    ): MnHandler {
      const byWord: Record<string, string> = {};
      forIn(POSITION_KEYWORDS, (word: string, abbr: string) => {
        byWord[valueNormalize(word)] = abbr;
      });
      return (p: MnEssenceParams) => {
        const name = p.name;
        const suffix = p.suffix;
        const style: Record<string, string> = {};
        const kebab = toKebabCase(suffix);
        if (GLOBAL_KEYWORDS[kebab]) {
          style[propName] = kebab;
          return styleWrap(style, priority);
        }
        const prefix = MSG_VALUE + suffix + MSG_IS_INVALID_FOR + name + MSG_COLON;
        // Ведущий `_` — слова CSS как есть, но у каждого слова позиции есть буква, поэтому слово в этой записи —
        // вторая запись (D-113): `op_right_10px_top_20px` → «Write it shorter: "opR_10px_T_20px"».
        const raw = suffix[0] === UNDERSCORE;
        const written = splitValueParts(raw ? suffix.slice(1) : suffix);
        const writtenCount = written.length;
        const words: string[] = [];
        const kinds: number[] = [];
        let part: string;
        let word: string;
        let corner: string[];
        let abbr: string;
        let j = 0;
        let long = 0;
        for (; j < writtenCount; j++) {
          part = written[j];
          if (raw) {
            if (POSITION_AXES[part]) {
              long = 1;
              written[j] = byWord[part];
              words.push(part);
              kinds.push(POSITION_AXES[part]);
              continue;
            }
          } else {
            corner = POSITION_CORNERS[part];
            if (corner && !j) {
              words.push(corner[0], corner[1]);
              kinds.push(POSITION_Y, POSITION_X);
              continue;
            }
            word = (POSITION_KEYWORDS as Record<string, string>)[part];
            if (word) {
              word = valueNormalize(word);
              words.push(word);
              kinds.push(POSITION_AXES[word]);
              continue;
            }
          }
          word = cssVarValue(part) || '';
          if (word) {
            words.push(word);
            kinds.push(POSITION_ANY);
            continue;
          }
          if (part.indexOf(OPEN_PAREN) > -1) {
            words.push(valueNormalize(part));
            kinds.push(POSITION_OFFSET);
            continue;
          }
          word = defaultUnitNormalize(part);
          if (REGEXP_LENGTH_PART.test(word)) {
            words.push(word);
            kinds.push(POSITION_OFFSET);
            continue;
          }
          word = valueNormalize(part);
          abbr = raw ? '' : byWord[word];
          if (abbr) {
            written[j] = abbr;
            throwInvalid(MSG_WRITE_SHORTER + name + written.join(UNDERSCORE) + MSG_INSTEAD_OF + name + suffix
            + MSG_SAME_VALUE);
          }
          REGEXP_BARE_WORD.test(word) || !word
            ? throwInvalid(prefix + (raw
              ? 'the "_" form takes CSS words — left, center, right, top, bottom — and lengths'
              : 'a part is a side letter, a length or a percent' + positionHint(name, j ? '' : 1)))
            : throwInvalid(prefix + 'expected a length or a percent');
        }
        long && throwInvalid(MSG_WRITE_SHORTER + name + written.join(UNDERSCORE) + MSG_INSTEAD_OF + name + suffix
          + MSG_SAME_VALUE);
        positionAssert(
          kinds, words, prefix, name, z,
        );
        style[propName] = words.join(SPACE);
        return styleWrap(style, priority);
      };
    }

    /** Буквы позиции целыми токенами: `opL (left)`, а первой частью — ещё и углы: `opTL (top left)`. */
    function positionHint(name: string, corners?: 1 | ''): string {
      const items: string[] = [];
      forIn(POSITION_KEYWORDS, (word: string, abbr: string) => {
        items.push(name + abbr + HINT_OPEN + valueNormalize(word) + CLOSE_PAREN);
      });
      corners && forIn(POSITION_CORNERS, (pair: string[], abbr: string) => {
        items.push(name + abbr + HINT_OPEN + pair.join(SPACE) + CLOSE_PAREN);
      });
      return availableHint(items);
    }

    /** Сочетание частей позиции по грамматике `<position>` (и `transform-origin` при `z`). */
    function positionAssert(
      kinds: number[], words: string[], prefix: string, name: string, z?: 1,
    ): void {
      const l = kinds.length;
      const first = kinds[0];
      const second = kinds[1];
      (z ? l < 4 : l !== 3 && l < 5) || throwInvalid(prefix + (z
        ? 'at most three parts — x, y and a z length, as "' + name + 'L_T_10"'
        : 'a position has 1, 2 or 4 parts, as "' + name + 'L_T" or "' + name + 'R_10_B_20"'));
      if (l === 4) {
        // `right 10px bottom 20px`: сторона и отступ от неё, стороны на разных осях; `center` здесь не бывает.
        positionSide(first) && positionOffset(second) && positionSide(kinds[2]) && positionOffset(kinds[3])
        && (first !== kinds[2] || first === POSITION_ANY)
        || throwInvalid(prefix + 'four parts are side_offset_side_offset with the sides on different axes, as "'
          + name + 'R_10_B_20"');
        return;
      }
      if (l < 2) {
        return;
      }
      (first !== second || first > POSITION_Y)
      || throwInvalid(prefix + 'both parts are on one axis — one is x (L, C, R), the other y (T, C, B)');
      // Два слова — в любом порядке; с длиной порядок закреплён: `top 10px` и `10px left` CSS не принимает.
      (first !== POSITION_Y || second !== POSITION_OFFSET) && (first !== POSITION_OFFSET || second !== POSITION_X)
      || throwInvalid(prefix + 'with a length the order is x, then y, as "' + name + '10_T"');
      // z — длина без процента: `transform-origin: 0 0 50%` невалиден.
      l < 3 || kinds[2] === POSITION_ANY || kinds[2] === POSITION_OFFSET && words[2].indexOf(PERCENT) < 0
      || throwInvalid(prefix + 'the third part is z — a length without percent');
    }
    /** Сторона в четырёхчастной позиции: `left`/`right`/`top`/`bottom` или переменная. */
    function positionSide(kind: number): boolean {
      return kind === POSITION_X || kind === POSITION_Y || kind === POSITION_ANY;
    }
    /** Отступ в четырёхчастной позиции: длина, процент, функция или переменная. */
    function positionOffset(kind: number): boolean {
      return kind === POSITION_OFFSET || kind === POSITION_ANY;
    }

    mn({
      tfo: positionProvider(
        'transformOrigin', 0, 1,
      ),
      pspo: positionProvider('perspectiveOrigin'),
      tfb: synonymProvider('transformBox', {
        CB: NAME_CONTENT_BOX,
        BB: NAME_BORDER_BOX,
        FB: NAME_FILL_BOX,
        SB: NAME_STROKE_BOX,
        VB: NAME_VIEW_BOX,
      }),
      bfv: synonymProvider('backfaceVisibility', {
        V: NAME_VISIBLE,
        H: NAME_HIDDEN,
      }),
    });

    /**
     * `owr` — `overflow-wrap`. Старое имя свойства, `word-wrap`, пишется опцией `overflowWrapMode` (D-106) — для
     * браузеров, что знают только его: `'legacy'` — вместо стандартного, `'both'` — оба, старое первым. Режим
     * читается при компиляции токена, как `axisMode`: `setOptions` + `recompile` переключают живой инстанс.
     */
    function overflowWrapProvider(): MnHandler {
      const standard = synonymProvider('overflowWrap', OVERFLOW_WRAP_SYNONYMS);
      const legacy = synonymProvider('wordWrap', OVERFLOW_WRAP_SYNONYMS);
      const both = synonymProvider([
        'wordWrap',
        'overflowWrap',
      ], OVERFLOW_WRAP_SYNONYMS);
      return (p) => {
        const mode = instance.options.overflowWrapMode;
        return (mode === WRAP_LEGACY ? legacy : (mode === WRAP_BOTH ? both : standard))(p);
      };
    }

    // Одиночные свойства группы F (RESEARCH/17, D-097).
    mn({
      csch: synonymProvider('colorScheme', COLOR_SCHEME_SYNONYMS),
      fca: synonymProvider('forcedColorAdjust', {
        A: NAME_AUTO,
        N: NAME_NONE,
        PPC: 'PreserveParentColor',
      }),
      hy: synonymProvider('hyphens', {
        N: NAME_NONE,
        M: 'Manual',
        A: NAME_AUTO,
      }),
      owr: overflowWrapProvider(),
      fvn: ((base: MnHandler) => (p: MnEssenceParams) => {
        // Буквы — по одной из группы и в порядке спецификации; сырой режим (`fvn_…`) бракует полные слова сам.
        p.suffix.indexOf(UNDERSCORE) > 0 && assertFontVariantNumericOrder(p.name, p.suffix);
        return base(p);
      })(synonymProvider(
        'fontVariantNumeric', FONT_VARIANT_NUMERIC_SYNONYMS, 0, 0 as any, 0 as any, 1,
      )),
      // Safari понимает только префиксное свойство, поэтому пишутся оба.
      bdb: synonymProvider([
        'WebkitBoxDecorationBreak',
        'boxDecorationBreak',
      ], {
        S: 'Slice',
        C: 'Clone',
      }),
      fsz: synonymProvider('fieldSizing', {
        F: NAME_FIXED,
        C: 'Content',
      }),
      tnb: synonymProvider('transitionBehavior', {
        N: NAME_NORMAL,
        AD: 'AllowDiscrete',
      }),
      // Функции (`atfCubicBezier\(…\)`, `atfSteps\(4\)`) проходят как есть.
      atf: synonymProvider('animationTimingFunction', TIMING_FUNCTION_SYNONYMS),
      // Буквы `atf` (D-106); приоритет выше `tn`, как у прочих полных свойств перехода.
      ttf: synonymProvider(
        'transitionTimingFunction', TIMING_FUNCTION_SYNONYMS, 1,
      ),
      bgbm: synonymProvider('backgroundBlendMode', BLEND_MODE_SYNONYMS),
      mbm: synonymProvider('mixBlendMode', MIX_BLEND_MODE_SYNONYMS),
      /**
       * Обрезка текста по числу строк: `lcl3` → `overflow:hidden`, `display:-webkit-box`,
       * `-webkit-box-orient:vertical`, `-webkit-line-clamp:3`. `lclN` снимает обрезку (`display:block`,
       * `-webkit-line-clamp:unset`). Число — целое от 1; переменная — как есть: `lcl--lines`.
       */
      lcl: (p: MnEssenceParams) => {
        const suffix = p.suffix;
        const none = suffix === N;
        const lines = none ? 'unset' : cssVarValue(suffix) || (REGEXP_LINE_COUNT.test(suffix) ? suffix
          : throwInvalid(MSG_VALUE + suffix + MSG_IS_INVALID_FOR + p.name
            + '": the number of lines is a whole number from 1, as "' + p.name + '3", or "N" to lift the clamp'));
        return styleWrap({
          overflow: none ? 'visible' : 'hidden',
          display: none ? 'block' : '-webkit-box',
          WebkitBoxOrient: none ? 'horizontal' : 'vertical',
          WebkitLineClamp: lines,
        });
      },
    });

    // Картинка отдельно от цвета (D-120): `bg3 bgi_hero\.jpg` — серый остаётся под картинкой. Одна запись на значение
    // (D-122): путь — только `_`-формой (`bgi_hero\.jpg` → `url("hero.jpg")`, {@link imagePathValue}), переменная —
    // `bgi--hero`, `none` — `bgiN`, CSS-wide keyword — словом (`bgiInherit`). Градиент пишется в `bg` / `mk`, функция в
    // токене не пишется (D-121). До D-122 проходило всё подряд: градиент становился именем файла (`bgiF00-00F` →
    // `url("F00-00F")`), `bgi10px` — `url("10px")`, `bgiUrl\(a\.png\)` — `Url(a.png)`, `bgi_url\(a\.png\)` — `url(a.png)`.
    forIn({
      bgi: [
        'backgroundImage',
        'bg',
      ],
      lisi: ['listStyleImage'],
      mki: [
        MASK_IMAGE,
        'mk',
      ],
    }, (options: string[], name: string) => {
      const propName = options[0];
      // Где пишется градиент для этого свойства — для подсказки; у `list-style-image` такого хендлера нет.
      const gradientIn = options[1];
      mn(name, (p) => {
        const s = p.suffix;
        const style: Record<string, any> = {};
        let word: string;
        if (!s) {
          return 0;
        }
        style[propName] = s === N ? NONE
          : s[0] === UNDERSCORE ? imagePathValue(s.slice(1), name)
            : cssVarValue(s)
            || (GLOBAL_KEYWORDS[word = assertNotLongForm(
              toKebabCase(s), NONE_ABBREVIATIONS, name, s,
            )] && word)
            || throwInvalid(MSG_VALUE + s + MSG_IS_INVALID_FOR + name + '": a picture is its path (`' + name
              + '_a\\.png`), a variable (`' + name + '--x`) or `' + name + 'N`' + (gradientIn
              ? '; a gradient is written in `' + gradientIn + '` (`' + gradientIn + 'F00-00F`)'
              : ''));
        return styleWrap(style, 1);
      });
    });

    // Переименовано (D-094): `lt`/`rt`/`jt` → `flL`/`flR`/`flN`, `apc` → `ap`.
    forIn({
      lt: 'flL',
      rt: 'flR',
      jt: 'flN',
    }, (replacement: string, name: string) => {
      mn(name, (p) => (p.suffix ? 0 : throwRenamed(name, replacement)));
    });
    mn('apc', (p) => throwRenamed('apc' + p.suffix, 'ap' + (APPEARANCE_RENAMED[p.suffix] || p.suffix)));
    // Переименовано (D-106): `ww` (`word-wrap` — старое имя `overflow-wrap`) → `owr`.
    mn('ww', (p) => throwRenamed(
      'ww' + p.suffix, 'owr' + (WW_RENAMED[p.suffix] || p.suffix), 'D-106',
    ));

    mn(
      'x', (p) => {
        const scale = p.s;
        const angle = p.angle;
        const z = p.z;
        return styleWrap({
          transform:
        'translate(' + (floatNormalize(p.x || ZERO) + ('' + (p.xu || PX))) + COMMA
        + (floatNormalize(p.y || ZERO) + ('' + (p.yu || PX))) + CLOSE_PAREN
        + (z ? (' translateZ('
          + floatNormalize(z) + ('' + (p.zu || PX)) + CLOSE_PAREN) : '')
        + (scale ? (' scale(' + (0.01 * floatNormalize(scale)) + CLOSE_PAREN) : '')
        + (angle ? (' rotate' + toUpper('' + p.dir)
        + OPEN_PAREN + assertAngle(
          '' + floatNormalize(angle),
          (REGEXP_ANGLE_TAIL.exec(p.suffix) as RegExpExecArray)[1],
          p.name + p.suffix,
        ) + CLOSE_PAREN) : ''),
        }); // eslint-disable-next-line
  }, '^' + PATTERN_DIGITS + ':x?(%):xu?([yY]' + PATTERN_DIGITS
    + ':y(%):yu?)?([zZ]' + PATTERN_DIGITS
    + ':z(%):zu?)?([sS]([0-9\\.]+):s)?([rR](x|y|z):dir'
    + PATTERN_DIGITS + ':angle([a-z]+):unit?)?$',
    );

    mn('spnr', (p) => {
      let v;
      // Суффикс без числа молча давал спиннер по умолчанию: `spnr_linear`, `spnrZzz` — `3000ms` (D-113, аудит).
      p.suffix && !p.value && throwInvalid(MSG_VALUE + p.suffix + MSG_IS_INVALID_FOR
        + 'spnr": expected a period in milliseconds, as "spnr2000"');
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
      AXIS_X,
      AXIS_Y,
      'z',
    ], (suffix) => {
      const prefix = 'rotate' + toUpper(suffix) + OPEN_PAREN;
      mn(R + suffix, (p) => {
        let v;
        return (v = p.value) ? styleWrap({
          transform: prefix + assertAngle(
            v, p.unit, p.name + p.suffix,
          ) + CLOSE_PAREN,
        }) : normalizeDefault(p, 180);
      });
    });

    forIn(SHADOW_HANDLERS, ([
      propName,
      handler,
    ], pfx) => {
    /**
     * Собирает ОДНУ тень из её разобранного суффикса.
     *
     * Возвращает пустую строку, когда тени нет (`bxsh` без значения или
     * `m0` — ноль повторов): вызывающий превращает это в `none`.
     */
      function shadowValue(part: string, name: string): string {
      // Вся тень одной переменной: `bxsh--shadow` → `box-shadow:var(--shadow)`.
      // У любого другого свойства `--x` означает значение целиком, и тень не
      // исключение. В позицию blur переменная ставится явно — `bxshB--blur`.
        const whole = cssVarValue(part);
        if (whole) {
          return whole;
        }
        const parsed = REGEXP_SHADOW_SUFFIX.exec(part);
        parsed || throwInvalid(DOUBLE_QUOTE + name + part + '" is only partly parsed: '
        + 'the order is blur (a number or a B-- variable), then x, y, r, m, c, in');
        const p = parsed as RegExpExecArray;
        const repeatCount = intval(
          p[MN_SHADOW_M], 1, 0,
        );
        // Значение (blur) — ведущее число или переменная; модификаторы его не
        // содержат.
        let value = p[MN_SHADOW_VALUE] || p[MN_SHADOW_BLUR_VAR];
        if (!value) {
        // Модификаторы без ведущего значения — описка: `bxshR3` раньше давало
        // мусор `Rpx` в позиции blur, а потом молча превращалось в `none`.
          part && throwInvalid(DOUBLE_QUOTE + name + part + '" has no leading value: '
          + 'blur goes first — "' + name + '19r3"');
          return '';
        }
        if (repeatCount < 1) {
          return '';
        }
        // `;` — терминатор имени переменной, как везде в нотации: без него имя
        // жадно забрало бы следующие модификаторы (`bxshB--blur;c--shadow`).
        value[0] === DASH && (value = cssVarValue(value) as string);
        const colors = getColor(p[MN_SHADOW_COLOR] || ZERO);
        // Последняя группа регулярки — `in` (inset).
        const prefixIn = p[p.length - 1] ? 'inset ' : '';
        const colorsLength = colors.length;
        // Единица склейки была жёстко `px`: `bxsh10em` давало
        // `0px 0px 10px 0px #000` — единица молча терялась. Модификаторы x/y/r
        // по грамматике суффикса — целые без единицы, поэтому единица у записи
        // одна на все её длины.
        const unit = p[MN_SHADOW_UNIT] || PX;
        const output = new Array(colorsLength);
      let sample, v, color, i, ci = 0; // eslint-disable-line
        for (;ci < colorsLength; ci++) {
          color = colors[ci];
          sample = prefixIn
          + shadowJoin(handler(
            p[MN_SHADOW_X] || 0, p[MN_SHADOW_Y] || 0,
            value, p[MN_SHADOW_R] || 0, color,
          ),
          unit);
          v = new Array(repeatCount);
          for (i = repeatCount; i--;) {
            v[i] = sample;
          }
          output[ci] = v.join(COMMA);
        }
        return output.join(COMMA);
      }

      mn(pfx, (p) => {
        const suffix = p.suffix;
        const style: Record<string, any> = {};
        // «Тени нет» — `bxshN` (наравне с голым `bxsh`); `bxshNone`, `bxsh_none` бракуются (D-113).
        if (suffix === N) {
          style[propName] = NONE;
          return styleWrap(style);
        }
        assertNotLongForm(
          snakeLeftTrim(suffix).toLowerCase(), NONE_ABBREVIATIONS, pfx, suffix,
        );
        // Несколько РАЗНЫХ теней — через запятую. Модификатор `m` повторяет одну
        // и ту же, а сырой режим на списке ломался: запятая уходила внутрь
        // `var(…)` и давала `var(--shadow,0) 1px 2px var(--shadow2)`.
        const parts = splitTopLevel(suffix);
        const l = parts.length;
        const out: string[] = new Array(l);
        let i = 0;
        let one: string;
        for (; i < l; i++) {
          one = shadowValue(parts[i], p.name);
          if (!one) {
            style[propName] = NONE;
            return styleWrap(style);
          }
          out[i] = one;
        }
        style[propName] = out.join(COMMA);
        return styleWrap(style);
      });
    });


    mn(
      R, (p) => {
        const v = getVal(
          p.suffix || 10000, 1, 0, PX, 1,
        );
        return styleWrap({
          borderRadius: v[0],
        }, v[1]);
      }, '', 1,
    );


    // border-radius by corners; логические углы и пары углов `rs`/`re` (A2, D-097) — `border-<блок>-<строка>-radius`
    forIn({
      lt: ['top-left'],
      lb: ['bottom-left'],
      rt: ['top-right'],
      rb: ['bottom-right'],
      ss: ['start-start'],
      se: ['start-end'],
      es: ['end-start'],
      ee: ['end-end'],
      // `rs` — оба угла начала строки, `re` — оба угла её конца (Tailwind `rounded-s` / `rounded-e`).
      s: [
        'start-start',
        'end-start',
      ],
      e: [
        'start-end',
        'end-end',
      ],
    }, (corners, suffix) => {
      const length = corners.length;
      const propNames = corners.map((corner) => BORDER + DASH + corner + '-radius');
      // Угол (2) позже пары углов (1): `rs8 rss0` — угол перекрывает пару.
      const priority = 3 - length;
      mn(
        R + suffix, (p) => {
          const value = getVal(
            p.suffix || 10000, 1, 1, PX, 1,
          )[0];
          const style: Record<string, any> = {};
          let i = 0;
          for (; i < length; i++) {
            style[propNames[i]] = value;
          }
          return styleWrap(style, priority);
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
          I: NAME_INHERIT,
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
          TN: NAME_THIN,
          M: NAME_MEDIUM,
          TC: NAME_THICK,
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
          U: NAME_UNSET,
          N: NAME_NORMAL,
        },
      ],
      ggc: [
        'gridColumnGap',
        0,
        2,
        1,
        {
          U: NAME_UNSET,
          R: NAME_REVERT,
          N: NAME_NORMAL,
        },
      ],
      ggr: [
        'gridRowGap',
        0,
        2,
        1,
        {
          U: NAME_UNSET,
          R: NAME_REVERT,
          N: NAME_NORMAL,
        },
      ],
    }, (options: any[], pfx: string) => {
      const [
        propName,
        defaultValue,
      ] = options;
      const priority = options[2] || 0;
      const one = options[3];
      const synonyms = options[4] || {};
      const noPercent = options[5];
      // Допустимые слова выводятся из значений самого словаря: если хендлер
      // объявил `N: 'Normal'`, то `normal` — слово этого свойства, и пишется оно
      // буквой (`ggcN`; `ggcNormal` бракуется, D-113). Отдельная таблица здесь
      // не нужна — словарь уже задан на свойство, а не на семейство.
      const keywords: Record<string, 1> = {};
      forIn(synonyms, (word: string) => {
        keywords[toKebabCase(word)] = 1;
      });
      mn(pfx, (p) => {
        const v = getVal(
          p.suffix || defaultValue,
          1, one, PX, 0, synonyms, keywords, noPercent, p.name,
        );
        const style: Record<string, any> = {};
        style[propName] = v[0];
        return styleWrap(style, priority + v[1]);
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
          '': NAME_HIDDEN,
          V: NAME_VISIBLE,
          H: NAME_HIDDEN,
          S: 'Scroll',
          A: NAME_AUTO,
          // `clip` — как `hidden`, но без создания scroll-контейнера.
          C: 'Clip',
        // `composite`: две оси в одном значении — `overflow: hidden auto`.
        }, priority, 0 as any, 0 as any, 1,
      );

      mn('ov' + suffix, function (this: unknown) {
      // `arguments` вместо rest — §6.1: хендлер зовётся на каждый токен.
      // Приведение нужно только для `apply` в строгом режиме.
      // eslint-disable-next-line
      const essence = handle.apply(this, arguments as unknown as [MnEssenceParams]);
        if (essence) {
          const s = essence.style;
          const v = s && s[propName];
          if (v === 'scroll' || v === AUTO) {
            essence.exts = ['ovscT'];
          }
        }
        return essence;
      });
    });

    mn(POS, (p) => {
      const s = p.suffix;
      // Перечень у `position` закрыт, поэтому значение — буква или ошибка:
      // `pos10` давало `position:10`, `posZzz` — `position:zzz`, `posAbsolute`
      // и `pos_absolute` — вторые записи `posA` (D-113). Голый `pos` — `relative`.
      const v = s ? assertEnumValue(
        lettersValue(
          p, POSITION_SYNONYMS, ENUM_KEYWORDS.position,
        ), ENUM_KEYWORDS.position, 0, POS, s, POSITION_SYNONYMS,
      ) : RELATIVE;
      return styleWrap({
        position: v,
      }, POSITION_PRIORITIES[v] || 0);
    });

    mn({
      cfx: {
        exts: ['posS'],
        childs: {
          pale: {
            selectors: [
              ':before',
              ':after',
            ],
            style: {
              content: '" "',
              clear: 'both',
              display: 'table',
            },
          },
        },
      },

      // background: (...)
      bg: backgroundProvider(
        'background', undefined, 'bgi',
      ),

      // font-weight
      fw: (p) => {
        const camel = p.camel;
        // `fw6` → 600 (цифра-сокращение) и `fw600` → 600 (значение CSS как есть).
        // До 2026-09-22 второе молча давало 900: число всегда умножалось на 100
        // и зажималось в 1..9, то есть самая естественная запись была неверной.
        const num = p.num;
        return p.negative ? 0 : styleWrap({
          fontWeight: camel
          // Слово не проверялось: `fwZzz` давало `font-weight:zzz`, `fwA` —
          // `font-weight:a`, `fwF00` — `font-weight:f`. Список закрытый,
          // выводится из того же словаря кратких записей; слово пишется буквой
          // (`fwB`, а `fwBold` бракуется, D-113).
            ? assertKnownWord(
              toKebabCase(FONT_WEIGHT_SYNONYMS[camel] || camel), camel, FONT_WEIGHT_SYNONYMS,
              FONT_WEIGHT_KEYWORDS, p.name, p.suffix,
            )
          // `num` приходит из разбора строкой; сравнение и деление ведём
          // числом явно, а не полагаясь на приведение оператором.
            : (+(num as string) >= 100
              ? 100 * intval(
                +(num as string) / 100, 1, 1, 9,
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
        whiteSpace: NORMAL,
        wordBreak: 'break-word',
      }),
      z: (p) => {
        let num;
        // `z-index` — целое число или `auto`. Дробь давала `z-index:1.5`,
        // правило, которое браузер отбрасывает целиком.
        return p.camel ? 0 : ((num = p.num) ? (
          REGEXP_INTEGER.test(num) || throwInvalid(MSG_VALUE + p.suffix
          + '" is invalid: z-index is an integer'),
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
            // `p.num` — группа регулярки, то есть строка. Раньше здесь шла
            // арифметика прямо по ней (`num * 0.01`) и работала на неявном
            // приведении; `+num` делает то же самое, но видимо.
          }) : ((num = p.num) ? styleWrap({
            opacity: (+num > 0 && +num < 1) ? toFixed(+num) : toFixed(+num * 0.01),
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
              lineHeight: num == ZERO ? num : (unit ? num + unit : num),
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
          // По грамматике это `none | auto | <percentage>`: единица по
          // умолчанию `%`, любая другая недопустима. Было `px`, поэтому
          // `tsa10` давало `text-size-adjust:10px`, `tsa10px` проходило, а
          // `tsa0` давало `text-size-adjust:0` — ноль там тоже невалиден.
            textSizeAdjust: (assertPercentOnly(p),
            lengthOrWord(
              p, TEXT_SIZE_ADJUST_KEYWORDS, LENGTH_PERCENT,
              PERCENT, TEXT_SIZE_ADJUST_SYNONYMS,
            )),
          }) : normalizeDefault(p, HUNDRED_PERCENT))
        );
      },
      fsa: (p) => {
        let v;
        return p.negative ? 0 : (
          (v = cssVarValue(p.suffix || '')) ? styleWrap({
            fontSizeAdjust: v,
          }) : (p.value ? styleWrap({
          // Значение безразмерное (`font-size-adjust:0.5`): единицы по
          // умолчанию нет, и явная тоже недопустима — `fsa10px` давало
          // `font-size-adjust:10px`. Слова — буквами: `fsaN`, `fsaFF`.
            fontSizeAdjust: (p.unit && throwInvalid(MSG_VALUE + p.suffix
            + '" is invalid: font-size-adjust is a unitless number'),
            lengthOrWord(
              p, FONT_SIZE_ADJUST_KEYWORDS, 0, '', FONT_SIZE_ADJUST_SYNONYMS,
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
            p, EMPTY_KEYWORDS, 0, PX,
          ),
        }) : normalizeDefault(p));
      },

      of: synonymProvider('objectFit', {
        '': NAME_COVER,
        F: NAME_FILL,
        CT: NAME_CONTAIN,
        CV: NAME_COVER,
        N: NAME_NONE,
        SD: 'ScaleDown',
      }),

      d: synonymProvider(
        'display', {
          '': NAME_BLOCK,
          B: NAME_BLOCK,
          N: NAME_NONE,
          F: 'Flex',
          IF: 'InlineFlex',
          I: NAME_INLINE,
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
          // `composite`: внешний и внутренний тип разом
          // (`display: inline flow-root`).
        }, 0, 0 as any, 0 as any, 1,
      ),

      dir: synonymProvider('direction', {
        LTR: 'Ltr',
        RTL: 'Rtl',
        I: NAME_INHERIT,
        R: NAME_REVERT,
        RL: NAME_REVERT_LAYER,
        U: NAME_UNSET,
      }),

      // `composite`: берёт два значения — по оси X и Y
      // (`overscroll-behavior: contain auto`).
      ovb: synonymProvider(
        'overscrollBehavior', OVERSCROLL_BEHAVIOR_PRIORITIES, 0, 0 as any, 0 as any, 1,
      ),
      ovbx: synonymProvider('overscrollBehaviorX', OVERSCROLL_BEHAVIOR_PRIORITIES),
      ovby: synonymProvider('overscrollBehaviorY', OVERSCROLL_BEHAVIOR_PRIORITIES),

      // Группа B (RESEARCH/17): привязка прокрутки и полоса прокрутки. Пары
      // значений перечислены словарём (`sstX_M`, `ssaC_S`), поэтому сырой
      // режим этим свойствам не нужен.
      sst: synonymProvider('scrollSnapType', SCROLL_SNAP_TYPE_SYNONYMS),
      ssa: synonymProvider('scrollSnapAlign', SCROLL_SNAP_ALIGN_SYNONYMS),
      sss: synonymProvider('scrollSnapStop', {
        N: NAME_NORMAL,
        A: NAME_ALWAYS,
      }),
      sbw: synonymProvider('scrollbarWidth', {
        A: NAME_AUTO,
        T: NAME_THIN,
        N: NAME_NONE,
      }),
      sbg: synonymProvider('scrollbarGutter', {
        A: NAME_AUTO,
        S: 'Stable',
        SB: 'Stable_BothEdges',
      }),

      // Маски (E2, D-097): семейство `mk…` зеркалит `bg…` — `mk` градиент, `mki` url, `mks`, `mkr`, `mko`, `mkcp`.
      mkt: synonymProvider('maskType', {
        L: 'Luminance',
        A: 'Alpha',
        I: NAME_INHERIT,
        R: NAME_REVERT,
        RL: NAME_REVERT_LAYER,
        U: NAME_UNSET,
      }),

      mkm: synonymProvider('maskMode', {
        L: 'Luminance',
        A: 'Alpha',
        I: NAME_INHERIT,
        R: NAME_REVERT,
        RL: NAME_REVERT_LAYER,
        U: NAME_UNSET,
        MS: 'MatchSource',
      }),

      mk: backgroundProvider(
        MASK_IMAGE, 1, 'mki',
      ),
      mks: synonymProvider(
        'maskSize', {
          A: NAME_AUTO,
          CT: NAME_CONTAIN,
          CV: NAME_COVER,
        }, 1, 0 as any, SIZE_LENGTHS, 1,
      ),
      mkr: synonymProvider(
        'maskRepeat', REPEAT_SYNONYMS, 1,
      ),
      mko: synonymProvider(
        'maskOrigin', MASK_BOX_SYNONYMS, 1,
      ),
      mkcp: synonymProvider(
        'maskClip', {
          ...MASK_BOX_SYNONYMS,
          NC: 'NoClip',
        }, 1,
      ),
      mkc: synonymProvider('maskComposite', {
        A: 'Add',
        S: 'Subtract',
        I: 'Intersect',
        E: 'Exclude',
      }),

      // `float` (D-094): `flL`, `flR`, `flN`, логические `flIS`, `flIE`.
      fl: synonymProvider('float', {
        L: NAME_LEFT,
        R: NAME_RIGHT,
        N: NAME_NONE,
        IS: 'InlineStart',
        IE: 'InlineEnd',
      }),
      cl: synonymProvider('clear', {
        '': NAME_BOTH,
        B: NAME_BOTH,
        N: NAME_NONE,
        L: NAME_LEFT,
        R: NAME_RIGHT,
        IS: 'InlineStart',
        IE: 'InlineEnd',
      }),
      v: synonymProvider('visibility', {
        '': NAME_HIDDEN,
        V: NAME_VISIBLE,
        H: NAME_HIDDEN,
        C: NAME_COLLAPSE,
      }),
      ovs: synonymProvider('overflowStyle', {
        '': 'Scrollbar',
        S: 'Scrollbar',
        A: NAME_AUTO,
        P: 'Panner',
        M: 'Move',
        MQ: 'Marquee',
      }),
      ovsc: synonymProvider('-webkitOverflowScrolling', {
        '': 'Touch',
        A: NAME_AUTO,
        T: 'Touch',
      }),
      cp: synonymProvider('clip', {
        A: NAME_AUTO,
        R: 'Rect\\(top_right_bottom_left\\)',
      }),
      rsz: synonymProvider('resize', {
        '': NAME_NONE,
        N: NAME_NONE,
        B: NAME_BOTH,
        H: 'Horizontal',
        V: 'Vertical',
        // Логические оси: `BL`, а не `B` — та уже занята `both`.
        BL: NAME_BLOCK,
        IL: NAME_INLINE,
      }),
      /**
     * `cursor`. Однобуквенные заняты исторически (`C` — crosshair, `P` — pointer,
     * `A` — auto), поэтому добавленные 2026-09-24 значения берут по две буквы.
     * Курсоры изменения размера — направление + `R`: `crER` (e-resize),
     * `crNWR` (nw-resize), `crNSR` (ns-resize).
     */
      cr: synonymProvider('cursor', {
        '': 'Pointer',
        A: NAME_AUTO,
        D: 'Default',
        C: 'Crosshair',
        HA: 'Hand',
        HE: 'Help',
        M: 'Move',
        P: 'Pointer',
        T: NAME_TEXT,
        N: NAME_NONE,
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
        '': NAME_CENTER,
        ...JUSTIFY_CONTENT_WORDS,
      }),
      ai: synonymProvider('alignItems', {
        '': NAME_CENTER,
        ...ALIGN_ITEMS_WORDS,
      }),
      bxz: synonymProvider('boxSizing', {
        '': NAME_BORDER_BOX,
        BB: NAME_BORDER_BOX,
        CB: NAME_CONTENT_BOX,
      }),
      fs: synonymProvider(
        'fontStyle', {
          '': 'Italic',
          N: NAME_NORMAL,
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
          N: NAME_NORMAL,
          NO: NAME_NONE,
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
          N: NAME_NONE,
          EG: 'Engrave',
          EB: 'Emboss',
          O: 'Outline',
        }, 1,
      ),
      fsm: synonymProvider(
        'fontSmooth', {
          A: NAME_AUTO,
          N: 'Never',
          AW: NAME_ALWAYS,
          // Абсолютные размеры — порог, ниже которого сглаживание отключается.
          XXS: 'XxSmall',
          XS: 'XSmall',
          S: 'Small',
          M: NAME_MEDIUM,
          L: 'Large',
          XL: 'XLarge',
          XXL: 'XxLarge',
          XXXL: 'XxxLarge',
        }, 1,
      ),
      fst: synonymProvider(
        'fontStretch', {
          N: NAME_NORMAL,
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
      tcha: synonymProvider(
        'touchAction', {
          A: NAME_AUTO,
          N: NAME_NONE,
          M: 'Manipulation',
          I: 'Initial',
          R: NAME_REVERT,
          U: NAME_UNSET,
          RL: NAME_REVERT_LAYER,
          PX: 'PanX',
          PY: 'PanY',
          PL: 'PanLeft',
          PR: 'PanRight',
          PU: 'PanUp',
          PD: 'PanDown',
          PZ: 'PinchZoom',
          // `composite`: оси комбинируются (`touch-action: pan-x pan-y`).
        }, 0, 0 as any, 0 as any, 1,
      ),
      ta: synonymProvider('textAlign', {
        L: NAME_LEFT,
        C: NAME_CENTER,
        R: NAME_RIGHT,
        J: 'Justify',
        E: NAME_END,
        S: NAME_START,
        MP: 'MatchParent',
      }),
      tal: synonymProvider(
        'textAlignLast', {
          A: NAME_AUTO,
          L: NAME_LEFT,
          C: NAME_CENTER,
          R: NAME_RIGHT,
          J: 'Justify',
          E: NAME_END,
          S: NAME_START,
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
          S: NAME_SOLID,
          DB: NAME_DOUBLE,
          DT: NAME_DOTTED,
          DS: NAME_DASHED,
          W: 'Wavy',
          A: NAME_AUTO,
          FF: 'FromFont',
          // `numeric`: толщина линии — длина (`text-decoration: underline 2px`).
          // `composite`: линия, стиль, цвет и толщина в одном значении
          // (`text-decoration: underline wavy red`).
        }, 0, 0 as any, OFFSET_LENGTH, 1,
      ),
      tdl: synonymProvider(
        'textDecorationLine', TD_SYNONYMS, 1,
      ),
      tj: synonymProvider(
        'textJustify', {
          A: NAME_AUTO,
          N: NAME_NONE,
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
      // `composite`: значение задаётся для начала и конца строки отдельно.
      tov: synonymProvider(
        'textOverflow', {
          '': 'Ellipsis',
          C: 'Clip',
          E: 'Ellipsis',
        }, 0, 0 as any, 0 as any, 1,
      ),
      tt: synonymProvider('textTransform', {
        '': 'Uppercase',
        N: NAME_NONE,
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
        W: NAME_WRAP,
        NW: NAME_NOWRAP,
        B: 'Balance',
        P: 'Pretty',
        S: 'Stable',
        A: NAME_AUTO,
      }),
      /**
     * `letter-spacing`. Голое число получает `px` (`lts2` → `2px`), как и остальные
     * размеры в нотации; единицы указываются явно (`lts0.06em`). До 2026-09-22
     * значение выводилось без единицы (`lts1.5` → `letter-spacing:1.5`) — невалидный CSS,
     * который браузер отбрасывал.
     */
      lts: (p) => {
        let v;
        return (v = cssVarValue(p.suffix || '')) ? styleWrap({
          letterSpacing: v,
        }) : (
          (p.camel || p.num != null) ? styleWrap({
            letterSpacing: lengthOrWord(
              p, LETTER_SPACING_KEYWORDS, LENGTH_PERCENT, PX, GAP_SYNONYMS,
            ),
          }) : 0
        );
      },
      // Контейнер для запросов `@…:имя` (D-088): имя — как записано, как и в запросе (D-091): `cnMainNav` →
      // `container-name: MainNav`, `cn_main-nav` → `main-nav`, несколько — через `_` (`cn_side_main`), `cn--c` —
      // переменная.
      cn: (p) => {
        const names = p.suffix ? containerNames(p.suffix) : '';
        return !names ? 0 : REGEXP_CONTAINER_NAMES.test(names) ? styleWrap({
          containerName: names,
        }) : throwInvalid(DOUBLE_QUOTE + names + '" is not a container name: expected CSS identifiers written as they are'
          + ' (cnSidebar, cn_main-nav, cn_side_main) or a variable');
      },
      // `ctIS` → `container-type: inline-size`; размер по обеим осям — `ctS`.
      ct: synonymProvider('containerType', {
        IS: 'InlineSize',
        S: 'Size',
        N: NAME_NORMAL,
      }),
      ws: synonymProvider('whiteSpace', {
        '': NAME_NOWRAP,
        N: NAME_NORMAL,
        P: 'Pre',
        NW: NAME_NOWRAP,
        PW: 'PreWrap',
        PL: 'PreLine',
        BS: 'BreakSpaces',
        // CSS Text 4: `white-space` стал шорткатом над `white-space-collapse`
        // и `text-wrap`. `P` уже занято `pre`, поэтому `preserve` — `PR`.
        C: NAME_COLLAPSE,
        PR: 'Preserve',
        PRB: 'PreserveBreaks',
        PRS: 'PreserveSpaces',
        W: NAME_WRAP,
      }),
      /**
     * `white-space-collapse`. Карта пересобрана 2026-09-24: прежние
     * `N`/`K`/`L`/`BS`/`BA` (`normal`/`keep-all`/`loose`/`break-strict`/`break-all`)
     * — значения `word-break`/`line-break`, к этому свойству не относящиеся;
     * НИ ОДНО из них не валидно, то есть любой токен `wsc*` давал CSS, молча
     * отбрасываемый браузером.
     */
      wsc: synonymProvider('whiteSpaceCollapse', {
        C: NAME_COLLAPSE,
        P: 'Preserve',
        PB: 'PreserveBreaks',
        PS: 'PreserveSpaces',
        BS: 'BreakSpaces',
      }),
      wb: synonymProvider('wordBreak', {
        N: NAME_NORMAL,
        K: 'KeepAll',
        BA: 'BreakAll',
        BW: NAME_BREAK_WORD,
        AP: 'AutoPhrase',
      }),
      bgr: synonymProvider(
        'backgroundRepeat', REPEAT_SYNONYMS, 1,
      ),
      bga: synonymProvider(
        'backgroundAttachment', {
          F: NAME_FIXED,
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
          '': NAME_PADDING_BOX,
          BB: NAME_BORDER_BOX,
          PB: NAME_PADDING_BOX,
          CB: NAME_CONTENT_BOX,
          NC: 'NoClip',
          T: NAME_TEXT,
          BA: 'BorderArea',
        }, 1,
      ),
      bgo: synonymProvider(
        'backgroundOrigin', {
          BB: NAME_BORDER_BOX,
          PB: NAME_PADDING_BOX,
          CB: NAME_CONTENT_BOX,
        }, 1,
      ),
      // `numeric` + `composite`: размер задаётся длинами или процентами, и их
      // может быть два — ширина и высота (`background-size: 100% .16em`).
      bgs: synonymProvider(
        'backgroundSize', {
          A: NAME_AUTO,
          CT: NAME_CONTAIN,
          CV: NAME_COVER,
        }, 1, 0 as any, SIZE_LENGTHS, 1,
      ),
      // `composite`: кавычки задаются парами — открывающая и закрывающая, и
      // пар может быть несколько (для вложенных уровней).
      q: synonymProvider(
        'quotes', {
          A: NAME_AUTO,
          N: NAME_NONE,
          RU: '\'\\00AB\'_\'\\00BB\'_\'\\201E\'_\'\\201C\'',
          EN: '\'\\201C\'_\'\\201D\'_\'\\2018\'_\'\\2019\'',
        }, 1, 0 as any, 0 as any, 1,
      ),
      ols: synonymProvider(
        'outlineStyle', OUTLINE_STYLE_SYNONYMS, 1,
      ),
      cps: synonymProvider('captionSide', {
        T: NAME_TOP,
        B: NAME_BOTTOM,
        L: NAME_LEFT,
        R: NAME_RIGHT,
        TO: 'TopOutside',
        BO: 'BottomOutside',
      }),
      ec: synonymProvider('emptyCells', {
        S: 'Show',
        H: 'Hide',
        U: NAME_UNSET,
      }),
      bdcl: synonymProvider(
        'borderCollapse', {
          C: NAME_COLLAPSE,
          S: 'Separate',
        }, 1,
      ),
      lis: synonymProvider(
        'listStyle', {
          N: NAME_NONE,
          S: 'Square',
          D: 'Disc',
          DC: 'Decimal',
          DCLZ: 'DecimalLeadingZero',
          LR: 'LowerRoman',
          UR: 'UpperRoman',
          C: 'Circle',
          I: 'Inside',
          O: 'Outside',
          // `composite`: тип, позиция и картинка в одном значении
          // (`list-style: disc inside`).
        }, 0, 0 as any, 0 as any, 1,
      ),
      lisp: synonymProvider(
        'listStylePosition', {
          I: 'Inside',
          O: 'Outside',
        }, 1,
      ),
      list: synonymProvider(
        'listStyleType', {
          N: NAME_NONE,
          S: 'Square',
          D: 'Disc',
          DC: 'Decimal',
          DCLZ: 'DecimalLeadingZero',
          LR: 'LowerRoman',
          UR: 'UpperRoman',
          C: 'Circle',
        }, 1,
      ),
      pgbb: synonymProvider([
        'pageBreakBefore',
        'breakBefore',
      ], BREAK_AFTER_SYNONYMS),
      pgba: synonymProvider([
        'pageBreakAfter',
        'breakAfter',
      ], BREAK_AFTER_SYNONYMS),
      pgbi: synonymProvider([
        'pageBreakInside',
        'breakInside',
      ], {
        A: NAME_AUTO,
        AV: 'Avoid',
        AVP: 'AvoidPage',
        AVC: 'AvoidColumn',
        AVRN: 'AvoidRegion',
      }),
      us: synonymProvider('userSelect', {
        A: NAME_AUTO,
        N: NAME_NONE,
        T: NAME_TEXT,
        C: NAME_CONTAIN,
        E: 'Element',
        // `A` занято `auto`, поэтому `all` — `AL`.
        AL: 'All',
      }),
      pe: synonymProvider('pointerEvents', {
        A: NAME_AUTO,
        N: NAME_NONE,
        V: NAME_VISIBLE,
        VP: '_visiblePainted',
        VF: '_visibleFill',
        VS: '_visibleStroke',
        P: 'Painted',
        F: NAME_FILL,
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
      // `composite`: две координаты в одном значении
      // (`object-position: left top`). Атомарных `object-position-x/y` в CSS нет,
      // поэтому разложить его, как `bgpx`/`bgpy`, нельзя.
      // `numeric`: координаты задаются и числами — `op50%_50%`.
      op: positionProvider('objectPosition', 1),
      // `mask-position-x/y` в CSS нет (только с `-webkit-`), поэтому позиция маски — общим разбором, как у `op`.
      mkp: positionProvider('maskPosition', 1),
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
          L: NAME_LEFT,
          C: NAME_CENTER,
          R: NAME_RIGHT,
          XS: 'XStart',
          XE: 'XEnd',
        }, 2, 0 as any, OFFSET_LENGTH,
      ),
      bgpy: synonymProvider(
        'backgroundPositionY', {
          T: NAME_TOP,
          C: NAME_CENTER,
          B: NAME_BOTTOM,
          YS: 'YStart',
          YE: 'YEnd',
        }, 2, 0 as any, OFFSET_LENGTH,
      ),
      as: synonymProvider('alignSelf', ALIGN_SELF_WORDS),
      /**
     * `justify-self` / `justify-items` — grid-раскладка. Буквы `S`/`ST`/`E`/`C`/`N`/`B`
     * согласованы с `jc`/`ai`/`as`/`ac`; `L`/`R` — как у `jc`, `justify-items`
     * и `justify-self` их тоже принимают (унаследовано от `text-align`).
     */
      js: synonymProvider('justifySelf', JUSTIFY_SELF_WORDS),
      ji: synonymProvider('justifyItems', JUSTIFY_ITEMS_WORDS),
      ac: synonymProvider('alignContent', ALIGN_CONTENT_WORDS),
      va: synonymProvider(
        'verticalAlign', {
          SUP: 'Super',
          // `S` свободна: `super` исторически занял `SUP`, а не `S`.
          S: 'Sub',
          SUB: 'Sub',
          T: NAME_TOP,
          TT: 'TextTop',
          M: 'Middle',
          BL: NAME_BASELINE,
          B: NAME_BOTTOM,
          TB: 'TextBottom',
          // `numeric`: сдвиг базовой линии задаётся длиной или процентом
          // (`vertical-align: -0.125em`).
        }, 0, 0 as any, OFFSET_LENGTH,
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
          U: NAME_UNSET,
        }, 1,
      ),
      fxw: synonymProvider(
        'flexWrap', {
          NW: NAME_NOWRAP,
          W: NAME_WRAP,
          WR: 'WrapReverse',
        }, 1,
      ),
      /**
     * `font` — только то, что не выражается атомарно.
     *
     * Shorthand принимает либо системный шрифт одним словом, либо набор из
     * размера, высоты строки и семейства. Второе выражается атомарными
     * `f`/`lh`/`ff` — `font16px/1.55_--font` это `f16 lh1.55 ff--font`, то есть
     * второй способ записать то же самое. По решению от 2026-09-26 (то же, что
     * сняло общий `ol`) составная форма убрана, и хендлер сужен до слов.
     *
     * Убрать его целиком нельзя: `font: inherit` наследует разом семь свойств
     * (family, size, line-height, weight, style, variant, stretch), и пяти
     * атомарных тегов на это не хватает — `font-variant` и `font-stretch` у
     * нотации отдельных тегов не имеют. Той же природы системные шрифты:
     * `font: menu` задаёт весь набор сразу.
     */
      font: (p) => {
        let s, v;
        if (!(s = p.suffix)) {
          return 0;
        }
        if (v = FONT_SYNONYMS[s]) {
          return styleWrap({
            font: v,
          });
        }
        v = valueNormalize(s);
        // Пробел в значении означает составную форму (`16px/1.55 var(--font)`) —
        // её и убираем, даже когда внутри есть подстановка. Целиком подстановка
        // (`font--v`) проходит: что в переменной, здесь не видно.
        v.indexOf(SPACE) > -1 && throwInvalid(MSG_VALUE + s + '" is invalid: '
        + 'size, line height and family are set by atomic tokens — '
        + '"f16 lh1.55 ff--font"; "font" only takes system fonts');
        return styleWrap({
          font: v.indexOf(OPEN_PAREN) > -1
            ? v
            // Слово — буквой: `fontMenu` → «Write it shorter: "fontM"» (D-113).
            : assertKnownWord(
              v, s, FONT_SYNONYMS, FONT_KEYWORDS, p.name, s,
            ),
        });
      },
      /**
     * `transition` — слоты в фиксированном порядке
     * `свойство длительность плавность задержка`, несколько переходов через
     * запятую.
     *
     * Атомарные `tp`/`dn`/`ttf`/`delay` покрывают одиночный переход целиком,
     * но задать РАЗНЫЕ параметры разным свойствам ими нельзя — они пишут по
     * одному значению на все сразу. Ради этого случая shorthand и остаётся.
     */
      // `an_fade_0.2s_EO_0.3s_both` → `animation:fade 0.2s ease-out 0.3s both` (плавность — буквами, D-111);
      // ключевые кадры — из пресета (`mn.setKeyframes`). Несколько анимаций — через `,`.
      an: (p) => {
        let s, i;
        if (!(s = p.suffix)) {
          return 0;
        }
        if (s === N) {
          return styleWrap({
            animation: NONE,
          });
        }
        // `anNone`, `an_none` — вторые записи `anN` (D-113).
        const list = splitTopLevel(assertNotLongForm(
          valueNormalize(s), NONE_ABBREVIATIONS, p.name, s,
        ));
        const l = list.length;
        const out: string[] = new Array(l);
        let parts: string[];
        let named: [string, Record<string, Record<string, string>>] | undefined;
        for (i = 0; i < l; i++) {
          parts = list[i].trim().split(SPACE);
          out[i] = animationValue(parts, s);
          if (named = NAMED_ANIMATIONS[parts[0]]) {
            setKeyframes(
              parts[0], named[1], 1,
            );
            parts.length < 2 && (out[i] += SPACE + named[0]);
          }
        }
        return styleWrap({
          animation: out.join(COMMA),
        });
      },
      tn: (p) => {
        let s, i;
        if (!(s = p.suffix)) {
          return 0;
        }
        // `tnN` — `transition:none`, как `tpN` и `anN` (D-111); длинная запись — с подсказкой (D-015).
        if (s === N) {
          return styleWrap({
            transition: NONE,
          });
        }
        const value = assertNotLongForm(
          valueNormalize(s), NONE_ABBREVIATIONS, p.name, s,
        );
        // `,` разделяет переходы, пробел — части одного перехода. Запятые
        // внутри скобок (`cubic-bezier(0,0,1,1)`) разделителем не считаются.
        const list = splitTopLevel(value);
        const l = list.length;
        let out: string[] = [];
        for (i = 0; i < l; i++) {
          out = out.concat(transitionValue(list[i].trim().split(SPACE), s));
        }
        return styleWrap({
          transition: out.join(COMMA),
        });
      },
      ff: (p) => {
        let s, v;
        if (!(s = p.suffix)) {
          return 0;
        }
        if (v = cssVarValue(s)) {
          return styleWrap({
            fontFamily: v,
          }, 1);
        }
        // Имя шрифта — идентификатор или строка; число и длина им быть не могут
        // (`ff10px` давало `font-family:10px`).
        const list = map(fontNameNormalize(s).split(REGEXP_COMMA), __wr);
        assertFontNames(list, s);
        return styleWrap({
          fontFamily: list.join(COMMA),
        }, 1);
      },
      /**
     * `content`. Ведущий `_` означает «дальше текст» и **сам ставит кавычки**:
     * `cnt_Hello_World` → `content:"Hello World"`. Без него значение обязано
     * быть ключевым словом свойства.
     *
     * До 2026-09-26 кавычки писал автор (`cnt_"Hello_World"`), а их отсутствие
     * никто не проверял: `cntHello` давало `content:hello`, `cnt_two_words` —
     * `content:two words`. По грамматике текст в `content` без кавычек
     * невалиден, и браузер такое правило отбрасывает.
     *
     * **Кавычка внутри текста экранируется**, а не служит признаком «автор
     * управляет сам»: `content: a "b" c` по грамматике невалиден, то есть
     * первая версия этой проверки оставляла дыру ровно там, где её закрывала.
     * `cnt_he_said_"hi"` → `content:"he said \"hi\""`.
     *
     * Не оборачиваются два случая: значение целиком вызов функции
     * (`cnt_attr\(href\)`) и подстановка (`cnt--v`).
     */
      cnt: (p) => {
        let s, v;
        if (!(s = p.suffix)) {
          return styleWrap({
            content: NONE,
          });
        }
        // Краткие записи разбираются до общего пути: `cntE` — пустая строка,
        // и кебабить её нечего.
        if (v = CONTENT_SYNONYMS[s]) {
          return styleWrap({
            content: v,
          });
        }
        v = valueNormalize(s);
        return styleWrap({
          content: s[0] === UNDERSCORE
          // Текста после `_` нет — пустая строка. Суффикс из НЕСКОЛЬКИХ
          // подчёркиваний бракуется: пробел пишется мнемоникой `cntS`, и
          // двух записей одного значения быть не должно.
            ? (v
              ? (v.indexOf(OPEN_PAREN) > -1 ? v : DOUBLE_QUOTE + quoteEscape(v) + DOUBLE_QUOTE)
              : (s.length > 1 && throwInvalid(MSG_VALUE + s
              + '" is invalid: a space is written as "cntS", an empty string as "cnt_"'),
              '""'))
            : (v.indexOf(OPEN_PAREN) > -1
              ? v
              // Слово с буквой полной записью бракуется: `cntNone` → `cntN` (D-113).
              : assertKnownWord(
                v, s, CONTENT_SYNONYMS, CONTENT_KEYWORDS, p.name, s,
              )),
        });
      },
      ft: ftProvider('filter'),
      ftb: ftProvider('backdropFilter'),
    });

    function ftProvider(propName: string): MnHandler {
      return (p: MnEssenceParams) => {
        let v: string; let s: Record<string, any>;
        return (v = filter(map(p.suffix.split(REGEXP_FILTER_SEP),
          (v: string) => {
            let matchs: RegExpExecArray | null; let name: string; let options: any;
            if (!v || !(matchs = REGEXP_FILTER_NAME.exec(v))) {
              return 0;
            }
            options = FILTER_MAP[name = lowerFirst(matchs[1])];
            const fn = camelToKebabCase(options && options[0] || name);
            FILTER_FUNCTIONS[fn] || throwInvalid(MSG_VALUE + p.suffix
            + '" is invalid: "' + fn + '" is not a filter function');
            return fn + OPEN_PAREN + (matchs[2] || options && options[1] || '')
            + (matchs[3] || options && options[2] || '') + CLOSE_PAREN;
          }), Boolean).join(SPACE)) ? (
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
      ap: ['appearance'],

      ti: [
        'textIndent',
        0,
        LENGTH_PERCENT | LENGTH_SIGN,
      ],

      tp: [
        'transitionProperty',
        1,
      ],



      g: ['grid'],
      gt: [
        'gridTemplate',
        1,
      ],
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
      gac: [
        'gridAutoColumns',
        1,
      ],
      gar: [
        'gridAutoRows',
        1,
      ],
      gaf: [
        'gridAutoFlow',
        1,
      ],

      gr: [
        'gridRow',
        1,
      ],
      gc: [
        'gridColumn',
        1,
      ],
      grs: [
        'gridRowStart',
        1,
      ],
      gre: [
        'gridRowEnd',
        1,
      ],
      gcs: [
        'gridColumnStart',
        1,
      ],
      gce: [
        'gridColumnEnd',
        1,
      ],

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
      fxf: [
        'flexFlow',
        1,
      ],
      fxg: [
        'flexGrow',
        1,
      ],
      fxs: [
        'flexShrink',
        1,
      ],

      or: ['order'],
      tds: [
        'textDecorationSkip',
        1,
      ],
      tdsi: [
        'textDecorationSkipInk',
        2,
      ],
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
      tdst: [
        'textDecorationStyle',
        2,
      ],
      tuo: [
        'textUnderlineOffset',
        2,
        LENGTH_PERCENT | LENGTH_SIGN,
        0,
        {
          auto: 1,
        },
      ],
      tup: [
        'textUnderlinePosition',
        2,
      ],

      ts: ['transformStyle'],
      bsp: [
        'borderSpacing',
        0,
        LENGTH_MULTI,
      ],
      // Группа F: `wcT` → `transform`; любое другое свойство — словом (`wcBackgroundColor`).
      wc: ['willChange'],
      // Группа F: `cpthN`, `cpthBB` → `border-box`, фигура — функцией: `cpthCircle\(50%\)`.
      cpth: ['clipPath'],
      // Группа F: `tbs4` → `tab-size:4`, `tbs2em`.
      tbs: ['tabSize'],
      // `perspective` (группа D): неотрицательная длина или `none` — `psp500`, `pspN`.
      psp: [
        'perspective',
        0,
        LENGTH_PLAIN,
        0,
        {
          none: 1,
        },
      ],
      // bdrs: ['borderRadius'],
      zm: ['zoom'],
      tem: ['textEmphasis'],
      temp: [
        'textEmphasisPosition',
        1,
      ],
      tems: [
        'textEmphasisStyle',
        1,
      ],
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
      const slots = SLOT_VALIDATORS[propName];
      mn(essenceName, (p) => {
        let s, repeated, abbreviations;
        let style: Record<string, any>;
        style = {};
        if (!(s = p.suffix)) {
        // Свойству-длине пустой суффикс даёт `0`, как у `p`/`m`/`b`; остальным
        // значения по умолчанию нет — они принимают произвольное слово, и
        // угадывать за автора нечего.
          return lengthy ? (style[propName] = ZERO, styleWrap(style, stylePriority)) : 0;
        }
        if (autoRepeat && (repeated = autoRepeatValue(s, essenceName))) {
          style[propName] = repeated;
          return styleWrap(style, stylePriority);
        }
        // Буквы — в каждой части составного значения (`fx1_1_A`, `arA_16/9`), полное слово с буквой бракуется в
        // любой части (D-113).
        s = (abbreviations = VALUE_ABBREVIATIONS[propName])
          ? lettersValue(
            p, abbreviations, enumWords,
          )
          : valueNormalize(s);
        // У свойства-длины голое слово почти всегда ошибка: `tiA` давало
        // `text-indent:a`, `wosN` — `word-spacing:n`. Список слов задан на
        // свойство; у остальных хендлеров блока значения произвольны
        // (`apcNone`, `irPixelated`), и проверять там нечего.
        lengthy && REGEXP_BARE_WORD.test(s) && !GLOBAL_KEYWORDS[s]
        && !(keywords && keywords[s])
        && throwInvalid(MSG_VALUE + p.suffix + MSG_IS_INVALID_FOR
          + essenceName + '": expected a length or a keyword of this property');
        // У свойства с закрытым перечислением проверяется значение ЦЕЛИКОМ, а не
        // только его словесная форма: `irF00` — не слово (`f00`), но и не
        // значение `image-rendering`. Подстановка и функция проходят: их
        // содержимое здесь разбирать нечем.
        if (slots) {
        // Составное значение разбирается по слотам своего свойства.
        // CSS-wide keywords и подстановка ЦЕЛИКОМ проходят мимо: перечислить
        // их в слотах нечем, а валидны они везде. Проверка на пробел
        // обязательна — иначе `var(--g) 1 auto` сходило бы за одну подстановку
        // и слоты не работали бы вовсе.
          s = (GLOBAL_KEYWORDS[s]
          || (REGEXP_SUBSTITUTION.test(s) && s.indexOf(SPACE) < 0))
            ? s
            : slots(
              s.split(SPACE), p.suffix, essenceName,
            );
        } else if (valuePattern) {
        // Свойство берёт безразмерное число; слово у него — только из списка,
        // если список есть.
          valuePattern.test(s) || (enumWords && (enumWords[s] || GLOBAL_KEYWORDS[s]))
          || s.indexOf(OPEN_PAREN) > -1
          || throwInvalid(MSG_VALUE + p.suffix + MSG_IS_INVALID_FOR
            + essenceName + '": expected a unitless number');
        } else if (enumWords) {
          s = assertEnumValue(
            s, enumWords, ENUM_MULTI[propName], essenceName, p.suffix, abbreviations,
          );
        }
        style[propName] = lengthy
          ? assertLengthValue(
            defaultUnitNormalize(s), essenceName, p.suffix, lengthy,
          )
          // `optimize-contrast` нужен и с префиксом WebKit (бывший `contrast`, D-094).
          : s === 'optimize-contrast' ? [
            s,
            '-webkit-' + s,
          ] : s;
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
      )) + PERCENT;
        return {
          exts: ['rlv'],
          style: {
            paddingTop: p.add
              ? normalizeCalc(
                v,
                '' + p.sa + floatNormalize(p.addv),
                validateUnit('' + (p.addu || PX)) as string,
              )
              : v,
          },
          childs: {
            overlay: {
              selectors: ['>*'],
              exts: [
                'abs' + p.ni,
                S + p.ni,
              ],
            },
          },
        };
      // eslint-disable-next-line
  }, '^((((\\d+):w)x((\\d+):h))|(\\d+):oh)?(([-+]):sa([0-9\\.]+):addv([a-z%]+):addu?):add?|(.*):other', 1);

    // Переименовано (D-094): `e` → `pe` (pointer-events).
    mn('e', (p) => throwRenamed('e' + p.suffix, 'pe' + p.suffix));
    // Переименовано (D-094): `contrast` → `irOptimizeContrast`.
    mn(CONTRAST, (p) => throwRenamed(CONTRAST + p.suffix, 'irOptimizeContrast'));
  },
} as MnPresetObject;

/** Для тестов: краткие записи слов по свойствам (D-094). */
export const STANDARD_VALUE_ABBREVIATIONS = VALUE_ABBREVIATIONS;
/**
 * Для тестов: буквы хендлеров на `synonymProvider` с закрытым списком (D-106) — значения в CamelCase, как в картах.
 */
export const STANDARD_SYNONYMS_BY_PROPERTY: Record<string, Record<string, string>> = {
  transitionTimingFunction: TIMING_FUNCTION_SYNONYMS,
  mixBlendMode: MIX_BLEND_MODE_SYNONYMS,
};
