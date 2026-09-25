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
 * Динамические значения свойства (`{ className: cond ? 'a' : 'b' }`, вычисляемые
 * выражения) — не поддерживаются, как и раньше: извлекается только буквальный текст.
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
  // литерала (`attr:`, включая вложенное — напр. MUI `slotProps={{ paper: { className: ... } }}`).
  return new RegExp(name + '\\s*[:=]\\s*(?:"([^"]*)"'
      + '|\'([^\']*)\''
      + '|\\{\\s*\'([^\']*)\'\\s*\\}'
      + '|\\{\\s*"([^"]*)"\\s*\\}'
      + '|\\{\\s*`([^`]*)`\\s*\\})',
  'g');
}

/**
 * @param source — полный текст файла
 * @param attrName — имя атрибута (`'class'`, `'className'`, ...)
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
    // одна из пяти альтернатив regexp'а всегда совпала — иначе не было бы матча
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
 * Разбивает литерал на токены, отбрасывая `${…}`-подстановки.
 *
 * Без `split`: он аллоцирует промежуточный массив на каждый литерал, а литералов в файле
 * столько же, сколько атрибутов, переменных и вызовов. Границы слов находятся проходом,
 * наружу уходят сразу готовые подстроки. `replace` тоже пропускается, когда подстановок
 * нет — а их нет в большинстве литералов.
 */
function pushLiteralTokens(out: string[], literal: string): void {
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
          // Аннотация: доходим до `=`, обрываясь на `;` и переводе строки —
          // как и прежняя регулярка (`[^=;\n]+`).
          while (i < l && source[i] !== '=' && source[i] !== ';' && source[i] !== '\n') {
            i++;
          }
          if (source[i] !== '=') {
            continue;
          }
          i++;
          while (i < l && isSpaceChar(source[i])) {
            i++;
          }
        }
      } else if (source[i] === '=') {
        i++;
        while (i < l && isSpaceChar(source[i])) {
          i++;
        }
      } else {
        continue;
      }
      quote = source[i];
      if (quote !== '\'' && quote !== '"' && quote !== '`') {
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
 */
function mergeCallRegExp(names: string[]): RegExp {
  const key = names.join('|');
  return $$mergeCallRegexps[key]
    || ($$mergeCallRegexps[key] = new RegExp('(?<![\\w$.])(?:' + names.map((n) => n.replace(REGEXP_ESCAPE, '\\$&')).join('|')
        + ')(?![\\w$])\\s*\\(',
    'g'));
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
 * @param names — имена функций (`['mne', 'mnClass']`); пустой массив отключает разбор
 * @returns список токенов (с возможными повторами)
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
 * @param names — имена функций слияния; пустой массив отключает разбор
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

/** Опции {@link scanTokens}. */
export interface ScanTokensOptions {
  /** Имя атрибута (`'class'`, `'className'`). По умолчанию `'class'`. */
  attr?: string;
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
  extractTokensInto(
    tokens, source, options.attr || 'class',
  );
  extractClassVarTokensInto(
    tokens,
    source,
    options.classVarSuffixes === undefined ? ['Class'] : options.classVarSuffixes,
  );
  extractMergeCallTokensInto(
    tokens,
    source,
    options.mergeFnNames === undefined ? ['mne', 'mnClass'] : options.mergeFnNames,
  );
  return tokens;
}

/**
 * Тот же {@link pushLiteralTokens}, экспортированный для бенчмарков.
 *
 * Отклонённый однопроходный вариант сканера живёт в `__benchmarks__/onepass.bench.ts`
 * и должен делить с рабочей реализацией разбиение литерала на токены — иначе сравнение
 * мерило бы разные вещи.
 */
export const pushLiteralTokensForBench = pushLiteralTokens;
