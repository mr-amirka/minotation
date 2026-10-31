import type {
  MnEssenceParams,
} from '../../core/types';
import {
  CLOSE_PAREN,
  DASH,
  DOUBLE_QUOTE,
  GLOBAL_KEYWORDS,
  LIST_SEPARATOR,
  OPEN_PAREN,
  PERCENT,
  PIPE,
  PX,
  SEMICOLON,
  SPACE,
  UNDERSCORE,
  UNITS,
  ZERO,
} from './words';
import {
  MSG_AS,
  MSG_COLON,
  MSG_INSTEAD_OF,
  MSG_IS_INVALID_FOR,
  MSG_SAME_VALUE,
  MSG_VALUE,
  MSG_WRITE_SHORTER,
  enumHint,
  throwInvalid,
} from './messages';

const REGEXP_UNESCAPED_UNDERSCORE = /(?<!\\)_/;
/**
 * `--name` → `var(--name)`, `---name` → `env(--name)`; для суффикса другой формы — `undefined`.
 *
 * Нужна хендлерам, которые разбирают суффикс сами, а не через общий `val`
 * (`ff`, `lh`): там CSS-переменная иначе молча превращается в мусор —
 * `ff--mono` давал `font-family:"-mono"` (ведущий `-` в {@link fontNameQuote} означает
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
export function cssVarValue(s: string): string | undefined {
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
export const REGEXP_VAR_UNDERSCORE = /\0/g;
function varUnderscoreHide(_all: string, name: string): string {
  return name.replace(REGEXP_UNDERSCORE_ALL, '\0') + SEMICOLON;
}
export function splitValueParts(
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
export const REGEXP_BARE_NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)$/;
/**
 * Готовая длина: `0` либо число со знаком и одной из единиц. Одна сборка на все проверки длин: длина, длина без
 * процента, размер дорожки (`1fr`), длина или число (`border-image-width`) не разъезжаются в записи числа.
 * @param units допустимые единицы
 * @param unitOptional число без единицы тоже годится (`2` — кратное, как у `border-image-width`)
 * @returns регулярное выражение на часть значения целиком
 * @example lengthPartRegExp(['px', 'em']).test('-1.5em') // true
 * @example lengthPartRegExp(['px'], 1).test('2') // true
 */
export function lengthPartRegExp(units: string[], unitOptional?: 1): RegExp {
  return new RegExp('^(?:0|[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:' + units.join(PIPE) + ')' + (unitOptional ? '?' : '')
    + ')$');
}
/**
 * Готовая длина: `0`, либо число с единицей из {@link UNITS}.
 *
 * Собирается из того же списка, чтобы не разъехаться с ним при правке:
 * добавили единицу — проверка узнала сама.
 */
export const REGEXP_LENGTH_PART = lengthPartRegExp(UNITS);
/**
 * Функция нативной формы `Name…` (D-124): имя в CamelCase, первый аргумент — слитно с ним, остальные — частями через
 * `_`. Скобки в токене не пишутся (D-121): `ftBlur2` → `blur(2px)`, `ftDropShadow2_4_6_000.5` →
 * `drop-shadow(2px 4px 6px rgba(0,0,0,.5))`. Хендлер объявляет свои функции таблицей и читает суффикс
 * {@link functionsValue}.
 */
export interface FunctionForm {
  /** Имя в CSS: `drop-shadow`. */
  css: string;
  /** Частей не меньше: у `drop-shadow` x и y обязательны. Голое имя (`ftBlur`) — ноль частей. */
  min: number;
  /** Частей не больше: следующая часть — уже новая функция, иначе ошибка. */
  max: number;
  /** Запись для подсказок, без имени хендлера: `Blur2`. */
  example: string;
  /** Аргументы → содержимое скобок; на части, которую не принимает, зовёт `call.fail`. */
  args: (args: string[], call: FunctionCall) => string;
  /**
   * Часть, которая продолжает функцию сверх `min`, — для слотов, где за функцией идут другие части (`tn`, `an`):
   * `tn_opacity_200_Steps4_JE_100` — `JE` ещё аргумент `Steps`, `100` уже задержка. Без неё там берётся ровно `min`.
   */
  more?: RegExp;
  /**
   * Первый аргумент — имя, он пишется отдельной частью: `cntAttr_href` (слитно `Attrhref` читалось бы одним именем).
   * Без флага первый аргумент — число или длина, слитно с именем: `ftBlur5`, а `ftBlur_5` бракуется.
   */
  named?: 1;
}
/**
 * Функции одного хендлера для {@link functionsValue}: собирается один раз, на регистрации.
 */
