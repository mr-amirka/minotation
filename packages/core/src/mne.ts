/**
 * Слияние наборов токенов без гонки специфичности.
 *
 * ## Задача
 *
 * Компонент задаёт базовые токены, потребитель хочет часть из них переопределить:
 *
 * ```jsx
 * <div className={'f20 dB bgC ' + (props.className || '')} />
 * <TextA className="f24 bg4" />   // → "f20 dB bgC f24 bg4"
 * ```
 *
 * У всех MN-классов специфичность ОДИНАКОВАЯ (`.f20` и `.f24` — по одному классу),
 * поэтому побеждает не порядок в атрибуте, а порядок правил в CSS-файле. Он от
 * автора компонента не зависит, и на практике приходится накручивать
 * специфичность вручную — `f24*2`, `bg4*2`. Это плодит лишние селекторы, ухудшает
 * читаемость и требует каждый раз лезть в браузер, чтобы понять, сколько звёздочек
 * нужно именно здесь.
 *
 * ## Решение
 *
 * Не повышать специфичность, а **убирать перекрытый токен из строки**: если
 * переопределение задаёт `f24`, базовый `f20` в атрибут просто не попадает.
 * Конфликта в CSS не возникает вовсе.
 *
 * ```js
 * mne('f20 dB bgC', 'f24 bg4')   // → 'dB f24 bg4'
 * ```
 *
 * Токены считаются конфликтующими, если совпадают **тег и контекст** —
 * имя хендлера плюс всё, что задаёт КОГДА и К ЧЕМУ правило применяется
 * (`@media`, `:state`, `<`/`>`-предки, `.`/`#`-условия, `-i`). Значение в ключ
 * не входит:
 *
 * | Токены | Конфликт | Почему |
 * |---|---|---|
 * | `f20` / `f24` | да | один тег, один контекст |
 * | `f20` / `f24@sm` | нет | разные медиа-контексты |
 * | `c--ink` / `cF00:hover` | нет | разные состояния |
 * | `p10<.parent` / `p12<.parent` | да | один предок |
 * | `p10-i` / `p12` | нет | `!important` всё равно победит |
 *
 * ## Чужие классы
 *
 * Строка может содержать классы из других систем — они проходят насквозь и
 * никогда никого не отменяют. Кебаб-форма (`text-center`, `btn-primary`,
 * `sr-only`) распознаётся по дефису перед БУКВОЙ: `mt-10` — это MN
 * (отрицательное значение), `mt-4` тоже MN, а `text-center` — чужой класс.
 *
 * **Граница, о которой стоит помнить:** camelCase-класс чужой системы
 * (`someClass`) по форме неотличим от MN-токена (`some` + `Class`), поэтому
 * два таких класса с одним префиксом будут считаться конфликтующими. Это та же
 * неоднозначность, с которой живёт сам разбор токенов.
 *
 * ## Зависимостей нет
 *
 * Модуль не импортирует ничего — ни из ядра, ни извне: он рассчитан на вызов
 * в рантайме на каждый рендер, в том числе в проектах, где `minotation`
 * подключена только как сборочный плагин.
 *
 * @module mne
 */

/**
 * Символ выглядит границей контекста, но на этой позиции он часть ЗНАЧЕНИЯ.
 *
 * Копия `REGEXP_SELECTOR_EXCEPTIONS` из `selectorsCompileProvider/constants.ts`
 * (там — источник истины). Дублируется намеренно: импорт потянул бы за собой
 * `fundamentool` в бандл потребителя, а весь смысл этого модуля в том, чтобы
 * не тянуть ничего. Синхронность закреплена тестом
 * `mne.test.ts` → «исключения совпадают с грамматикой ядра».
 *
 * Флаг `y` (sticky) — чтобы проверять позицию через `lastIndex`, не нарезая
 * подстроку на каждый встреченный символ-кандидат.
 */
