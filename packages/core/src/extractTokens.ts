import {
  MN_GROUP_ATTR,
  MN_GROUP_FNS,
  MN_GROUP_TARGET,
  MN_GROUP_VARS,
  MN_PLAN_COMMENTS,
  MN_PLAN_GROUPS,
  MN_PLAN_MARKER_TARGET,
  cachedScanPlanOf,
} from './scanPlan';
import type {
  ScanGroup,
  ScanPlan,
  ScannedTokens,
} from './scanPlan';
import type {
  TPairsValue,
} from 'fundamentool';

/** A replacement: the match, escaped. */
const ESCAPED_MATCH = '\\$&';
const SPACE = ' ';
const NEWLINE = '\n';
const TAB = '	';
const AND_OPERATOR = '&&';
const LESS = '<';
const GREATER = '>';
const DASH = '-';
const ASTERISK = '*';
const SLASH = '/';
const PIPE = '|';
const QUESTION = '?';
const DOT = '.';
const EXCLAMATION = '!';
const OPEN_PAREN = '(';
const CLOSE_PAREN = ')';
const QUOTE = '\'';
const DOUBLE_QUOTE = '"';
const BACKTICK = '`';
const OPEN_BRACKET = '[';
const EQUALS = '=';
const BACKSLASH = '\\';
const OPEN_BRACE = '{';
const CLOSE_BRACE = '}';

/**
 * Извлечение MN-токенов из значений заданного HTML/JSX-атрибута в тексте файла.
 *
 * Используется build-плагинами (`minotation-vite`, `minotation-webpack`) для сбора
 * токенов из исходников без полноценного парсинга AST — под капотом просто ищет
 * значение атрибута в одной из распространённых форм и разбивает его по пробелам.
 *
 * ## Поддерживаемые формы значения
 *
 * 1. **Литеральная строка** (HTML/JSX): `attr="p10 w50"`, `attr='p10 w50'`.
 * 2. **JSX-выражение со строкой**: `attr={'p10 w50'}`, `attr={"p10 w50"}`.
 * 3. **Template literal**: `` attr={`p10 ${cond} w50`} `` — литеральные сегменты плюс
 *    литералы-значения подстановок (D-074): `` `p10 ${on ? 'cF' : 'c0'}` `` → `p10 cF c0`;
 *    переменная или вызов в подстановке токенов не дают.
 * 4. **Свойство объектного литерала** (напр. MUI `slotProps`):
 *    `{ className: 'p10 w50' }`, `{ className: "p10 w50" }` — в т.ч. вложенное,
 *    `slotProps={{ paper: { className: 'p10 w50' } }}`. Различие с формой 1 — `:`
 *    вместо `=` перед значением, оба варианта разбираются одним regexp'ом
 *    (`[:=]`). Вложенность объекта не важна — regexp ищет `attrName` где угодно
 *    в тексте, не разбирает структуру объекта.
 *
 * 5. **Выражение** (`attr={…}` и значение свойства без кавычек): литералы, которые могут
 *    стать значением, — ветви `?:`, правая часть `&&`, обе части `||`/`??`
 *    ({@link pushValueExpression}). Условия, сравнения, вызовы и склейка токенов не дают.
 *
 * @module extractTokens
 */

/** `${...}` — интерполяция внутри template literal, вырезается перед разбиением на токены. */
const REGEXP_INTERPOLATION = /\$\{[^}]*\}/g;

/**
 * Символы, требующие экранирования при подстановке произвольного `attrName` в regexp
 * (защита от инъекции спецсимволов, если имя атрибута когда-нибудь станет пользовательским).
 */
const REGEXP_ESCAPE = /[.*+?^${}()|[\]\\]/g;

/**
 * Начало имени перед концом шаблона: `fill` в `fillClassName`, `data-` в `data-class` (D-131). Хотя бы один знак:
 * `*ClassName` — имя, которое кончается на `ClassName` и длиннее него (D-146, одно правило для трёх опций).
 */
const NAME_HEAD_SOURCE = '[\\w$-]+';

/**
 * Имя атрибута для регулярного выражения: точное — экранированным, шаблон `*ClassName` — любым именем, которое
 * кончается на `ClassName` (D-131). Граница слева — за вызывающим.
 *
 * @param attr — имя из опции `attr`
 * @returns исходник регулярного выражения
 *
 * @example
 * attrNameSource('className')    // → 'className'
 * attrNameSource('*ClassName')   // → '[\\w$-]+ClassName'
 */
export function attrNameSource(attr: string): string {
  return attr[0] === ASTERISK
    ? NAME_HEAD_SOURCE + attr.slice(1).replace(REGEXP_ESCAPE, ESCAPED_MATCH)
    : attr.replace(REGEXP_ESCAPE, ESCAPED_MATCH);
}

/**
 * Подходит ли имя атрибута, ключа, переменной или функции под имена опции (D-146): то же имя или шаблон `*ClassName` —
 * имя кончается на `ClassName`, регистр как написан (D-131). Зовётся на каждый узел файла, поэтому конец
 * сравнивается посимвольно, без `slice`.
 *
 * @param name — имя в исходнике
 * @param attrs — имена и шаблоны одной опции, без целей
 * @returns `true`, если имя подходит
 *
 * @example
 * isScanName('fillClassName', ['className', '*ClassName'])   // → true
 * isScanName('classname', ['*ClassName'])                    // → false
 * isScanName('ClassName', ['*ClassName'])                    // → false — только окончание, без начала
 * isScanName('thClass', ['mne', '*Class'])                   // → true
 */
