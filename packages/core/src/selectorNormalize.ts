/**
 * Нормализация селектора Minotation → CSS-селектор.
 *
 * ## Обработка
 *
 * 1. **Разворот через `!`** — сплит по `!` с учётом экранирования,
 *    разворот массива, склейка. Позволяет писать селекторы в обратном порядке:
 *    `Parent!Child` → `ChildParent`.
 *
 * 2. **Часть имени класса** (D-050) — `.*текст` → `[class*=текст]` (содержит). Значение в
 *    кавычках, только если без них оно не идентификатор CSS (`.*1x` → `[class*="1x"]`).
 *    Висячая `*` в конце (`.*a*`) — брак; `.^`/`.$` — брак (проверяли бы всю строку `class`).
 *    В MN звёздочка означает «содержит подстроку».
 *
 * 3. **Часть id** — `#*`, `#^`, `#$` → `[id*=…]`, `[id^=…]` (начинается с), `[id$=…]`
 *    (заканчивается на): у `id` одно значение, начало и конец осмысленны.
 *
 * 4. **Скобки функционального псевдокласса** ({@link pseudoBrackets}, применяется
 *    ТОЛЬКО к селекторам `mn.assign`/`essence.selectors`) — `:not[.plain]` →
 *    `:not(.plain)`.
 *    В нотации `[...]` сразу после имени состояния — это scope: в токене
 *    `cF00:not[.a]` он давно разворачивается в `:not(.a)`. В селекторах
 *    `mn.assign` тот же механизм не работал, и `'button:not[.plain]'` уезжало
 *    в CSS как есть — невалидным, потому что `[.plain]` не атрибут.
 *
 *    Атрибутные селекторы не задеты: квадратные скобки превращаются в круглые
 *    ТОЛЬКО вплотную за именем псевдокласса. `input[checked]`, `[type=text]`,
 *    `.cF00[checked]` остаются как есть — `[` в них начинает контекстную часть,
 *    а не аргумент.
 *
 *    В сам `selectorNormalize` преобразование НЕ входит: имена токенов проходят
 *    через него же, а там scope уже разворачивается механизмом
 *    `selectorsCompileProvider` — двойное преобразование дало бы
 *    `:not(.a(.b))` вместо `:not(.a[.b])` (поймано тестом вложенных scope).
 *
 * @param minotationSelector — селектор в синтаксисе MN
 * @returns нормализованный CSS-совместимый селектор
 *
 * @example
 * // Простой класс
 * selectorNormalize('myClass')        // → 'myClass'
 *
 * @example
 * // Разворот через !
 * selectorNormalize('Parent!Child')   // → 'ChildParent'
 *
 * @example
 * // Wildcard-класс
 * selectorNormalize('.*active')       // → '[class*=active]'
 *
 * @example
 * // Wildcard-id
 * selectorNormalize('#*main')         // → '[id*=main]'
 */
import {
  MnParseError,
} from './core/types';
import {
  escapedSplitProvider,
} from 'fundamentool';

/** Сплиттер по `!` с учётом экранирования (base-версия без unslash). */
const splitReverse = escapedSplitProvider('!').base;

/**
 * `.*текст` / `.^текст` / `.$текст` и то же с `#` (D-050): `[1]` — `.` или `#`, `[2]` —
 * оператор, `[3]` — текст, `[4]` — висячая `*` (брак).
 */
const REGEXP_ATTR_PART = /([.#])([*^$])([A-Za-z0-9_$-]+)(\*?)/g;

/** Корректный идентификатор CSS — значение атрибута можно не брать в кавычки. */
const REGEXP_CSS_IDENT = /^(?:-?[A-Za-z_]|--)[A-Za-z0-9_-]*$/;

function attrPartReplacer(
  match: string, kind: string, operator: string, text: string, dangling: string,
): string {
  dangling && throwDanglingStar(match);
  // `^=`/`$=` проверяют начало и конец всей строки `class`, а не каждого класса: у
  // `class="card btn-x"` `.^btn-` не совпал бы. Решение владельца — не поддерживать (D-050).
  const isClass = kind === '.';
  isClass && operator !== '*' && throwClassAnchor(match, operator);
  return '[' + (isClass ? 'class' : 'id') + operator + '='
    + (REGEXP_CSS_IDENT.test(text) ? text : '"' + text + '"') + ']';
}

function throwClassAnchor(match: string, operator: string): never {
  throw new MnParseError('"' + match + '" is not supported: CSS [class' + operator + '=…] checks the start'
    + ' or end of the whole class attribute, not of each class, so it rarely matches. Use ".*text"'
    + ' (contains)', {
    token: '',
    handler: '',
    arg: match,
    utility: 'selectorNormalize',
  });
}

function throwDanglingStar(match: string): never {
  throw new MnParseError('"' + match + '" ends with "*" with nothing after it. Use "'
    + match[0] + '*text" (contains)' + (match[0] === '#' ? ', "#^text" (starts with) or "#$text" (ends with)' : ''), {
    token: '',
    handler: '',
    arg: match,
    utility: 'selectorNormalize',
  });
}

/** Имя псевдокласса/псевдоэлемента сразу после `:` или `::`. */
const REGEXP_PSEUDO_NAME = /^:{1,2}[A-Za-z][A-Za-z-]*/;

/**
 * `:name[...]` → `:name(...)` — скобки аргумента функционального псевдокласса.
 *
 * Меняется только ВНЕШНЯЯ пара, вплотную идущая за именем: вложенные скобки
 * остаются квадратными, как и в токенах (`:hover[.a[.b]]` → `:hover(.a[.b])`).
 */
export function pseudoBrackets(selector: string): string {
  const l = selector.length;
  let output = '';
  let i = 0;
  let matchs: RegExpExecArray | null;
  let depth: number;
  let j: number;
  let ch: string;
  while (i < l) {
    ch = selector[i];
    if (ch === '\\') {
      // Экранированный символ переносится парой — `\[` остаётся литералом.
      output += selector.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch !== ':') {
      output += ch;
      i++;
      continue;
    }
    matchs = REGEXP_PSEUDO_NAME.exec(selector.slice(i));
    if (!matchs) {
      output += ch;
      i++;
      continue;
    }
    output += matchs[0];
    i += matchs[0].length;
    if (selector[i] !== '[') {
      continue;
    }
    // Ищем парную `]`, считая вложенность и пропуская экранированное.
    depth = 1;
    j = i + 1;
    while (j < l && depth) {
      if (selector[j] === '\\') {
        j += 2;
        continue;
      }
      if (selector[j] === '[') {
        depth++;
      } else if (selector[j] === ']') {
        depth--;
      }
      j++;
    }
    if (depth) {
      // Пары нет — оставляем как написано, пусть разбирается дальше по цепочке.
      continue;
    }
    output += '(' + selector.slice(i + 1, j - 1) + ')';
    i = j;
  }
  return output;
}

export function selectorNormalize(minotationSelector: string): string {
  return splitReverse(minotationSelector)
    .reverse()
    .join('')
    .replace(REGEXP_ATTR_PART, attrPartReplacer);
}
