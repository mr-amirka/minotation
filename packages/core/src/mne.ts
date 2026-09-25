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

/** Имя хендлера — ведущая цепочка строчных букв, как в `REGEXP_MATCH_NAME` ядра. */
const REGEXP_TAG = /^[a-z]+/;

/**
 * Символ выглядит границей контекста, но на этой позиции он часть ЗНАЧЕНИЯ.
 *
 * Копия `REGEXP_SELECTOR_EXCEPTIONS` из `selectorsCompileProvider/constants.ts`
 * (там — источник истины). Дублируется намеренно: импорт потянул бы за собой
 * `fundamentool` в бандл потребителя, а весь смысл этого модуля в том, чтобы
 * не тянуть ничего. Синхронность закреплена тестом
 * `mne.test.ts` → «исключения совпадают с грамматикой ядра».
 */
const REGEXP_VALUE_EXCEPTION
  = /^(?:[.+]\d|\+--|#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3,4})(?![0-9A-Za-z]))/;

/** Начала контекстной части токена: состояние, предок, медиа, условие. */
const CONTEXT_CHARS = ':<>@&~[.#+';

/** Кебаб чужой системы: дефис перед буквой (`text-center`), а не перед цифрой (`mt-4`). */
const REGEXP_FOREIGN_KEBAB = /^-[a-zA-Z]/;

/** Маркер `!important` — токен с ним не конфликтует с токеном без него. */
const REGEXP_IMPORTANT = /-i$/;

const SPLIT_SPACES = /\s+/;

/**
 * Разбирает токен на ключ конфликта и значение.
 *
 * Токены с одинаковым ключом задают одно и то же свойство в одних и тех же
 * условиях — значит, в атрибуте должен остаться только последний.
 */
function splitToken(token: string): [string, string] {
  const matchs = REGEXP_TAG.exec(token);
  if (!matchs) {
    // Ни одной строчной буквы в начале — это не токен нотации
    // (`--gap=10px`, `Foo`, `2xl`). Отменяет только сам себя.
    return [token, ''];
  }
  const tag = matchs[0];
  const rest = token.slice(tag.length);
  if (REGEXP_FOREIGN_KEBAB.test(rest)) {
    return [token, ''];
  }
  const l = rest.length;
  let i = 0;
  let ch: string;
  while (i < l) {
    ch = rest[i];
    if (ch === '\\') {
      // Экранированный символ — часть значения (`bgi_img/a\.png`), пропускаем пару.
      i += 2;
      continue;
    }
    if (CONTEXT_CHARS.indexOf(ch) > -1 && !REGEXP_VALUE_EXCEPTION.test(rest.slice(i))) {
      return [tag + rest.slice(i), rest.slice(0, i)];
    }
    i++;
  }
  // Контекста нет: `-i` в ключ, значение — остаток без него.
  return REGEXP_IMPORTANT.test(rest)
    ? [tag + '-i', rest.slice(0, rest.length - 2)]
    : [tag, rest];
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
  return splitToken(token)[0];
}

/** Разбор строки классов в список `[токен, ключ, значение]`. */
function parseTokens(className: string | undefined | null): Array<[string, string, string]> {
  if (!className) {
    return [];
  }
  const parts = className.split(SPLIT_SPACES);
  const l = parts.length;
  const result: Array<[string, string, string]> = [];
  let i = 0;
  let part: string;
  let pair: [string, string];
  for (; i < l; i++) {
    part = parts[i];
    if (part) {
      pair = splitToken(part);
      result.push([
        part,
        pair[0],
        pair[1],
      ]);
    }
  }
  return result;
}

/**
 * Собирает итоговую строку: при совпадении ключей выигрывает ПОСЛЕДНИЙ токен.
 *
 * Идём справа налево, оставляя первое встреченное вхождение каждого ключа, —
 * так побеждает правый, а исходный порядок оставшихся сохраняется.
 */
function joinTokens(groups: Array<Array<[string, string, string]>>): string {
  const seen: Record<string, number> = {};
  const output: string[] = [];
  let gi = groups.length;
  let tokens: Array<[string, string, string]>;
  let ti: number;
  let entry: [string, string, string];
  while (gi--) {
    tokens = groups[gi];
    ti = tokens.length;
    while (ti--) {
      entry = tokens[ti];
      if (seen[entry[1]]) {
        continue;
      }
      seen[entry[1]] = 1;
      output.push(entry[0]);
    }
  }
  return output.reverse().join(' ');
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
export function mne(className?: string | null, ...overrides: Array<string | null | undefined>): string {
  const groups: Array<Array<[string, string, string]>> = [parseTokens(className)];
  const l = overrides.length;
  let i = 0;
  for (; i < l; i++) {
    groups.push(parseTokens(overrides[i]));
  }
  return joinTokens(groups);
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
  const base = parseTokens(className);
  return function () {
    const groups: Array<Array<[string, string, string]>> = [base];
    const l = arguments.length;
    let i = 0;
    for (; i < l; i++) {
      groups.push(parseTokens(arguments[i] as string | null | undefined));
    }
    return joinTokens(groups);
  };
}

/**
 * Разбор строки классов в карту «ключ → значение».
 *
 * Та самая форма, в которой удобно отдавать фреймворку разобранные
 * родительские токены (`parentMN`): компонент видит, что именно ему передали,
 * не разбирая строку сам.
 *
 * @param className — строка классов
 * @returns карту `ключ → значение` (значение — часть токена после тега)
 * @example
 * mnMap('f24 bg4 active someClass');
 * // => { f: '24', bg: '4', active: '', some: 'Class' }
 */
export function mnMap(className?: string | null): Record<string, string> {
  const tokens = parseTokens(className);
  const l = tokens.length;
  const result: Record<string, string> = {};
  let i = 0;
  for (; i < l; i++) {
    result[tokens[i][1]] = tokens[i][2];
  }
  return result;
}