export function isScanName(name: string, attrs: string[]): boolean {
  const l = attrs.length;
  const nameLength = name.length;
  let i = 0;
  let attr: string;
  let at: number;
  let j: number;
  let length: number;
  for (; i < l; i++) {
    attr = attrs[i];
    if (attr[0] !== ASTERISK) {
      if (attr === name) {
        return true;
      }
      continue;
    }
    length = attr.length;
    // Конец шаблона (`ClassName`) начинается в имени с `at`; перед ним — хотя бы один знак.
    at = nameLength - length + 1;
    if (at < 1) {
      continue;
    }
    j = 1;
    while (j < length && name[at + j - 1] === attr[j]) {
      j++;
    }
    if (j === length) {
      return true;
    }
  }
  return false;
}

/**
 * Что искать в строке, прежде чем разбирать её как разметку: `className=` у имени, `ClassName=` у шаблона.
 *
 * @param attr — имя или шаблон опции `attr`
 * @returns подстрока-признак
 *
 * @example attrMarkup('*ClassName') // → 'ClassName='
 */
export function attrMarkup(attr: string): string {
  return (attr[0] === ASTERISK ? attr.slice(1) : attr) + EQUALS;
}

/**
 * Кеш регулярок по имени атрибута.
 *
 * `extractTokens` зовётся на каждый файл сборки, а имён атрибутов в проекте одно-два.
 * Компиляция регулярки — самая дорогая часть вызова, и без кеша она повторялась
 * столько раз, сколько в проекте файлов.
 */
const $$attrRegexps: Record<string, RegExp> = {};

function buildAttrRegexp(attrName: string): RegExp {
  const name = attrNameSource(attrName);
  // `[:=]` — принимает как JSX-атрибут (`attr=`), так и свойство объектного
  // литерала (`attr:`, включая вложенное — напр. MUI `slotProps={{ paper: { className:... } }}`).
  // Граница слева: без неё `Name` ловил бы `className=`, а `class` — `data-class=`.
  // `class` не матчил `className=` только потому, что после него идёт `N`.
  return new RegExp('(?<![\\w$-])' + name + '\\s*[:=]\\s*(?:"([^"]*)"'
      + '|\'([^\']*)\''
      + '|\\{\\s*\'([^\']*)\'\\s*\\}'
      + '|\\{\\s*"([^"]*)"\\s*\\}'
      // Остальное — выражение (`{v ? 'a' : 'b'}`, `className: on && 'a'`): его читает
      // `pushValueExpression`, шаблоны тоже (D-074: подстановки читаются).
      // 5 — в фигурных скобках, 6 — без них (свойство объекта).
      + '|(\\{)'
      + '|()(?=[^\\s\'"{=>]))',
  'g');
}

/**
 * @param source — полный текст файла
 * @param attrName — имя атрибута (`'class'`, `'className'`,...)
 * @returns массив токенов (может содержать дубликаты — вызывающая сторона обычно
 *   складывает результат в `Set` для дедупликации)
 *
 * @example
 * extractTokens('<div class="p10 w50">', 'class')                  // → ['p10', 'w50']
 * extractTokens('<div className={"m5"}>', 'className')             // → ['m5']
 * extractTokens('<div className={`fx1 ${x} h100`}>', 'className')  // → ['fx1', 'h100']
 * extractTokens('slotProps={{ paper: { className: \'w320 dF\' } }}', 'className')  // → ['w320', 'dF']
 */
export function extractTokens(source: string, attrName: string): string[] {
  const tokens: string[] = [];
  extractTokensInto(
    tokens, source, attrName,
  );
  return tokens;
}

/**
 * То же, что {@link extractTokens}, но пишет в переданный массив.
 *
 * Нужна {@link scanTokens}: три механизма складывают токены в ОДИН массив, вместо трёх
 * своих и `concat` поверх — на файл это четыре аллокации вместо одной.
 *
 * @param tokens — аккумулятор, в который добавляются найденные токены
 * @param source — полный текст файла
 * @param attrName — имя атрибута
 */
export function extractTokensInto(
  tokens: string[], source: string, attrName: string,
): void {
  const regexp = $$attrRegexps[attrName]
    || ($$attrRegexps[attrName] = buildAttrRegexp(attrName));
  // Регулярка переиспользуется между вызовами, а флаг `g` хранит позицию:
  // без сброса следующий файл сканировался бы не с начала.
  regexp.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regexp.exec(source))) {
    if (match[5] !== undefined || match[6] !== undefined) {
      regexp.lastIndex = pushValueExpression(
        tokens, source, regexp.lastIndex,
      );
      continue;
    }
    // одна из четырёх литеральных альтернатив regexp'а совпала — иначе не было бы матча
    pushLiteralTokens(tokens,
      (match[1] ?? match[2] ?? match[3] ?? match[4]) as string);
  }
}

/** Идентификаторный символ: продолжение имени переменной. */
function isIdentChar(ch: string): boolean {
  return ch === '_' || ch === '$'
    || (ch >= 'a' && ch <= 'z')
    || (ch >= 'A' && ch <= 'Z')
    || (ch >= '0' && ch <= '9');
}

/** Пробел, перевод строки или табуляция. */
function isSpaceChar(ch: string): boolean {
  return ch === SPACE || ch === NEWLINE || ch === TAB || ch === '\r';
}

/**
 * Состояние разбора выражения кортежем (§2): исходник, позиция, аккумулятор токенов.
 *
 * Аккумулятор общий с остальным сканером: литерал, который оказался не значением
 * (условие, операнд сравнения), отрезается обратно по сохранённой длине — без
 * промежуточных массивов на каждый узел.
 */
