/**
 * Пробелы вокруг операторов в математике произвольных значений — как пишет их Tailwind 4: и в утилитах
 * (`w-[calc(100%-2rem)]`, `presets/shared/tw.ts`), и в вариантах (`max-[calc(100%-2rem)]:`, разбор ядра).
 *
 * @module mathSpaces
 */

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
