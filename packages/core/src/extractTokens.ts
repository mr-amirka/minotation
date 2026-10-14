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
 * 3. **Template literal**: `` attr={`p10 ${cond} w50`} `` — берутся только литеральные
 *    сегменты (между `` ` `` и `${`, между `}` и следующим `${`/`` ` ``);
 *    `${...}`-интерполяции целиком отбрасываются — динамические токены заведомо
 *    непредсказуемы на этапе сборки, не пытаемся их разрешить.
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
 * Кеш регулярок по имени атрибута.
 *
 * `extractTokens` зовётся на каждый файл сборки, а имён атрибутов в проекте одно-два.
 * Компиляция регулярки — самая дорогая часть вызова, и без кеша она повторялась
 * столько раз, сколько в проекте файлов.
 */
const $$attrRegexps: Record<string, RegExp> = {};

function buildAttrRegexp(attrName: string): RegExp {
  const name = attrName.replace(REGEXP_ESCAPE, '\\$&');
  // `[:=]` — принимает как JSX-атрибут (`attr=`), так и свойство объектного
  // литерала (`attr:`, включая вложенное — напр. MUI `slotProps={{ paper: { className:... } }}`).
  // Граница слева: без неё `Name` ловил бы `className=`, а `class` — `data-class=`.
  // `class` не матчил `className=` только потому, что после него идёт `N`.
  return new RegExp('(?<![\\w$-])' + name + '\\s*[:=]\\s*(?:"([^"]*)"'
      + '|\'([^\']*)\''
      + '|\\{\\s*\'([^\']*)\'\\s*\\}'
      + '|\\{\\s*"([^"]*)"\\s*\\}'
      + '|\\{\\s*`([^`]*)`\\s*\\}'
      // Остальное — выражение (`{v ? 'a' : 'b'}`, `className: on && 'a'`): его читает
      // `pushValueExpression`. 6 — в фигурных скобках, 7 — без них (свойство объекта).
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
    if (match[6] !== undefined || match[7] !== undefined) {
      regexp.lastIndex = pushValueExpression(
        tokens, source, regexp.lastIndex,
      );
      continue;
    }
    // одна из пяти литеральных альтернатив regexp'а совпала — иначе не было бы матча
    pushLiteralTokens(tokens,
      (match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5]) as string);
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
  return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r';
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
  '&&',
  '||',
  '??',
  '==',
  '!=',
  '<=',
  '>=',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '|',
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
  if (source[i] !== '?' || source[i + 1] === '?' || source[i + 1] === '.') {
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
  return operator === '||' || operator === '??' ? 1 : operator === '&&' ? 2 : 3;
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
    if (operator === '&&') {
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
  if (ch === '!' || ch === '~' || ch === '+' || ch === '-') {
    // Унарный оператор: значение — уже не строка.
    state[MN_EXPR_AT] = i + 1;
    readOperand(state);
    out.length = mark;
    return;
  }
  if (ch === '(') {
    state[MN_EXPR_AT] = i + 1;
    readConditional(state);
    skipSpaces(state);
    source[state[MN_EXPR_AT]] === ')' && state[MN_EXPR_AT]++;
  } else if (ch === '\'' || ch === '"') {
    i = skipString(source, i);
    pushLiteralTokens(out, source.slice(state[MN_EXPR_AT] + 1, i - 1));
    state[MN_EXPR_AT] = i;
  } else if (ch === '`') {
    state[MN_EXPR_AT] = readTemplate(
      source, i, out,
    );
  } else if (ch !== undefined && (isIdentChar(ch) || ch === '.')) {
    while (i < source.length && (isIdentChar(source[i]) || source[i] === '.')) {
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
    if (ch === '(' || ch === '[') {
      i = skipBalanced(source, i);
    } else if (ch === '.' || (ch === '?' && source[i + 1] === '.')) {
      i += ch === '.' ? 1 : 2;
      while (i < source.length && isIdentChar(source[i])) {
        i++;
      }
    } else if (ch === '!' && source[i + 1] !== '=') {
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
    if (source[i] === '\\') {
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
 * Шаблон, открытый в `at`: статические куски — в `out` (если передан), подстановки
 * `${…}` пропускаются целиком. Возвращает позицию за закрывающей кавычкой.
 */
function readTemplate(
  source: string, at: number, out: string[] | undefined,
): number {
  const l = source.length;
  let i = at + 1;
  let from = i;
  for (; i < l; i++) {
    if (source[i] === '\\') {
      i++;
      continue;
    }
    if (source[i] === '`') {
      out && pushLiteralTokens(out, source.slice(from, i));
      return i + 1;
    }
    if (source[i] === '$' && source[i + 1] === '{') {
      out && pushLiteralTokens(out, source.slice(from, i));
      i = skipBalanced(source, i + 1) - 1;
      from = i + 1;
    }
  }
  return l;
}

/** Позиция за скобкой, парной открытой в `at`; строки и шаблоны внутри пропускаются. */
function skipBalanced(source: string, at: number): number {
  const l = source.length;
  let depth = 0;
  let i = at;
  let ch: string;
  for (; i < l; i++) {
    ch = source[i];
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      if (!--depth) {
        return i + 1;
      }
    } else if (ch === '\'' || ch === '"') {
      i = skipString(source, i) - 1;
    } else if (ch === '`') {
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
    : literal.replace(REGEXP_INTERPOLATION, ' ');
  const l = text.length;
  let i = 0;
  let from = -1;
  let ch: string;
  for (; i < l; i++) {
    ch = text[i];
    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
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
 * Извлекает MN-токены из строковых значений переменных с заданными суффиксами.
 *
 * Классы, собранные в переменной, разбор `class="…"` не видит — а в островах
 * (React/Preact/Vue) набор токенов почти всегда лежит в константе. Конвенция имени
 * (суффикс `Class`) делает такую переменную видимой для сборки.
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
 * @param suffixes — суффиксы имён (`['Class']`); пустой массив отключает разбор
 * @returns список токенов (с возможными повторами)
 */
export function extractClassVarTokens(source: string, suffixes: string[]): string[] {
  const out: string[] = [];
  extractClassVarTokensInto(
    out, source, suffixes,
  );
  return out;
}

/**
 * То же, что {@link extractClassVarTokens}, но пишет в переданный массив.
 *
 * @param out — аккумулятор
 * @param source — полный текст файла
 * @param suffixes — суффиксы имён; пустой массив отключает разбор
 */
export function extractClassVarTokensInto(
  out: string[], source: string, suffixes: string[],
): void {
  const suffixesLength = suffixes.length;
  if (!suffixesLength) {
    return;
  }
  const l = source.length;
  let si = 0;
  let suffix: string;
  let suffixLength: number;
  let from: number;
  let at: number;
  let i: number;
  let quote: string;
  let valueFrom: number;
  for (; si < suffixesLength; si++) {
    suffix = suffixes[si];
    suffixLength = suffix.length;
    from = 0;
    while ((at = source.indexOf(suffix, from)) !== -1) {
      i = at + suffixLength;
      from = i;
      // `thClassy` — суффикс продолжается, значит это другое имя.
      if (i < l && isIdentChar(source[i])) {
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
        if (quote !== '\'' && quote !== '"' && quote !== '`') {
          // Аннотация доходит до `=`, обрываясь на `;` и переводе строки —
          // как и прежняя регулярка (`[^=;\n]+`). Не дошла (или `=` — часть
          // `===`/`=>`) — это свойство объекта со значением-выражением:
          // `{ aClass: on ? 'a' : 'b' }`.
          at = i;
          while (i < l && source[i] !== '=' && source[i] !== ';' && source[i] !== '\n') {
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
      if (quote !== '\'' && quote !== '"' && quote !== '`') {
        // `const aClass = on ? 'a' : 'b'` — значение-выражение.
        from = pushValueExpression(
          out, source, i,
        );
        continue;
      }
      valueFrom = ++i;
      for (; i < l; i++) {
        if (source[i] === '\\') {
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
  return source[at] === '='
    && next !== '=' && next !== '>'
    && prev !== '=' && prev !== '!' && prev !== '<' && prev !== '>';
}

/**
 * Кеш регулярок поиска вызовов, по списку имён и суффиксов.
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
 * Суффиксы дают вторую ветку — вызов переменной с суффиксом (`thClass('w150')`): так
 * зовётся функция, которую вернул `mnClass(base)`, и её аргументы — те же токены.
 */
function mergeCallRegExp(names: string[], suffixes: string[]): RegExp {
  const key = names.join('|') + '/' + suffixes.join('|');
  const cached = $$mergeCallRegexps[key];
  if (cached) {
    return cached;
  }
  const alternatives = names.map((n) => n.replace(REGEXP_ESCAPE, '\\$&'));
  suffixes.length && alternatives.push('[\\w$]+(?:'
    + suffixes.map((n) => n.replace(REGEXP_ESCAPE, '\\$&')).join('|') + ')');
  return ($$mergeCallRegexps[key] = new RegExp('(?<![\\w$.])(?:' + alternatives.join('|')
    + ')(?![\\w$])\\s*\\(', 'g'));
}

/**
 * Извлекает MN-токены из строковых аргументов вызовов функций слияния (`mne`, `mnClass`).
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
 * @param names — имена функций (`['mne', 'mnClass']`)
 * @param suffixes — суффиксы переменных (`['Class']`): вызов `thClass('w150')` тоже
 *   разбирается — это функция, которую вернул `mnClass`. По умолчанию — без них.
 *   Оба списка пустые — разбор отключён
 * @returns список токенов (с возможными повторами)
 */
export function extractMergeCallTokens(
  source: string, names: string[], suffixes?: string[],
): string[] {
  const out: string[] = [];
  extractMergeCallTokensInto(
    out, source, names, suffixes,
  );
  return out;
}

/**
 * То же, что {@link extractMergeCallTokens}, но пишет в переданный массив.
 *
 * @param out — аккумулятор
 * @param source — полный текст файла
 * @param names — имена функций слияния
 * @param suffixes — суффиксы переменных, чей вызов тоже разбирается; оба списка
 *   пустые — разбор отключён
 */
export function extractMergeCallTokensInto(
  out: string[], source: string, names: string[], suffixes?: string[],
): void {
  const varSuffixes = suffixes || [];
  if (!names.length && !varSuffixes.length) {
    return;
  }
  const re = mergeCallRegExp(names, varSuffixes);
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
      if (ch === '(' || ch === '[' || ch === '{') {
        depth++;
        continue;
      }
      if (ch === ')' || ch === ']' || ch === '}') {
        if (!--depth) {
          break;
        }
        continue;
      }
      if (ch !== '\'' && ch !== '"' && ch !== '`') {
        continue;
      }
      // Границы литерала запоминаем и режем одним `slice`: посимвольная склейка
      // строки стоит аллокации на каждый знак.
      quote = ch;
      from = ++i;
      for (; i < l; i++) {
        if (source[i] === '\\') {
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
 */
export function stripComments(source: string): string {
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
    if (ch === '\'' || ch === '"' || ch === '`') {
      quote = ch;
      for (i++; i < l; i++) {
        if (source[i] === '\\') {
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
    if (ch !== '/' && ch !== '<') {
      i++;
      continue;
    }
    from = i;
    if (ch === '/' && source[i + 1] === '/') {
      while (i < l && source[i] !== '\n') {
        i++;
      }
    } else if (ch === '/' && source[i + 1] === '*') {
      for (i += 2; i < l; i++) {
        if (source[i] === '*' && source[i + 1] === '/') {
          i += 2;
          break;
        }
      }
    } else if (ch === '<' && source[i + 1] === '!'
      && source[i + 2] === '-' && source[i + 3] === '-') {
      for (i += 4; i < l; i++) {
        if (source[i] === '-' && source[i + 1] === '-' && source[i + 2] === '>') {
          i += 3;
          break;
        }
      }
    } else {
      i++;
      continue;
    }
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

/** Только переводы строк из вырезанного диапазона — остальное отбрасывается. */
function newlinesOf(
  source: string, from: number, to: number,
): string {
  let out = '';
  let i = from;
  for (; i < to; i++) {
    source[i] === '\n' && (out += '\n');
  }
  return out;
}

/**
 * Опция `attr` списком имён: строка — одно имя, массив — как есть, пусто — `class`.
 *
 * @param attr — значение опции `attr`
 * @returns непустой список имён атрибутов
 */
export function attrNames(attr: string | string[] | undefined): string[] {
  if (!attr || !attr.length) {
    return ['class'];
  }
  return typeof attr === 'string' ? [attr] : attr;
}

/** Опции {@link scanTokens}. */
export interface ScanTokensOptions {
  /**
   * Имя атрибута (`'class'`, `'className'`) или несколько — `['class', 'className']`
   * для проекта, где `.astro`/`.html` пишут `class`, а React-компоненты — `className`.
   * По умолчанию `'class'`.
   */
  attr?: string | string[];
  /**
   * Суффиксы имён переменных со списком токенов. По умолчанию `['Class']`,
   * пустой массив отключает механизм.
   */
  classVarSuffixes?: string[];
  /**
   * Имена функций слияния, чьи строковые аргументы сканируются.
   * По умолчанию `['mne', 'mnClass']`, пустой массив отключает механизм.
   */
  mergeFnNames?: string[];
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
 * Единая точка сбора MN-токенов из текста файла — атрибут, переменные с суффиксом,
 * аргументы функций слияния.
 *
 * Плагины сборщиков должны вызывать её, а не собирать механизмы по отдельности:
 * до 2026-09-25 `classVarSuffixes` был реализован только в `minotation-vite`, и проекты
 * на esbuild, rollup и webpack теряли токены из переменных, ничего об этом не сообщая.
 *
 * @param source — полный текст файла
 * @param options — см. {@link ScanTokensOptions}
 * @returns массив токенов (с возможными повторами)
 *
 * @example
 * scanTokens('<div class="p10">', { attr: 'class' })       // → ['p10']
 * scanTokens("const aClass = 'p10';", {})                  // → ['p10']
 * scanTokens("mne(base, 'p10')", {})                       // → ['p10']
 */
export function scanTokens(source: string, options: ScanTokensOptions): string[] {
  const tokens: string[] = [];
  // Комментарии вырезаются ДО всех трёх механизмов: токен из примера
  // разметки в комментарии либо раздувает CSS правилами, которые не к чему
  // применить, либо роняет сборку под `strict` — см. `stripComments`.
  source = options.comments === false ? source : stripComments(source);
  const attrs = attrNames(options.attr);
  const attrsLength = attrs.length;
  let i = 0;
  for (; i < attrsLength; i++) {
    extractTokensInto(
      tokens, source, attrs[i],
    );
  }
  const suffixes = options.classVarSuffixes === undefined ? ['Class'] : options.classVarSuffixes;
  extractClassVarTokensInto(
    tokens, source, suffixes,
  );
  extractMergeCallTokensInto(
    tokens,
    source,
    options.mergeFnNames === undefined ? ['mne', 'mnClass'] : options.mergeFnNames,
    suffixes,
  );
  return tokens;
}

