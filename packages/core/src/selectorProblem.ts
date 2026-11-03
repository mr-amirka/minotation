/**
 * Проверка готового селектора токена: что в нём сломает CSS.
 *
 * Селектор строится из токена в нескольких местах (нотация, варианты Tailwind, пресеты области), поэтому
 * проверяется готовый результат — одним проходом по символам, без промежуточных строк. Две ошибки:
 *
 * - после `.` идёт символ, с которого имя класса начаться не может (`.#a`, `.0a`, `.[a]`);
 * - запятая вне `(…)`: в CSS это разделитель списка, и правило применится не к тому
 *   (`.cF00\#a\,b#a,b` — «… или каждый `<b>`»). Внутри `:not(…)`, `:is(…)`, `:where(…)` запятая штатная.
 *
 * Экранированный символ (`\#`) и закавыченная строка (`"a,b"`) — часть значения, их не проверяем.
 *
 * @module selectorProblem
 */
import {
  MnParseError,
} from './core/types';

const BACKSLASH = '\\';
const DOT = '.';
const COMMA = ',';
const OPEN_PAREN = '(';
const CLOSE_PAREN = ')';
const DOUBLE_QUOTE = '"';
const QUOTE = '\'';

/** Символы, с которых имя класса после `.` начаться не может. */
const NOT_NAME_START: Record<string, 1> = {
  '#': 1,
  '[': 1,
  ']': 1,
  '.': 1,
  '*': 1,
  '^': 1,
  '$': 1,
  '(': 1,
  ')': 1,
  '>': 1,
  '<': 1,
  '+': 1,
  '~': 1,
  '=': 1,
  '|': 1,
  ':': 1,
  ',': 1,
  '"': 1,
  '\'': 1,
  '`': 1,
  ' ': 1,
  '\t': 1,
  '\n': 1,
  '\r': 1,
  '\f': 1,
  '@': 1,
  '%': 1,
  '!': 1,
  '/': 1,
  '0': 1,
  '1': 1,
  '2': 1,
  '3': 1,
  '4': 1,
  '5': 1,
  '6': 1,
  '7': 1,
  '8': 1,
  '9': 1,
};

/** Глубже не считаем: запятая на такой глубине — в маске последнего уровня. */
const MAX_DEPTH = 30;

/**
 * Что в селекторе сломает CSS — причина для предупреждения, или `''`, если селектор в порядке.
 *
 * Запятая внутри скобок штатна, только если скобка закрыта: `a(b,c` — запятая снаружи. Уровни, на которых
 * встретилась запятая, — биты маски; закрытая скобка снимает бит своего уровня.
 *
 * @param selector — готовый селектор (`.p10\.\#a.#a`)
 * @returns причина или `''`
 *
 * @example
 * selectorProblem('.cF00\\:not\\[\\.a\\,\\.b\\]:not(.a,.b)')   // → ''
 * selectorProblem('.p10\\.\\#a.#a')
 * // → 'Selector ".p10\.\#a.#a" has "." followed by "#": a class name can\'t start with it'
 */
export function selectorProblem(selector: string): string {
  const l = selector.length;
  let i = 0;
  let depth = 0;
  let commas = 0;
  let close: number;
  let ch: string;
  let next: string;
  for (; i < l; i++) {
    ch = selector[i];
    if (ch === BACKSLASH) {
      i++;
    } else if (ch === DOUBLE_QUOTE || ch === QUOTE) {
      // Незакрытая кавычка — обычный символ: строки нет.
      close = selector.indexOf(ch, i + 1);
      close > -1 && (i = close);
    } else if (ch === DOT) {
      next = selector[i + 1];
      if (next !== undefined && NOT_NAME_START[next]
        && !((next === DOUBLE_QUOTE || next === QUOTE) && selector.indexOf(next, i + 2) > -1)) {
        return 'Selector "' + selector + '" has "." followed by "' + next + '": a class name can\'t start with it';
      }
    } else if (ch === OPEN_PAREN) {
      depth < MAX_DEPTH && depth++;
      commas &= ~(1 << depth);
    } else if (ch === CLOSE_PAREN) {
      if (depth) {
        commas &= ~(1 << depth);
        depth--;
      }
    } else if (ch === COMMA) {
      if (!depth) {
        return commaProblem(selector);
      }
      commas |= 1 << depth;
    }
  }
  return commas ? commaProblem(selector) : '';
}

function commaProblem(selector: string): string {
  return 'Selector "' + selector + '" has a bare ",": it would start a second selector and style other elements.'
    + ' Escape it — "\\," — if it belongs to the value; in :not, :is, :where write the list in square brackets:'
    + ' ":not[.a,.b]"';
}

/**
 * Проверяет готовые селекторы разбора токена; первый битый — {@link MnParseError} с токеном и причиной.
 *
 * Зовётся внутри разбора, поэтому ошибка становится предупреждением `parse-error` (под `strict` — ошибкой
 * сборки), а токен не даёт CSS — как и при любой другой ошибке разбора.
 *
 * @param items — результат разбора: пары «эссенции, селекторы»
 * @param token — токен, как его написал автор
 * @throws {MnParseError} если селектор сломает CSS
 */
export function assertTokenSelectors(items: ReadonlyArray<[unknown, Record<string, unknown>]>, token: string): void {
  const l = items.length;
  let i = 0;
  let selector: string;
  let problem: string;
  for (; i < l; i++) {
    for (selector in items[i][1]) { // eslint-disable-line
      problem = selectorProblem(selector);
      if (problem) {
        throw new MnParseError(problem, {
          token: token,
          handler: '',
          arg: token,
          utility: 'selectors',
        });
      }
    }
  }
}