type ExpressionState = [source: string, at: number, out: string[]];

const MN_EXPR_SOURCE = 0;
const MN_EXPR_AT = 1;
const MN_EXPR_OUT = 2;

/** Бинарные операторы, длинные раньше коротких: `===` не должен прочитаться как `==`. */
const BINARY_OPERATORS = [
  '===',
  '!==',
  AND_OPERATOR,
  '||',
  '??',
  '==',
  '!=',
  '<=',
  '>=',
  LESS,
  GREATER,
  '+',
  DASH,
  ASTERISK,
  SLASH,
  '%',
  PIPE,
  '&',
  '^',
];

/**
 * Токены выражения, которое начинается в `at`, — из каждого литерала, который может
 * стать его значением (паритет с синтаксическим сканером, `syntaxScan.ts`).
 *
 * Берутся обе ветки `cond ? 'a' : 'b'` (и вложенных), правая часть `cond && 'a'`, обе
 * части `a || 'b'` и `a ?? 'b'`, скобки, статические куски шаблона. Условие и операнды
 * сравнения не берутся: в `v === 'splash' ? …` строка `'splash'` — не класс. Вызов,
 * обращение к свойству, конкатенация на этапе сборки неизвестны — токенов не дают.
 *
 * Разбор останавливается на первом символе, которым выражение продолжиться не может
 * (`}`, `)`, `,`, `;`, `=>`, начало следующей инструкции).
 *
 * @param out — аккумулятор токенов
 * @param source — текст файла
 * @param at — позиция начала выражения
 * @returns позиция сразу за прочитанным выражением
 *
 * @example
 * pushValueExpression(out, "v === 'splash' ? 'bg1 cF' : 'fx1' }", 0)  // out: bg1, cF, fx1
 */
export function pushValueExpression(
  out: string[], source: string, at: number,
): number {
  const state: ExpressionState = [
    source,
    at,
    out,
  ];
  readConditional(state);
  return state[MN_EXPR_AT];
}

/** Пропускает пробелы и переводы строк. */
function skipSpaces(state: ExpressionState): void {
  const source = state[MN_EXPR_SOURCE];
  const l = source.length;
  let i = state[MN_EXPR_AT];
  while (i < l && isSpaceChar(source[i])) {
    i++;
  }
  state[MN_EXPR_AT] = i;
}

/** `cond ? a : b` — условие отрезается, ветки остаются; без `:` выражение битое — отрезается всё. */
function readConditional(state: ExpressionState): void {
  const source = state[MN_EXPR_SOURCE];
  const out = state[MN_EXPR_OUT];
  const mark = out.length;
  readBinary(state, 0);
  skipSpaces(state);
  const i = state[MN_EXPR_AT];
  if (source[i] !== QUESTION || source[i + 1] === QUESTION || source[i + 1] === DOT) {
    return;
  }
  out.length = mark;
  state[MN_EXPR_AT] = i + 1;
  readConditional(state);
  skipSpaces(state);
  if (source[state[MN_EXPR_AT]] !== ':') {
    out.length = mark;
    return;
  }
  state[MN_EXPR_AT]++;
  readConditional(state);
}

/** Оператор в позиции `at` или пустая строка; `=>` и `=` операторами не считаются. */
function binaryOperator(source: string, at: number): string {
  const l = BINARY_OPERATORS.length;
  let i = 0;
  let operator: string;
  for (; i < l; i++) {
    operator = BINARY_OPERATORS[i];
    if (source.startsWith(operator, at)) {
      return operator;
    }
  }
  return '';
}

/** Приоритет: `??`/`||` — 1, `&&` — 2, остальные (сравнения, арифметика) — 3. */
function precedence(operator: string): number {
  return operator === '||' || operator === '??' ? 1 : operator === AND_OPERATOR ? 2 : 3;
}

/**
 * Цепочка бинарных операторов не ниже `minPrecedence`.
 *
 * `a && b` — значение из `b`; `a || b`, `a ?? b` — из обеих; прочие (`===`, `+`) —
 * вычисляемые, токены обеих частей отрезаются.
 */
function readBinary(state: ExpressionState, minPrecedence: number): void {
  const source = state[MN_EXPR_SOURCE];
  const out = state[MN_EXPR_OUT];
  const mark = out.length;
  let operator: string;
  let level: number;
  readOperand(state);
  for (;;) {
    skipSpaces(state);
    operator = binaryOperator(source, state[MN_EXPR_AT]);
    if (!operator) {
      return;
    }
    level = precedence(operator);
    if (level < minPrecedence) {
      return;
    }
    state[MN_EXPR_AT] += operator.length;
    if (operator === AND_OPERATOR) {
      out.length = mark;
      readBinary(state, level + 1);
    } else if (level === 1) {
      readBinary(state, level + 1);
    } else {
      readBinary(state, level + 1);
      out.length = mark;
    }
  }
}

/**
 * Операнд: литерал, шаблон, скобки, имя или число — плюс хвост из вызовов и обращений
 * к свойствам. С хвостом значение вычисляемое (`'a b'.trim()`), его токены отрезаются.
 */