const REGEXP_VALUE_EXCEPTION
  = /(?:[.+]\d|\+--|#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3,4})(?![0-9A-Za-z]))/y;

/**
 * Кебаб чужой системы: дефис перед буквой (`text-center`), а не перед цифрой (`mt-4`).
 * Тоже sticky — проверяется сразу после тега, без нарезки остатка.
 */
const REGEXP_FOREIGN_KEBAB = /-[a-zA-Z]/y;

/**
 * Начала контекстной части токена: состояние, предок, медиа, условие.
 * Карта, а не строка с `indexOf`: проверка идёт на каждый символ токена.
 */
const CONTEXT_CHARS: Record<string, 1> = {
  ':': 1,
  '<': 1,
  '>': 1,
  '@': 1,
  '&': 1,
  '~': 1,
  '[': 1,
  '.': 1,
  '#': 1,
  '+': 1,
};

const SPLIT_SPACES = /\s+/;

/**
 * Результат разбора последнего токена — см. {@link scanToken}.
 *
 * Модульные переменные вместо возвращаемого кортежа: `scanToken` зовётся на
 * каждый токен на каждый рендер, и аллокация пары чисел там лишняя. Читать их
 * можно только сразу после успешного `scanToken`.
 */
let $$tagLength = 0;
let $$contextAt = 0;
let $$important = false;

/**
 * Находит границы токена: длину тега и начало контекстной части.
 *
 * Заполняет {@link $$tagLength}, {@link $$contextAt}, {@link $$important}.
 * Ничего не нарезает — строки создаёт уже вызывающий, и только те, что нужны
 * именно ему (пути слияния значение не требуется вовсе).
 *
 * @returns `false`, если токен не наш (чужой класс) — тогда он целиком и ключ,
 *   и значения у него нет
 */
function scanToken(token: string): boolean {
  const l = token.length;
  let i = 0;
  // Диапазон a–z: сравнение кодов здесь по делу, посимвольное `===` потребовало
  // бы перечислить 26 вариантов.
  while (i < l) {
    const code = token.charCodeAt(i);
    if (code < 97 || code > 122) {
      break;
    }
    i++;
  }
  if (!i) {
    // Ни одной строчной буквы в начале — это не токен нотации
    // (`--gap=10px`, `Foo`, `2xl`).
    return false;
  }
  $$tagLength = i;
  REGEXP_FOREIGN_KEBAB.lastIndex = i;
  if (REGEXP_FOREIGN_KEBAB.test(token)) {
    return false;
  }
  while (i < l) {
    if (token[i] === '\\') {
      // Экранированный символ — часть значения (`bgi_img/a\.png`), пропускаем пару.
      i += 2;
      continue;
    }
    if (CONTEXT_CHARS[token[i]]) {
      REGEXP_VALUE_EXCEPTION.lastIndex = i;
      if (!REGEXP_VALUE_EXCEPTION.test(token)) {
        $$contextAt = i;
        $$important = false;
        return true;
      }
    }
    i++;
  }
  $$contextAt = l;
  // Контекста нет — только тогда хвостовой `-i` виден как маркер важности.
  $$important = l > $$tagLength + 2 && token[l - 2] === '-' && token[l - 1] === 'i';
  return true;
}

/**
 * Ключ конфликта токена: тег + контекст, без значения.
 *
 * @param token — один токен (без пробелов)
 * @returns ключ; для чужого класса — сам класс, чтобы он отменял только себя
 * @example
 * mnKey('f20');           // => 'f'
 * mnKey('f24@sm');        // => 'f@sm'
 * mnKey('cF00:hover');    // => 'c:hover'
 * mnKey('p10-i');         // => 'p-i'
 * mnKey('text-center');   // => 'text-center'
 */
export function mnKey(token: string): string {
  if (!scanToken(token)) {
    return token;
  }
  const tag = token.slice(0, $$tagLength);
  return $$contextAt < token.length
    ? tag + token.slice($$contextAt)
    : ($$important ? tag + '-i' : tag);
}

/**
 * Значение токена — то, что между тегом и контекстом.
 *
 * @param token — один токен (без пробелов)
 * @returns значение; пустая строка у чужого класса и у токена без значения
 */
function mnValue(token: string): string {
  if (!scanToken(token)) {
    return '';
  }
  return token.slice($$tagLength, $$important ? token.length - 2 : $$contextAt);
}

/**
 * Разбирает одну строку классов и добавляет в результат ещё не занятые ключи.
 *
 * Вызывается СПРАВА НАЛЕВО, поэтому «первый встреченный ключ» — это самый правый
 * токен, то есть побеждает переопределение.
 *
 * `seen` — обычный объект, а не `Object.create(null)`: последний создаётся в
 * словарном режиме и заметно медленнее на чтении. Ключом при этом может оказаться
 * `constructor` или `toString`, поэтому сравнение строгое (`=== 1`), а не на
 * истинность — унаследованное свойство единицей не будет.
 */
function collect(
  seen: Record<string, number>, output: string[], value: unknown,
): void {
  // Пустой аргумент отсеивается ДО разбора: `mnClass(...)()` и
  // `mne(base, props.className)` с пустым className — самые частые вызовы.
  if (!value) {
    return;
  }
  const parts = ('' + value).split(SPLIT_SPACES);
  let i = parts.length;
  let part: string;
  let key: string;
  while (i--) {
    part = parts[i];
    if (!part) {
      continue;
    }
    key = mnKey(part);
    if (seen[key] === 1) {
      continue;
    }
    seen[key] = 1;
    output.push(part);
  }
}

/**
 * Сливает наборы токенов: каждый следующий аргумент переопределяет предыдущие.
 *
 * @param className — базовый набор
 * @param overrides — переопределения; чем правее, тем выше приоритет
 * @returns строка для атрибута `class`
 * @example
 * mne('f20 dB bgC', 'f24 bg4');        // => 'dB f24 bg4'
 * mne('f20', undefined);               // => 'f20'
 * mne('f20 p10', 'f24@sm');            // => 'f20 p10 f24@sm' (разные контексты)
 * mne('btn f20', 'btn-primary f24');   // => 'btn btn-primary f24'
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function mne(className?: string | null, ...overrides: Array<string | null | undefined>): string {
  // `arguments` вместо rest-параметров (конвенция coding.md §6.1): объявленные
  // выше нужны только для сигнатуры и подсказок IDE, массив из них не строится.
  // Наружу `arguments` не передаётся — только элемент: иначе V8 материализует
  // объект целиком, и выигрыш съедается (замерено).
  const seen: Record<string, number> = {};
  const output: string[] = [];
  // eslint-disable-next-line prefer-rest-params
  let i = arguments.length;
  while (i--) {
    // eslint-disable-next-line prefer-rest-params
    collect(
      seen, output, arguments[i],
    );
  }
  return output.reverse().join(' ');
}

/**
 * Предвычисленный вариант {@link mne} — базовый набор разбирается один раз.
 *
 * Разбор базы не зависит от пропсов, поэтому его незачем повторять на каждый
 * рендер: `mnClass` вызывается на уровне модуля, возвращённая функция — внутри
 * компонента.
 *
 * @param className — базовый набор токенов
 * @returns функцию, принимающую переопределения
 * @example
 * const textAClass = mnClass('f20 dB bgC');
 *
 * export function TextA(props) {
 *   return <div {...props} className={textAClass(props.className)} />;
 * }
 */
export function mnClass(className?: string | null): (...overrides: Array<string | null | undefined>) => string {
  // Плоский `[токен, ключ, токен, ключ, …]` — один массив вместо массива пар.
  const base: string[] = [];
  if (className) {
    const parts = className.split(SPLIT_SPACES);
    const l = parts.length;
    let i = 0;
    let part: string;
    for (; i < l; i++) {
      part = parts[i];
      part && base.push(part, mnKey(part));
    }
  }
  const baseLength = base.length;
  return function () {
    const seen: Record<string, number> = {};
    const output: string[] = [];
    // eslint-disable-next-line prefer-rest-params
    let i = arguments.length;
    while (i--) {
      // eslint-disable-next-line prefer-rest-params
      collect(
        seen, output, arguments[i],
      );
    }
    let bi = baseLength;
    let key: string;
    let part: string;
    while (bi) {
      key = base[--bi];
      part = base[--bi];
      if (seen[key] === 1) {
        continue;
      }
      seen[key] = 1;
      output.push(part);
    }
    return output.reverse().join(' ');
  };
}

/**
 * Разбор строки классов в карту «ключ → значение».
 *
 * Та самая форма, в которой удобно отдавать фреймворку разобранные
 * родительские токены (`parentMN`): компонент видит, что именно ему передали,
 * не разбирая строку сам.
 *
 * Ключ включает контекст, поэтому карта плоская, но составная:
 * `f24 f28@sm` → `{ f: '24', 'f@sm': '28' }`. Вложенная форма
 * (`{ f: { '': '24', '@sm': '28' } }`) обсуждается — см. `OPEN_QUESTIONS.md`, S-3.
 *
 * @param className — строка классов
 * @returns карту `ключ → значение` (значение — часть токена после тега)
 * @example
 * mnMap('f24 bg4 active someClass');
 * // => { f: '24', bg: '4', active: '', some: 'Class' }
 */
export function mnMap(className?: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  if (!className) {
    return result;
  }
  const parts = className.split(SPLIT_SPACES);
  const l = parts.length;
  let i = 0;
  let part: string;
  for (; i < l; i++) {
    part = parts[i];
    // mnValue зовётся после mnKey: оба гоняют scanToken, но mnMap — холодный путь,
    // и читаемость тут важнее экономии одного прохода по строке.
    part && (result[mnKey(part)] = mnValue(part));
  }
  return result;
}
