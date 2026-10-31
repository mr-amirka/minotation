import type {
  MnEssenceParams,
} from '../../core/types';
import {
  CSS_WIDE_LETTERS,
} from '../../core/utils';
import {
  MnHandler,
  MnHandlerResult,
  MnInstance,
} from '../../types';
import type {
  LengthRule,
} from './words';
import {
  CLOSE_PAREN,
  COLOR_SYNONYMS,
  COMMA,
  DASH,
  DOT,
  DOUBLE_QUOTE,
  ENUM_KEYWORDS,
  ENUM_MULTI,
  GLOBAL_KEYWORDS,
  LENGTH_MULTI,
  LENGTH_PERCENT,
  LENGTH_SIGN,
  LIST_SEPARATOR,
  N,
  NONE,
  OPEN_PAREN,
  PERCENT,
  POSITION_ANY,
  POSITION_AXES,
  POSITION_CORNERS,
  POSITION_KEYWORDS,
  POSITION_OFFSET,
  POSITION_X,
  POSITION_Y,
  PX,
  QUOTE,
  S,
  SEMICOLON,
  SPACE,
  UNDERSCORE,
  UNITS,
  VALUE_ABBREVIATIONS,
  VAR_OPEN,
  ZERO,
} from './words';
import {
  HINT_OPEN,
  MSG_COLON,
  MSG_COLON_QUOTE,
  MSG_INSTEAD_OF,
  MSG_IS_INVALID_FOR,
  MSG_SAME_VALUE,
  MSG_VALUE,
  MSG_WRITE_SHORTER,
  availableHint,
  enumHint,
  notationWord,
  shorterSuffix,
  throwInvalid,
  withSuspectCheck,
} from './messages';
import type {
  FunctionSet,
  SingleValues,
} from './functions';
import {
  NO_VALUES,
  REGEXP_BARE_NUMBER,
  REGEXP_LENGTH_PART,
  REGEXP_VAR_UNDERSCORE,
  assertEnumValue,
  assertNoFunction,
  cssVarValue,
  functionsStart,
  functionsValue,
  splitValueParts,
} from './functions';

const REGEXP_TRIM_SNAKE_LEFT = /^_+/g;
export const REGEXP_DOTS = /\./g;


const PATTERN_VAR = '((-):env?((--[^;,]+)(,\\d+([a-z%]+):vu?):va?):vv;?)';
// eslint-disable-next-line
const PATTERN_VAR_ADD = '(-):nva?((--[^;,]+)(,[0-9\\.]+([a-z%]+):vua?):vaa?):vva;?';
export const PATTERN_DIGITS = '(-?[0-9\\.]+)';

// eslint-disable-next-line
// `;?` после имени переменной — тот же необязательный терминатор, что в
// PATTERN_VAR. Цветовому пути он не нужен для разбора (здесь нет разреза по
// `_`, поэтому `c--my_ink` работает и без него), но пишущий токен не обязан
// помнить, какой хендлер каким путём разбирается: без `;?` привычное
// `c--my_ink;` молча не давало правила (2026-09-23).
export const PATTERN_BASE_COLOR = '([A-Z][a-z][A-Za-z]+):camel|([A-Fa-f0-9]+(\\.[0-9]+)?):color|(-?--[^;]+):vv;?';
export const PATTERN_COLOR = '^(' + PATTERN_BASE_COLOR + '):value$';

const PATTERN_VAL = '^(((([A-Za-z]+):otherName|([-]):sign?'
  + PATTERN_DIGITS + ':num(/' + PATTERN_DIGITS
  + ':total?)?):value([a-z%]+):unit?)|'
  + PATTERN_VAR + '):vl(([-+]):sa(([0-9\\.]+):addv([a-z%]+):addu?|'
  + PATTERN_VAR_ADD + ')):add?$';