function readOperand(state: ExpressionState): void {
  const source = state[MN_EXPR_SOURCE];
  const out = state[MN_EXPR_OUT];
  const mark = out.length;
  skipSpaces(state);
  let i = state[MN_EXPR_AT];
  const ch = source[i];
  if (ch === EXCLAMATION || ch === '~' || ch === '+' || ch === DASH) {
    // Унарный оператор: значение — уже не строка.
    state[MN_EXPR_AT] = i + 1;
    readOperand(state);
    out.length = mark;
    return;
  }
  if (ch === OPEN_PAREN) {
    state[MN_EXPR_AT] = i + 1;
    readConditional(state);
    skipSpaces(state);
    source[state[MN_EXPR_AT]] === CLOSE_PAREN && state[MN_EXPR_AT]++;
  } else if (ch === QUOTE || ch === DOUBLE_QUOTE) {
    i = skipString(source, i);
    pushLiteralTokens(out, source.slice(state[MN_EXPR_AT] + 1, i - 1));
    state[MN_EXPR_AT] = i;
  } else if (ch === BACKTICK) {
    state[MN_EXPR_AT] = readTemplate(
      source, i, out,
    );
  } else if (ch !== undefined && (isIdentChar(ch) || ch === DOT)) {
    const sourceLength = source.length;
    while (i < sourceLength && (isIdentChar(source[i]) || source[i] === DOT)) {
      i++;
    }
    state[MN_EXPR_AT] = i;
  } else {
    return;
  }
  readPostfix(state) && (out.length = mark);
}

/** Вызовы, индексы и обращения к свойствам после операнда; `true` — что-то было. */
function readPostfix(state: ExpressionState): boolean {
  const source = state[MN_EXPR_SOURCE];
  let i = state[MN_EXPR_AT];
  const start = i;
  let ch: string;
  for (;;) {
    ch = source[i];
    if (ch === OPEN_PAREN || ch === OPEN_BRACKET) {
      i = skipBalanced(source, i);
    } else if (ch === DOT || (ch === QUESTION && source[i + 1] === DOT)) {
      i += ch === DOT ? 1 : 2;
      const sourceLength = source.length;
      while (i < sourceLength && isIdentChar(source[i])) {
        i++;
      }
    } else if (ch === EXCLAMATION && source[i + 1] !== EQUALS) {
      // TS: `value!` — утверждение «не null».
      i++;
    } else {
      break;
    }
  }
  state[MN_EXPR_AT] = i;
  return i > start;
}

/** Позиция за закрывающей кавычкой строки, открытой в `at`. */
function skipString(source: string, at: number): number {
  const quote = source[at];
  const l = source.length;
  let i = at + 1;
  for (; i < l; i++) {
    if (source[i] === BACKSLASH) {
      i++;
      continue;
    }
    if (source[i] === quote) {
      return i + 1;
    }
  }
  return l;
}

/**
 * Шаблон, открытый в `at`: статические куски — в `out` (если передан), подстановка
 * `${…}` — по правилам выражения (D-074): `` `p10 ${on ? 'cF' : 'c0'}` `` → `p10 cF c0`.
 * Подстановку, которую разбор не дочитал до `}`, — целиком пропускаем.
 * Без `out` шаблон только пропускается. Возвращает позицию за закрывающей кавычкой.
 */
function readTemplate(
  source: string, at: number, out: string[] | undefined,
): number {
  const l = source.length;
  let i = at + 1;
  let from = i;
  for (; i < l; i++) {
    if (source[i] === BACKSLASH) {
      i++;
      continue;
    }
    if (source[i] === BACKTICK) {
      out && pushLiteralTokens(out, source.slice(from, i));
      return i + 1;
    }
    if (source[i] === '$' && source[i + 1] === OPEN_BRACE) {
      out && pushLiteralTokens(out, source.slice(from, i));
      i = out ? readSubstitution(
        source, i + 1, out,
      ) : skipBalanced(source, i + 1) - 1;
      from = i + 1;
    }
  }
  return l;
}

/**
 * Подстановка `${…}`, `{` которой — в `at`: токены значения в `out`.
 * Возвращает позицию закрывающей `}`.
 */
function readSubstitution(
  source: string, at: number, out: string[],
): number {
  const mark = out.length;
  // Разбор сам съедает пробелы за выражением: дальше сразу `}` или то, на чём он встал.
  const i = pushValueExpression(
    out, source, at + 1,
  );
  if (source[i] === CLOSE_BRACE) {
    return i;
  }
  out.length = mark;
  return skipBalanced(source, at) - 1;
}

/** Позиция за скобкой, парной открытой в `at`; строки и шаблоны внутри пропускаются. */
function skipBalanced(source: string, at: number): number {
  const l = source.length;
  let depth = 0;
  let i = at;
  let ch: string;
  for (; i < l; i++) {
    ch = source[i];
    if (ch === OPEN_PAREN || ch === OPEN_BRACKET || ch === OPEN_BRACE) {
      depth++;
    } else if (ch === CLOSE_PAREN || ch === ']' || ch === CLOSE_BRACE) {
      if (!--depth) {
        return i + 1;
      }
    } else if (ch === QUOTE || ch === DOUBLE_QUOTE) {
      i = skipString(source, i) - 1;
    } else if (ch === BACKTICK) {
      i = readTemplate(
        source, i, undefined,
      ) - 1;
    }
  }
  return l;
}

/**
 * Разбивает литерал на токены, отбрасывая `${…}`-подстановки.
 *
 * Без `split`: он аллоцирует промежуточный массив на каждый литерал, а литералов в файле
 * столько же, сколько атрибутов, переменных и вызовов. Границы слов находятся проходом,
 * наружу уходят сразу готовые подстроки. `replace` тоже пропускается, когда подстановок
 * нет — а их нет в большинстве литералов.
 *
 * Экспортируется ради синтаксического сканера (`syntaxScan.ts`) и бенчмарков:
 * оба обязаны делить разбиение с рабочей реализацией, иначе один сравнивал бы
 * разные вещи, а второй расходился с текстовым сканером на пустом месте.
 */
