/**
 * Математика в значении: сумма термов, произведение, функции `min` / `max` / `clamp`, группы и переменные —
 * `100%-2rem+10`, `$gap*2`, `Min{100%,50rem}`, `{100%-2rem}/3`, `$a{10}`, `$$safe-area-inset-top`.
 *
 * Ядро знает механизм — термы, операторы, функции, запись CSS; пресет даёт правила свойства — единицу голого
 * числа, допустимые единицы, знак. Правила собираются один раз ({@link mathRules}, холодный путь), значение
 * читается на каждый токен ({@link mathValue}, горячий путь: без замыканий и регулярных выражений на вызов).
 *
 * @module mathValue
 */
import {
  toFixed,
} from 'fundamentool';
import {
  checkOptions,
  describeValue,
  isBoolean,
  isString,
  isStringArray,
} from '../checkOptions';
import {
  MnParseError,
} from './types';

const DASH = '-';
const PLUS = '+';
const ASTERISK = '*';
const SLASH = '/';
const DOT = '.';
const COMMA = ',';
const SEMICOLON = ';';
const DOLLAR = '$';
const OPEN_BRACE = '{';
const CLOSE_BRACE = '}';
const PERCENT = '%';
const SPACE = ' ';
const ZERO = '0';
const NINE = '9';
const LOWER_A = 'a';
const LOWER_Z = 'z';
const OPEN_PAREN = '(';
const DOUBLE_QUOTE = '"';
const CLOSE_PAREN = ')';
const ARG_SEPARATOR = ', ';
const CALC_OPEN = 'calc(';
const VAR_OPEN = 'var(--';
const ENV_OPEN = 'env(';
const NEGATE = ' * -1';
const MSG_NOT_EXPECTED = ' is not expected';
/** Сколько единиц сообщение называет списком; длиннее — образцом с единицей по умолчанию. */
const UNITS_LISTED = 8;
/** С чего начинается значение — подсказка, когда не подошёл первый же символ (`tiF00`, `w#1`). */
const MSG_TERM_START = ': a value starts with a number ("10"), a variable ("$x"), a function ("Min{…}") or a group'
  + ' ("{…}")';

/** Голое число: единицу ему даёт место в выражении. */
const KIND_BARE = 0;
/** Всё остальное: число с единицей, дробь, переменная, функция, группа. */
const KIND_DIMENSION = 1;

/** Целое значение — ноль, с единицей или без: `0`, `-0`, `0px`. Пишется `0`. */
const REGEXP_WHOLE_ZERO = /^-?0([a-z%]*)$/;
/**
 * `;` перед следующей переменной или запятой списка в прежней записи — у `$` он не нужен: `--a;--b` → `$a$b`,
 * `--a;,--b` → `$a,$b`. Имени с `_` он нужен и дальше: `--my_a;--my_b` → `$my_a;$my_b`.
 */
