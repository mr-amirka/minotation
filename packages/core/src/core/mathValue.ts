/**
 * Значения CSS в записи нотации — слой над `fundamentool/css` (D-095): ридер знает CSS и механизм, нотация даёт запись
 * ({@link MN_CSS_SPELLING}: группа `{…}`, `$a`, `$$x`, `;`, `Min{…}`, части градиента) и свои хуки — ошибку
 * {@link MnParseError} и подсказку о прежней записи переменной (`--a`). Здесь же сбор математики без скобок: ядро зовёт
 * {@link mathBareBegin} перед хендлером токена и {@link mathBareEnd} после.
 *
 * @module mathValue
 */
import {
  cssValuesProvider,
} from 'fundamentool/css';
import type {
  TCssValuesOptions,
  TMathRules,
} from 'fundamentool/css';
import {
  MnParseError,
} from './types';

const DOLLAR = '$';
const DOUBLE_QUOTE = '"';

/** Прежняя запись: `;` перед следующей переменной или запятой списка — у `$` он не нужен: `--a;--b` → `$a$b`. */
const REGEXP_OLD_NEXT = /(--[A-Za-z0-9\u0080-\uFFFF-]+);(?=--(?!-)|,)/g;
/** Прежний env в начале части: `---x` → `$$x`. */
const REGEXP_OLD_ENV = /(^|[_,{])---/g;
/** Прежний минус перед переменной: `10---a` → `10-$a`. */
const REGEXP_OLD_MINUS_VARIABLE = /---/g;
/** Прежняя переменная: `--a` → `$a`. */
const REGEXP_OLD_DASHES = /--/g;
/** Прежний запасной вариант через запятую: `$v,10px` → `$v{10px}`; запятая перед переменной — список: `$a,$b`. */
const REGEXP_OLD_FALLBACK = /(\$[A-Za-z0-9_\u0080-￿-]+),(?!\$)([^_,]+)/g;

/**
 * Запись нотации для ридеров `fundamentool/css`: группа и аргументы функций — в фигурных скобках, переменная `$a`,
 * env `$$x`, конец имени `;`, функции с заглавной буквы, градиент `F00-00Fp40_g90`, `_r`, `_rpt`.
 */
export const MN_CSS_SPELLING: TCssValuesOptions = Object.freeze<TCssValuesOptions>({
  group: [
    '{',
    '}',
  ],
  variable: DOLLAR,
  env: '$$',
  nameEnd: ';',
  functions: {
    Min: 'min',
    Max: 'max',
    Clamp: 'clamp',
  },
  gradient: {
    join: '-',
    stop: 'p',
    angle: '_g',
    radial: '_r',
    repeat: '_rpt',
    space: '_',
  },
  fail: throwParse,
  legacy: throwOldVariable,
});

/**
 * Ридеры значений в записи нотации: `math` — длина с математикой, `variable` — переменная целиком, `color` — цвет,
 * `gradient` — фон. Хендлеры зовут их на каждый токен (горячий путь — состояние ридера модульное).
 */
export const mnCss = cssValuesProvider(MN_CSS_SPELLING);

/**
 * Математика без скобок, найденная с {@link mathBareBegin}: пары «как часть написана в токене», «выражение». Один
 * список на всю сборку: сбор помечает его длину и отрезает своё в {@link mathBareEnd}, так что токен без такой
 * математики (почти любой) не стоит списка.
 */
const $$bare: string[] = [];
/** Сколько сборов открыто; `0` — ридер, вызванный вне хендлера, ничего не копит. */
let $$bareDepth = 0;
/** Ничего не найдено — один общий пустой список, его не меняют. */
const NO_BARE: readonly string[] = [];

/**
 * Значение с математикой — {@link mnCss}`.math`, и запись в сбор математики без скобок (режим `bareMathMode`), если
 * оператор стоит вне скобок (`1/2+32`, `$a*2`).
 *
 * @param expr — одна часть значения (между `_`): `100%-2rem+10`
 * @param rules — правила свойства (`mathRules` из `fundamentool/css`)
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
  expr: string, rules: TMathRules, written?: string,
): string {
  const css = mnCss.math(expr, rules);
  $$bareDepth && mnCss.bare() && $$bare.push(written === undefined ? expr : written, expr);
  return css;
}

/**
 * Начинает сбор математики без скобок: ядро зовёт его перед хендлером токена, {@link mathBareEnd} — после.
 * Сбор вложенный: внутренний отрезает только своё, внешний своё сохраняет.
 * @returns метка начала сбора — её получает {@link mathBareEnd}
 * @example const mark = mathBareBegin(); mathValue('1+2', rules); mathBareEnd(mark) // ['1+2', '1+2']
 */
export function mathBareBegin(): number {
  $$bareDepth++;
  return $$bare.length;
}

/**
 * Заканчивает сбор, начатый {@link mathBareBegin}.
 * @param mark — метка, которую вернул {@link mathBareBegin}
 * @returns пары «как часть написана в токене», «выражение» — по одной на каждое значение с оператором вне скобок;
 *   ничего не найдено — общий пустой список (его не меняют)
 * @example mathBareEnd(mark) // ['B$a*2', '$a*2']
 */
export function mathBareEnd(mark: number): readonly string[] {
  $$bareDepth--;
  return $$bare.length === mark ? NO_BARE : $$bare.splice(mark);
}

/** Ошибка ридера — ошибка разбора нотации; токен и хендлер подставит ядро. */
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
