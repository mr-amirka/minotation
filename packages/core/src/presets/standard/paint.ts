import type {
  StandardContext,
} from './context';
import type {
  MnEssenceParams,
} from '../../core/types';
import type {
  MnHandler,
  MnStyle,
} from '../../types';
import type {
  LengthRule,
} from './words';
import {
  A,
  ANGLE_UNITS,
  AUTO,
  BLEND_MODE_SYNONYMS,
  COLOR_SYNONYMS,
  COMMA,
  DEG,
  DOUBLE_QUOTE,
  HUNDRED_PERCENT,
  MIX_BLEND_MODE_SYNONYMS,
  N,
  NAME_AUTO,
  NAME_BORDER_BOX,
  NAME_BOTTOM,
  NAME_CENTER,
  NAME_CONTAIN,
  NAME_CONTENT_BOX,
  NAME_COVER,
  NAME_FILL_BOX,
  NAME_FIXED,
  NAME_LEFT,
  NAME_NONE,
  NAME_NORMAL,
  NAME_REPEAT,
  NAME_RIGHT,
  NAME_STROKE_BOX,
  NAME_TEXT,
  NAME_TOP,
  NAME_VIEW_BOX,
  NONE,
  NONE_ABBREVIATIONS,
  OFFSET_LENGTH,
  PERCENT,
  SPACE,
  UNDERSCORE,
  VALUE_ABBREVIATIONS,
  withPairs,
  wordsSet,
} from './words';
import {
  MSG_INSTEAD_OF,
  MSG_IS_INVALID_FOR,
  MSG_VALUE,
  assertNotLongForm,
  throwInvalid,
  throwRenamed,
} from './messages';
import type {
  FunctionCall,
  FunctionForm,
} from './functions';
import {
  REGEXP_BARE_NUMBER,
  REGEXP_FUNCTION_FIRST_ARG,
  REGEXP_FUNCTION_LENGTH,
  cssVarValue,
  functionLength,
  functionSet,
  functionsValue,
  lengthPartRegExp,
  splitValueParts,
} from './functions';
import {
  PATTERN_COLOR,
  REGEXP_DOTS,
  imagePathValue,
  normalizeDefault,
  styleWrap,
} from './context';

/** Строка цветового свойства: свойство, приоритет, слова сверх цвета (`auto` у `caret-color`). */
type ColorRow = [propName: string, priority?: number, keywords?: Record<string, 1>];