const REGEXP_OLD_NEXT = /(--[A-Za-z0-9\u0080-\uFFFF-]+);(?=--(?!-)|,)/g;
/** Прежний env в начале части: `---x` → `$$x`. */
const REGEXP_OLD_ENV = /(^|[_,{])---/g;
/** Прежний минус перед переменной: `10---a` → `10-$a`. */
const REGEXP_OLD_MINUS_VARIABLE = /---/g;
/** Прежняя переменная: `--a` → `$a`. */
const REGEXP_OLD_DASHES = /--/g;
/** Прежний запасной вариант через запятую: `$v,10px` → `$v{10px}`; запятая перед переменной — список: `$a,$b`. */
const REGEXP_OLD_FALLBACK = /(\$[A-Za-z0-9_\u0080-￿-]+),(?!\$)([^_,]+)/g;

/** Функции математики: имя в токене → [имя CSS, меньше аргументов нельзя, больше нельзя]. */
const FUNCTIONS: Record<string, [string, number, number]> = {
  Min: [
    'min',
    2,
    Infinity,
  ],
  Max: [
    'max',
    2,
    Infinity,
  ],
  Clamp: [
    'clamp',
    3,
    3,
  ],
};
const FUNCTION_NAMES = Object.keys(FUNCTIONS);

/** Правила свойства: что значит голое число, какие единицы допустимы, можно ли минус. */
export interface MnMathRules {
  /** Имя хендлера — для сообщений: `w`. */
  readonly name: string;
  /** Единица голого числа: `px`; пустая строка — свойство безразмерное (`lh`). */
  readonly unit: string;
  /** Допустимые единицы; `%` среди них — допустимы и процент, и дробь (`1/3` → `33.33%`). */
  readonly units: readonly string[];
  /** Минус перед первым термом значения допустим (`m-10`, `m-$a`). */
  readonly negative: boolean;
}

/** Опции {@link mathRules}. */
export interface MnMathRulesOptions {
  /** Имя хендлера — для сообщений. */
  name: string;
  /** Единица голого числа; `''` — свойство безразмерное. */
  unit: string;
  /** Допустимые единицы; с `%` — процент и дробь. */
  units: readonly string[];
  /** Минус перед первым термом. По умолчанию нельзя. */
  negative?: boolean;
}

const RULES_SCHEMA = {
  name: isString,
  unit: isString,
  units: isStringArray,
  negative: isBoolean,
};
const RULES_REQUIRED = [
  'name',
  'unit',
  'units',
];

/**
 * Правила свойства для {@link mathValue}. Холодный путь: собираются один раз, в фабрике хендлера.
 *
 * @param options — имя хендлера, единица голого числа, допустимые единицы, минус
 * @returns замороженные правила
 * @throws {Error} неизвестный ключ (с ближайшим допустимым), значение не того типа, нет обязательного ключа,
 *   единица голого числа не из допустимых
 * @example
 * const widthRules = mathRules({ name: 'w', unit: 'px', units: ['px', 'rem', '%'] });
 */
export function mathRules(options: MnMathRulesOptions): MnMathRules {
  const where = 'mathRules';
  checkOptions(
    options, RULES_SCHEMA, where,
  );
  for (const key of RULES_REQUIRED) {
    (options as unknown as Record<string, unknown> | undefined)?.[key] === undefined
      && fail(where + ': option "' + key + '" is required, got ' + describeValue(options && (options as never)[key]));
  }
  options.unit && options.units.indexOf(options.unit) < 0
    && fail(where + ': "unit" expects one of "units", got "' + options.unit + DOUBLE_QUOTE);
  return Object.freeze({
    name: options.name,
    unit: options.unit,
    units: Object.freeze(options.units.slice()),
    negative: !!options.negative,
  });
}

function fail(message: string): never {
  throw new Error('[minotation] ' + message);
}

// Состояние разбора одного значения. Модульное, а не замыкание: разбор синхронный и не вызывает чужой код.
let src = '';
let pos = 0;
let end = 0;
let rules: MnMathRules;
/** Сколько операторов (и отрицаний) было на уровне последней прочитанной суммы. */
let sumOps = 0;
/** Тип последнего прочитанного множителя. */
let factorKind = KIND_BARE;
/** Последний множитель — переменная: запятая после неё — прежний запасной вариант. */
let factorVariable = 0;
/**
 * Множитель — первый в произведении: только там число над числом — дробь. Дальше `/` — деление: `10*2/4` —
 * `10px * 2 / 4`, а не `10px * 50%` (длину на процент CSS не умножает).
 */
let factorFirst = 0;
/** Глубина скобок разбора: группа, аргументы функции, запасной вариант переменной. Вне скобок — `0`. */
let level = 0;
/** В значении есть оператор вне скобок — математика без скобок (`w1/2+32`, а не `w{1/2+32}`). */
let bareOps = 0;
/**
 * Математика без скобок, найденная с {@link mathBareBegin}: пары «как часть написана в токене», «выражение».
 * `undefined` — сбор выключен: читатель, вызванный вне хендлера, ничего не копит.
 */
let bareFound: string[] | undefined;

/**
 * Значение с математикой — строка CSS. Один терм — без `calc` (`10` → `10px`, `$a` → `var(--a)`,
 * `Min{100%,50rem}` → `min(100%, 50rem)`); операторы — в `calc`. Голое число получает единицу, где оно терм, и
 * остаётся числом, где оно множитель: `$gap*2` → `calc(var(--gap) * 2)`, `10*2` → `calc(10px * 2)`. Число над
 * числом — дробь: `1/3` → `33.33%`. Внутри математики ноль пишется с единицей — `calc(0 + 5px)` CSS не принимает.
 *
 * Оператор вне скобок (`1/2+32`, `$a*2`) — математика без скобок: при включённом сборе
 * ({@link mathBareBegin}) значение записывается для режима `bareMathMode`. Не она: знак (`-10`, `-$a`), дробь
 * (`1/3`), всё внутри скобок группы, функции и запасного варианта (`{1+2}`, `Min{10+5,20%}`, `$a{10+5}`).
 *
 * @param expr — одна часть значения (между `_`): `100%-2rem+10`
 * @param mathRulesValue — правила свойства из {@link mathRules}
 * @param written — как часть написана в токене, если не так, как `expr`: тень пишет переменную размытия через
 *   `B` (`B$a*2` — выражение `$a*2`). По нему подсказка ставит скобки: `bxshB$a*2;x2` → `bxsh{$a*2}x2`
 * @returns CSS значения
 * @throws {MnParseError} выражение не читается, единица или минус не подходят свойству, прежняя запись
 *   переменной (`--a`)
 * @example
 * mathValue('100%-2*$gap', widthRules); // 'calc(100% - 2 * var(--gap))'
 * mathValue('Min{100%,50rem}', widthRules); // 'min(100%, 50rem)'
 */
export function mathValue(
  expr: string, mathRulesValue: MnMathRules, written?: string,
): string {
  const css = readValue(expr, mathRulesValue);
  bareOps && bareFound && bareFound.push(written === undefined ? expr : written, expr);
  return css;
}

/**
 * Начинает сбор математики без скобок: ядро зовёт его перед хендлером токена, {@link mathBareEnd} — после.
 * Сбор вложенный: прежний возвращается в {@link mathBareEnd}.
 * @returns прежний сбор
 * @example const outer = mathBareBegin(); mathValue('1+2', rules); mathBareEnd(outer) // ['1+2', '1+2']
 */
export function mathBareBegin(): string[] | undefined {
  const outer = bareFound;
  bareFound = [];
  return outer;
}

/**
 * Заканчивает сбор, начатый {@link mathBareBegin}.
 * @param outer — прежний сбор, который вернул {@link mathBareBegin}
 * @returns пары «как часть написана в токене», «выражение» — по одной на каждое значение с оператором вне скобок
 * @example mathBareEnd(outer) // ['B$a*2', '$a*2']
 */
export function mathBareEnd(outer: string[] | undefined): string[] {
  const found = bareFound as string[];
  bareFound = outer;
  return found;
}

/** Тело {@link mathValue}: CSS значения; `bareOps` после него — был ли оператор вне скобок. */
function readValue(expr: string, mathRulesValue: MnMathRules): string {
  src = expr;
  pos = 0;
  end = expr.length;
  rules = mathRulesValue;
  level = 0;
  bareOps = 0;
  // Значение — одна группа целиком: её скобки ничего не группируют — `{1+2}` → `calc(1px + 2px)`, `{10}` → `10px`
  // (было `calc((1px + 2px))`). Так слот буквенной записи пишет математику: `x{10+5}`.
  if (expr[0] === OPEN_BRACE && groupEnd(expr) === end - 1) {
    const css = readValue(expr.slice(1, -1), mathRulesValue);
    bareOps = 0;
    return css;
  }
  const zero = REGEXP_WHOLE_ZERO.exec(expr);
  if (zero) {
    zero[1] && checkUnit(zero[1]);
    return ZERO;
  }
  end || invalid('a value is expected');
  expr[0] === DASH && expr[1] !== DASH && !rules.negative && throwRule('negative value is not allowed for this property');
  const text = readSum();
  pos < end && unexpected();
  return sumOps ? CALC_OPEN + text + CLOSE_PAREN : text;
}

/**
 * Где закрывается группа, открытая первым символом.
 * @param expr — выражение, начатое с `{`
 * @returns индекс её `}`, или `-1`, если она не закрыта
 * @example groupEnd('{1+2}*3') // 4
 */
function groupEnd(expr: string): number {
  const l = expr.length;
  let depth = 0;
  let i = 0;
  let ch: string;
  for (; i < l; i++) {
    ch = expr[i];
    if (ch === OPEN_BRACE) {
      depth++;
    } else if (ch === CLOSE_BRACE && !--depth) {
      return i;
    }
  }
  return -1;
}

/** Сумма: произведения через `+` и `-`. Минус в начале — знак первого терма. */
function readSum(): string {
  let ops = 0;
  let text: string;
  let ch: string;
  if (src[pos] === DASH) {
    // Прежняя переменная в начале: `--a`, `---a`.
    src[pos + 1] === DASH && throwOldVariable(src);
    pos++;
    ch = src[pos];
    text = readProduct(DASH);
    // Отрицательное число — число со знаком; всё остальное отрицается умножением.
    ch >= ZERO && ch <= NINE || ch === DOT || (text += NEGATE, ops++);
  } else {
    text = readProduct('');
  }
  ops += factorKind;
  while (pos < end) {
    ch = src[pos];
    if (ch !== PLUS && ch !== DASH) {
      break;
    }
    pos++;
    level || (bareOps = 1);
    text += SPACE + ch + SPACE + readProduct('');
    ops++;
  }
  sumOps = ops;
  return text;
}

/**
 * Произведение: множители через `*` и `/`. Голое число — длина, если в произведении нет ничего с единицей
 * (первое из голых), иначе число: `10*2` → `10px * 2`, `2*$gap` → `2 * var(--gap)`.
 * После возврата `factorKind` — 1, если произведению нужен `calc` (операторы или группа).
 */
function readProduct(sign: string): string {
  factorFirst = 1;
  const texts: string[] = [readFactor(sign)];
  const kinds: number[] = [factorKind];
  const ops: string[] = [];
  let bare = factorKind === KIND_BARE ? 1 : 0;
  let group = factorKind === KIND_DIMENSION && texts[0][0] === OPEN_PAREN ? 1 : 0;
  let ch: string;
  while (pos < end) {
    ch = src[pos];
    if (ch !== ASTERISK && ch !== SLASH) {
      break;
    }
    pos++;
    level || (bareOps = 1);
    ops.push(ch);
    factorFirst = 0;
    texts.push(readFactor(''));
    kinds.push(factorKind);
    factorKind === KIND_BARE || (bare = 0);
  }
  const l = texts.length;
  let text = kinds[0] === KIND_BARE && (bare || l === 1) ? lengthText(texts[0]) : numberText(texts[0], kinds[0]);
  let i = 1;
  for (; i < l; i++) {
    text += SPACE + ops[i - 1] + SPACE + numberText(texts[i], kinds[i]);
  }
  l > 1 && (group = 1);
  factorKind = group;
  return text;
}

/** Голое число как длина: `10` → `10px`, `0` → `0px` (внутри математики ноль с единицей); безразмерное — как есть. */
function lengthText(raw: string): string {
  return rules.unit ? (raw[0] === DASH ? DASH + toFixed(raw.slice(1)) : toFixed(raw)) + rules.unit
    : numberText(raw, KIND_BARE);
}

/** Множитель как есть; голое число — без округления: `1.125`, `.5`. */
function numberText(text: string, kind: number): string {
  if (kind === KIND_DIMENSION) {
    return text;
  }
  const v = '' + +text;
  return v[0] === ZERO && v[1] === DOT ? v.slice(1) : v[0] === DASH && v[1] === ZERO && v[2] === DOT
    ? DASH + v.slice(2) : v;
}

/** Множитель: число, переменная, функция или группа. */
function readFactor(sign: string): string {
  factorVariable = 0;
  const ch = src[pos];
  if (ch >= ZERO && ch <= NINE || ch === DOT) {
    return readNumber(sign);
  }
  if (ch === DOLLAR) {
    return readVariable();
  }
  if (ch === OPEN_BRACE) {
    pos++;
    level++;
    const inner = readSum();
    level--;
    closeBrace();
    // Внутренняя сумма — своя: тип множителя ставится после неё.
    factorKind = KIND_DIMENSION;
    return OPEN_PAREN + inner + CLOSE_PAREN;
  }
  if (ch >= 'A' && ch <= 'Z') {
    const text = readFunction();
    // Аргументы — свои суммы: тип множителя ставится после них.
    factorKind = KIND_DIMENSION;
    return text;
  }
  // Прежняя переменная после оператора: `10---a`, `10+--a`.
  ch === DASH && src[pos + 1] === DASH && throwOldVariable(src);
  return pos < end ? unexpected() : invalid(DOUBLE_QUOTE + src[pos - 1] + '" needs a term after it');
}

/** Число, его единица; число над числом — дробь в процентах. */
function readNumber(sign: string): string {
  const start = pos;
  let dots = 0;
  let ch: string;
  for (; pos < end; pos++) {
    ch = src[pos];
    if (ch === DOT) {
      dots++;
    } else if (ch < ZERO || ch > NINE) {
      break;
    }
  }
  const num = src.slice(start, pos);
  (dots > 1 || num === DOT) && invalid(DOUBLE_QUOTE + num + '" is not a number');
  const unitStart = pos;
  for (; pos < end; pos++) {
    ch = src[pos];
    if (!(ch >= LOWER_A && ch <= LOWER_Z || ch === PERCENT)) {
      break;
    }
  }
  const unit = src.slice(unitStart, pos);
  if (unit) {
    checkUnit(unit);
    factorKind = KIND_DIMENSION;
    return sign + toFixed(num) + unit;
  }
  ch = src[pos + 1];
  if (factorFirst && src[pos] === SLASH && (ch >= ZERO && ch <= NINE || ch === DOT)) {
    pos++;
    return sign + readFraction(num);
  }
  factorKind = KIND_BARE;
  return sign + num;
}

/** Дробь `1/3` → `33.33%`: знаменатель — число без единицы, не ноль. */
function readFraction(num: string): string {
  const start = pos;
  let ch: string;
  for (; pos < end; pos++) {
    ch = src[pos];
    if (ch !== DOT && (ch < ZERO || ch > NINE)) {
      break;
    }
  }
  const total = src.slice(start, pos);
  ch = src[pos];
  (ch >= LOWER_A && ch <= LOWER_Z || ch === PERCENT) && invalid('a fraction is a number over a number: "' + num + SLASH
    + total + '" — the unit goes after the fraction is turned into a percent, so it isn\'t written');
  !+total && invalid('a fraction can\'t have a zero total: "' + num + SLASH + total + DOUBLE_QUOTE);
  checkUnit(PERCENT);
  factorKind = KIND_DIMENSION;
  return toFixed(100 * +num / +total) + PERCENT;
}

/**
 * Единица свойства: процент — своё сообщение. Чужая единица — с образцом: короткий список единиц целиком, длинный —
 * единицей по умолчанию (`10px`), без единиц — числом.
 */
function checkUnit(unit: string): void {
  const units = rules.units;
  const count = units.length;
  units.indexOf(unit) < 0 && (unit === PERCENT
    ? throwRule('this property takes a length, percent is not allowed')
    : invalid('unit "' + unit + '" doesn\'t fit' + (!count ? ': the value is a plain number, as "1.5"'
      : count > UNITS_LISTED ? ', as "10' + rules.unit + DOUBLE_QUOTE : ': the units are ' + units.join(ARG_SEPARATOR))));
}

/** Переменная `$name` → `var(--name)`, `$$name` → `env(name)`; запасной вариант — в скобках: `$a{10}`. */
function readVariable(): string {
  const env = src[pos + 1] === DOLLAR;
  pos += env ? 2 : 1;
  const name = readName();
  name || invalid('a variable needs a name after "' + (env ? DOLLAR + DOLLAR : DOLLAR) + '": "$gap", "$$safe-area-inset-top"');
  src[pos] === SEMICOLON && pos++;
  let fallback = '';
  if (src[pos] === OPEN_BRACE) {
    pos++;
    level++;
    fallback = readSum();
    level--;
    fallback = ARG_SEPARATOR + (sumOps ? CALC_OPEN + fallback + CLOSE_PAREN : fallback);
    closeBrace();
  }
  factorVariable = 1;
  factorKind = KIND_DIMENSION;
  return (env ? ENV_OPEN : VAR_OPEN) + name + fallback + CLOSE_PAREN;
}

/** Имя переменной: буквы, цифры, `-`, `_`, не-ASCII. Кончается на любом символе, которого в имени CSS нет. */
function readName(): string {
  const start = pos;
  let ch: string;
  for (; pos < end; pos++) {
    ch = src[pos];
    if (!(ch >= LOWER_A && ch <= LOWER_Z || ch >= 'A' && ch <= 'Z' || ch >= ZERO && ch <= NINE || ch === DASH || ch === '_'
      || ch >= '\u0080')) {
      break;
    }
  }
  return src.slice(start, pos);
}

/** Функция `Min{a,b}` → `min(a, b)`: имя из таблицы, аргументы через `,`, сколько ей нужно. */
function readFunction(): string {
  const start = pos;
  let ch: string;
  for (pos++; pos < end; pos++) {
    ch = src[pos];
    if (ch < LOWER_A || ch > LOWER_Z) {
      break;
    }
  }
  const name = src.slice(start, pos);
  const fn = FUNCTIONS[name];
  if (!fn) {
    name === 'Calc' && invalid('a sum is written without "Calc": "100%-2rem", a group in braces — "{100%-2rem}/3"');
    // Без скобок это не вызов, а заглавная буква не на месте: `bF00` — цвет в длине, а не функция «F».
    if (src[pos] !== OPEN_BRACE) {
      pos = start;
      unexpected();
    }
    invalid('unknown function "' + name + '". Functions: ' + FUNCTION_NAMES.join(', '));
  }
  src[pos] === OPEN_BRACE || invalid('the arguments of "' + name + '" are written in braces: "' + name
    + '{100%,50rem}"');
  pos++;
  level++;
  const args: string[] = [];
  for (;;) {
    args.push(readSum());
    ch = src[pos];
    if (ch !== COMMA) {
      break;
    }
    pos++;
  }
  level--;
  closeBrace();
  (args.length < fn[1] || args.length > fn[2]) && invalid(DOUBLE_QUOTE + name + '" takes ' + (fn[1] === fn[2]
    ? fn[1] : 'at least ' + fn[1]) + ' arguments, got ' + args.length);
  return fn[0] + OPEN_PAREN + args.join(ARG_SEPARATOR) + CLOSE_PAREN;
}

/** Закрывающая скобка группы, функции или запасного варианта. */
function closeBrace(): void {
  src[pos] === CLOSE_BRACE ? pos++ : pos < end ? unexpected() : invalid('"{" is not closed');
}

/** Символ, которого на этом месте быть не может. */
function unexpected(): never {
  const ch = src[pos];
  return invalid(ch === COMMA && factorVariable
    ? 'a fallback is written in braces: "' + src.slice(0, pos) + '{' + src.slice(pos + 1) + '}"'
    : DOUBLE_QUOTE + ch + DOUBLE_QUOTE + (pos ? ' after "' + src.slice(0, pos) + DOUBLE_QUOTE + MSG_NOT_EXPECTED
      : MSG_NOT_EXPECTED + MSG_TERM_START));
}

function invalid(reason: string): never {
  return throwParse('Value "' + src + '" is invalid for "' + rules.name + '": ' + reason);
}

function throwRule(reason: string): never {
  return throwParse('Value "' + src + '" is invalid: ' + reason);
}

function throwParse(message: string): never {
  throw new MnParseError(message, {
    token: '',
    handler: '',
    arg: '',
  });
}

/**
 * Прежняя запись переменной (`--a`, `---a`, `--v,10px`): CSS нет, сообщение с новой. Убирается через один
 * выпуск — задача в плане; это сообщение, а не вторая реализация.
 * @param expr — значение как написано
 * @example throwOldVariable('--a+5') // «"--a+5" was renamed: write "$a+5" — …»
 */
export function throwOldVariable(expr: string): never {
  return throwParse(DOUBLE_QUOTE + expr + '" was renamed: write "' + newVariables(expr) + '" — a variable is "$name"'
    + ' (var), "$$name" (env), its fallback in braces: "$name{10px}". The old spelling gives no CSS.');
}

/**
 * Прежняя запись переменных → новая, для подсказки: `--a;--b` → `$a$b`, `---x` → `$$x`, `10---a` → `10-$a`,
 * `--v,10px` → `$v{10px}`.
 * @param expr — значение в прежней записи
 * @returns то же значение в новой
 * @example newVariables('--a;---b') // '$a;-$b'
 */
export function newVariables(expr: string): string {
  return expr.replace(REGEXP_OLD_NEXT, '$1').replace(REGEXP_OLD_ENV, '$1$$$$').replace(REGEXP_OLD_MINUS_VARIABLE, '-$$')
    .replace(REGEXP_OLD_DASHES, DOLLAR).replace(REGEXP_OLD_FALLBACK, '$1{$2}');
}

/**
 * Значение целиком — переменная: `$mono` → `var(--mono)`, `$$safe-area-inset-top` → `env(safe-area-inset-top)`,
 * запасной вариант в скобках как есть: `$mono{serif}` → `var(--mono, serif)`, `$a{$b}` → `var(--a, var(--b))`.
 * Для хендлеров, чьё значение не длина (`ff`, `tn`, цвета); длину читает {@link mathValue}.
 *
 * @param s — часть значения
 * @returns CSS, или `undefined`, если часть — не переменная целиком
 * @throws {MnParseError} прежняя запись (`--mono`)
 * @example cssVarValue('$mono{serif}') // 'var(--mono, serif)'
 */
export function cssVarValue(s: string): string | undefined {
  if (s[0] !== DOLLAR) {
    s[0] === DASH && s[1] === DASH && throwOldVariable(s);
    return;
  }
  src = s;
  end = s.length;
  const env = s[1] === DOLLAR;
  pos = env ? 2 : 1;
  const name = readName();
  if (!name) {
    return;
  }
  pos < end && s[pos] === SEMICOLON && pos++;
  if (pos === end) {
    return (env ? ENV_OPEN : VAR_OPEN) + name + CLOSE_PAREN;
  }
  if (s[pos] !== OPEN_BRACE || s[end - 1] !== CLOSE_BRACE) {
    return;
  }
  const raw = s.slice(pos + 1, -1);
  return (env ? ENV_OPEN : VAR_OPEN) + name + ARG_SEPARATOR + (cssVarValue(raw) || raw) + CLOSE_PAREN;
}