export function pushLiteralTokens(out: string[], literal: string): void {
  const text = literal.indexOf('${') < 0
    ? literal
    : literal.replace(REGEXP_INTERPOLATION, SPACE);
  const l = text.length;
  let i = 0;
  let from = -1;
  let ch: string;
  for (; i < l; i++) {
    ch = text[i];
    if (ch === SPACE || ch === NEWLINE || ch === TAB || ch === '\r') {
      if (from >= 0) {
        out.push(text.slice(from, i));
        from = -1;
      }
      continue;
    }
    if (from < 0) {
      from = i;
    }
  }
  if (from >= 0) {
    out.push(from ? text.slice(from) : text);
  }
}

/**
 * Извлекает MN-токены из строковых значений переменных с заданными именами.
 *
 * Классы, собранные в переменной, разбор `class="…"` не видит — а в островах
 * (React/Preact/Vue) набор токенов почти всегда лежит в константе. Конвенция имени
 * (шаблон `*Class` — имя кончается на `Class`) делает такую переменную видимой для сборки.
 *
 * Распознаются присваивание (`const aClass = '…'`), свойство объекта
 * (`{ aClass: '…' }`) и аннотация типа между ними (`const aClass: string = '…'`).
 * Кавычки любые, включая обратные; `${…}`-подстановки отбрасываются.
 *
 * ## Почему разбор ручной, а не регуляркой
 *
 * Регулярка обходилась в 104 мс на 300 файлов × 20 прогонов, из них почти всё —
 * ведущий `[\\w$]*`, которым «захватывалось имя переменной»: имя нигде не
 * использовалось, а движок перебирал его длины на каждой позиции файла. После снятия
 * `[\\w$]*` осталось 20 мс, ручной разбор даёт около 6 мс — и попутно разбирает
 * аннотацию типа точно, а не через backtracking (регулярке приходилось сначала съедать
 * `[^=;\\n]+` до конца строки и отступать назад в поисках `=`).
 *
 * @param source — исходный текст файла
 * @param names — имена и шаблоны `*Окончание` (`['*Class']`; D-146); пустой массив отключает разбор
 * @returns список токенов (с возможными повторами)
 *
 * @example
 * extractClassVarTokens("const rowClass = 'p10'", ['*Class'])      // → ['p10']
 * extractClassVarTokens("const rowStyles = 'p10'", ['rowStyles'])  // → ['p10']
 */
export function extractClassVarTokens(source: string, names: string[]): string[] {
  const out: string[] = [];
  extractClassVarTokensInto(
    out, source, names,
  );
  return out;
}

/**
 * То же, что {@link extractClassVarTokens}, но пишет в переданный массив.
 *
 * @param out — аккумулятор
 * @param source — полный текст файла
 * @param names — имена и шаблоны `*Окончание`; пустой массив отключает разбор
 */
export function extractClassVarTokensInto(
  out: string[], source: string, names: string[],
): void {
  const namesLength = names.length;
  if (!namesLength) {
    return;
  }
  const l = source.length;
  let si = 0;
  let name: string;
  let isExact: boolean;
  let nameLength: number;
  let from: number;
  let at: number;
  let i: number;
  let quote: string;
  let valueFrom: number;
  for (; si < namesLength; si++) {
    name = names[si];
    // Шаблон `*Class` ищется окончанием, перед которым — начало имени; точное имя — целиком.
    isExact = name[0] !== ASTERISK;
    isExact || (name = name.slice(1));
    nameLength = name.length;
    from = 0;
    while ((at = source.indexOf(name, from)) !== -1) {
      i = at + nameLength;
      from = i;
      // `thClassy` — окончание продолжается, значит это другое имя; `my_rowStyles` — у точного имени чужое начало;
      // `Class` — у шаблона нет начала.
      if (i < l && isIdentChar(source[i])
        || (isExact ? at && isIdentChar(source[at - 1]) : !at || !isIdentChar(source[at - 1]))) {
        continue;
      }
      while (i < l && isSpaceChar(source[i])) {
        i++;
      }
      if (source[i] === ':') {
        // Либо свойство объекта (`{ aClass: '…' }`), либо аннотация типа
        // (`const aClass: string = '…'`). Различаем по тому, что идёт после.
        i++;
        while (i < l && isSpaceChar(source[i])) {
          i++;
        }
        quote = source[i];
        if (quote !== QUOTE && quote !== DOUBLE_QUOTE && quote !== BACKTICK) {
          // Аннотация доходит до `=`, обрываясь на `;` и переводе строки —
          // как и прежняя регулярка (`[^=;\n]+`). Не дошла (или `=` — часть
          // `===`/`=>`) — это свойство объекта со значением-выражением:
          // `{ aClass: on ? 'a' : 'b' }`.
          at = i;
          while (i < l && source[i] !== EQUALS && source[i] !== ';' && source[i] !== NEWLINE) {
            i++;
          }
          if (!isAssignment(source, i)) {
            from = pushValueExpression(
              out, source, at,
            );
            continue;
          }
          i++;
          while (i < l && isSpaceChar(source[i])) {
            i++;
          }
        }
      } else if (isAssignment(source, i)) {
        i++;
        while (i < l && isSpaceChar(source[i])) {
          i++;
        }
      } else {
        continue;
      }
      quote = source[i];
      if (quote !== QUOTE && quote !== DOUBLE_QUOTE) {
        // `const aClass = on ? 'a' : 'b'` — значение-выражение; шаблон — тоже
        // через разбор: его подстановки читаются (D-074).
        from = pushValueExpression(
          out, source, i,
        );
        continue;
      }
      valueFrom = ++i;
      for (; i < l; i++) {
        if (source[i] === BACKSLASH) {
          i++;
          continue;
        }
        if (source[i] === quote) {
          break;
        }
      }
      pushLiteralTokens(out, source.slice(valueFrom, i));
      from = i;
    }
  }
}

