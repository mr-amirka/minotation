import type {
  StandardContext,
} from './context';
import type {
  MnEssenceParams,
} from '../../core/types';
import type {
  MnHandler,
} from '../../types';
import {
  COMMA,
  DASH,
  DOUBLE_QUOTE,
  GAP_SYNONYMS,
  HUNDRED_PERCENT,
  LENGTH_PERCENT,
  LENGTH_SIGN,
  LIST_SEPARATOR,
  N,
  NAME_ALWAYS,
  NAME_AUTO,
  NAME_BASELINE,
  NAME_BOTTOM,
  NAME_CENTER,
  NAME_COLLAPSE,
  NAME_DASHED,
  NAME_DOTTED,
  NAME_DOUBLE,
  NAME_END,
  NAME_LEFT,
  NAME_MEDIUM,
  NAME_NONE,
  NAME_NORMAL,
  NAME_NOWRAP,
  NAME_RIGHT,
  NAME_SOLID,
  NAME_START,
  NAME_TOP,
  NAME_WRAP,
  NONE,
  OFFSET_LENGTH,
  OPEN_PAREN,
  PERCENT,
  PX,
  QUOTE,
  SPACE,
  UNDERSCORE,
  ZERO,
  wordsSet,
} from './words';
import {
  MSG_COLON,
  MSG_INSTEAD_OF,
  MSG_IS_INVALID_FOR,
  MSG_SAME_VALUE,
  MSG_VALUE,
  throwInvalid,
  throwRenamed,
} from './messages';
import type {
  SingleValues,
} from './functions';
import {
  REGEXP_FUNCTION_HEAD,
  REGEXP_LENGTH_PART,
  assertNoFunction,
  cssVarValue,
  functionSet,
  functionsStart,
  functionsValue,
} from './functions';
import {
  REGEXP_SLOT_IDENT,
  REGEXP_SLOT_INTEGER,
  REGEXP_VALUE_INTEGER,
  normalizeDefault,
  snakeLeftTrim,
  styleWrap,
} from './context';

const NAME_BREAK_WORD = 'BreakWord';

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
const TD_SYNONYMS = {
  '': NAME_NONE,
  N: NAME_NONE,
  U: 'Underline',
  O: 'Overline',
  L: 'LineThrough',
  BL: 'Blink',
  SPE: 'SpellingError',
  GRE: 'GrammarError',
};
const FONT_WEIGHT_SYNONYMS: Record<string, string> = {
  N: NAME_NORMAL,
  B: 'Bold',
  BR: 'Bolder',
  LR: 'Lighter',
};
/** Слова `font-weight`; пишутся буквами (`fwBR`, а `fwBolder` бракуется). */
const FONT_WEIGHT_KEYWORDS: Record<string, 1> = {
  normal: 1,
  bold: 1,
  bolder: 1,
  lighter: 1,
};
/**
 * `overflow-wrap` (`owr`): буквы те же, что у `wb`: `BW` — `break-word`. Значения `none`, `unrestricted`, `suppress`
 * убраны — невалидны по спецификации.
 */
