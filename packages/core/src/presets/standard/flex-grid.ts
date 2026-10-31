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
import {
  AUTO,
  CENTER,
  CLOSE_PAREN,
  DASH,
  DOUBLE_QUOTE,
  FIT_CONTENT,
  GAP_SYNONYMS,
  HUNDRED_PERCENT,
  LENGTH_PERCENT,
  LIST_SEPARATOR,
  NAME_AUTO,
  NAME_BASELINE,
  NAME_CENTER,
  NAME_END,
  NAME_LEFT,
  NAME_NORMAL,
  NAME_NOWRAP,
  NAME_RIGHT,
  NAME_START,
  NAME_STRETCH,
  NAME_WRAP,
  NONE,
  OPEN_PAREN,
  PX,
  SEMICOLON,
  SPACE,
  SPAN,
  UNDERSCORE,
  UNITS,
  ZERO,
  wordsSet,
} from './words';
import {
  HINT_OPEN,
  MSG_AS,
  MSG_COLON,
  MSG_INSTEAD_OF,
  MSG_IS_INVALID_FOR,
  MSG_VALUE,
  MSG_WRITE_SHORTER,
  availableHint,
  throwInvalid,
} from './messages';
import type {
  FunctionCall,
  FunctionForm,
  SingleValues,
} from './functions';
import {
  REGEXP_BARE_NUMBER,
  REGEXP_LENGTH_PART,
  cssVarValue,
  functionLength,
  functionSet,
  lengthPartRegExp,
  splitValueParts,
} from './functions';
import {
  REGEXP_SLOT_IDENT,
  REGEXP_VALUE_INTEGER,
  normalizeDefault,
  snakeLeftTrim,
  styleWrap,
} from './context';

const SLASH = '/';
const FLEX_START = 'flex-start';
const FLEX_END = 'flex-end';
const STRETCH = 'stretch';
const NAME_FLEX_END = 'FlexEnd';
const NAME_FLEX_START = 'FlexStart';
const NAME_SELF_START = 'SelfStart';
const NAME_SELF_END = 'SelfEnd';
const NAME_FIRST_BASELINE = 'First_baseline';
const NAME_LAST_BASELINE = 'Last_baseline';
const NAME_ANCHOR_CENTER = 'AnchorCenter';
/** `gap`-семейство, `letter-spacing`, `word-spacing`. */
const KEYWORDS_NORMAL: Record<string, 1> = {
  normal: 1,
};