export function floatNormalize(v: any, nosign?: number): number {
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

export function replace(
  v: any, from: string | RegExp, to: string,
): string {
  return ('' + v).replace(from, to);
}
export function snakeLeftTrim(v: string): string {
  return replace(
    v, REGEXP_TRIM_SNAKE_LEFT, '',
  );
}
export function styleWrap(style: Record<string, any>, priority?: number): MnHandlerResult {
  return {
    style,
    priority: priority || 0,
  };
}
/** Значение-слово: только буквы и дефисы, без цифр, скобок и единиц. */
const REGEXP_BARE_WORD = /^[a-z][a-z-]*$/;
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
 * Записи картинки у читателя `bg` / `mk` / `bi` — для сообщений об ошибке: одна строка на все три места.
 * @param name имя хендлера
 * @returns «a gradient (`bgF00-00F`), a variable or `bgN`»
 */
function imageForms(name: string): string {
  return 'a gradient (`' + name + 'F00-00F`), a variable or `' + name + 'N`';
}
/**
 * Картинка по пути — `_`-форма `bgi`, `lisi`, `mk` и `bi` (D-122, D-127): `bgi_hero\.jpg` → `url("hero.jpg")`. Одна запись на
 * значение: у переменной (`bgi_--x`) и ключевого слова (`bgi_none`, `bgi_inherit`) своя запись без `_`, функция в токене
 * не пишется (`bgi_url\(a\.png\)`, D-121), пустой путь — ошибка; каждый случай бракуется с подсказкой.
 * @param path путь без ведущего `_`, как написан
 * @param name имя хендлера — для сообщений
 * @param letters буквы хендлера → слово CSS: слово путём — вторая запись (`cpth_border-box` → `cpthBB`, D-113)
 * @returns `url("…")`
 * @example imagePathValue('img/a.png', 'bgi') // 'url("img/a.png")'
 */
export function imagePathValue(
  path: string, name: string, letters?: Record<string, string>,
): string {
  const word = path.toLowerCase();
  const written = name + UNDERSCORE + path;
  let letter: string;
  for (letter in letters) { // eslint-disable-line
    (letters as Record<string, string>)[letter] === word && throwInvalid(MSG_WRITE_SHORTER + name + letter + MSG_INSTEAD_OF + written
      + MSG_SAME_VALUE);
  }
  const head = MSG_VALUE + UNDERSCORE + path + MSG_IS_INVALID_FOR + name + '": ';
  path || throwInvalid(head + 'the path after "_" is empty — as "' + name + '_a\\.png"');
  cssVarValue(path) && throwInvalid('Write the variable without "_": "' + name + path + MSG_INSTEAD_OF + written
    + MSG_SAME_VALUE);
  word === NONE && throwInvalid(MSG_WRITE_SHORTER + name + N + MSG_INSTEAD_OF + written + MSG_SAME_VALUE);
  GLOBAL_KEYWORDS[word] && throwInvalid(MSG_WRITE_SHORTER + name + CSS_WIDE_LETTERS[word] + MSG_INSTEAD_OF
    + written + MSG_SAME_VALUE);
  path.indexOf(OPEN_PAREN) > -1 && throwInvalid(head + 'a function is not written in a class — the path alone, as "'
    + name + '_a\\.png"');
  return 'url("' + path + '")';
}
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
export const REGEXP_VALUE_INTEGER = /^[-+]?\d+$/;
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
/** Подстановка — годится в любой слот, что внутри неё, здесь не видно. */
export const REGEXP_SUBSTITUTION = /^(?:var|env)\(/;
/**
 * Делит по запятым ВЕРХНЕГО уровня — запятые внутри скобок остаются в части.
 *
 * `cubic-bezier(0,0,1,1)` иначе распадается на четыре куска, и переход
 * бракуется на ровном месте.
 * @param v значение
 * @returns части по порядку
 * @example splitTopLevel('a(1,2),b') // ['a(1,2)', 'b']
 */
export function splitTopLevel(v: string): string[] {
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
export const REGEXP_SLOT_INTEGER = /^[-+]?\d+$/;
/** Имя счётчика или области — произвольный идентификатор CSS. */
export const REGEXP_SLOT_IDENT = /^-?[A-Za-z_][\w-]*$/;
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
/** Готовое значение — градиент (а не цвет-fallback из `colorGetBackground`). */
function isGradientValue(v: string): boolean {
  return REGEXP_GRADIENT_HEAD.test(v);
}
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
export function calc(
  v: any, sign: string, add: any,
): string {
  return 'calc(' + v + SPACE + sign + SPACE + add + CLOSE_PAREN;
}
/**
 * Значение хендлера по умолчанию — для голого имени (`z` → `z1`). Непустой суффикс, который хендлер не разобрал,
 * — брак: раньше `z--v`, `dn_x`, `rx--v` молча давали значение по умолчанию (`z-index:1`, `250ms`, `180deg`).
 * @param p параметры хендлера
 * @param def значение по умолчанию
 * @returns ссылка на запись со значением по умолчанию
 * @example normalizeDefault({ name: 'z', suffix: '', ni: '' }, 1) // { exts: ['z1'] }
 */
export function normalizeDefault(p: MnEssenceParams, def?: string | number): MnHandlerResult {
  p.suffix && throwInvalid(MSG_VALUE + p.suffix + MSG_IS_INVALID_FOR + p.name + DOUBLE_QUOTE);
  return {
    exts: [p.name + (def || 0) + p.ni],
  };
}

/**
 * Помощники пресета, которым нужен `mn.utils`: строятся один раз на экземпляр в `setup` и передаются каждому
 * предметному файлу (D-130).
 *
 * @param instance — экземпляр minotation
 * @returns контекст пресета
 */
export function createContext(instance: MnInstance) {
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
    // Функции свойства в нативной форме (D-124): `ttfSteps4_JE`. Суффикс, который начинается их именем (или
    // содержит скобку), читает {@link functionsValue}; остальное — словарь, как раньше.
    functions?: FunctionSet,
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
     * Одна часть значения: слово из словаря, число (если оно тут законно) или подстановка — функцию автора
     * {@link assertNoFunction} бракует раньше (D-124). Возвращает 1, если часть — длина: составное значение считает их.
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
          assertNoFunction(
            s, p.name, () => abbrHint(p.name),
          );
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
        if (functions && functionsStart(s, functions)) {
          style = {};
          style[propName as string] = functionsValue(p, functions);
          return styleWrap(style, priority);
        }
        assertNoFunction(
          s, p.name, () => abbrHint(p.name),
        );
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
    if (hex.indexOf(DOT) > -1) {
      return;
    }
    const form = HEX_ALPHA_FORM[hex.length];
    if (!form) {
      return;
    }
    const alpha = parseInt(hex.slice(hex.length - form[0]), 16);
    return hex.slice(0, hex.length - form[0]) + DOT
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
 * переменной, картинка по пути — `_`-формой своего хендлера (`bgi_a\.png`, `mk_a\.png`, `bi_a\.png`). До D-121
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
   * пути — `_`-форма (D-122): у `bg` — в своём хендлере картинки (`bgi_a\.png`, D-120), у `mk` и `bi` — в них самих
   * (`mk_a\.png`, `bi_a\.png`; `mki` слит в `mk`, D-127).
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
    return (p: MnEssenceParams) => {
      const style: Record<string, string> = {};
      style[propName] = positionWords(
        p.name, p.suffix, z,
      ).join(SPACE);
      return styleWrap(style, priority);
    };
  }

  /** Слово позиции → буква: `right` → `R` — для подсказки «Write it shorter» (D-113). */
  const POSITION_BY_WORD: Record<string, string> = {};
  forIn(POSITION_KEYWORDS, (word: string, abbr: string) => {
    POSITION_BY_WORD[valueNormalize(word)] = abbr;
  });

  /**
   * Части `<position>` (группа D): буквы `L`/`C`/`R`/`T`/`B`, углы первой частью, длины, переменные; ведущий `_` —
   * слова CSS. Общий читатель {@link positionProvider} (`op`, `pspo`, `tfo`) и позиции фигур `clip-path` после
   * радиуса (`cpthCircle50%_R_T`, D-124).
   * @param name имя хендлера — для сообщений
   * @param suffix часть токена с позицией, как написана
   * @param z свойство берёт третью часть z (`transform-origin`)
   * @param bare позиция — часть функции (`cpthCircle50%_R_T`): примеры в подсказках — без имени хендлера, `R_T`
   * @returns слова CSS по частям: `['right', 'top']`
   */
  function positionWords(
    name: string, suffix: string, z?: 1, bare?: 1,
  ): string[] {
    const byWord = POSITION_BY_WORD;
    const prefix = MSG_VALUE + suffix + MSG_IS_INVALID_FOR + name + MSG_COLON;
    const hint = bare ? '' : name;
    // Функция автора (D-124): позиция — буквы, длины и переменные. Внутри фигуры `clip-path` скобку бракует читатель
    // форм раньше.
    bare || assertNoFunction(
      suffix, name, () => '',
    );
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
        throwInvalid(MSG_WRITE_SHORTER + hint + written.join(UNDERSCORE) + MSG_INSTEAD_OF + hint + suffix
        + MSG_SAME_VALUE);
      }
      REGEXP_BARE_WORD.test(word) || !word
        ? throwInvalid(prefix + (raw
          ? 'the "_" form takes CSS words — left, center, right, top, bottom — and lengths'
          : 'a part is a side letter, a length or a percent' + positionHint(hint, j ? '' : 1)))
        : throwInvalid(prefix + 'expected a length or a percent');
    }
    long && throwInvalid(MSG_WRITE_SHORTER + hint + written.join(UNDERSCORE) + MSG_INSTEAD_OF + hint + suffix
      + MSG_SAME_VALUE);
    positionAssert(
      kinds, words, prefix, hint, z,
    );
    return words;
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

  /**
   * Регистрирует свойства-длины: строка — `[свойство, значение по умолчанию, приоритет, одно значение, слова,
   * без процента]` (D-130).
   *
   * @param table — хендлер → строка
   */
  function registerLengthProperties(table: Record<string, any[]>): void {
    forIn(table, (options: any[], pfx: string) => {
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
  }

  /**
   * Регистрирует одиночные свойства: строка реестра — `[свойство, приоритет, длина, авто-повтор, слова]`, что
   * свойство знает о значении сверх неё — таблицы темы (D-130).
   *
   * @param table — хендлер → строка реестра
   * @param values — слоты, функции нативной формы, числа и подсказки темы по имени свойства
   */
  function registerSingleProperties(table: Record<string, any[]>, values: SingleValues = NO_VALUES): void {
    const slotsOf = values.slots;
    const functionsOf = values.functions || NO_VALUES.functions;
    const patterns = values.patterns || NO_VALUES.patterns;
    const parenHints = values.parenHints || NO_VALUES.parenHints;
    forIn(table, (options: any[], essenceName: string) => {
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
      const valuePattern = patterns[propName];
      const slots = slotsOf[propName];
      const functions = functionsOf[propName];
      const ownHint = parenHints[propName];
      // Скобку у свойства с нативными формами бракует читатель форм ({@link throwParen}): подсказка называет форму.
      // Своя подсказка темы (у `g`/`gt` — о повторе, его нет в наборе) — раньше перечня слов.
      const parenHint = ownHint
        ? () => ownHint(essenceName)
        : () => (enumWords ? enumHint(
          enumWords, essenceName, VALUE_ABBREVIATIONS[propName],
        ) : '');
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
        if (functions && functionsStart(s, functions)) {
          style[propName] = functionsValue(p, functions);
          return styleWrap(style, stylePriority);
        }
        assertNoFunction(
          s, essenceName, parenHint,
        );
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
  }

  return {
    COLOR_SYNONYM_BY_WORD,
    assertColorAbbr,
    assertKnownWord,
    assertNoLetter,
    assertShortestHex,
    backgroundProvider,
    floatval,
    forEach,
    forIn,
    getColor,
    getVal,
    indexOf,
    instance,
    intval,
    isDefined,
    lengthOrWord,
    lettersValue,
    map,
    mapIn,
    mn,
    positionProvider,
    positionWords,
    rawColorValue,
    reduce,
    registerLengthProperties,
    registerSingleProperties,
    setKeyframes,
    size,
    spaceNormalize,
    synonymProvider,
    toFixed,
    toKebabCase,
    toUpper,
    validateUnit,
    valueNormalize,
  };
}

/** Контекст пресета — то, что `createContext` отдаёт предметным файлам. */
export type StandardContext = ReturnType<typeof createContext>;