const OVERFLOW_WRAP_SYNONYMS: Record<string, string> = {
  N: NAME_NORMAL,
  BW: NAME_BREAK_WORD,
  A: 'Anywhere',
};
/** `ww` → `owr`: у `ww` было по две буквы на значение — `B`/`BW`, `N`/`NM`. */
const WW_RENAMED: Record<string, string> = {
  B: 'BW',
  NM: N,
};
/** `overflowWrapMode`: `'legacy'` — старое имя `word-wrap`, `'both'` — оба имени. */
const WRAP_LEGACY = 'legacy';
const WRAP_BOTH = 'both';
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
 * `font-variant-numeric`: буквы через `_`, по одной из группы и в порядке спецификации — `fvnTN`,
 * `fvnTN_SZ` → `tabular-nums slashed-zero`, `fvnLN_TN_SZ`. Порядок проверяет {@link assertFontVariantNumericOrder}:
 * `fvnSZ_TN` дало бы то же значение второй записью, а значит второе правило.
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
/** Краткие записи `fsa`: `fsaN` → `none`, `fsaFF` → `from-font` (как `tdFF`). */
const FONT_SIZE_ADJUST_SYNONYMS: Record<string, string> = {
  N: NAME_NONE,
  FF: 'FromFont',
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
/** Буквы системных шрифтов: `fontMB` → `font:message-box`. */
const FONT_SYNONYMS: Record<string, string> = {
  C: 'caption',
  I: 'icon',
  M: 'menu',
  MB: 'message-box',
  SC: 'small-caption',
  SB: 'status-bar',
};
/** Стиль `text-emphasis` — тот же список, что у атомарного `tems`. */
const TEXT_EMPHASIS_STYLE = wordsSet('none filled open dot circle double-circle'
  + ' triangle sesame');

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
 * Одна линия сетки: `grs`, `gre`, `gcs`, `gce`. По грамматике это `<grid-line>`:
 * `auto`, имя, номер с именем или без, `span` с номером и/или именем — по одному каждого. Второй позиции нет, и
 * `gcs1/3` дало бы невалидное `grid-column-start:1/3`: пара пишется через `gc`.
 */
/**
 * `tab-size`: целое число пробелов без единицы (`tbs4` → `tab-size:4` — `px` здесь не дописывается, число
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
/** Число строк у `lcl`: целое от 1. */
const REGEXP_LINE_COUNT = /^[1-9]\d*$/;

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

/** Текст: табуляция, выделение, счётчики, висячие строки. */
const TYPOGRAPHY_VALUES: SingleValues = {
  slots: {
    tabSize: tabSizeValue,
    textEmphasis: textEmphasisValue,
    counterIncrement: counterValue,
    counterReset: counterValue,
  },
  patterns: {
    widows: REGEXP_VALUE_INTEGER,
    orphans: REGEXP_VALUE_INTEGER,
  },
};
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
  // Кавычки по `quotes`: `cntOQ` → `open-quote`.
  OQ: 'open-quote',
  CQ: 'close-quote',
  NOQ: 'no-open-quote',
  NCQ: 'no-close-quote',
};
/** Типы маркера списка буквами — у `list`, `lis` и стиля счётчика `cntCounter_item_UR`. */
const LIST_STYLE_TYPES: Record<string, string> = {
  N: NAME_NONE,
  S: 'Square',
  D: 'Disc',
  DC: 'Decimal',
  DCLZ: 'DecimalLeadingZero',
  LR: 'LowerRoman',
  UR: 'UpperRoman',
  C: 'Circle',
};
/** Имя атрибута в `attr()` или счётчика в `counter()`: `href`, `data-label`, `item`. */
const REGEXP_CSS_NAME = /^[A-Za-z][A-Za-z\d-]*$/;
/** Ключевые слова `content` — всё, что пишется без кавычек и не функция. */
const CONTENT_KEYWORDS: Record<string, 1> = {
  none: 1,
  normal: 1,
  'open-quote': 1,
  'close-quote': 1,
  'no-open-quote': 1,
  'no-close-quote': 1,
};

/**
 * Берёт имя шрифта в кавычки, если оно из нескольких слов.
 *
 * Уже закавыченное имя второй раз не оборачивается: `ff_"My_Font"` давало
 * `font-family:""My Font""` — вложенные кавычки, и правило браузер отбрасывает
 *.
 */
function fontNameQuote(v: string): string {
  if (v[0] === DOUBLE_QUOTE || v[0] === QUOTE) {
    return v;
  }
  return v[0] === DASH
    ? DOUBLE_QUOTE + v.slice(1) + DOUBLE_QUOTE
    : (
      v.indexOf(SPACE) > -1 ? DOUBLE_QUOTE + v + DOUBLE_QUOTE : v
    );
}

/**
 * Хендлеры темы «typography».
 *
 * @param ctx — контекст пресета (`createContext`)
 */
