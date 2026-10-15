/**
 * Декоратор хендлера для имён Tailwind из нескольких частей (D-061): регистрация не меняется
 * (`mn('gap', tw(handler))`), хендлер находится по первым буквам, а остаток класса
 * (`gap-x-2` → `-x-2`) разбирается здесь один раз и отдаётся хендлеру готовой структурой.
 */
import type {
  MnEssenceParams,
} from '../../core/types';
import type {
  MnHandler, MnHandlerResult,
} from '../../types';

/** Разобранный остаток класса для хендлера в {@link tw}. */
export interface MnTwArgs {
  /** Части до произвольного значения: `gap-x-2` → `['x', '2']`, `bg-blue-500` → `['blue', '500']`. */
  parts: string[];
  /**
   * Произвольное значение: `w-[37px]` → `37px` (`_` — пробел, `\_` — подчёркивание),
   * `fill-(--brand)` → `var(--brand)`; в математике — пробелы вокруг операторов ({@link mathSpaces}).
   */
  arbitrary?: string;
  /** Тип перед произвольным значением: `text-[length:1rem]` → `length` (значение — `1rem`). */
  type?: string;
  /** После `/` вне скобок: `bg-blue-500/50` → `50`, `w-1/2` → `2`. */
  modifier?: string;
  /**
   * Класс с ведущим `-` (`-translate-x-2`). Ядро передаёт такой класс только хендлеру,
   * объявившему `negative` (D-059): `handler.negative = 1` при регистрации.
   */
  negative: boolean;
}

/** Хендлер под {@link tw}: ничего не вернул на kebab-остаток — класс чужой, без предупреждения (D-062). */
export type MnTwHandler = (args: MnTwArgs, p: MnEssenceParams) => MnHandlerResult | void | 0;

/** `[тип:значение]`: тип — слово перед двоеточием. */
const REGEXP_ARBITRARY_TYPE = /^([a-z-]+):(.+)$/;

/** `_` — пробел, `\_` — само подчёркивание. */
const REGEXP_ARBITRARY_SPACE = /\\_|_/g;

/** Математические функции CSS: внутри них — пробелы вокруг операторов, как у Tailwind 4. */
const MATH_FUNCTIONS = [
  'calc',
  'min',
  'max',
  'clamp',
  'mod',
  'rem',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'pow',
  'sqrt',
  'hypot',
  'log',
  'exp',
  'round',
];

/** Цифра. */
const REGEXP_DIGIT = /[0-9]/;

/** Буква латиницы. */
const REGEXP_LETTER = /[a-zA-Z]/;

/** Часть имени функции перед `(`: строчные буквы и цифры. */
const REGEXP_FUNCTION_CHAR = /[a-z0-9]/;

/** Оператор `+ - * /`. */
const REGEXP_OPERATOR = /[-+*/]/;

/**
 * Пробелы вокруг операторов внутри математических функций — как Tailwind 4 пишет произвольные значения:
 * `calc(100%-2rem)` → `calc(100% - 2rem)` (без пробелов `-` в `calc` — не вычитание, CSS недействителен),
 * `min(10px,2*3px)` → `min(10px, 2 * 3px)`. Вне функций (`1/3`) и внутри `var(--x-y)` — без изменений;
 * экспонента (`1e-3`) и знак числа (`* -1`) — не операторы. Порт `addWhitespaceAroundMathOperators`
 * из `tailwindcss@4.3.3` (MIT, (c) Tailwind Labs).
 *
 * @param value — значение
 * @returns значение с пробелами вокруг операторов
 */