const CONTRAST = 'contrast';
const MASK_IMAGE = 'maskImage';
const NAME_PADDING_BOX = 'PaddingBox';
/** Код цвета в части значения: hex и, через точку, альфа (`F00.5`). */
const REGEXP_HEX_ALPHA = /^[0-9A-Fa-f]+(\.[0-9]+)?$/;
/** Фигура `clip-path` нативной формой: `_circle(50%)` — не путь, хоть и начинается с `_`. */
const REGEXP_SHAPE_HEAD = /^_(?:circle|ellipse|inset|polygon)\(/i;
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
 * `color-scheme`: `cschL`, `cschL_D` → `light dark`, `cschD_O` → `dark only`. Одно `only` невалидно —
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
/** Угол с единицей: `1turn`, `-90deg`. */
const REGEXP_FUNCTION_ANGLE = lengthPartRegExp(ANGLE_UNITS);
/** Доля: число не меньше нуля, с `%` или без. */
const REGEXP_FUNCTION_RATIO = /^(?:\d+\.?\d*|\.\d+)%?$/;
/** Полные имена функций фильтра там, где есть короткое: одна форма на значение. */
const FILTER_LONG_NAMES: Record<string, string> = {
  Grayscale: 'Gray',
  Brightness: 'Bright',
  HueRotate: 'Hue',
};
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

/** Слово `auto` у свойства-цвета, где буква `A` занята кодом `#aaa`: `ccAuto`. */
const AUTO_KEYWORD: Record<string, 1> = {
  [AUTO]: 1,
};
/**
 * Аргумент-доля функции: голое число — проценты (`50` → `50%`), переменная — `var()`. Число не меньше нуля.
 * @param v аргумент
 * @param call вызов — для ошибки
 * @returns доля CSS
 * @example functionRatio('50', call) // '50%'
 */
function functionRatio(v: string, call: FunctionCall): string {
  return cssVarValue(v) || (REGEXP_FUNCTION_RATIO.test(v)
    ? (v[v.length - 1] === PERCENT ? v : v + PERCENT) : call.fail('a percentage of zero or more'));
}
/**
 * Аргумент-угол функции: голое число — градусы (`90` → `90deg`), с единицей угла — как написано, переменная —
 * `var()`.
 * @param v аргумент
 * @param call вызов — для ошибки
 * @returns угол CSS
 * @example functionAngle('90', call) // '90deg'
 */
function functionAngle(v: string, call: FunctionCall): string {
  return cssVarValue(v) || (REGEXP_BARE_NUMBER.test(v) ? v + DEG
    : REGEXP_FUNCTION_ANGLE.test(v) ? v : call.fail('an angle'));
}
/**
 * Функция-доля из одной части: `ftGray50` → `grayscale(50%)`, голое имя — `100%`.
 * @param css имя в CSS
 * @param example запись для подсказок
 * @returns форма функции
 */
function ratioForm(css: string, example: string): FunctionForm {
  return {
    css,
    min: 0,
    max: 1,
    example,
    args: (args, call) => (args.length ? functionRatio(args[0], call) : HUNDRED_PERCENT),
  };
}

/**
 * Хендлеры темы «paint».
 *
 * @param ctx — контекст пресета (`createContext`)
 */
export function registerPaint(ctx: StandardContext): void {
  const {
    COLOR_SYNONYM_BY_WORD,
    assertColorAbbr,
    assertShortestHex,
    backgroundProvider,
    forIn,
    getColor,
    mn,
    positionProvider,
    positionWords,
    rawColorValue,
    registerLengthProperties,
    registerSingleProperties,
    synonymProvider,
    toFixed,
    toKebabCase,
  } = ctx;

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
    // '-webkit-tap-highlight-color', см. fundamentool). Хендлер заменил ручной mn.css({html:{'-webkit-tap-highlight-color':'#000'}})
    // в presets/main/index.ts — единственного оставшегося в проекте вызова mn.css.
    thc: [
      'WebkitTapHighlightColor',
      1,
    ],
    // Группа F: цвет галочек и полей формы, цвет каретки. `auto` — словом (`ccAuto`): буква `A` —
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
  } satisfies Record<string, ColorRow>, (options, pfx) => {
    const propName = options[0];
    const priority = options[1] || 0;
    // Слова свойства сверх цвета — `auto` у `caret-color`.
    const keywords = options[2];
    mn(
      pfx, (p) => {
        let s: MnStyle; let v: string | undefined; let synonym: string;
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
            // хвост молча терялся (`color:#fff`). Слово — цвет,
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
   * `scrollbar-color`: `sbcA` → `auto`, иначе ровно два
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
      // CSS-wide keyword — буквами, его ставит ядро.
      const whole = cssVarValue(suffix) || throwInvalid(MSG_VALUE + suffix + MSG_IS_INVALID_FOR + p.name
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

  mn({
    csch: synonymProvider('colorScheme', COLOR_SCHEME_SYNONYMS),
    fca: synonymProvider('forcedColorAdjust', {
      A: NAME_AUTO,
      N: NAME_NONE,
      PPC: 'PreserveParentColor',
    }),
    bgbm: synonymProvider('backgroundBlendMode', BLEND_MODE_SYNONYMS),
    mbm: synonymProvider('mixBlendMode', MIX_BLEND_MODE_SYNONYMS),
  });

  // Картинка отдельно от цвета: `bg3 bgi_hero\.jpg` — серый остаётся под картинкой. Одна запись на значение:
  // путь — только `_`-формой (`bgi_hero\.jpg` → `url("hero.jpg")`, {@link imagePathValue}), переменная —
  // `bgi--hero`, `none` — `bgiN`, CSS-wide keyword — словом (`bgiInherit`). Градиент пишется в `bg` / `mk`, функция в
  // токене не пишется. Раньше проходило всё подряд: градиент становился именем файла (`bgiF00-00F` →
  // `url("F00-00F")`), `bgi10px` — `url("10px")`, `bgiUrl\(a\.png\)` — `Url(a.png)`, `bgi_url\(a\.png\)` — `url(a.png)`.
  forIn({
    bgi: [
      'backgroundImage',
      'bg',
    ],
    lisi: ['listStyleImage'],
  }, (options: string[], name: string) => {
    const propName = options[0];
    // Где пишется градиент для этого свойства — для подсказки; у `list-style-image` такого хендлера нет.
    const gradientIn = options[1];
    mn(name, (p) => {
      const s = p.suffix;
      if (!s) {
        return 0;
      }
      const style: MnStyle = {};
      style[propName] = s === N ? NONE
        : s[0] === UNDERSCORE ? imagePathValue(s.slice(1), name)
          // CSS-wide keyword — буквами, его ставит ядро; `bgiNone` — «Write it shorter: "bgiN"».
          : cssVarValue(s)
          || (assertNotLongForm(
            toKebabCase(s), NONE_ABBREVIATIONS, name, s,
          ), throwInvalid(MSG_VALUE + s + MSG_IS_INVALID_FOR + name + '": a picture is its path (`' + name
            + '_a\\.png`), a variable (`' + name + '--x`) or `' + name + 'N`' + (gradientIn
            ? '; a gradient is written in `' + gradientIn + '` (`' + gradientIn + 'F00-00F`)'
            : '')));
      return styleWrap(style, 1);
    });
  });

  // Слито: `mki` — то же свойство `mask-image`, что `mk`; путь — `mk_a\.png`.
  // Точка в пути пишется экранированной (`mk_a\.png`) — так же и в подсказке.
  mn('mki', (p) => {
    const suffix = p.suffix.replace(REGEXP_DOTS, '\\.');
    return throwRenamed('mki' + suffix, 'mk' + suffix);
  });

  registerLengthProperties({
    sw: [
      'strokeWidth',
      0,
      0,
      1,
    ],
  });

  mn({

    // background: (...)
    bg: backgroundProvider(
      'background', undefined, 'bgi',
    ),
    /**
     * `opacity`. Число — проценты (`o50` → `.5`), как в 1.x. Дробь меньше единицы
     * трактуется как готовая доля (`o0.5` → `.5`): раньше такая запись
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

    // Маски: семейство `mk…` зеркалит `bg…` — `mk` картинка (градиент, путь `mk_a\.png`; бывшее `mki` слито с ним), `mks`,
    // `mkr`, `mko`, `mkcp`.
    mkt: synonymProvider('maskType', {
      L: 'Luminance',
      A: 'Alpha',
    }),

    mkm: synonymProvider('maskMode', {
      L: 'Luminance',
      A: 'Alpha',
      MS: 'MatchSource',
    }),

    mk: backgroundProvider(MASK_IMAGE, 1),
    mks: synonymProvider(
      'maskSize', {
        A: NAME_AUTO,
        CT: NAME_CONTAIN,
        CV: NAME_COVER,
      }, 1, undefined, SIZE_LENGTHS, 1,
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
    cp: synonymProvider('clip', {
      A: NAME_AUTO,
      R: 'Rect\\(top_right_bottom_left\\)',
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
      }, 1, undefined, SIZE_LENGTHS, 1,
    ),
    // `mask-position-x/y` в CSS нет (только с `-webkit-`), поэтому позиция маски — общим разбором, как у `op`.
    mkp: positionProvider('maskPosition', 1),
    /**
     * Оси `background-position`. Ключевые слова у них РАЗНЫЕ: горизонтальная
     * принимает `left`/`right`/`x-start`/`x-end`, вертикальная —
     * `top`/`bottom`/`y-start`/`y-end`. Раньше карт не было вовсе, и
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
      }, 2, undefined, OFFSET_LENGTH,
    ),
    bgpy: synonymProvider(
      'backgroundPositionY', {
        T: NAME_TOP,
        C: NAME_CENTER,
        B: NAME_BOTTOM,
        YS: 'YStart',
        YE: 'YEnd',
      }, 2, undefined, OFFSET_LENGTH,
    ),
    ft: ftProvider('filter'),
    ftb: ftProvider('backdropFilter'),
  });

  /**
   * Цвет-аргумент функции: те же записи и проверки, что у цвета в части значения ({@link colorPart}). С `altColor`
   * у кода с альфой цветов два — основной и запасной; какой взять, решает проход {@link FunctionCall.fallback}.
   */
  function functionColor(
    v: string, call: FunctionCall, k: number,
  ): string {
    const parts = call.parts.slice();
    // Первый аргумент слит с именем функции: в подсказку цвета идёт сам аргумент.
    parts[call.index[k]] = v;
    const colors = colorPart(
      call.p, parts, call.index[k],
    );
    return colors[call.fallback ? 0 : colors.length - 1];
  }

  /**
   * `drop-shadow`: x и y, затем размытие и цвет — по порядку CSS (`ftDropShadow2_4_6_000.5` →
   * `drop-shadow(2px 4px 6px rgba(0,0,0,.5))`). Из трёх частей третья — размытие, если это число или длина, иначе
   * цвет: `ftDropShadow2_4_F00`. Размытие из переменной пишется вместе с цветом: `ftDropShadow2_4_--b_0`.
   */
  function dropShadowArgs(args: string[], call: FunctionCall): string {
    const l = args.length;
    const third = l > 2 ? args[2] : '';
    const blur = l > 3 || REGEXP_BARE_NUMBER.test(third) || REGEXP_FUNCTION_LENGTH.test(third);
    return functionLength(
      args[0], call, 1,
    ) + SPACE + functionLength(
      args[1], call, 1,
    )
      + (blur ? SPACE + functionLength(third, call) : '')
      + (l > (blur ? 3 : 2) ? SPACE + functionColor(
        args[l - 1], call, l - 1,
      ) : '');
  }

  /**
   * Функции фильтра в нативной форме — список закрыт спецификацией (`<filter-function>`): `ftBlur2`,
   * `ftGray50`, `ftHue90`, `ftDropShadow2_4_6_000.5`. Голое число — единица функции: пиксели у размытия, проценты
   * у долей, градусы у поворота тона. Голое имя — значение по умолчанию: `ftBlur` → `blur(4px)`, `ftGray` →
   * `grayscale(100%)`.
   *
   * Раньше имя прокидывалось как есть и хвост приклеивался без проверки: `ftBlur\(2px\)` давало `blur(4(2px))`,
   * `ftBlur.5` — `blur(4.5)`, `ftBlur--a` — `blur(4--a)`, `ftHueRotate90` — `hue-rotate(90)` без единицы,
   * `ftDropShadow2` — `drop-shadow(2)`, а `ftBrightness150` — `brightness(150)`, то есть в сто раз ярче, чем
   * `ftBright150` (полное имя шло без процентов). Ещё раньше закрыт сам список: `ftbF00` давало
   * `backdrop-filter:f(00)`, `ftb_solid` — `solid()`.
   */
  const FILTER_FORMS: Record<string, FunctionForm> = {
    Blur: {
      css: 'blur',
      min: 0,
      max: 1,
      example: 'Blur2',
      args: (args, call) => (args.length ? functionLength(args[0], call) : '4px'),
    },
    Gray: ratioForm('grayscale', 'Gray50'),
    Bright: ratioForm('brightness', 'Bright150'),
    Contrast: ratioForm(CONTRAST, 'Contrast150'),
    Hue: {
      css: 'hue-rotate',
      min: 0,
      max: 1,
      example: 'Hue90',
      args: (args, call) => (args.length ? functionAngle(args[0], call) : '180deg'),
    },
    Invert: ratioForm('invert', 'Invert20'),
    Opacity: ratioForm('opacity', 'Opacity50'),
    Saturate: ratioForm('saturate', 'Saturate200'),
    Sepia: ratioForm('sepia', 'Sepia50'),
    DropShadow: {
      css: 'drop-shadow',
      min: 2,
      max: 4,
      example: 'DropShadow2_4_6_000.5',
      args: dropShadowArgs,
    },
  };
  const FILTER_FUNCTIONS = functionSet(
    FILTER_FORMS, 'a filter function', undefined, FILTER_LONG_NAMES,
  );
  /**
   * Радиусы и позиция фигуры `circle` / `ellipse`: первые части, которые начинаются числом, — радиусы (не больше
   * `radii`), остальное — позиция после `at`, тем же читателем, что у `op` ({@link positionWords}): `50%_R_T` →
   * `50% at right top`.
   * @param args аргументы функции
   * @param radii сколько радиусов у фигуры: 1 у круга, 2 у эллипса
   * @param call вызов — для ошибки и имени хендлера
   * @returns содержимое скобок
   */
  function shapeAt(
    args: string[], radii: number, call: FunctionCall,
  ): string {
    const l = args.length;
    const out: string[] = [];
    let i = 0;
    for (; i < radii && i < l && REGEXP_FUNCTION_FIRST_ARG.test(args[i]); i++) {
      out.push(functionLength(
        args[i], call, undefined, 1,
      ));
    }
    // У эллипса радиусов два или ни одного: `ellipse(30%)` невалиден.
    i && i < radii && call.fail('two radii, x and y');
    i < l && out.push('at ' + positionWords(
      call.p.name, args.slice(i).join(UNDERSCORE), undefined, 1,
    ).join(SPACE));
    return out.join(SPACE);
  }
  /**
   * Фигуры `clip-path` в нативной форме: `cpthCircle50%_R_T` → `circle(50% at right top)`,
   * `cpthEllipse30%_50%_C`, `cpthInset10_20_R5` → `inset(10px 20px round 5px)` (`R` — перед радиусом скругления),
   * `cpthPolygon50%_0,100%_100%,0_100%` → `polygon(50% 0,100% 100%,0 100%)` (`_` внутри точки, `,` между точками).
   * Голое число — пиксели. Остальное (`path(…)`, `xywh(…)`, правило заливки) — переменной.
   */
  const CLIP_PATH_FUNCTIONS = functionSet({
    Circle: {
      css: 'circle',
      min: 0,
      max: 5,
      example: 'Circle50%_R_T',
      args: (args, call) => shapeAt(
        args, 1, call,
      ),
    },
    Ellipse: {
      css: 'ellipse',
      min: 0,
      max: 6,
      example: 'Ellipse30%_50%_C',
      args: (args, call) => shapeAt(
        args, 2, call,
      ),
    },
    Inset: {
      css: 'inset',
      min: 1,
      max: 8,
      example: 'Inset10_20_R5',
      args: (args, call) => {
        const l = args.length;
        const out: string[] = [];
        let round = -1;
        let i = 0;
        let v: string;
        for (; i < l; i++) {
          v = args[i];
          if (v[0] === 'R' && round < 0) {
            round = i;
            v = v.slice(1);
          }
          // Отступ может быть отрицательным, радиус — нет.
          out.push(functionLength(
            v, call, round < 0 ? 1 : undefined, 1,
          ));
        }
        const insets = round < 0 ? l : round;
        insets && insets < 5 || call.fail('one to four insets, then R and the radius');
        l - insets < 5 || call.fail('one to four radii after R');
        return out.slice(0, insets).join(SPACE) + (round < 0 ? '' : ' round ' + out.slice(insets).join(SPACE));
      },
    },
    Polygon: {
      css: 'polygon',
      min: 2,
      max: 64,
      example: 'Polygon50%_0,100%_100%,0_100%',
      args: (args, call) => {
        const points = args.join(SPACE).split(COMMA);
        const l = points.length;
        let i = 0;
        let xy: string[];
        for (; i < l; i++) {
          xy = points[i].split(SPACE);
          xy.length === 2 || call.fail('points of two coordinates, x_y, with "," between points');
          points[i] = functionLength(
            xy[0], call, 1, 1,
          ) + SPACE + functionLength(
            xy[1], call, 1, 1,
          );
        }
        return points.join(COMMA);
      },
    },
  }, 'a clip-path shape');
  /**
   * `clip-path`: буквы рамки (`cpthN`, `cpthBB` → `border-box`), фигуры нативной формой
   * ({@link CLIP_PATH_FUNCTIONS}) и `<clipPath>` SVG по пути: `cpth_\#wave` → `url("#wave")`.
   */
  const clipPathWords = synonymProvider(
    'clipPath', VALUE_ABBREVIATIONS.clipPath, undefined, undefined, undefined, undefined, CLIP_PATH_FUNCTIONS,
  );
  // `_` — путь, но `cpth_circle\(50%\)` — фигура со скобкой: её бракует читатель фигур с нативной формой.
  mn('cpth', (p) => (p.suffix[0] === UNDERSCORE && !REGEXP_SHAPE_HEAD.test(p.suffix) ? styleWrap({
    clipPath: imagePathValue(
      p.suffix.slice(1), p.name, VALUE_ABBREVIATIONS.clipPath,
    ),
  }) : clipPathWords(p)));

  function ftProvider(propName: string): MnHandler {
    return (p: MnEssenceParams) => {
      const whole = cssVarValue(p.suffix);
      const main = whole || functionsValue(p, FILTER_FUNCTIONS);
      if (!main) {
        return 0;
      }
      const s: MnStyle = {};
      const fallback = whole || functionsValue(
        p, FILTER_FUNCTIONS, true,
      );
      s[propName] = fallback === main ? main : [
        fallback,
        main,
      ];
      return styleWrap(s);
    };
  }

  registerSingleProperties({
    ir: ['imageRendering'],
  });
  // Переименовано: `contrast` → `irOptimizeContrast`.
  mn(CONTRAST, (p) => throwRenamed(CONTRAST + p.suffix, 'irOptimizeContrast'));
}