export function registerTypography(ctx: StandardContext): void {
  const {
    assertKnownWord,
    escapeQuote,
    instance,
    intval,
    lengthOrWord,
    map,
    mn,
    registerLengthProperties,
    registerSingleProperties,
    spaceNormalize,
    synonymProvider,
    toKebabCase,
    validateUnit,
    valueNormalize,
  } = ctx;

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
   * `owr` — `overflow-wrap`. Старое имя свойства, `word-wrap`, пишется опцией `overflowWrapMode` — для
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

  mn({
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
      'fontVariantNumeric', FONT_VARIANT_NUMERIC_SYNONYMS, 0, undefined, undefined, 1,
    )),
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
  // Переименовано: `ww` (`word-wrap` — старое имя `overflow-wrap`) → `owr`.
  mn('ww', (p) => throwRenamed('ww' + p.suffix, 'owr' + (WW_RENAMED[p.suffix] || p.suffix)));

  registerLengthProperties({
    f: [
      'fontSize',
      '',
      1,
      1,
    ],
  });

  mn({

    // font-weight
    fw: (p) => {
      const camel = p.camel;
      // `fw6` → 600 (цифра-сокращение) и `fw600` → 600 (значение CSS как есть).
      // Раньше второе молча давало 900: число всегда умножалось на 100
      // и зажималось в 1..9, то есть самая естественная запись была неверной.
      const num = p.num;
      const v = cssVarValue(p.suffix);
      // Нераспознанный суффикс молча давал `font-weight:100`: `fw--v`, `fw_x`.
      v || camel || num || !p.suffix || throwInvalid(MSG_VALUE + p.suffix + MSG_IS_INVALID_FOR
        + 'fw": expected a digit (`fw6`), a weight (`fw600`), a letter (`fwB`) or a variable');
      return p.negative ? 0 : styleWrap({
        fontWeight: v || (camel
        // Слово не проверялось: `fwZzz` давало `font-weight:zzz`, `fwA` —
        // `font-weight:a`, `fwF00` — `font-weight:f`. Список закрытый,
        // выводится из того же словаря кратких записей; слово пишется буквой
        // (`fwB`, а `fwBold` бракуется).
          ? assertKnownWord(
            toKebabCase(FONT_WEIGHT_SYNONYMS[camel] || camel), camel, FONT_WEIGHT_SYNONYMS,
            FONT_WEIGHT_KEYWORDS, p.name, p.suffix,
          )
        // `num` приходит из разбора строкой; сравнение и деление ведём
        // числом явно, а не полагаясь на приведение оператором.
          : '' + (+(num as string) >= 100
            ? 100 * intval(
              +(num as string) / 100, 1, 1, 9,
            )
            : 100 * intval(
              num, 1, 1, 9,
            ))),
      }, 1);
    },
    /**
   * `line-height`. **Один способ на каждый смысл:** голое число — безразмерный
   * множитель, как в CSS (`lh1.5` → `line-height:1.5`; потомки наследуют
   * коэффициент); любая единица пишется явно и проходит как есть
   * (`lh20px`, `lh1.2em`, `lh150%` → `line-height:150%`).
   *
   * Так по двум причинам. Первая: голое число молча получало
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
   * синонима из ~30 значений; теперь есть все. Практически ходовые тут
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
   * (`solid`/`wavy`/…) и толщина (`auto`/`from-font`) есть
   * ТОЛЬКО здесь: `text-decoration-line` их не принимает, а карту `TD_SYNONYMS`
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
      }, 0, undefined, OFFSET_LENGTH, 1,
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
      }, 0, undefined, undefined, 1,
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
   * `text-wrap`. Карта синонимов пересобрана: прежние `N`/`NO`/`U`/`S`
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
   * размеры в нотации; единицы указываются явно (`lts0.06em`). Раньше
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
   * `white-space-collapse`. Карта пересобрана: прежние
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
    // `composite`: кавычки задаются парами — открывающая и закрывающая, и
    // пар может быть несколько (для вложенных уровней).
    q: synonymProvider(
      'quotes', {
        A: NAME_AUTO,
        N: NAME_NONE,
        RU: '\'\\00AB\'_\'\\00BB\'_\'\\201E\'_\'\\201C\'',
        EN: '\'\\201C\'_\'\\201D\'_\'\\2018\'_\'\\2019\'',
      }, 1, undefined, undefined, 1,
    ),
    lis: synonymProvider(
      'listStyle', {
        ...LIST_STYLE_TYPES,
        I: 'Inside',
        O: 'Outside',
        // `composite`: тип, позиция и картинка в одном значении
        // (`list-style: disc inside`).
      }, 0, undefined, undefined, 1,
    ),
    lisp: synonymProvider(
      'listStylePosition', {
        I: 'Inside',
        O: 'Outside',
      }, 1,
    ),
    list: synonymProvider(
      'listStyleType', LIST_STYLE_TYPES, 1,
    ),
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
      }, 0, undefined, OFFSET_LENGTH,
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
    /**
   * `font` — только то, что не выражается атомарно.
   *
   * Shorthand принимает либо системный шрифт одним словом, либо набор из
   * размера, высоты строки и семейства. Второе выражается атомарными
   * `f`/`lh`/`ff` — `font16px/1.55_--font` это `f16 lh1.55 ff--font`, то есть
   * второй способ записать то же самое. Поэтому (как и общий `ol`) составная форма убрана, и хендлер сужен до слов.
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
      assertNoFunction(
        s, p.name, () => '',
      );
      v = valueNormalize(s);
      // Пробел в значении означает составную форму (`16px/1.55 var(--font)`) —
      // её и убираем, даже когда внутри есть подстановка. Целиком подстановка
      // (`font--v`) проходит: что в переменной, здесь не видно.
      v.indexOf(SPACE) > -1 && throwInvalid(MSG_VALUE + s + '" is invalid: '
      + 'size, line height and family are set by atomic tokens — '
      + '"f16 lh1.55 ff--font"; "font" only takes system fonts');
      return styleWrap({
        // Скобка — только от подстановки (`font--v`).
        font: v.indexOf(OPEN_PAREN) > -1
          ? v
          // Слово — буквой: `fontMenu` → «Write it shorter: "fontM"».
          : assertKnownWord(
            v, s, FONT_SYNONYMS, FONT_KEYWORDS, p.name, s,
          ),
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
      // (`ff10px` давало `font-family:10px`), функция — тоже.
      assertNoFunction(
        s, p.name, () => '',
      );
      const list = map(fontNameNormalize(s).split(REGEXP_COMMA), fontNameQuote);
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
   * Раньше кавычки писал автор (`cnt_"Hello_World"`), а их отсутствие
   * никто не проверял: `cntHello` давало `content:hello`, `cnt_two_words` —
   * `content:two words`. По грамматике текст в `content` без кавычек
   * невалиден, и браузер такое правило отбрасывает.
   *
   * **Кавычка внутри текста экранируется**, а не служит признаком «автор
   * управляет сам»: `content: a "b" c` по грамматике невалиден, то есть
   * первая версия этой проверки оставляла дыру ровно там, где её закрывала.
   * `cnt_he_said_"hi"` → `content:"he said \"hi\""`.
   *
   * Не оборачивается подстановка (`cnt--v`). Функции — нативной формой: `cntAttr_href`,
   * `cntCounter_item_UR` ({@link CONTENT_FUNCTIONS}); скобка в начале текста (`cnt_attr\(href\)`) бракуется с
   * подсказкой, а не уходит в кавычки молча. Скобки внутри текста — текст: `cnt_see_\(note\)`.
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
      if (s[0] === UNDERSCORE ? REGEXP_FUNCTION_HEAD.test(s.slice(1)) : functionsStart(s, CONTENT_FUNCTIONS)) {
        return styleWrap({
          content: functionsValue(p, CONTENT_FUNCTIONS),
        });
      }
      v = valueNormalize(s);
      return styleWrap({
        content: s[0] === UNDERSCORE
        // Текста после `_` нет — пустая строка. Суффикс из НЕСКОЛЬКИХ
        // подчёркиваний бракуется: пробел пишется мнемоникой `cntS`, и
        // двух записей одного значения быть не должно.
          // Скобка, которой нет в суффиксе, — от подстановки (`cnt_--v`): её не кавычат. Скобка автора — текст.
          ? (v
            ? (v.indexOf(OPEN_PAREN) > -1 && s.indexOf(OPEN_PAREN) < 0 ? v
              // `content: "he said "hi""` обрывается на второй кавычке: кавычка и `\` внутри строки экранируются.
              : DOUBLE_QUOTE + escapeQuote(v) + DOUBLE_QUOTE)
            : (s.length > 1 && throwInvalid(MSG_VALUE + s
            + '" is invalid: a space is written as "cntS", an empty string as "cnt_"'),
            '""'))
          // Скобка здесь — только от подстановки (`cnt--v`): скобку автора забрал читатель функций выше.
          : (v.indexOf(OPEN_PAREN) > -1
            ? v
            // Слово с буквой полной записью бракуется: `cntNone` → `cntN`.
            : assertKnownWord(
              v, s, CONTENT_SYNONYMS, CONTENT_KEYWORDS, p.name, s,
            )),
      });
    },
  });
  /**
   * Функции `content` в нативной форме: `cntAttr_href` → `attr(href)`, `cntCounter_item_UR` →
   * `counter(item,upper-roman)` — стиль буквами `list` ({@link LIST_STYLE_TYPES}). Значение — одна функция: склейка
   * с текстом (`counter(item) ". "`) пишется переменной. У `url(…)`, `counters(…)` короткой записи нет — тоже
   * переменная.
   */
  const CONTENT_FUNCTIONS = functionSet(
    {
      Attr: {
        css: 'attr',
        min: 1,
        max: 1,
        named: 1,
        example: 'Attr_href',
        args: (args, call) => (REGEXP_CSS_NAME.test(args[0]) ? args[0]
          : call.fail('an attribute name')),
      },
      Counter: {
        css: 'counter',
        min: 1,
        max: 2,
        named: 1,
        example: 'Counter_item_UR',
        args: (args, call) => {
          const counter = REGEXP_CSS_NAME.test(args[0]) ? args[0] : call.fail('a counter name');
          if (args.length < 2) {
            return counter;
          }
          const style = cssVarValue(args[1]) || (LIST_STYLE_TYPES[args[1]] ? toKebabCase(LIST_STYLE_TYPES[args[1]])
            : call.fail('a list style letter: ' + Object.keys(LIST_STYLE_TYPES).join(LIST_SEPARATOR)));
          return counter + COMMA + style;
        },
      },
    }, 'a content function', 1,
  );

  registerSingleProperties({
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

    ti: [
      'textIndent',
      0,
      LENGTH_PERCENT | LENGTH_SIGN,
    ],
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
    // Группа F: `tbs4` → `tab-size:4`, `tbs2em`.
    tbs: ['tabSize'],
    tem: ['textEmphasis'],
    temp: [
      'textEmphasisPosition',
      1,
    ],
    tems: [
      'textEmphasisStyle',
      1,
    ],
  }, TYPOGRAPHY_VALUES);
}