/** `=` в позиции `at` — присваивание, а не часть `==`, `===`, `!=`, `<=`, `>=` или `=>`. */
function isAssignment(source: string, at: number): boolean {
  const next = source[at + 1];
  const prev = source[at - 1];
  return source[at] === EQUALS
    && next !== EQUALS && next !== GREATER
    && prev !== EQUALS && prev !== EXCLAMATION && prev !== LESS && prev !== GREATER;
}

/**
 * Кеш регулярок поиска вызовов, по списку имён.
 *
 * Список приходит из опций плагина и на всю сборку один, а функция зовётся на каждый файл.
 */
const $$mergeCallRegexps: Record<string, RegExp> = {};

/**
 * Регексп, находящий начало вызова любой из функций слияния.
 *
 * Отсечение «хвоста другого идентификатора» (`myMne`, `obj.mne`, `mne2`) выражено прямо
 * в регекспе: `(?<![\\w$.])` слева и `(?![\\w$])` справа. Раньше это проверялось вручную
 * после каждого `indexOf`, и проход по файлу делался отдельно на каждое имя.
 *
 * Шаблон `*Class` — любое имя с этим окончанием: так зовётся и функция, которую вернул `mnClass(base)`
 * (`thClass('w150')`), и её аргументы — те же токены (D-146).
 */
function mergeCallRegExp(names: string[]): RegExp {
  const key = names.join(PIPE);
  const cached = $$mergeCallRegexps[key];
  if (cached) {
    return cached;
  }
  const alternatives = names.map((n) => (n[0] === ASTERISK
    ? CALL_NAME_HEAD_SOURCE + n.slice(1).replace(REGEXP_ESCAPE, ESCAPED_MATCH)
    : n.replace(REGEXP_ESCAPE, ESCAPED_MATCH)));
  return ($$mergeCallRegexps[key] = new RegExp('(?<![\\w$.])(?:' + alternatives.join(PIPE)
    + ')(?![\\w$])\\s*\\(', 'g'));
}

/** Начало имени функции перед окончанием шаблона: `th` в `thClass`, хотя бы один знак. */
const CALL_NAME_HEAD_SOURCE = '[\\w$]+';

/**
 * Извлекает MN-токены из строковых аргументов вызовов функций слияния (`mne`, `*Class`).
 *
 * `mne('pt26 pb6', props.class)` — токены записаны прямо в вызове: ни в `class="…"`,
 * ни в переменной с суффиксом. Без этого разбора они не попадали в CSS, причём молча:
 * сборка проходила зелёной, а стилей не было.
 *
 * Два шага: регексп находит начала вызовов (линейный проход, один на все имена),
 * и только внутри найденного вызова идёт посимвольный разбор. Посимвольный он потому,
 * что аргументы бывают вложенными (`mne(base, cond ? a : mne(x, 'p10'))`), а
 * сбалансированность скобок регулярным выражением не выражается.
 *
 * @param source — исходный текст файла
 * @param names — имена и шаблоны `*Окончание` (`['mne', '*Class']`; D-146): `*Class` берёт и `mnClass('p10')`, и
 *   `thClass('w150')` — функцию, которую вернул `mnClass`. Пустой список — разбор отключён
 * @returns список токенов (с возможными повторами)
 *
 * @example
 * extractMergeCallTokens("mne(base, 'p10'); thClass('w150')", ['mne', '*Class'])   // → ['p10', 'w150']
 */
export function extractMergeCallTokens(source: string, names: string[]): string[] {
  const out: string[] = [];
  extractMergeCallTokensInto(
    out, source, names,
  );
  return out;
}

/**
 * То же, что {@link extractMergeCallTokens}, но пишет в переданный массив.
 *
 * @param out — аккумулятор
 * @param source — полный текст файла
 * @param names — имена и шаблоны функций; пустой список — разбор отключён
 */
export function extractMergeCallTokensInto(
  out: string[], source: string, names: string[],
): void {
  if (!names.length) {
    return;
  }
  const re = mergeCallRegExp(names);
  re.lastIndex = 0;
  const l = source.length;
  let i: number;
  let depth: number;
  let ch: string;
  let quote: string;
  let from: number;
  // Позиция после открывающей скобки берётся из `lastIndex`, само совпадение не нужно.
  while (re.exec(source) !== null) {
    // `lastIndex` стоит сразу за открывающей скобкой — отступаем на неё.
    i = re.lastIndex - 1;
    depth = 0;
    for (; i < l; i++) {
      ch = source[i];
      if (ch === OPEN_PAREN || ch === OPEN_BRACKET || ch === OPEN_BRACE) {
        depth++;
        continue;
      }
      if (ch === CLOSE_PAREN || ch === ']' || ch === CLOSE_BRACE) {
        if (!--depth) {
          break;
        }
        continue;
      }
      if (ch === BACKTICK) {
        // Шаблон: статика и значение подстановок (D-074).
        i = readTemplate(
          source, i, out,
        ) - 1;
        continue;
      }
      if (ch !== QUOTE && ch !== DOUBLE_QUOTE) {
        continue;
      }
      // Границы литерала запоминаем и режем одним `slice`: посимвольная склейка
      // строки стоит аллокации на каждый знак.
      quote = ch;
      from = ++i;
      for (; i < l; i++) {
        if (source[i] === BACKSLASH) {
          i++;
          continue;
        }
        if (source[i] === quote) {
          break;
        }
      }
      pushLiteralTokens(out, source.slice(from, i));
    }
    // Продолжаем поиск за концом разобранного вызова, а не внутри него.
    re.lastIndex = i;
  }
}