export interface FunctionSet {
  forms: Record<string, FunctionForm>;
  /** Длинное имя → короткое (`Grayscale` → `Gray`): вторая запись того же значения (D-122). */
  longNames: Record<string, string>;
  /** Что за функции — для сообщения: `a filter function`. */
  what: string;
  /** Значение — одна функция (`ttf`), а не список через `_` (`ft`). */
  single: boolean;
  /** Первая форма — пример в подсказках. */
  first: FunctionForm;
  /** Имена через запятую — для сообщения «expected …». */
  names: string;
  /**
   * Функция CSS, у которой короткая запись — не функция набора: `repeat` → `3x1fr` или `AF240`. Подсказка
   * {@link throwParen} на её скобку.
   */
  hints: Record<string, string[]>;
}
/**
 * Собирает {@link FunctionSet}.
 * @param forms функции по имени в нотации, первая — пример в подсказках
 * @param what что за функции — для сообщения
 * @param single значение — одна функция
 * @param longNames длинное имя → короткое
 * @param hints функция CSS → её короткие записи вне набора (см. {@link FunctionSet.hints})
 * @returns набор для {@link functionsValue}
 */
export function functionSet(
  forms: Record<string, FunctionForm>, what: string, single?: 1, longNames?: Record<string, string>,
  hints?: Record<string, string[]>,
): FunctionSet {
  const names = Object.keys(forms);
  return {
    forms,
    longNames: longNames || {},
    what,
    single: !!single,
    first: forms[names[0]],
    names: names.join(LIST_SEPARATOR),
    hints: hints || {},
  };
}
/** Что видит читатель аргументов одной функции {@link FunctionForm}. */
export interface FunctionCall {
  /** Параметры токена. */
  p: MnEssenceParams;
  /** Части всего суффикса — для подсказок, которые называют токен целиком (`colorPart`). */
  parts: string[];
  /** Номер части суффикса у каждого аргумента: первый слит с именем функции. */
  index: number[];
  /** Проход с запасным цветом `altColor`: цвет с альфой даёт свойству два значения, как у `sbc`. */
  fallback: boolean;
  /** Бросает «функция ждёт …» с примером записи. */
  fail: (expected: string) => never;
}
/** Имя функции в части: слова в CamelCase, дальше — первый аргумент. */
const REGEXP_FUNCTION_NAME = /^((?:[A-Z][a-z]+)+)(.*)$/;
/** Имя, написанное не той формой: строчное (`blur5`, `hueRotate90`) или в CamelCase — для подсказки. */
export const REGEXP_FUNCTION_NAME_ANY = /^([A-Za-z][a-z]*(?:[A-Z][a-z]+)*)(.*)$/;
/** Функция со скобкой, как в CSS: `blur(`, `drop-shadow(`, `Blur(`. */
export const REGEXP_FUNCTION_HEAD = /^([A-Za-z][A-Za-z-]*)\(/;
/** Начало первого аргумента — число, длина, угол или переменная: `5`, `-2`, `.5`, `--x`. */
export const REGEXP_FUNCTION_FIRST_ARG = /^[-.\d]/;
const REGEXP_KEBAB_LETTER = /-([a-z])/g;
/** Длина без процента — у `blur` и `drop-shadow` процента нет. */
export const REGEXP_FUNCTION_LENGTH = lengthPartRegExp(UNITS.filter((unit) => unit !== PERCENT));
/**
 * Аргумент-длина функции: голое число — пиксели (`2` → `2px`, `0` остаётся `0`), с единицей — как написано,
 * переменная — `var()`.
 * @param v аргумент
 * @param call вызов — для ошибки
 * @param signed отрицательная длина допустима (сдвиг тени), иначе — нет (размытие)
 * @param percent процент допустим (фигуры `clip-path`), иначе — нет (`blur`, `drop-shadow`)
 * @returns длина CSS
 * @example functionLength('2', call) // '2px'
 */
export function functionLength(
  v: string, call: FunctionCall, signed?: 1, percent?: 1,
): string {
  const whole = cssVarValue(v);
  if (whole) {
    return whole;
  }
  (signed || v[0] !== DASH) || call.fail('a length of zero or more');
  return REGEXP_BARE_NUMBER.test(v) ? (v === ZERO ? v : v + PX)
    : (percent ? REGEXP_LENGTH_PART : REGEXP_FUNCTION_LENGTH).test(v) ? v
      : call.fail(percent ? 'a length or a percent' : 'a length');
}
/**
 * Начинается ли суффикс функцией из набора — в любой форме имени, со скобкой тоже: хендлер со словарём (`ttf`)
 * отдаёт такой суффикс {@link functionsValue}, а остальное читает сам.
 * @param suffix суффикс токена
 * @param set функции хендлера
 * @returns суффикс — для читателя функций
 */
export function functionsStart(suffix: string, set: FunctionSet): boolean {
  if (suffix.indexOf(OPEN_PAREN) > -1) {
    return true;
  }
  const m = REGEXP_FUNCTION_NAME_ANY.exec(suffix[0] === UNDERSCORE ? suffix.slice(1) : suffix);
  return !!(m && functionKey(m[1][0].toUpperCase() + m[1].slice(1), set));
}
/** Последнее слово CamelCase-имени: `Content` в `MinmaxMinContent`. */
const REGEXP_CAMEL_LAST = /[A-Z][a-z]*$/;
/**
 * Имя функции набора в начале слова CamelCase: само слово, иначе самое длинное его начало — первый аргумент-слово
 * пишется слитно, как число: `MinmaxMinContent_1fr` → `Minmax` и `MinContent`. У формы с именем-аргументом
 * ({@link FunctionForm.named}) он — отдельная часть: слитное `AttrHref` {@link functionsFix} переписывает в
 * `Attr_href`. Длинное имя узнаётся тоже (`Grayscale`): его заменяет {@link functionsFix}.
 * @param name слово CamelCase с заглавной
 * @param set функции хендлера
 * @returns имя, как оно написано, или пустая строка
 * @example functionKey('MinmaxMinContent', TRACK_FUNCTIONS) // 'Minmax'
 */
function functionKey(name: string, set: FunctionSet): string {
  const forms = set.forms;
  const longNames = set.longNames;
  let key = name;
  // Самое длинное начало, которое — функция набора.
  while (key && !forms[longNames[key] || key]) {
    key = key.replace(REGEXP_CAMEL_LAST, '');
  }
  return key;
}
/**
 * Исправленная запись суффикса, когда функция написана не той формой (D-122 «одна форма на значение»): строчное
 * имя (`ft_blur5` → `ftBlur5`), длинное там, где есть короткое (`ftGrayscale100` → `ftGray100`), или первый аргумент
 * отдельной частью (`ftBlur_5` → `ftBlur5`).
 * @param parts части суффикса
 * @param set функции хендлера
 * @returns `[запись, только короче]`, или `undefined`, когда исправлять нечего
 */
function functionsFix(parts: string[], set: FunctionSet): [fixed: string, shorter: boolean] | undefined {
  const forms = set.forms;
  const longNames = set.longNames;
  const l = parts.length;
  const out: string[] = [];
  let shorter = true;
  let fixed = false;
  let i = 0;
  let m: RegExpExecArray | null;
  let part: string;
  let key: string;
  let short: string;
  let rest: string;
  for (; i < l; i++) {
    part = parts[i];
    if ((m = REGEXP_FUNCTION_NAME_ANY.exec(part)) && (key = functionKey(m[1][0].toUpperCase() + m[1].slice(1), set))) {
      short = longNames[key] || key;
      rest = m[1].slice(key.length) + m[2];
      part = short + rest;
      if (short !== m[1].slice(0, key.length)) {
        fixed = true;
        // Короче — только замена длинного имени; строчное имя исправляется без сокращения.
        short === key && (shorter = false);
      }
      // Имя-аргумент слитно (`cntAttrHref`) — отдельной частью, со строчной: `cntAttr_href`.
      if (forms[short].named && key.length < m[1].length) {
        part = short + UNDERSCORE + m[1][key.length].toLowerCase() + rest.slice(1);
        fixed = true;
        shorter = false;
      }
      if (!rest && !forms[short].named && i + 1 < l && REGEXP_FUNCTION_FIRST_ARG.test(parts[i + 1])) {
        part += parts[++i];
        fixed = true;
        shorter = false;
      }
    }
    out.push(part);
  }
  // Ведущий `_` перед функцией лишний: `ft_Blur5` — то же, что `ftBlur5`.
  if (l > 1 && !parts[0] && (m = REGEXP_FUNCTION_NAME.exec(out[1])) && forms[functionKey(m[1], set)]) {
    out.shift();
    fixed = true;
    shorter = false;
  }
  return fixed ? [
    out.join(UNDERSCORE),
    shorter,
  ] : undefined;
}
/**
 * Читает суффикс из функций нативной формы `Name…` (D-124) — общая точка расширения: хендлер объявляет свои функции
 * таблицей {@link FunctionForm}, разбор и сообщения — здесь.
 *
 * Часть, которая начинается известным именем, открывает новую функцию; остальные части — её аргументы, пока их не
 * больше `max`. Скобка (`ftBlur\(2px\)`) бракуется с подсказкой нативной формы (D-121); имя — одной формой (D-122):
 * строчное и длинное бракуются с исправленной записью.
 * @param p параметры токена
 * @param set функции хендлера
 * @param fallback проход с запасным цветом (см. {@link FunctionCall.fallback})
 * @param bare функция — часть слота (`tn`), и пример записи в подсказке — без имени хендлера: `CubicBezier0.4_0_0.2_1`
 * @returns вызовы через пробел; пустая строка — функций нет
 * @example functionsValue(p, FILTER_FUNCTIONS) // ftBlur3_Invert20 → 'blur(3px) invert(20%)'
 */
export function functionsValue(
  p: MnEssenceParams, set: FunctionSet, fallback?: boolean, bare?: boolean,
): string {
  const suffix = p.suffix;
  const name = bare ? '' : p.name;
  const forms = set.forms;
  const head = MSG_VALUE + suffix + MSG_IS_INVALID_FOR + p.name + MSG_COLON;
  const parts = splitValueParts(suffix);
  const l = parts.length;
  const out: string[] = [];
  let form: FunctionForm | undefined;
  let key = '';
  let args: string[] = [];
  let index: number[] = [];
  let part: string;
  let m: RegExpExecArray | null;
  let found: string;
  let first: string;
  let i = 0;
  const call: FunctionCall = {
    p,
    parts,
    index,
    fallback: !!fallback,
    fail: (expected: string) => throwInvalid(head + DOUBLE_QUOTE + key + '" expects ' + expected + MSG_AS + name
      + (form as FunctionForm).example + DOUBLE_QUOTE),
  };
  suffix.indexOf(OPEN_PAREN) > -1 && throwParen(
    head, name, parts, set,
  );
  const fix = functionsFix(parts, set);
  fix && throwInvalid((fix[1] ? MSG_WRITE_SHORTER : 'Write "') + name + fix[0] + MSG_INSTEAD_OF + name + suffix
    + MSG_SAME_VALUE);
  for (; i < l; i++) {
    part = parts[i];
    if ((m = REGEXP_FUNCTION_NAME.exec(part)) && forms[found = functionKey(m[1], set)]) {
      form && set.single && throwInvalid(head + 'one function is expected — as "' + name + set.first.example
        + DOUBLE_QUOTE);
      form && out.push(functionCall(
        form, key, args, call, head, name,
      ));
      form = forms[key = found];
      call.index = index = [];
      args = [];
      (first = m[1].slice(found.length) + m[2]) && (args.push(first), index.push(i));
      continue;
    }
    if (!part) {
      // Ведущий `_` — запасная форма хендлера (D-126); пустая часть в середине — описка.
      i && throwInvalid(head + 'an empty part — one "_" between parts');
      continue;
    }
    form || throwInvalid(head + 'expected ' + set.what + ' by its name, as "' + name + set.first.example + MSG_COLON
      + set.names);
    args.length < (form as FunctionForm).max || throwInvalid(head + DOUBLE_QUOTE + part + '" is extra: "' + key
      + '" takes at most ' + (form as FunctionForm).max + ((form as FunctionForm).max > 1 ? ' parts' : ' part')
      + MSG_AS + name + (form as FunctionForm).example + DOUBLE_QUOTE);
    args.push(part);
    index.push(i);
  }
  form && out.push(functionCall(
    form, key, args, call, head, name,
  ));
  return out.join(SPACE);
}
/**
 * Скобка в суффиксе (D-121) — ошибка с нативной формой: функции, названной перед скобкой (`blur(` → `ftBlur2`,
 * `hue-rotate(` → `ftHue90`), иначе той, внутри которой скобка (`DropShadow2_4_rgba(…)`), иначе первой. Функция с
 * короткой записью вне набора ({@link FunctionSet.hints}) получает её: `repeat(` → `gtc3x1fr` или `gtcAF240`. У функции
 * без нативной формы (`linear(…)`, `url(…)`) выход — переменная.
 * @param head начало сообщения
 * @param name имя хендлера
 * @param parts части суффикса
 * @param set функции хендлера
 */
export function throwParen(
  head: string, name: string, parts: string[], set: FunctionSet,
): never {
  const forms = set.forms;
  let i = 0;
  for (; parts[i].indexOf(OPEN_PAREN) < 0;) {
    i++;
  }
  const m = REGEXP_FUNCTION_HEAD.exec(parts[i]);
  let key = m ? m[1].replace(REGEXP_KEBAB_LETTER, (_s: string, c: string) => c.toUpperCase()) : '';
  key = key && key[0].toUpperCase() + key.slice(1);
  key = set.longNames[key] || key;
  let back: RegExpExecArray | null;
  let inside = '';
  for (; !forms[key] && !inside && i > -1; i--) {
    (back = REGEXP_FUNCTION_NAME.exec(parts[i])) && forms[back[1]] && (inside = back[1]);
  }
  const form = forms[key] || forms[inside];
  const hint = set.hints[key];
  m && REGEXP_WRITTEN_SUBSTITUTION.test(m[0]) && throwInvalid(head + substitutionMessage(name));
  return throwInvalid(head + 'a function is not written in a class — ' + (hint
    ? 'write "' + name + hint.join('" or "' + name) + DOUBLE_QUOTE
    : form || !m
      ? 'write "' + name + (form || set.first).example + DOUBLE_QUOTE
      : DOUBLE_QUOTE + m[1] + '" has no short form, write it through a variable — "' + name + '--x"'));
}
/**
 * Один вызов из {@link functionsValue}: проверка числа частей и чтение аргументов.
 * @returns `name(аргументы)`
 */
function functionCall(
  form: FunctionForm, key: string, args: string[], call: FunctionCall, head: string, name: string,
): string {
  args.length < form.min && throwInvalid(head + DOUBLE_QUOTE + key + '" takes at least ' + form.min + (form.min > 1 ? ' parts' : ' part') + MSG_AS
    + name + form.example + DOUBLE_QUOTE);
  return form.css + OPEN_PAREN + form.args(args, call) + CLOSE_PAREN;
}

export function assertEnumValue(
  v: string,
  words: Record<string, 1 | string>,
  multi: 1 | 0 | undefined,
  essenceName: string,
  raw: string,
  abbreviations?: Record<string, string>,
): string {
  // Функция автора бракуется (D-124): у закрытого списка значение — его буквы, CSS-wide-буквы или переменная. Скобка
  // в `v` после этого — от подстановки (`--v` → `var(--v)`): что в ней, здесь не видно. CSS-wide keywords валидны
  // везде и в списке свойства не перечисляются.
  assertNoFunction(
    raw, essenceName, () => enumHint(
      words, essenceName, abbreviations,
    ),
  );
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
 * Скобка автора вне кавычек — функция в токене: `Url(a.png)`, `_calc(1px+2px)`. В кавычках скобка — текст (`q_"("`).
 */
const REGEXP_AUTHOR_FUNCTION = /^(?:[^"'(]|"[^"]*"|'[^']*')*\(/;
/**
 * Функция в токене (D-124): у хендлера без нативных форм значение — его буквы, CSS-wide-буквы (`INH`) или переменная;
 * вычисленное значение — через переменную. Скобка в значении после разбора — уже только от подстановки (`--v` →
 * `var(--v)`), поэтому проверяется суффикс, как его написал автор.
 * @param raw суффикс токена
 * @param name имя хендлера
 * @param hint даёт список букв хендлера (`. Available: dB (block), …`) или пустую строку; зовётся только при браке
 * @example assertNoFunction('Url(a.png)', 'd', () => '') // «Value "Url(a.png)" is invalid for "d": a function is not …»
 */
export function assertNoFunction(
  raw: string, name: string, hint: () => string,
): void {
  REGEXP_AUTHOR_FUNCTION.test(raw) && throwInvalid(MSG_VALUE + raw + MSG_IS_INVALID_FOR + name + MSG_COLON
    + (REGEXP_WRITTEN_SUBSTITUTION.test(raw) ? substitutionMessage(name)
      : 'a function is not written in a class; a computed value goes through a variable, as "' + name + '--x"'
        + hint()));
}
/** Подстановка, написанная словом: `_var(--x)`, `Env(x)`, `A_0.2s_var(--d)` — у неё своя запись, `--x` / `---x`. */
export const REGEXP_WRITTEN_SUBSTITUTION = /(?:^|[_,])(?:var|env)\(/i;
/**
 * Подстановка пишется без функции: `--x` → `var(--x)`, `---x` → `env(--x)`.
 * @param name имя хендлера
 * @returns хвост сообщения
 * @example substitutionMessage('tn') // 'a variable is written without "var()": "tn--x" → var(--x), …'
 */
export function substitutionMessage(name: string): string {
  return 'a variable is written without "var()": "' + name + '--x" → var(--x), "' + name + '---x" → env(--x)';
}

/** Разбор значения одиночного свойства по слотам: части значения, суффикс токена, имя хендлера. */
type SlotValidator = (parts: string[], raw: string, essenceName: string) => string;

/**
 * Что одиночное свойство знает о своём значении сверх строки реестра. Ключ — имя свойства, как и у
 * {@link ENUM_KEYWORDS}: сам факт наличия означает «здесь слоты» (функции, число). Таблицы задаёт тема (D-130).
 */
export interface SingleValues {
  /** Разбор значения по слотам. */
  slots: Record<string, SlotValidator>;
  /**
   * Функции нативной формы (D-124): значение, которое начинается функцией набора (или содержит скобку), читает
   * {@link functionsValue}.
   */
  functions?: Record<string, FunctionSet>;
  /** Свойство берёт безразмерное число: шаблон, которому значение обязано соответствовать. */
  patterns?: Record<string, RegExp>;
  /** Своя подсказка о скобке в токене; без неё подсказка — перечень слов свойства. */
  parenHints?: Record<string, (essenceName: string) => string>;
}

/** Одиночные свойства без таблиц значений. */
export const NO_VALUES: Required<SingleValues> = {
  slots: {},
  functions: {},
  patterns: {},
  parenHints: {},
};
