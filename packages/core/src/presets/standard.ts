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
const BORDER_STYLE_SYNONYMS = {
  N: 'None',
  H: 'Hidden',
  DT: 'Dotted',
  DS: 'Dashed',
  S: 'Solid',
  DB: 'Double',
  DTDS: 'DotDash',
  DTDTDS: 'DotDotDash',
  W: 'Wave',
  G: 'Groove',
  R: 'Ridge',
  I: 'Inset',
  O: 'Outset',
};
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
const UNITS = 'em,ex,%,px,cm,mm,in,pt,pc,ch,rem,vh,vw,vmin,vmax'.split(',');

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
 */
const REGEXP_SHADOW_SUFFIX = new RegExp('^(?:[0-9.]+(?:' + UNITS.join('|') + ')?)?(?:'
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
  function getVal(
    suffix: any,
    positive?: number,
    one?: number,
    defaultUnit?: string,
    noOtherName?: number,
    symonyms?: Record<string, any>,
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
        output[i] = toKebabCase(symonyms && symonyms[otherName] || otherName);
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
          ) : (p.sign || '') + (
            total
              ? toFixed(100 * floatNormalize(num, positive) / floatNormalize(total, positive)) + '%'
              : toFixed(num) + validateUnit(p.unit || defaultUnit)
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
    propName: string | string[], synonyms: Record<string, any>, priority?: number, _style?: Record<string, any>,
  ): MnHandler {
    let props: Record<string, number>;
    // Обратный индекс: длинное слово → краткая запись, строится из самого
    // словаря, поэтому новый синоним сразу начинает бракать свою длинную форму.
    const byWord: Record<string, string> = {};
    forIn(synonyms, (word: string, abbr: string) => {
      abbr && (byWord[valueNormalize(word)] = abbr);
    });
    function assertSynonymAbbr(p: any, value: string): void {
      const abbr = byWord[value];
      if (abbr && p.suffix !== abbr) {
        throwInvalid('Записывается короче: "' + p.name + abbr
          + '" вместо "' + p.name + p.suffix + '" — то же значение');
      }
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
  /** Бракует длинную запись цвета, у которой есть аббревиатура. */
  function assertColorAbbr(p: any): void {
    const abbr = p.camel && COLOR_SYNONYM_BY_WORD[p.camel.toLowerCase()];
    if (abbr) {
      throwInvalid('Цвет записывается короче: "' + p.name + abbr
      + '" вместо "' + p.name + p.camel + '"');
    }
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
      sidesSet: (v: any) => Record<string, any>, nosign?: any, one?: any,
    ): MnHandler {
      return (p: any) => {
        let suffix: string; let synonym: any;
        if (!(suffix = p.suffix)) {
          return normalizeDefault(p, 0);
        }
        if (synonym = SIZE_SYNONYMS[suffix]) {
          return normalizeDefault(p, synonym);
        }
        const v = getVal(
          suffix, nosign, one, 'px', 0, SIZE_SYNONYMS,
        );
        return styleWrap(sidesSet(v[0]), priority + v[1]);
      };
    }

    forIn({
      p: [
        'padding',
        0,
        1,
      ],
      m: ['margin'],
      b: [
        'border',
        '-width',
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
      ), '', 1,
    );
    mn('bs' + suffix, (p) => {
      let s, synonym;
      return (synonym = BORDER_STYLE_SYNONYMS[s = p.suffix])
        ? normalizeDefault(p, synonym)
        : (
          s
            ? styleWrap(bsSidesSet(valueNormalize(s)), priority + 1)
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
          const synonym = SIZE_SYNONYMS[suffix];
          if (synonym) {
            return normalizeDefault(p, synonym);
          }
          const v = getVal(
            suffix, 1, 1, 'px', 0, SIZE_SYNONYMS,
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
      // `normal` — initial value у row-gap/column-gap. В общую SIZE_SYNONYMS
      // его не добавить: там размеры (`w`/`h`/`p`/`m`), которым оно не подходит.
      if (suffix === 'N') {
        return normalizeDefault(p, 'Normal');
      }
      const synonym = SIZE_SYNONYMS[suffix];
      if (synonym) {
        return normalizeDefault(p, synonym);
      }
      const v = getVal(
        suffix, 1, 1, 'px', 0, SIZE_SYNONYMS,
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
        + '(' + floatNormalize(angle) + (p.unit || 'deg') + ')') : ''),
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
        transform: prefix + v + (p.unit || 'deg') + ')',
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
          REGEXP_SHADOW_SUFFIX.test(suffix) || throwInvalid('Запись "' + p.name + suffix + '" разобрана не полностью: после значения '
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
        let sample, v, color, i, ci = 0; // eslint-disable-line
          output = new Array(colorsLength);

          for (;ci < colorsLength; ci++) {
            color = colors[ci];
            sample = prefixIn
            + handler(
              p.x || 0, p.y || 0, value, p.r || 0, color,
            ).join('px ');
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
    sw: ['strokeWidth', 0],
    olw: [
      'outlineWidth',
      0,
      1,
    ],
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
      0,
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
      0,
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
    mn(pfx, (p) => {
      let style, suffix, synonym, v;
      return (synonym = synonyms[suffix = p.suffix])
        ? normalizeDefault(p, synonym)
        : (
          v = getVal(
            suffix || defaultValue,
            1, one, 'px', 0, synonyms,
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
          v = valueNormalize(s),
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
          ? toKebabCase(camel)
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

    olwTN: 'olwThin',
    olwM: 'olwMedium',
    olwTC: 'olwThick',
    'break': styleWrap({ // eslint-disable-line
      whiteSpace: 'normal',
      wordBreak: 'break-word',
    }),
    z: (p) => {
      let num;
      return p.camel ? 0 : ((num = p.num) ? styleWrap({
        zIndex: num,
      }) : normalizeDefault(p, 1));
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
          unit = p.unit,
          (num = p.num) ? styleWrap({
            lineHeight: num == '0' ? num : (unit ? num + unit : num),
          }) : normalizeDefault(p, '1')
        )
      );
    },
    tsa: (p) => {
      let num, camel, v;
      return p.negative ? 0 : (
        (v = cssVarValue(p.suffix || '')) ? styleWrap({
          textSizeAdjust: v, 
        }) : (p.value ? styleWrap({
          textSizeAdjust: (camel = p.camel)
            ? toKebabCase(camel)
            : ((num = p.num) == '0' ? num : (num + (p.unit || 'px'))),
        }) : normalizeDefault(p, '100%'))
      );
    },
    fsa: (p) => {
      let num, camel, v;
      return p.negative ? 0 : (
        (v = cssVarValue(p.suffix || '')) ? styleWrap({
          fontSizeAdjust: v, 
        }) : (p.value ? styleWrap({
          fontSizeAdjust: (camel = p.camel)
            ? (camel == 'N' ? 'none' : toKebabCase(camel))
            : ((num = p.num) == '0' ? num : (num + (p.unit || 'px'))),
        }) : 0)
      );
    },
    olo: (p) => {
      let num, camel;
      return (p.value ? styleWrap({
        outlineOffset: (camel = p.camel)
          ? toKebabCase(camel)
          : ((num = p.num) == '0' ? num : (num + (p.unit || 'px'))),
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
    td: synonymProvider('textDecoration', {
      ...TD_SYNONYMS,
      S: 'Solid',
      DB: 'Double',
      DT: 'Dotted',
      DS: 'Dashed',
      W: 'Wavy',
      A: 'Auto',
      FF: 'FromFont',
    }),
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
      let num, v;
      return p.suffix === 'N'
        ? normalizeDefault(p, 'Normal')
        : ((v = cssVarValue(p.suffix || '')) ? styleWrap({
          letterSpacing: v, 
        }) : (
          p.camel ? styleWrap({
            letterSpacing: toKebabCase(p.camel), 
          }) : (
            (num = p.num) != null ? styleWrap({
              letterSpacing: num == '0' ? num : ((p.sign || '') + num + (p.unit || 'px')),
            }) : 0
          )
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
    ol: synonymProvider('outline', OUTLINE_STYLE_SYNONYMS),
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
     */
    bgpx: synonymProvider(
      'backgroundPositionX', {
        L: 'Left',
        C: 'Center',
        R: 'Right',
        XS: 'XStart',
        XE: 'XEnd',
      }, 2,
    ),
    bgpy: synonymProvider(
      'backgroundPositionY', {
        T: 'Top',
        C: 'Center',
        B: 'Bottom',
        YS: 'YStart',
        YE: 'YEnd',
      }, 2,
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
    va: synonymProvider('verticalAlign', {
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
    }),
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
      1,
    ],
    apc: ['appearance'],

    ti: [
      'textIndent',
      0,
      1,
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
      1,
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
      1,
    ],
    tdst: ['textDecorationStyle', 2],
    tuo: [
      'textUnderlineOffset',
      2,
      1,
    ],
    tup: ['textUnderlinePosition', 2],

    ts: ['transformStyle'],
    mbm: ['mixBlendMode'],
    bsp: [
      'borderSpacing',
      0,
      1,
    ],
    // bdrs: ['borderRadius'],
    zm: ['zoom'],
    tem: ['textEmphasis'],
    temp: ['textEmphasisPosition', 1],
    tems: ['textEmphasisStyle', 1],
    ir: ['imageRendering'],
  }, ([
    propName,
    priority,
    lengthy,
    autoRepeat]: [string, number?, number?, number?,
  ], essenceName: string) => {
    // §6.3: `priority || 0` вычислялся на каждый вызов хендлера, причём дважды —
    // выносим на холодный путь регистрации.
    const stylePriority = priority || 0;
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
      style[propName] = lengthy
        ? defaultUnitNormalize(valueNormalize(s))
        : valueNormalize(s);
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