/**
 * Заменяет содержимое комментариев пробелами.
 *
 * Сканер текстовый: он ищет `class=` регуляркой и синтаксис языка не
 * разбирает, поэтому содержимое комментария обрабатывал наравне с кодом. В
 * проекте `affiliate` комментарий, ОБЪЯСНЯВШИЙ работу сканера, уронил сборку:
 * из образца `class="..."` извлёкся токен `...`, ядро его забраковало, а
 * `strict: true` превратил предупреждение в ошибку.
 *
 * Хуже тихий случай: любой пример разметки в комментарии или JSDoc добавляет
 * свои токены в CSS — правила есть, применить их не к чему.
 *
 * Вырезаются `//` до конца строки, `/* * /`, `<!-- -->`. Форма `{/* * /}` из
 * JSX покрывается вторым вариантом. Содержимое заменяется ПРОБЕЛАМИ, а не
 * удаляется: длина исходника сохраняется, и позиции совпадают с оригиналом.
 *
 * Строковые литералы разбираются вместе с комментариями — иначе `'https://x'`
 * съел бы остаток строки как комментарий. Внутри литерала комментариев нет.
 *
 * Попутно собираются токены из комментариев-маркеров `@mn` (D-083), если передан `markers`:
 * обычный комментарий остаётся немым, маркер — явное объявление токенов, которые сканер
 * иначе не увидит (`className={someVar}`).
 *
 * @param source — текст файла
 * @param markers — куда сложить токены маркеров `@mn`; без него маркеры не читаются
 */
export function stripComments(source: string, markers?: string[]): string {
  const l = source.length;
  // Куски исходника между вырезанными диапазонами. Пока массив пуст, ни одного
  // комментария не встретилось — тогда возвращается сам `source`, без склейки.
  let parts: string[] | 0 = 0;
  let kept = 0;
  let i = 0;
  let ch: string;
  let quote: string;
  let from: number;
  while (i < l) {
    ch = source[i];
    // Строка: пропускаем целиком, внутри комментариев нет.
    if (ch === QUOTE || ch === DOUBLE_QUOTE || ch === BACKTICK) {
      quote = ch;
      for (i++; i < l; i++) {
        if (source[i] === BACKSLASH) {
          i++;
          continue;
        }
        if (source[i] === quote) {
          break;
        }
      }
      i++;
      continue;
    }
    if (ch !== SLASH && ch !== LESS) {
      i++;
      continue;
    }
    from = i;
    if (ch === SLASH && source[i + 1] === SLASH) {
      while (i < l && source[i] !== NEWLINE) {
        i++;
      }
    } else if (ch === SLASH && source[i + 1] === ASTERISK) {
      for (i += 2; i < l; i++) {
        if (source[i] === ASTERISK && source[i + 1] === SLASH) {
          i += 2;
          break;
        }
      }
    } else if (ch === LESS && source[i + 1] === EXCLAMATION
      && source[i + 2] === DASH && source[i + 3] === DASH) {
      for (i += 4; i < l; i++) {
        if (source[i] === DASH && source[i + 1] === DASH && source[i + 2] === GREATER) {
          i += 3;
          break;
        }
      }
    } else {
      i++;
      continue;
    }
    markers && markerTokens(
      markers, source, from, i,
    );
    parts || (parts = []);
    parts.push(source.slice(kept, from));
    // Переводы строк сохраняются: без них склеились бы соседние строки, и
    // `class=` из следующей строки попал бы в конец комментария.
    parts.push(newlinesOf(
      source, from, i,
    ));
    kept = i;
  }
  if (!parts) {
    return source;
  }
  parts.push(source.slice(kept));
  return parts.join('');
}

/** Хвост строки маркера: закрытие комментария (звёздочка со слешем, `-->`). */
const REGEXP_MARKER_TAIL = /\s*(?:\*\/|-->)\s*$/;

/**
 * Токены маркеров `@mn` в комментарии `[from, to)` (D-083): после `@mn` и пробела — токены до конца
 * строки или комментария. `@mn` — отдельное слово: `@mnClass`, `x@mn` маркерами не являются.
 *
 * @example
 * {/* @mn cF00 px10 *\/}      // → cF00, px10
 * // @mn bgF00 bg0F0          // → bgF00, bg0F0
 */
function markerTokens(
  out: string[], source: string, from: number, to: number,
): void {
  let at = source.indexOf('@mn', from);
  let end: number;
  let next: string;
  while (at > -1 && at < to) {
    next = source[at + 3];
    if ((next === SPACE || next === TAB) && !isIdentChar(source[at - 1])) {
      end = at + 4;
      while (end < to && source[end] !== NEWLINE) {
        end++;
      }
      pushLiteralTokens(out, source.slice(at + 4, end).replace(REGEXP_MARKER_TAIL, ''));
    }
    at = source.indexOf('@mn', at + 3);
  }
}

/** Только переводы строк из вырезанного диапазона — остальное отбрасывается. */
function newlinesOf(
  source: string, from: number, to: number,
): string {
  let out = '';
  let i = from;
  for (; i < to; i++) {
    source[i] === NEWLINE && (out += NEWLINE);
  }
  return out;
}

