/**
 * Длина у свойства со словарём — флаг `numeric` у `synonymProvider`: бывает ли она отрицательной, сколько
 * длин в значении и какие слова стоят только поодиночке. Голое число получает `px`, как у прочих длин.
 */
export interface LengthRule {
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
}export const ZERO = '0';
export const NAME_NONE = 'None';
export const NAME_HIDDEN = 'Hidden';
export const NAME_DOTTED = 'Dotted';
export const NAME_DASHED = 'Dashed';
export const NAME_SOLID = 'Solid';
export const NAME_DOUBLE = 'Double';
export const NAME_LEFT = 'Left';
export const NAME_CENTER = 'Center';
export const NAME_RIGHT = 'Right';
export const NAME_TOP = 'Top';
export const NAME_BOTTOM = 'Bottom';
export const NAME_AUTO = 'Auto';
export const NAME_NORMAL = 'Normal';
export const NAME_THIN = 'Thin';
export const NAME_MEDIUM = 'Medium';
export const NAME_THICK = 'Thick';
export const NAME_CONTAIN = 'Contain';
export const PX = 'px';
export const PERCENT = '%';
export const DEG = 'deg';
export const COMMA = ',';
export const DOT = '.';
export const PIPE = '|';
export const UNDERSCORE = '_';
export const VAR_OPEN = 'var(';
export const CLOSE_PAREN = ')';
export const SPACE = ' ';
export const SEMICOLON = ';';
export const N = 'N';
export const A = 'A';
export const NONE = 'none';
export const ALL = 'all';
export const AUTO = 'auto';
export const FIT_CONTENT = 'fit-content';
export const SPAN = 'span';
const SIDE_LEFT = 'left';
const SIDE_RIGHT = 'right';
const PRESERVE_3D = 'preserve-3d';
const MOZ_CRISP_EDGES = '-moz-crisp-edges';
const O_CRISP_EDGES = '-o-crisp-edges';
const WEBKIT_OPTIMIZE_CONTRAST = '-webkit-optimize-contrast';
const OPTIMIZE_SPEED = 'optimizeSpeed';
const OPTIMIZE_QUALITY = 'optimizeQuality';
export const NORMAL = 'normal';
export const DOUBLE_QUOTE = '"';
export const DASH = '-';
export const LIST_SEPARATOR = ', ';
export const OPEN_PAREN = '(';
export const QUOTE = '\'';
export const S = 's';
export const POS = 'pos';
export const BORDER = 'border';
export const HUNDRED_PERCENT = '100%';
export const CENTER = 'center';
export const NAME_START = 'Start';
export const NAME_END = 'End';
export const NAME_STRETCH = 'Stretch';
export const NAME_FILL = 'Fill';
export const R = 'r';
export const NAME_VISIBLE = 'Visible';
export const NAME_COVER = 'Cover';
export const NAME_BLOCK = 'Block';
export const NAME_INLINE = 'Inline';
export const NAME_ALWAYS = 'Always';
export const NAME_BOTH = 'Both';
export const NAME_COLLAPSE = 'Collapse';
export const NAME_TEXT = 'Text';
export const NAME_BASELINE = 'Baseline';
export const NAME_FIXED = 'Fixed';
export const NAME_BORDER_BOX = 'BorderBox';
export const NAME_CONTENT_BOX = 'ContentBox';
export const NAME_WRAP = 'Wrap';
export const NAME_NOWRAP = 'Nowrap';
export const NAME_FILL_BOX = 'FillBox';
export const NAME_STROKE_BOX = 'StrokeBox';
export const NAME_VIEW_BOX = 'ViewBox';
/** Повтор `background-repeat` / `mask-repeat`: `bgrN`, `mkrX`; пустой суффикс — `repeat`. */
export const NAME_REPEAT = 'Repeat';
/** Оси `x`/`y`: суффиксы сторон в `SIDES_MAP` (`x` — ось строки, inline; `y` — ось блока, block) и оси `rotate*`. */
export const AXIS_X = 'x';
export const AXIS_Y = 'y';
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
export const COLOR_SYNONYMS: Record<string, string> = {
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
/** Ключевые слова позиции — общие для `background-position`/`object-position`. */
export const POSITION_KEYWORDS = {
  L: NAME_LEFT,
  C: NAME_CENTER,
  R: NAME_RIGHT,
  T: NAME_TOP,
  B: NAME_BOTTOM,
};
/** Часть `<position>` — ключевое слово по оси x (`left`/`right`). */
export const POSITION_X = 1;
/** Часть `<position>` — ключевое слово по оси y (`top`/`bottom`). */
export const POSITION_Y = 2;
/** Часть `<position>` — `center`: годится обеим осям. */
const POSITION_CENTER = 3;
/** Часть `<position>` — длина, процент или функция. */
export const POSITION_OFFSET = 4;
/** Часть `<position>` — переменная: что в ней, неизвестно, поэтому проходит любое место. */
export const POSITION_ANY = 5;
/** Ось каждого ключевого слова позиции: по ней проверяется порядок и сочетание частей. */
export const POSITION_AXES: Record<string, number> = {
  left: POSITION_X,
  right: POSITION_X,
  top: POSITION_Y,
  bottom: POSITION_Y,
  [CENTER]: POSITION_CENTER,
};
/** Углы целым значением: `tfoTL` → `top left`. Только первой частью — дальше они дали бы три слова на две оси. */
export const POSITION_CORNERS: Record<string, string[]> = {
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
/** Краткие записи gap-семейства: `auto`/`none` у него невалидны. */
export const GAP_SYNONYMS = {
  N: NAME_NORMAL,
};

/**
 * Функции плавности словами — `atfL` → `linear`, `atfEIO` → `ease-in-out`; у `ttf` те же буквы:
 * одна плавность пишется одинаково у анимации и у перехода.
 */
export const TIMING_FUNCTION_SYNONYMS: Record<string, string> = {
  L: 'Linear',
  E: 'Ease',
  EI: 'EaseIn',
  EO: 'EaseOut',
  EIO: 'EaseInOut',
  SS: 'StepStart',
  SE: 'StepEnd',
};
/**
 * Режимы смешивания `background-blend-mode`: `bgbmM` → `multiply`. `C` — `color`, поэтому пары на «color»
 * получили вторую букву: `CD` — `color-dodge`, `CB` — `color-burn`. `plus-darker`/`plus-lighter` фону не положены —
 * они только у `mix-blend-mode` ({@link MIX_BLEND_MODE_SYNONYMS}).
 */
export const BLEND_MODE_SYNONYMS: Record<string, string> = {
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
/** Режимы смешивания элемента (`mbm`): буквы фона плюс `PD` — `plus-darker`, `PL` — `plus-lighter`. */
export const MIX_BLEND_MODE_SYNONYMS: Record<string, string> = {
  ...BLEND_MODE_SYNONYMS,
  PD: 'PlusDarker',
  PL: 'PlusLighter',
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
export const UNITS = ('svmin,svmax,lvmin,lvmax,dvmin,dvmax,cqmin,cqmax,vmin,vmax,'
  + 'svw,svh,lvw,lvh,dvw,dvh,cqw,cqh,cqi,cqb,rlh,rem,rex,rch,ric,cap,'
  + 'em,ex,px,cm,mm,in,pt,pc,ch,ic,lh,vw,vh,vi,vb,q,%').split(COMMA);
/** Единицы угла — всё, чем измеряется поворот в CSS. */
export const ANGLE_UNITS = [
  DEG,
  'grad',
  'rad',
  'turn',
];
/** Сдвиг: `vertical-align`, `background-position-x`/`-y`, толщина в `text-decoration` — одна длина со знаком. */
export const OFFSET_LENGTH: LengthRule = {
  signed: true,
  max: 1,
};

/** Краткая запись `none` у свойств, где других букв нет: `biN`, `tnN`. */
export const NONE_ABBREVIATIONS: Record<string, string> = {
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

export const VALUE_ABBREVIATIONS: Record<string, Record<string, string>> = {
  // `tpA`/`tpN` давали `transition-property:a`/`n`.
  transitionProperty: {
    A: ALL,
    N: NONE,
  },
  // Буквы виджетов; у `textarea`/`textfield` и `menulist`/`meter` букв пока нет: для этих пар они ещё не выбраны.
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
    FC: FIT_CONTENT,
  },
  flexBasis: {
    A: AUTO,
    C: 'content',
    FC: FIT_CONTENT,
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

export const ENUM_KEYWORDS: Record<string, Record<string, 1 | string>> = {
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
    // Другие записи слова — для подсказки «Write it shorter: "tsP"»: `tsPreserve3d`, `tsPreserve3D`.
    preserve3d: PRESERVE_3D,
    'preserve3-d': PRESERVE_3D,
  },
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
export const ENUM_MULTI: Record<string, 1> = {
  textEmphasisStyle: 1,
  textEmphasisPosition: 1,
  textDecorationSkip: 1,
  textUnderlinePosition: 1,
  gridAutoFlow: 1,
};
/**
 * Ключевые слова, допустимые у любого свойства (CSS-wide keywords).
 * В словарях отдельных хендлеров не перечисляются — они валидны везде.
 */
export const GLOBAL_KEYWORDS: Record<string, 1> = {
  inherit: 1,
  initial: 1,
  unset: 1,
  revert: 1,
  'revert-layer': 1,
};
/** Проценты допустимы: `text-indent:10%`, но не `word-spacing:10%`. */
export const LENGTH_PERCENT = 1;
/** Несколько значений через `_`: `border-spacing:10px 20px`. */
export const LENGTH_MULTI = 2;
/** Отрицательные значения: `text-indent:-5px`, но не `flex-basis:-5px`. */
export const LENGTH_SIGN = 4;
/** Значения курсора, которые не цвет: `cP` — не `#P`, а, видимо, `crP`. */
export const CURSOR_WORDS: Record<string, 1> = {
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
export const POSITION_WORDS: Record<string, 1> = {
  A: 1,
  R: 1,
  F: 1,
  S: 1,
};

/** Значения `float`: `fL` — не размер шрифта, а `flL`. */
export const FLOAT_WORDS: Record<string, 1> = {
  L: 1,
  R: 1,
  N: 1,
  IS: 1,
  IE: 1,
};

/** Значения `box-sizing`: `bsBB` — не стиль рамки, а `bxzBB`. */
export const BOX_SIZING_WORDS: Record<string, 1> = {
  BB: 1,
  CB: 1,
};

/**
 * Словарь «одно значение или пара через `_`»: к записям `first` добавляются
 * пары `A_B` → `WordA_WordB` (`valueNormalize` разворачивает `_` в пробел).
 * Пара из двух одинаковых частей не порождается — `start start` то же, что
 * `start`, и вторая запись дала бы второе правило.
 */
export function withPairs(
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
 * Строка слов через пробел → множество для проверки значения.
 *
 * Компактнее объектного литерала и в исходнике, и в бандле, а разворачивается
 * один раз на холодном пути регистрации.
 */
export function wordsSet(words: string): Record<string, 1> {
  const parts = words.split(SPACE);
  const set: Record<string, 1> = {};
  let i = parts.length;
  while (i--) {
    set[parts[i]] = 1;
  }
  return set;
}