/**
 * Буквы выравнивания: одни и те же у `ac`/`jc`, `ai`/`ji`, `as`/`js` и у пар `plc`/`pli`/`pls`, где первая часть —
 * `align-*`, вторая — `justify-*`.
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
  // Набор тот же, что у `ac`/`as`.
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
  // Буквы те же, что у `as`/`ac`: `S` — Start, `ST` — Stretch.
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
const REGEXP_VALUE_NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)$/;
/** Число с дробной частью — `flex-grow`, `flex-shrink`. */
const REGEXP_SLOT_NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)$/;
/** Ключевые слова `flex-basis`, кроме длины. */
const FLEX_BASIS_KEYWORDS = wordsSet('auto content min-content max-content fit-content');
/** Слова, допустимые в `grid` помимо дорожек. */
const GRID_KEYWORDS = wordsSet('none auto-flow dense');
/** Область сетки — строка в кавычках: `"a b"`. */
const REGEXP_GRID_AREA = /^(?:"[^"]*"|'[^']*')$/;
/** Начало строки в кавычках, которая ещё не закрыта. */
const REGEXP_QUOTE_OPEN = /^["'][^"']*$/;
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
 * Повтор дорожек нативной формой: число повторов, `x`, дорожки через `;` — `3x1fr` → `repeat(3, 1fr)`,
 * `2x1fr;2fr` → `repeat(2, 1fr 2fr)`. Так говорят дизайнеры («3 × 1fr»); `x` — ещё и единица разрешения (`dppx`), но
 * дорожка разрешением не бывает, и в шаблоне сетки запись однозначна. Повтор — часть списка: `gtc3x1fr_200px` →
 * `repeat(3, 1fr) 200px`. Повторы `auto-fit`/`auto-fill` — сокращение `AF240` ({@link autoRepeatValue}).
 */
const REGEXP_TRACK_REPEAT = /^(\d+)x(.*)$/;

/** Слово-аргумент функций дорожек: `A` — как у `gacA`, внутренние размеры — словом, как у `gacMinContent`. */
const TRACK_ARG_WORDS: Record<string, string> = {
  A: AUTO,
  MinContent: 'min-content',
  MaxContent: 'max-content',
};
/** Доля свободного места: `1fr` — только верхняя граница `minmax()`. */
const REGEXP_FLEX = /^(?:\d+\.?\d*|\.\d+)fr$/;
/** Функции дорожки — значение целиком: внутри списка дорожек функция пишется переменной. */
const TRACK_FORMS: Record<string, FunctionForm> = {
  Minmax: {
    css: 'minmax',
    min: 2,
    max: 2,
    example: 'Minmax100px_1fr',
    args: (args, call) => trackArg(args[0], call) + LIST_SEPARATOR + trackArg(
      args[1], call, 1,
    ),
  },
  FitContent: {
    css: FIT_CONTENT,
    min: 1,
    max: 1,
    example: 'FitContent200px',
    args: (args, call) => functionLength(
      args[0], call, undefined, 1,
    ),
  },
};
/**
 * Функции неявных дорожек `gac`/`gar`: `garMinmax100px_A` → `grid-auto-rows:minmax(100px, auto)`.
 */
const TRACK_FUNCTIONS = functionSet(
  TRACK_FORMS, 'a track function', 1,
);
/**
 * Функции шаблонов `gtc`/`gtr` — те же; на скобку `repeat(` — повтор нативной формой: `gtc3x1fr`, `gtcAF240`.
 */
const TEMPLATE_TRACK_FUNCTIONS = functionSet(
  TRACK_FORMS, 'a track function', 1, undefined, {
    Repeat: [
      '3x1fr',
      'AF240',
    ],
  },
);

/** Номер линии в `<grid-line>`: целое, не ноль. */
const REGEXP_GRID_LINE_NUMBER = /^[-+]?0*[1-9]\d*$/;

/** `flex-flow` — направление и перенос, оба из закрытых списков. */
const FLEX_FLOW_KEYWORDS = wordsSet('row row-reverse column column-reverse'
  + ' nowrap wrap wrap-reverse');

/** Сетка и флекс: слоты, функции дорожек, числа. */
const FLEX_GRID_VALUES: SingleValues = {
  slots: {
    flexFlow: flexFlowValue,
    grid: gridValue,
    gridTemplate: gridValue,
    gridTemplateColumns: trackValue,
    gridTemplateRows: trackValue,
    gridAutoColumns: trackValue,
    gridAutoRows: trackValue,
    gridRow: gridLineValue,
    gridColumn: gridLineValue,
    gridRowStart: gridLineSingleValue,
    gridRowEnd: gridLineSingleValue,
    gridColumnStart: gridLineSingleValue,
    gridColumnEnd: gridLineSingleValue,
    flex: flexValue,
  },
  functions: {
    gridTemplateColumns: TEMPLATE_TRACK_FUNCTIONS,
    gridTemplateRows: TEMPLATE_TRACK_FUNCTIONS,
    gridAutoColumns: TRACK_FUNCTIONS,
    gridAutoRows: TRACK_FUNCTIONS,
  },
  patterns: {
    order: REGEXP_VALUE_INTEGER,
    flexGrow: REGEXP_VALUE_NUMBER,
    flexShrink: REGEXP_VALUE_NUMBER,
  },
  parenHints: {
    grid: gridRepeatHint,
    gridTemplate: gridRepeatHint,
  },
};

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
  let repeated: string | undefined;
  // Скобку автора бракует общий путь одиночных свойств с подсказкой про повтор; скобка в части — от
  // подстановки.
  const gridExample = essenceName + '1fr_/_3x1fr';
  for (; i < l; i++) {
    part = parts[i];
    if ((repeated = trackRepeat(
      part, prefix, gridExample,
    ))) {
      parts[i] = repeated;
      continue;
    }
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
/**
 * Часть шаблона сетки — повтор `3x1fr`, если она так записана. Повторяется размер или переменная; слово, `minmax()` и
 * прочее внутри повтора — через переменную.
 * @param part часть значения после нормализации: переменная внутри повтора ещё не развёрнута (`3x--w`)
 * @param prefix начало сообщения об ошибке
 * @param example запись для подсказки: `gtc3x1fr`, у `g` — `g1fr_/_3x1fr`
 * @returns `repeat(…)`, или `undefined`, когда часть — не повтор
 * @example trackRepeat('2x1fr;2fr', prefix, 'gtc3x1fr') // 'repeat(2, 1fr 2fr)'
 */
function trackRepeat(
  part: string, prefix: string, example: string,
): string | undefined {
  const m = REGEXP_TRACK_REPEAT.exec(part);
  if (!m) {
    return;
  }
  example = MSG_AS + example + DOUBLE_QUOTE;
  parseInt(m[1], 10) > 0 || throwInvalid(prefix + 'the count of a repeat is a whole number from 1' + example);
  const tracks = m[2].split(SEMICOLON);
  let i = tracks.length;
  let track: string;
  while (i--) {
    track = tracks[i];
    tracks[i] = cssVarValue(track) || (REGEXP_TRACK_SIZE.test(track) ? track
      : throwInvalid(prefix + 'a repeated track is a size (length, percent, fr) or a variable, ";" between tracks'
        + example));
  }
  return 'repeat(' + m[1] + LIST_SEPARATOR + tracks.join(SPACE) + CLOSE_PAREN;
}

/**
 * Дорожки сетки: `gtc`, `gtr`, `gac`, `gar`.
 *
 * Были permissive pass-through: `gtcZzz` давало
 * `grid-template-columns:zzz`, `gtc10zz` — `10zz`, `gtc10` — `10` (размер
 * дорожки без единицы невалиден, в отличие от голого числа в других местах
 * нотации).
 *
 * Повтор — нативной формой `3x1fr` ({@link trackRepeat}), только у явных шаблонов: у `gac`/`gar` грамматика — список
 * размеров. Функции дорожек (`Minmax`, `FitContent`) — значение целиком ({@link TRACK_FUNCTIONS}), скобка автора сюда
 * не доходит: её бракует читатель функций. Скобка в части — от подстановки (`gtc1fr_--x` → `var(--x)`).
 */
function trackValue(
  parts: string[], raw: string, essenceName: string,
): string {
  const l = parts.length;
  // У явных шаблонов (`gtc`/`gtr`) список слов шире, чем у неявных
  // (`gac`/`gar`) — см. TRACK_KEYWORDS. Различает вторая буква тега.
  const template = essenceName[1] === 't';
  const words = template ? TEMPLATE_TRACK_KEYWORDS : TRACK_KEYWORDS;
  const prefix = MSG_VALUE + raw + MSG_IS_INVALID_FOR + essenceName + MSG_COLON;
  let i = 0;
  let part: string;
  let repeated: string | undefined;
  for (; i < l; i++) {
    part = parts[i];
    if (template && (repeated = trackRepeat(
      part, prefix, essenceName + '3x1fr',
    ))) {
      parts[i] = repeated;
      continue;
    }
    (part.indexOf(OPEN_PAREN) > -1
      || words[part]
      || REGEXP_TRACK_SIZE.test(part)
      || REGEXP_LINE_NAME.test(part))
      || throwInvalid(prefix + 'a track is a size (length, percent, fr), a keyword'
        + (template ? ', a repeat as "' + essenceName + '3x1fr"' : '') + ' or a variable; a function is the whole value, as "'
        + essenceName + TRACK_FUNCTIONS.first.example + DOUBLE_QUOTE);
  }
  return parts.join(SPACE);
}
/**
 * Аргумент функции дорожки: длина (голое число — пиксели, как у других функций и у `AF240`), процент, слово
 * {@link TRACK_ARG_WORDS} или переменная; доля `fr` — где её допускает грамматика.
 * @param v аргумент
 * @param call вызов — для ошибки
 * @param flex доля допустима (верхняя граница `minmax()`)
 * @returns размер CSS
 * @example trackArg('100', call) // '100px'
 */
function trackArg(
  v: string, call: FunctionCall, flex?: 1,
): string {
  return cssVarValue(v) || TRACK_ARG_WORDS[v]
    || (v[0] !== DASH && (flex && REGEXP_FLEX.test(v) ? v
      : REGEXP_BARE_NUMBER.test(v) ? (v === ZERO ? v : v + PX)
        : REGEXP_LENGTH_PART.test(v) && v))
    || call.fail('a length, a percent' + (flex ? ', a fraction ("1fr")' : '') + ', "A" (auto), "MinContent" or '
      + '"MaxContent"');
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
    // Подстановка (`gcsS_--n` → `var(--n)`) может дать и номер, и имя — разбирать её нечем. Функцию автора бракует
    // общий путь одиночных свойств раньше.
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

/** `g` / `gt`: повтора нет в наборе форм, подсказка о нём — своя. */
function gridRepeatHint(essenceName: string): string {
  return '. A repeat of tracks is "3x1fr", as "' + essenceName + '1fr_/_3x1fr"';
}

/**
 * Хендлеры темы «flex-grid».
 *
 * @param ctx — контекст пресета (`createContext`)
 */
export function registerFlexGrid(ctx: StandardContext): void {
  const {
    assertNoLetter,
    forIn,
    getVal,
    mn,
    registerLengthProperties,
    registerSingleProperties,
    synonymProvider,
    valueNormalize,
  } = ctx;

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
      const style: MnStyle = {};
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

  /**
   * Флекс-выравнивание буквами — `fxaC`, `fyaST`: объявление с префиксной парой старого `box-*`. Полное слово
   * (`fxaCenter`, `fya_stretch`) — вторая запись того же правила, бракуется с подсказкой; незнакомая буква —
   * со списком букв.
   */
  function flexAlignProvider(name: string, styles: Record<string, [string, Record<string, string>]>): MnHandler {
    const words: Record<string, string> = {};
    const items: string[] = [];
    forIn(styles, (entry: [string, Record<string, string>], letter: string) => {
      words[letter] = entry[0];
      items.push(name + letter + HINT_OPEN + valueNormalize(entry[0]) + CLOSE_PAREN);
    });
    // Свойства записи — у всех букв одни (`justify-content` и старый `box-pack`).
    const props = Object.keys(styles[Object.keys(styles)[0]][1]);
    return (p) => {
      const s = p.suffix;
      const entry = styles[s];
      const v = cssVarValue(s);
      const style: Record<string, string> = {};
      if (entry) {
        return styleWrap(entry[1], 1);
      }
      if (v) {
        for (const prop of props) {
          style[prop] = v;
        }
        return styleWrap(style, 1);
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

  /**
   * `place-content` / `-items` / `-self`: `align` и, через `_`, `justify`. Буквы частей —
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
      // CSS-wide keyword — буквами, его ставит ядро. Переменная с `_` в имени закрывается `;`
      // (`plc--my_gap;`), иначе `_` делит части: `plc--a_C` → `var(--a) center`.
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

  registerLengthProperties({
    // `grid-gap` — сокращение для двух дорожек (`row column`), поэтому здесь
    // два значения допустимы, а у покомпонентных `ggc`/`ggr` — нет.
    gg: [
      'gridGap',
      0,
      1,
      0,
      {
        N: NAME_NORMAL,
      },
    ],
    ggc: [
      'gridColumnGap',
      0,
      2,
      1,
      {
        N: NAME_NORMAL,
      },
    ],
    ggr: [
      'gridRowGap',
      0,
      2,
      1,
      {
        N: NAME_NORMAL,
      },
    ],
  });

  mn({
    jc: synonymProvider('justifyContent', {
      '': NAME_CENTER,
      ...JUSTIFY_CONTENT_WORDS,
    }),
    ai: synonymProvider('alignItems', {
      '': NAME_CENTER,
      ...ALIGN_ITEMS_WORDS,
    }),
    as: synonymProvider('alignSelf', ALIGN_SELF_WORDS),
    /**
     * `justify-self` / `justify-items` — grid-раскладка. Буквы `S`/`ST`/`E`/`C`/`N`/`B`
     * согласованы с `jc`/`ai`/`as`/`ac`; `L`/`R` — как у `jc`, `justify-items`
     * и `justify-self` их тоже принимают (унаследовано от `text-align`).
     */
    js: synonymProvider('justifySelf', JUSTIFY_SELF_WORDS),
    ji: synonymProvider('justifyItems', JUSTIFY_ITEMS_WORDS),
    ac: synonymProvider('alignContent', ALIGN_CONTENT_WORDS),
    fxd: synonymProvider(
      'flexDirection', {
        C: 'Column',
        CR: 'ColumnReverse',
        R: 'Row',
        RR: 'RowReverse',
      }, 1,
    ),
    fxw: synonymProvider(
      'flexWrap', {
        NW: NAME_NOWRAP,
        W: NAME_WRAP,
        WR: 'WrapReverse',
      }, 1,
    ),
  });

  registerSingleProperties({



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
  }, FLEX_GRID_VALUES);
}