/** Опции {@link scanTokens}: записи трёх механизмов и вырезание комментариев (D-146). */
export interface ScanTokensOptions {
  /**
   * Атрибуты и ключи объектов: `'class'`, `'className:class'`, `'*ClassName:class'` (любое имя, которое кончается на
   * `ClassName`; D-131), `'m'` — в `[m~="ws"]`. Имя без цели — само себе цель; у шаблона цель пишется явно. Строка
   * (`'class, className:class'`), массив записей или объект `{ className: 'class' }` (D-147).
   *
   * @default ['class']
   */
  attrs?: TPairsValue;
  /**
   * Переменные и ключи объектов со списком токенов: `'*Class:class'` берёт `const rowClass = 'p10'`. Цель пишется
   * явно. Пустой список (`''`, `[]`, `{}`) отключает механизм.
   *
   * @default ['*Class:class']
   */
  varNames?: TPairsValue;
  /**
   * Вызовы, чьи строковые аргументы — токены: `'mne:class'` и `'*Class:class'` — `mnClass('p10')` и
   * `thClass('w150')` (функция, которую вернул `mnClass`). Цель пишется явно. Пустой список отключает механизм.
   *
   * @default ['mne:class', '*Class:class']
   */
  fnNames?: TPairsValue;
  /**
   * `true` — список, заданный вместо умолчания, теряет его записи намеренно: сканер не предупреждает (D-146).
   *
   * @default false
   */
  replaceDefaults?: boolean;
  /**
   * `false` — не вырезать комментарии перед сканированием.
   *
   * По умолчанию вырезаются: пример разметки в комментарии иначе добавляет
   * свои токены в CSS. Отключать стоит только там, где формат файла заведомо
   * не имеет комментариев, а входные данные велики.
   */
  comments?: boolean;
}

/**
 * Единая точка сбора MN-токенов из текста файла — атрибуты, переменные, аргументы вызовов, по цели.
 *
 * Плагины сборщиков должны вызывать её (через `createScanner`), а не собирать механизмы по отдельности:
 * до 2026-09-25 переменные разбирались только в `minotation-vite`, и проекты на esbuild, rollup и webpack
 * теряли токены из переменных, ничего об этом не сообщая.
 *
 * Опции разбираются один раз на объект опций (план кешируется); сканер с выбором разбора по файлу — `createScanner`.
 *
 * @param source — полный текст файла
 * @param options — см. {@link ScanTokensOptions}
 * @returns токены по цели (с возможными повторами)
 *
 * @example
 * scanTokens('<div class="p10">', {})                                // → { class: ['p10'] }
 * scanTokens("const aClass = 'p10'; mne(base, 'w1')", {})            // → { class: ['p10', 'w1'] }
 * scanTokens('<a className="p10" m="w1">', { attrs: 'className:class, m' })
 * // → { class: ['p10'], m: ['w1'] }
 */
export function scanTokens(source: string, options: ScanTokensOptions): ScannedTokens {
  return scanTokensByPlan(source, cachedScanPlanOf(options));
}

/**
 * {@link scanTokens} по готовому плану: на каждый файл, без разбора опций.
 *
 * @param source — полный текст файла
 * @param plan — план из `scanPlanOf`
 * @returns токены по цели
 */
export function scanTokensByPlan(source: string, plan: ScanPlan): ScannedTokens {
  const out: ScannedTokens = {};
  scanTokensByPlanInto(
    out, source, plan,
  );
  return out;
}

/**
 * {@link scanTokensByPlan} в готовый набор: однофайловый компонент складывает шаблон и скрипты в один объект, без
 * промежуточных.
 *
 * @param out — набор, куда добавляются токены по цели
 * @param source — полный текст файла
 * @param plan — план из `scanPlanOf`
 */
export function scanTokensByPlanInto(
  out: ScannedTokens, source: string, plan: ScanPlan,
): void {
  const groups = plan[MN_PLAN_GROUPS];
  const l = groups.length;
  const markerTarget = plan[MN_PLAN_MARKER_TARGET];
  // Комментарии вырезаются ДО всех трёх механизмов: токен из примера
  // разметки в комментарии либо раздувает CSS правилами, которые не к чему
  // применить, либо роняет сборку под `strict` — см. `stripComments`.
  // Маркеры `@mn` читаются всегда (D-083), даже с `comments: false`.
  const stripped = stripComments(source, out[markerTarget] || (out[markerTarget] = []));
  source = plan[MN_PLAN_COMMENTS] ? stripped : source;
  let i = 0;
  let group: ScanGroup;
  for (; i < l; i++) {
    group = groups[i];
    scanGroupInto(
      out[group[MN_GROUP_TARGET]] || (out[group[MN_GROUP_TARGET]] = []), source, group,
    );
  }
}

/**
 * Три механизма одной группы — в один массив.
 *
 * @param tokens — аккумулятор группы
 * @param source — текст без комментариев
 * @param group — группа плана
 */
export function scanGroupInto(
  tokens: string[], source: string, group: ScanGroup,
): void {
  const attrs = group[MN_GROUP_ATTR];
  const attrsLength = attrs.length;
  let i = 0;
  for (; i < attrsLength; i++) {
    extractTokensInto(
      tokens, source, attrs[i],
    );
  }
  extractClassVarTokensInto(
    tokens, source, group[MN_GROUP_VARS],
  );
  extractMergeCallTokensInto(
    tokens, source, group[MN_GROUP_FNS],
  );
}