export function mathSpaces(value: string): string {
  const l = value.length;
  // Для каждой открытой скобки: `true` — внутри математики.
  const math: boolean[] = [];
  let found = 0;
  let out = '';
  let i = 0;
  let j: number;
  let ch: string;
  let fn: string;
  let last: string;
  let before: string;
  let next: string;
  let trimmed: string;
  // Конец текущего «числа с единицей» и предыдущего — `2px-` после единицы тоже оператор.
  let run = -1;
  let previousRun = -1;
  for (fn of MATH_FUNCTIONS) {
    value.indexOf(fn) < 0 || (found = 1);
  }
  if (!found) {
    return value;
  }
  for (; i < l; i++) {
    ch = value[i];
    REGEXP_DIGIT.test(ch) || run >= 0 && (ch === '%' || REGEXP_LETTER.test(ch)) ? run = i : (previousRun = run, run = -1);
    if (ch === '(') {
      out += ch;
      j = i;
      while (j > 0 && REGEXP_FUNCTION_CHAR.test(value[j - 1])) {
        j--;
      }
      fn = value.slice(j, i);
      // Скобки без имени внутри математики — тоже математика.
      math.unshift(MATH_FUNCTIONS.indexOf(fn) >= 0 || !!math[0] && !fn);
    } else if (ch === ')') {
      out += ch;
      math.shift();
    } else if (ch === ',' && math[0]) {
      out += ', ';
    } else if (ch === ' ' && math[0] && out[out.length - 1] === ' ') {
      continue;
    } else if (math[0] && REGEXP_OPERATOR.test(ch)) {
      trimmed = out.trimEnd();
      last = trimmed[trimmed.length - 1];
      before = trimmed[trimmed.length - 2];
      next = value[i + 1];
      // За концом строки `next` — `undefined`: `test` видит строку «undefined», в ней нет цифр и операторов.
      out += (last === 'e' || last === 'E') && REGEXP_DIGIT.test(before) || REGEXP_OPERATOR.test(last)
        || last === '(' || last === ',' ? ch
        : value[i - 1] === ' ' ? ch + ' '
          : REGEXP_DIGIT.test(last) || REGEXP_DIGIT.test(next) || last === ')' || next === '('
            || REGEXP_OPERATOR.test(next) || previousRun >= 0 && previousRun === i - 1 ? ' ' + ch + ' ' : ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Разбирает остаток класса после имени хендлера: части через `-`, произвольное значение в
 * `[…]` или `(…)`, модификатор после `/`.
 *
 * @param suffix — остаток после имени: `-x-2`, `-blue-500/50`, `-[37px]`, `/50`, `''`
 * @param negative — был ли ведущий `-`
 * @returns структура для хендлера или `undefined`, если остаток не в форме Tailwind
 */
export function parseTwSuffix(suffix: string, negative: boolean): MnTwArgs | undefined {
  const args: MnTwArgs = {
    parts: [],
    negative,
  };
  if (!suffix) {
    return args;
  }
  // Голое имя с модификатором: `shadow/50`, `bg-radial/oklch`.
  if (suffix[0] === '/') {
    args.modifier = suffix.slice(1);
    return args.modifier && args.modifier.indexOf('/') < 0 ? args : undefined;
  }
  if (suffix[0] !== '-') {
    return undefined;
  }
  const l = suffix.length;
  let depth = 0;
  let slash = -1;
  let open = -1;
  let i = 1;
  let ch: string;
  for (; i < l; i++) {
    ch = suffix[i];
    if (ch === '[' || ch === '(') {
      depth++ || open < 0 && suffix[i - 1] === '-' && (open = i);
    } else if (ch === ']' || ch === ')') {
      depth--;
    } else if (ch === '/' && !depth) {
      slash = i;
    }
  }
  const body = slash < 0 ? suffix.slice(1) : suffix.slice(1, slash);
  slash < 0 || (args.modifier = suffix.slice(slash + 1));
  if (depth || !body || slash > -1 && !args.modifier) {
    return undefined;
  }
  if (open < 0) {
    args.parts = body.split('-');
    return args.parts.indexOf('') < 0 ? args : undefined;
  }
  const head = suffix.slice(1, open - 1);
  const close = slash < 0 ? l - 1 : slash - 1;
  const bracket = suffix[open];
  if (suffix[close] !== (bracket === '[' ? ']' : ')') || close - open < 2) {
    return undefined;
  }
  args.parts = head ? head.split('-') : [];
  let value = suffix.slice(open + 1, close).replace(REGEXP_ARBITRARY_SPACE, (match) => (match === '_' ? ' ' : '_'));
  const typed = REGEXP_ARBITRARY_TYPE.exec(value);
  typed && (args.type = typed[1], value = typed[2]);
  args.arbitrary = bracket === '(' ? 'var(' + value + ')' : mathSpaces(value);
  return args.parts.indexOf('') < 0 ? args : undefined;
}

/**
 * Оборачивает хендлер для записи Tailwind (D-061): разбор остатка — здесь, хендлеру —
 * готовая структура {@link MnTwArgs}. Обёртка только собирает остаток — флагов
 * не ставит (D-062): kebab-остаток, на который хендлер ничего не вернул или который не в форме
 * Tailwind, ядро само считает чужим классом и молчит, как Tailwind.
 *
 * @param handler — хендлер, получающий разобранный остаток
 * @returns хендлер для `mn(name, …)`
 * @example
 * mn('gap', tw(({ parts, arbitrary }) => {
 *   const property = parts[0] === 'x' ? 'columnGap' : parts[0] === 'y' ? 'rowGap' : 'gap';
 *   const step = property === 'gap' ? parts[0] : parts[1];
 *   const value = arbitrary || (step && step * 0.25 + 'rem');
 *   return value ? { style: { [property]: value } } : undefined;
 * }));
 * // gap-2 → gap:.5rem; gap-x-4 → column-gap:1rem; gap-y-[3px] → row-gap:3px; gap-foo → чужой класс
 */
export function tw(handler: MnTwHandler): MnHandler {
  return (p: MnEssenceParams) => {
    const args = parseTwSuffix(p.suffix, p.sign === '-');
    return args ? handler(args, p) : undefined;
  };
}
