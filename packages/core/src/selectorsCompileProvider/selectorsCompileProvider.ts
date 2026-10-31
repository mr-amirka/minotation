/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  escapeCss,
  escapeQuote,
  extend,
  mapIn,
  push,
  reduceIn,
  repeat,
  unslash,
  variants,
} from 'fundamentool';
import {
  assertMediaNames,
  assertVariantGroups,
  rewriteGroups,
  assertTrailingSeparator,
  throwVariantGroup,
  REGEXP_MATCH_IMPORTANT,
  REGEXP_MATCH_NAME,
} from '../core/utils';
import {
  selectorNormalize,
} from '../selectorNormalize';
import {
  MN_MAX_SPECIFICITY,
  MnParseError,
  parseSettingsKey,
} from '../core/types';
import type {
  MnParseSettings,
} from '../core/types';

import type {
  AltMap,
  MnChain,
  MnContext,
  MnSegment,
  MnStateNode,
  ParseComboNameFn,
  StrMap,
} from './types';
import {
  extractSuffix,
  REGEXP_MULTIPLIER,
  REGEXP_OLD_MULTIPLIER,
  REGEXP_SCOPE_SUFFIX,
  SCOPE_END,
  SCOPE_START,
  MN_ESSENCE_PAIR,
  MN_RAW_PROPERTY,
  MN_NEGATIVE,
  REGEXP_BREAKPOINT_PREFIX,
  splitChild,
  splitParent,
  splitState,
} from './constants';
import {
  scopeSplit2,
  type ScopeNode,
} from './scopeSplit2';
import {
  mediaFilterIteratee,
} from './extractMedia';
import {
  mediaCondition,
} from '../core/mediaCondition';
import {
  mathSpaces,
} from '../core/mathSpaces';
import type {
  MnMediaOperator,
} from '../core/mediaCondition';
import {
  childSelectorMessage,
  importantMessage,
  maxDepthMessage,
  maxSpecificityMessage,
  specificityMessage,
} from './raiseMessages';
import {
  getCombinator,
} from './getCombinator';
import type {
  MnDepthCheck,
} from './getCombinator';
import {
  joinMapsWithFirstValue,
  joinPrefixWithFirstValue,
  joinWhere,
  wrapWhere,
} from './joinMaps';

const VARIANTS = 'variants';
const BACKSLASH = '\\';
const DOUBLE_QUOTE = '"';
const QUOTE = '\'';
const OPEN_BRACKET = '[';
const CLOSE_BRACKET = ']';
const SPACE = ' ';
const OPEN_PAREN = '(';
const CLOSE_PAREN = ')';
const AT = '@';
const AMPERSAND = '&';
const SELECTORS = 'selectors';
const DOT = '.';
const ASTERISK = '*';
/** Знак множителя специфичности: `p10**2`. */
const MULTIPLIER_MARK = '**';
/** Хвост прежнего множителя `*N` — для подсказки с новой записью. */
const REGEXP_OLD_MULTIPLIER_TAIL = /\*([0-9]+)$/;
const GREATER = '>';
const WARNING_CHILD_SELECTOR = 'child-selector';
const WARNING_IMPORTANT = 'important';
const AT_LEAST = '>=';
const EXCLAMATION = '!';
const DASH = '-';
const COLON = ':';
const MAX = 'max';
const WIDTH = 'width';
const LESS = '<';
const PLUS = '+';
const TILDE = '~';
const UNDERSCORE = '_';

/**
 * Разворачивает `(a|b)`-группы в comboName в список плоских вариантов (глубина не нужна).
 *
 * `applyUnslash: false` — экранирования (`\.` и т.п.) должны дожить до {@link suffixesReduce}/
 * `extractSuffix`, чей собственный escape-механизм (`splitSelector`/`extractSuffix`'s
 * `/\\.|[.+]\d/`) как раз и защищает их от трактовки как границы селектора; сняты они будут
 * позже, явным `unslash` в `suffixesReduce`. Раньше здесь снимался unslash преждевременно
 * (`variants(comboName)[0]`, без `false`) — экранирование терялось до того, как
 * `extractSuffix` успевал его увидеть, из-за чего `\.` в значении (например, `mk_a\.png`)
 * не защищало точку от трактовки как self-class-границы. Найдено и исправлено 2026-08-10
 * вместе со связанным багом regex в `constants.ts` (`splitSelector`/`extractSuffix`).
 */
/** Нет настроек файла разметки — всё из опций экземпляра. */
const NO_SETTINGS: MnParseSettings = {};

/**
 * Похоже ли имя на MN-токен, то есть стоит ли вообще придираться к его
 * структуре.
 *
 * Критерий: имя начинается со строчной буквы, и этот префикс зарегистрирован
 * как тег. Чужие классы в разметке сплошь и рядом начинаются с букв
 * (`sr-only`, `my-widget`) или вовсе не являются классами (`...` из образца
 * в комментарии), и придираться к ним не за что — автор их писал не в нотации.
 *
 * До 2026-09-26 порядок был обратный: структура проверялась раньше, чем
 * выяснялось, есть ли у имени тег. `sr-only` давало `Parameter is invalid`
 * (тег `s` существует, а `-only` не разбирается), `...` — «висячий
 * сепаратор», и со `strict: true` любой из них ронял сборку. Решение
 * владельца: падать не должно (трек `scanner-robustness`, задача 1; уточняет
 * D-014, где такую границу оставляли как есть).
 *
 * Настоящие ошибки в токенах это не затрагивает: у `w50@`, `p10:`, `cF00.`
 * тег зарегистрирован, предупреждение остаётся.
 */
function looksLikeToken(comboName: string, domains: Record<string, unknown>): boolean {
  const matched = REGEXP_MATCH_NAME.exec(comboName);
  return !!matched && !!domains[matched[1]];
}

function variantsBase(comboName: string, domains: Record<string, unknown>): string[] {
  // Вырожденная группа (скобки без `|`) молча съедала бы сами скобки — см.
  // JSDoc `assertVariantGroups`. Бросается MnParseError: `parseComboName`
  // обёрнут перехватчиком, который превращает её в warning `parse-error`,
  // и токен не даёт CSS вовсе — как и у вырожденных контекстных сегментов.
  //
  // Проверки структуры — только для того, что похоже на MN-токен: иначе
  // чужой класс из разметки роняет сборку под `strict`.
  if (!looksLikeToken(comboName, domains)) {
    return variants(comboName, false)[0];
  }
  // Структуру скобок проверяем по записи: непарная или пустая скобка видна
  // только в ней, после развёртки её уже нет.
  assertVariantGroups(
    comboName, VARIANTS, 1,
  );
  const alts = variants(comboName, false)[0];
  // А вырожденный вариант — по РЕЗУЛЬТАТУ развёртки. Пустая альтернатива сама
  // по себе не дефект: `w(|max)150` даёт законные `w150` и `wmax150`. Дефект —
  // когда вариант остаётся без части контекста: `p10@(sm|)` даёт `p10@`
  // (висячий `@`), `p10@(|sm):h` — `p10@:h` (пустое имя медиа). Проверка по
  // результату ловит ровно это и заодно закрывает те же формы, записанные
  // напрямую, без группы: `p10@:h` до 2026-10-04 компилировался молча.
  const l = alts.length;
  let i = 0;
  for (; i < l; i++) {
    assertTrailingSeparator(alts[i], VARIANTS);
    assertMediaNames(alts[i], VARIANTS);
  }
  return alts;
}

/**
 * Группирует один вариант comboName (`altComboName`) по его нормализованному суффиксу
 * (контекст `<parent`/`>child`/`:state`/`@media`).
 *
 * Несколько эссенций с БУКВАЛЬНО одинаковым суффиксом (например разные значения одного
 * префикса, `w50:hover` и `w100:hover`) попадают в один и тот же `suffixes[suffix]`, чтобы
 * их общий контекст (`parseContext`/`buildContext`) вычислялся один раз на всех, а не на
 * каждую эссенцию отдельно.
 *
 * @param suffixes — аккумулятор `нормализованный суффикс → { имя эссенции: 1 }`
 * @param altComboName — один вариант comboName после разворота `(a|b)`
 * @returns тот же `suffixes` (мутируется in-place, как редьюсер)
 */
function suffixesReduce(suffixes: StrMap<StrMap<number>>,
  altComboName: string): StrMap<StrMap<number>> {
  const extract = extractSuffix(altComboName);
  const suffix = selectorNormalize(extract[1]);
  (suffixes[suffix] || (suffixes[suffix] = {} as StrMap<number>))[unslash(extract[0])] = 1;
  return suffixes;
}

/**
 * Провайдер компиляции селекторов Minotation.
 *
 * Разбирает MN-комбо-имя (значение атрибута `class`, `id`, etc.) на
 * карту селекторов с медиа-привязками.
 *
 * ## Возвращаемый объект
 *
 * - `parseComboName(comboName, targetName)` — разобрать одно имя
 * - `parseComboNameProvider(attrName)` — получить парсер для атрибута
 * - `parseClass(comboName)` — разбор класса
 * - `parseId(comboName)` — разбор id
 * - `states` — состояния (синонимы сущностей)
 * - `_synonyms` — синонимы селекторов
 *
 * ## Формат результата parseComboName
 *
 * `Array<[StrMap<number>, AltMap]>` — массив пар:
 * - `StrMap<number>` — карта имён сущностей → 1
 * - `AltMap` — карта селекторов → массив `[медиа-приоритет, медиа-имя]`
 *
 * @param instance — существующий экземпляр для расширения
 * @returns расширенный экземпляр с методами парсинга
 *
 * @example
 * const scp = selectorsCompileProvider;
 * const result = scp.parseClass('w50');
 * // → [[{ w50: 1 }, { '.w50': [[0, undefined]] }]]
 */
/**
 * Имя класса для селектора: `escapeCss` и вдобавок `{`, `}` (группы Master CSS, D-051) и `&`
 * (медиа `@sm&safari`, D-053) — без экранирования селектор битый: `&` вне вложенности — это
 * селектор вложения.
 */
function escapeClass(name: string): string {
  return escapeCss(name).replace(REGEXP_UNESCAPED_CLASS_CHARS, '\\$&');
}
const REGEXP_UNESCAPED_CLASS_CHARS = /[{}&]/g;

/** Имя-заглушка эссенции при разборе селектора (D-071): контекст читается как у класса. */
const SELECTOR_ESSENCE = 'x';

/** Начало контекста в селекторе `mn.assign`/`mn.css`: состояние, группа, предок, ребёнок, медиа. */
const SELECTOR_CONTEXT: Record<string, 1> = {
  ':': 1,
  '(': 1,
  '<': 1,
  '>': 1,
  '@': 1,
};

/** Конец элемента в селекторе — первый символ контекста вне `[…]`, кавычек и экранирования. */
function elementEnd(source: string): number {
  const l = source.length;
  let i = 0;
  let ch: string;
  let quote = '';
  let depth = 0;
  for (; i < l; i++) {
    ch = source[i];
    if (ch === BACKSLASH) {
      i++;
    } else if (quote) {
      ch === quote && (quote = '');
    } else if (ch === DOUBLE_QUOTE || ch === QUOTE) {
      quote = ch;
    } else if (ch === OPEN_BRACKET) {
      depth++;
    } else if (ch === CLOSE_BRACKET) {
      depth--;
    } else if (!depth && SELECTOR_CONTEXT[ch]) {
      return i;
    }
  }
  return l;
}

/**
 * Части селектора: составные и комбинаторы CSS между ними, вне `[…]`, `(…)`, кавычек и
 * экранирования. `[1, '.a:h']` — составной, `[0, '>']` — комбинатор (пробелы вокруг сжаты; просто
 * пробел — потомок `' '`).
 */
function splitCompounds(source: string): Array<[number, string]> {
  const out: Array<[number, string]> = [];
  const l = source.length;
  let compound = '';
  let combinator = '';
  let quote = '';
  let depth = 0;
  let i = 0;
  let ch: string;
  for (; i < l; i++) {
    ch = source[i];
    if (!quote && !depth && (SELECTOR_MEDIA_END[ch])) {
      // Комбинатор: пробелы вокруг `>`/`+`/`~` не значат ничего, одни пробелы — потомок.
      compound && out.push([
        1,
        compound,
      ]);
      compound = '';
      combinator = ch === SPACE || ch === '\t' || ch === '\n' ? combinator || SPACE : ch;
      continue;
    }
    if (combinator) {
      out.length && out.push([
        0,
        combinator,
      ]);
      combinator = '';
    }
    if (ch === BACKSLASH) {
      compound += source.slice(i, i + 2);
      i++;
      continue;
    }
    if (quote) {
      ch === quote && (quote = '');
    } else if (ch === DOUBLE_QUOTE || ch === QUOTE) {
      quote = ch;
    } else if (ch === OPEN_BRACKET || ch === OPEN_PAREN) {
      depth++;
    } else if (ch === CLOSE_BRACKET || ch === CLOSE_PAREN) {
      depth--;
    }
    compound += ch;
  }
  compound && out.push([
    1,
    compound,
  ]);
  return out;
}

/** Конец медиа-выражения в селекторе: пробел или комбинатор. */
const SELECTOR_MEDIA_END: Record<string, 1> = {
  ' ': 1,
  '\t': 1,
  '\n': 1,
  '>': 1,
  '+': 1,
  '~': 1,
};

/**
 * Вынимает из селектора все `@медиа` вне `[…]`, кавычек и экранирования (D-071): `'.a:h@m .b'` →
 * `['.a:h .b', 'm']`; несколько — через `&`: `'.a@m .b@dark'` → `['.a .b', 'm&dark']`.
 */
function takeSelectorMedia(source: string): [string, string] {
  const medias: string[] = [];
  const l = source.length;
  let out = '';
  let quote = '';
  let depth = 0;
  let i = 0;
  let from: number;
  let ch: string;
  for (; i < l; i++) {
    ch = source[i];
    if (ch === BACKSLASH) {
      out += source.slice(i, i + 2);
      i++;
      continue;
    }
    if (quote) {
      ch === quote && (quote = '');
    } else if (ch === DOUBLE_QUOTE || ch === QUOTE) {
      quote = ch;
    } else if (ch === OPEN_BRACKET) {
      depth++;
    } else if (ch === CLOSE_BRACKET) {
      depth--;
    } else if (ch === AT && !depth) {
      from = i + 1;
      while (i + 1 < l && !SELECTOR_MEDIA_END[source[i + 1]]) {
        i++;
      }
      medias.push(source.slice(from, i + 1));
      continue;
    }
    out += ch;
  }
  return [
    out,
    medias.join(AMPERSAND),
  ];
}

/** Медиа из разбора и медиа селектора — через `&`, приоритет `^N` — в конце. */
function joinSelectorMedia(parsed: string, taken: string): string {
  const a = REGEXP_SELECTOR_PRIORITY.exec(parsed);
  const b = REGEXP_SELECTOR_PRIORITY.exec(taken);
  const left = a ? parsed.slice(0, a.index) : parsed;
  const right = b ? taken.slice(0, b.index) : taken;
  return (left && right ? left + AMPERSAND + right : left || right) + (a ? a[0] : b ? b[0] : '');
}

/** Приоритет в конце медиа-выражения: `^3`, `^-100`. */
const REGEXP_SELECTOR_PRIORITY = /\^-?[0-9]+$/;

/**
 * Сообщение `groupSuspectMode` (D-077): что не так с группами и как управлять режимом.
 *
 * @param issues — описания подозрительных групп из {@link rewriteGroups}
 * @param strict — режим `'strict'`
 */
function groupSuspectMessage(issues: string[], strict: boolean): string {
  return issues.join('. ') + (strict
    ? '. (groupSuspectMode: \'strict\') — the token gives no CSS.'
    : '. To hide this warning: groupSuspectMode: \'silent\'; to forbid such tokens: groupSuspectMode: \'strict\'.');
}

/** Варианты селектора: альтернативы через запятую, в каждой — развёрнутые группы `(a|b)`. */
function expandSelectorGroups(source: string): string[] {
  const out: string[] = [];
  let part: string;
  let alt: string;
  for (part of splitSelectorList(source)) {
    part = part.trim();
    // Те же проверки структуры, что у прежнего разбора селекторов: непарная, пустая или
    // «вырожденная» скобка (`button:not(.plain)` — нужно `\\(` или `:not[.plain]`) — ошибка при
    // регистрации, а не битый CSS.
    assertVariantGroups(part, SELECTORS);
    // Без экранирования-снятия (`false`): `\\(` остаётся для разбора контекста.
    for (alt of variants(part, false)[0]) {
      (alt = alt.trim()) || throwVariantGroup(
        'Empty selector among the variants of "' + part + '": a rule with it would apply to nothing.'
          + ' Remove the extra "|"', part, SELECTORS,
      );
      assertTrailingSeparator(alt, SELECTORS);
      out.push(alt);
    }
  }
  return out;
}

/** Альтернативы селектора: запятая вне скобок, кавычек и экранирования. */
function splitSelectorList(source: string): string[] {
  const out: string[] = [];
  const l = source.length;
  let from = 0;
  let depth = 0;
  let quote = '';
  let i = 0;
  let ch: string;
  for (; i < l; i++) {
    ch = source[i];
    if (ch === BACKSLASH) {
      i++;
    } else if (quote) {
      ch === quote && (quote = '');
    } else if (ch === DOUBLE_QUOTE || ch === QUOTE) {
      quote = ch;
    } else if (ch === OPEN_BRACKET || ch === OPEN_PAREN) {
      depth++;
    } else if (ch === CLOSE_BRACKET || ch === CLOSE_PAREN) {
      depth--;
    } else if (ch === ',' && !depth) {
      out.push(source.slice(from, i));
      from = i + 1;
    }
  }
  out.push(source.slice(from));
  return out;
}

/** `_` — пробел в произвольном значении Tailwind, `\\_` — само подчёркивание. */
const REGEXP_ARBITRARY_SPACE = /\\_|_/g;

/** `[@правило условие]`: `[1]` — media/supports/container, `[2]` — условие. */
const REGEXP_AT_RULE = /^@(media|supports|container)\s*(\S.*)$/;

/** Условие `@supports` с функцией — без скобок вокруг: `not (…)`, `selector(…)`, `font-tech(…)`. */
const REGEXP_SUPPORTS_FUNCTION = /^(?:not\b|selector\(|font-(?:tech|format)\()/;

/** Хвост произвольного варианта после `&` уходит к потомку: `>` или пробел вне скобок. */
const REGEXP_ARBITRARY_CHILD = /^[^(]*[> ]/;

/** Символ имени свойства Master CSS. */
const REGEXP_PROPERTY_CHAR = /[A-Za-z0-9-]/;
/** Конец значения Master CSS вне скобок (D-051). */
const VALUE_STOPS: Record<string, 1> = {
  ':': 1,
  '@': 1,
  '!': 1,
  '>': 1,
  '_': 1,
  '+': 1,
  '~': 1,
  '[': 1,
};
/** Конец состояния/селектора Master CSS вне скобок. */
const PART_STOPS: Record<string, 1> = {
  ':': 1,
  '@': 1,
  '!': 1,
  '>': 1,
  '_': 1,
  '+': 1,
  '~': 1,
};
/** Сокращения состояний Master CSS. */
const MASTER_STATES: Record<string, (args: string) => string> = {
  first: () => 'first-child',
  last: () => 'last-child',
  odd: () => 'nth-child(odd)',
  even: () => 'nth-child(even)',
  nth: (args) => 'nth-child' + args,
};
/** Псевдоэлементы, которые Master CSS пишет с одним `:`. */
const MASTER_PSEUDO_ELEMENTS: Record<string, 1> = {
  before: 1,
  after: 1,
};
/** Слова медиа Master CSS. */
const MASTER_MEDIA: Record<string, string> = {
  dark: '(prefers-color-scheme: dark)',
  light: '(prefers-color-scheme: light)',
  print: 'print',
  landscape: '(orientation: landscape)',
  portrait: '(orientation: portrait)',
  motion: '(prefers-reduced-motion: no-preference)',
  'reduced-motion': '(prefers-reduced-motion: reduce)',
};
/** Сравнение в медиа Master CSS: `<md`, `>=1024`, `768`. */
/**
 * Псевдоклассы и псевдоэлементы CSS (MDN, 2026-10): `:имя` после медиа с таким именем — состояние, записанное не
 * на своём месте (`cF00@m4:hover`), а не контейнер (D-088).
 */
const CSS_PSEUDO_NAMES: Record<string, 1> = {
  'active': 1,
  'any-link': 1,
  'autofill': 1,
  'blank': 1,
  'buffering': 1,
  'checked': 1,
  'closed': 1,
  'current': 1,
  'default': 1,
  'defined': 1,
  'dir': 1,
  'disabled': 1,
  'empty': 1,
  'enabled': 1,
  'first': 1,
  'first-child': 1,
  'first-of-type': 1,
  'focus': 1,
  'focus-visible': 1,
  'focus-within': 1,
  'fullscreen': 1,
  'future': 1,
  'has': 1,
  'has-slotted': 1,
  'host': 1,
  'host-context': 1,
  'hover': 1,
  'in-range': 1,
  'indeterminate': 1,
  'invalid': 1,
  'is': 1,
  'lang': 1,
  'last-child': 1,
  'last-of-type': 1,
  'left': 1,
  'link': 1,
  'local-link': 1,
  'modal': 1,
  'muted': 1,
  'not': 1,
  'nth-child': 1,
  'nth-col': 1,
  'nth-last-child': 1,
  'nth-last-col': 1,
  'nth-last-of-type': 1,
  'nth-of-type': 1,
  'only-child': 1,
  'only-of-type': 1,
  'open': 1,
  'optional': 1,
  'out-of-range': 1,
  'past': 1,
  'paused': 1,
  'picture-in-picture': 1,
  'placeholder-shown': 1,
  'playing': 1,
  'popover-open': 1,
  'read-only': 1,
  'read-write': 1,
  'required': 1,
  'right': 1,
  'root': 1,
  'scope': 1,
  'seeking': 1,
  'stalled': 1,
  'state': 1,
  'target': 1,
  'target-current': 1,
  'target-within': 1,
  'user-invalid': 1,
  'user-valid': 1,
  'valid': 1,
  'visited': 1,
  'volume-locked': 1,
  'where': 1,
  'after': 1,
  'backdrop': 1,
  'before': 1,
  'file-selector-button': 1,
  'first-letter': 1,
  'first-line': 1,
  'marker': 1,
  'placeholder': 1,
  'selection': 1,
};

/** Символ медиа-части в записи minotation (D-088): имена, числа, `-`, `,`, `&`, `^`, `/`, `:`, `.`, группы. */
const REGEXP_MEDIA_CHAR = /[A-Za-z0-9_\-,&^/:.|()]/;

/** Цифра — `.` перед ней часть числа (`@10.5rem`), а не класс. */
const REGEXP_DIGIT_CHAR = /[0-9]/;

/** Имя после `:` в медиа — проверка, не состояние ли это. */
const REGEXP_NAME_HEAD = /^[A-Za-z0-9_-]+/;

/** Множитель специфичности в конце токена: `**2`; прежняя запись `*2` тоже кончает медиа — ответ о ней дальше. */
const REGEXP_TAIL_MULTIPLIER = /^\*\*?[0-9]+$/;

const REGEXP_MASTER_MEDIA_COMPARE = /^(<=|>=|<|>)?([0-9.]+|[A-Za-z][A-Za-z0-9-]*)$/;
/** Ширина в запросе брейкпоинта. */
const REGEXP_WIDTH = /\((?:(?:min|max)-width:\s*|width\s*(?:>=|<=|<|>)\s*)([0-9.]+)px\)/;

export function selectorsCompileProvider(instance?: ParseComboNameFn) {
  let $$states: StrMap<string[]>;
  let $$synonyms: StrMap<AltMap>;

  /**
   * Проверка мягкого `maxDepth` для {@link getCombinator} — ОДИН объект на
   * провайдер, а не новый на каждый разбор имени.
   *
   * Раньше он собирался заново внутри `parseComboName`: новый объект плюс новое
   * замыкание `onExceed` на каждый токен, причём `onExceed` зовётся только при
   * превышении лимита, то есть почти никогда. Единственное, что реально менялось
   * от токена к токену, — `token`; его и обновляем перед разбором, а `onExceed`
   * читает значение из самого объекта, а не из замыкания над `comboName`.
   */
  const $$depthCheck: MnDepthCheck = {
    maxDepth: undefined,
    token: '',
    // Режим `maxDepthMode` решает ядро (D-039); без ядра (`selectorsCompileProvider`
    // отдельно) превышение ни на что не влияет.
    onExceed: (depth: number, maxDepth: number) => (instance as any)._raisedToken?.(
      $$depthCheck.token, 'max-depth-exceeded',
      (strict: boolean) => maxDepthMessage(
        depth, maxDepth, strict,
      ),
    ),
  };

  const $$parsers: StrMap<ParseComboNameFn> = {
    'id': parseId,
    'class': parseClass,
  };

  /**
   * Возвращает (и кэширует) парсер для произвольного HTML-атрибута.
   *
   * `'id'`/`'class'` уже зарегистрированы в `$$parsers` как {@link parseId}/{@link parseClass};
   * любой другой атрибут (`'data-mn'` и т.п.) получает парсер лениво через {@link parseAttrProvider}.
   *
   * @param attrName — имя HTML-атрибута
   * @returns функция разбора значения этого атрибута
   */
  /**
   * Разборщик значений атрибута. `settings` — настройки разбора этого компилятора (файл или
   * пакет со своей декларацией, D-045 этап 3, D-081); не заданное — из опций экземпляра.
   */
  function parseComboNameProvider(attrName: string, settings?: MnParseSettings): ParseComboNameFn {
    const settingsKey = parseSettingsKey(settings);
    const base = $$parsers[attrName] || ($$parsers[attrName] = parseAttrProvider(attrName));
    if (!settingsKey) {
      return base;
    }
    const key = attrName + SPACE + settingsKey;
    return $$parsers[key] || ($$parsers[key] = (comboName: string) => {
      $$markupSettings = settings;
      try {
        return base(comboName);
      } finally {
        $$markupSettings = undefined;
      }
    });
  }

  /**
   * Разбирает значение атрибута `id`. Целевой CSS-селектор — `#значение`.
   *
   * @param comboName — сырое значение атрибута `id`
   */
  function parseId(comboName: string): ReturnType<ParseComboNameFn> {
    return parseComboName(comboName, '#' + escapeCss(comboName));
  }

  /**
   * Разбирает значение атрибута `class`. Целевой CSS-селектор — `.значение`.
   *
   * @param comboName — одно слово из атрибута `class`
   */
  function parseClass(comboName: string): ReturnType<ParseComboNameFn> {
    return parseComboName(comboName, DOT + escapeClass(comboName) + isolateSuffix());
  }

  /**
   * Привязка к классу области (D-075): `.cFFF._l` или `.cFFF:where(._l)` — сразу за классом токена,
   * до состояний и псевдоэлементов, так что правило относится к самому элементу. Считает ядро
   * в `applyOptions` (как и прочие опции — из замыкания, не из `mn.options`).
   */
  function isolateSuffix(): string {
    return (instance as any)._isolateSuffix || '';
  }

  /**
   * Фабрика парсера для произвольного атрибута (не `id`/`class`).
   * Целевой CSS-селектор — `[attrName~="значение"]` (word-match, как у `class`).
   *
   * @param attrName — имя атрибута
   * @returns функция разбора значения этого атрибута
   */
  function parseAttrProvider(attrName: string): ParseComboNameFn {
    const prefix = OPEN_BRACKET + attrName + '~="';
    return (comboName: string) => parseComboName(comboName,
      prefix + escapeQuote(comboName) + '"]');
  }

  /**
   * Редьюсер для `>child`-сегментов суффикса (см. {@link parseComboName}).
   *
   * Каждый `childName` — самостоятельная `<parent`-цепочка (см. {@link parseChain}),
   * без явного целевого селектора (`alt: '*'` — если сам сегмент не задаёт класс/id,
   * подставляется wildcard). Она пристыковывается к уже накопленным `alts`
   * (более ранний, «внешний» селектор) через комбинатор из числового depth-префикса
   * (`getCombinator`) — то есть `alts` становится предком, а разобранный `childName` —
   * более глубоким потомком в итоговом CSS-селекторе.
   *
   * @param alts — селектор(ы), накопленные до этого `>`-сегмента
   * @param childName — один `>`-сегмент суффикса (может нести свой depth-префикс и `<`-цепочку)
   */
  function parseComboName(comboName: string,
    targetName: string): Array<[StrMap<number>, AltMap]> {
    // ИСПРАВЛЕНО 2026-09-23: `states` заводится безусловно в момент
    // selectorsCompileProvider(instance) — НО это не делает фолбэк мёртвым,
    // как я сперва решил: `instance.states` документирован здесь же ниже
    // (см. getSynonyms) как ПУБЛИЧНАЯ "точка расширения для потребителя" —
    // внешний код имеет полное право присвоить `mn.states = {...}` целиком
    // (не домешивая в существующий объект), и тогда фолбэк на `{}` — не
    // страховка от гипотетической ошибки, а рабочий путь. `_synonyms` тем же
    // способом лениво заводится только при первом `mn.synonyms(...)`.
    $$states = (instance as any).states || {};
    $$synonyms = (instance as any)._synonyms || {};
    // Опции читаются на каждый разбор: `mn.setOptions` может поменять лимит
    // между вызовами. Обновляем три поля вместо аллокации объекта с замыканием.
    const $$mnOptions = (instance as any).options || {};
    $$depthCheck.maxDepth = $$selectorMode ? undefined : $$mnOptions.maxDepth;
    $$depthCheck.token = comboName;
    // Настройки файла разметки (D-081) важнее опций экземпляра.
    const markup = $$markupSettings || NO_SETTINGS;
    $$contextWhere = !!(markup.contextWhere === undefined ? $$mnOptions.contextWhere : markup.contextWhere);
    $$mediaClassic = $$mnOptions.mediaSyntax === 'classic';
    // Режим синтаксиса (D-045): строки пресета — в режиме пресета (на время его `setup`),
    // остальное — в режиме проекта. Свой разборщик на режим (D-047); по умолчанию —
    // 'context-qualified' ниже.
    const mode = $$selectorMode ? 'context-qualified'
      : (instance as any)._presetMode || markup.notationMode || $$mnOptions.notationMode;
    if (mode === 'tw4-compatible') {
      return parseVariantPrefixed(comboName, targetName);
    }
    if (mode === 'breakpoint-prefixed') {
      return parseBreakpointPrefixed(comboName, targetName);
    }
    if (mode === 'property-value') {
      return parsePropertyValue(comboName, targetName);
    }

    // Круглые скобки до развёртки групп (D-077): аргумент функционального псевдокласса,
    // `groupMode: 'css'`, подозрительные группы. Селекторы переписаны раньше — в `parseSelector`.
    $$selectorMode || assertMediaPart(comboName);
    const issues: string[] = [];
    let name = $$selectorMode ? comboName : rewriteGroups(
      comboName, $$synonyms, (markup.groupMode || $$mnOptions.groupMode) === 'css', issues,
    );
    if (issues.length && raiseGroupSuspect(comboName, issues)) {
      return [];
    }
    let tgt = targetName;
    let multiplier: number;
    let suffix: string;
    let essence: string;
    let childs: string[];

    const multiplierMatch = REGEXP_MULTIPLIER.exec(name);
    multiplierMatch || REGEXP_OLD_MULTIPLIER.test(comboName) && throwOldMultiplier(comboName);
    if (multiplierMatch) {
      name = multiplierMatch[1];
      multiplier = parseInt(multiplierMatch[2]);
      if (multiplier > 1) {
        // Накрутка специфичности — свой режим (D-039); запрещённый токен CSS не даёт.
        if ((instance as any)._raisedToken?.(
          comboName, 'raised-specificity', (strict: boolean) => specificityMessage(MULTIPLIER_MARK + multiplier, strict),
        )) {
          return [];
        }
        // Предел `*N` (D-089): выше `maxSpecificity` — сообщение; выше потолка 16 CSS нет ни в каком режиме.
        if (multiplier > ($$mnOptions.maxSpecificity || MN_MAX_SPECIFICITY) && ((instance as any)._raisedToken?.(
          comboName, 'max-specificity', (strict: boolean) => maxSpecificityMessage(
            multiplier, $$mnOptions.maxSpecificity || MN_MAX_SPECIFICITY, MN_MAX_SPECIFICITY, strict,
          ),
        ) || multiplier > MN_MAX_SPECIFICITY)) {
          return [];
        }
        tgt = repeat(tgt, multiplier);
      }
    }

    const suffixes = reduceIn(
      variantsBase(name, (instance as any).domains || {}),
      suffixesReduce, {} as StrMap<StrMap<number>>,
    );
    // `!important` (`-i`) виден только в именах эссенций — после разворота групп;
    // дочерний сегмент `>` — в суффиксе (D-041).
    for (suffix in suffixes) { // eslint-disable-line
      if (suffix.indexOf(GREATER) > -1 && (childs = splitChild(suffix)).length > 1 && !$$selectorMode
        && (instance as any)._raisedToken?.(
          comboName, WARNING_CHILD_SELECTOR,
          (strict: boolean) => childSelectorMessage(GREATER + childs.slice(1).join(GREATER), strict),
        )) {
        return [];
      }
      for (essence in suffixes[suffix]) { // eslint-disable-line
        if (REGEXP_MATCH_IMPORTANT.test(essence)
          && (instance as any)._raisedToken?.(
            comboName, WARNING_IMPORTANT, importantMessage,
          )) {
          return [];
        }
      }
    }
    $$tgt = tgt;
    return (reduceIn as any)(
      suffixes, suffixesIteratee, [],
    );
  }

  /**
   * Целевой селектор текущего разбора — для {@link suffixesIteratee}.
   *
   * Итератор вынесен из тела `parseComboName` (там он создавался заново на
   * каждый токен, хотя от токена к токену менялся только `tgt`). Тот же приём,
   * что и с `$$depthCheck.token`: меняющееся значение кладём в поле провайдера,
   * функцию создаём один раз. Повторного входа в `parseComboName` нет —
   * `reduceIn` синхронный, рекурсии через него не возникает.
   */
  let $$tgt: string;
  /**
   * Не предупреждать о незарегистрированных состояниях (D-051): у Master CSS `:hover`,
   * `:nth(2)` — штатная запись оригинала, а не опечатка.
   */
  let $$quietStates = false;
  /**
   * Разбор селектора `mn.assign`/`mn.css` (D-071): всегда запись классов minotation, без
   * предупреждений, которые нужны только классам (полное имя псевдокласса, дочерний селектор,
   * глубина) — в селекторе это обычный CSS.
   */
  let $$selectorMode = false;
  /** Режим синтаксиса компилятора разметки на время разбора (D-045 этап 3). */
  let $$markupSettings: MnParseSettings | undefined;
  /** `contextWhere` текущего разбора (D-049) — читается из опций в начале `parseComboName`. */
  let $$contextWhere = false;
  /** `mediaSyntax: 'classic'` текущего разбора (D-087): условия ширины через `min-`/`max-`. */
  let $$mediaClassic = false;

  function suffixesIteratee(
    items: Array<[StrMap<number>, AltMap]>, essences: StrMap<number>, suffix: string,
  ): Array<[StrMap<number>, AltMap]> {
    return push(items, [
      essences,
      buildContext(parseContext(suffix), $$tgt),
    ]);
  }

  /**
   * Разборщик `'tw4-compatible'` (Tailwind, D-045/D-046): приставки варианта перед
   * классом — `dark:md:hover:group-hover:bg-blue-500`, `!mt-4`. Каждая приставка ищется:
   * 1. среди синонимов и `mn.states` — состояние самого элемента;
   * 2. среди имён медиа (`mn.media`) — медиа; имя есть и там, и там — берётся синоним;
   * 3. по шаблону `{метка}-{синоним|медиа}[/имя]` — метка, зарегистрированная в
   *    `mn.variantPrefixedSynonyms` (`group: '.group'` — предок, `peer: '.peer~'` — сосед),
   *    с этим состоянием или медиа (D-048).
   * Неизвестная приставка — предупреждение, CSS нет. Строк контекста нет: сразу
   * эталонная структура (D-047).
   *
   * @param comboName — класс в записи Tailwind
   * @param targetName — готовый селектор самого элемента
   */
  function parseVariantPrefixed(comboName: string,
    targetName: string): Array<[StrMap<number>, AltMap]> {
    // `:` внутри `[…]`/`(…)` — часть произвольного значения или варианта (D-055).
    const prefixes = splitTopLevelColon(comboName);
    const l = prefixes.length - 1;
    const states: string[] = [''];
    const medias: string[] = [];
    const chain: MnChain = [
      [
        '',
        '',
        undefined,
        undefined,
      ],
    ];
    const childs: Array<[string, MnChain]> = [];
    const marks: string[] = [];
    const media: StrMap<unknown> = (instance as any).media || {};
    const essences: StrMap<number> = {};
    let utility = prefixes[l];
    let prefix: string;
    let i = 0;
    for (; i < l; i++) {
      prefix = prefixes[i];
      $$synonyms[prefix] || $$states[prefix]
        ? states.push(prefix)
        : media[prefix]
          // Точка — «от точки», как в Tailwind (D-060); описание без точки — как есть.
          ? medias.push(pointQuery(
            media, prefix, AT_LEAST,
          ) || prefix)
          : pushTailwindVariant(
            chain, childs, medias, marks, prefix, comboName,
          )
            || pushVariantParent(
              chain, prefix, media,
            ) || throwUnknownVariant(comboName, prefix);
    }
    states.length > 1 && (chain[0][2] = [
      [
        states,
        undefined,
      ],
    ]);
    medias.length && (chain[0][3] = medias.join(AMPERSAND));
    // Стили дочерних элементов (`*:`, `[&>li]:`) — childSelectorMode, как в других режимах (D-041).
    if (marks.length && (instance as any)._raisedToken?.(
      comboName, WARNING_CHILD_SELECTOR,
      (strict: boolean) => childSelectorMessage(marks.join(', '), strict),
    )) {
      return [];
    }
    // `!` — в начале (v3) или в конце (v4).
    const important = utility[0] === EXCLAMATION || utility[utility.length - 1] === EXCLAMATION;
    important && (utility = utility[0] === EXCLAMATION ? utility.slice(1) : utility.slice(0, -1));
    if (important && (instance as any)._raisedToken?.(
      comboName, WARNING_IMPORTANT, importantMessage,
    )) {
      return [];
    }
    essences[tailwindEssence(utility) + (important ? '-i' : '')] = 1;
    return [
      [
        essences,
        buildContext([
          chain,
          childs,
        ], targetName),
      ],
    ];
  }

  /**
   * Эссенция утилиты Tailwind: произвольное свойство `[свойство:значение]` — сырая
   * декларация (D-055, только в этом режиме), иначе утилита как есть — хендлер получает
   * суффикс целиком (`w-[37px]` → `-[37px]`); со скобками — без снятия `\\`: `\\_` в
   * произвольном значении — само подчёркивание, его разбирает хендлер.
   */
  function tailwindEssence(utility: string): string {
    // Ведущий `-` (`-mt-4`) — метка для ядра, хендлер получит `p.sign` (D-064). `--имя=значение` —
    // переменная CSS в записи minotation, не минус: классов на `--` у Tailwind нет.
    return utility[0] === DASH && utility[1] !== DASH && utility.length > 1
      ? MN_NEGATIVE + tailwindEssence(utility.slice(1))
      : utility[0] === OPEN_BRACKET && utility[utility.length - 1] === CLOSE_BRACKET && utility.indexOf(COLON) > 0
        ? MN_RAW_PROPERTY + arbitrary(utility.slice(1, -1))
        : utility.indexOf(OPEN_BRACKET) < 0 ? unslash(utility) : utility;
  }

  /**
   * Варианты Tailwind с аргументом и семейства (D-049, таблица вариантов Tailwind):
   * `[&…]`, `group-[…]`, `peer-[…]`, `data-*`, `aria-*`, `min-*`/`max-*`, `has-[…]`, `not-[…]`,
   * `nth-[…]`, `nth-last-[…]`, `in-[…]`, `*`, `**`. At-правила (`supports-[…]`, `[@…]`) —
   * предупреждение: в выводе ядра есть только `@media`.
   *
   * @returns распознан ли вариант
   */
  function pushTailwindVariant(
    chain: MnChain, childs: Array<[string, MnChain]>, medias: string[], marks: string[], prefix: string,
    comboName: string,
  ): boolean {
    const self = chain[0];
    const bracket = prefix.indexOf('-[');
    const closesBracket = prefix[prefix.length - 1] === CLOSE_BRACKET;
    const name = bracket > 0 && closesBracket ? prefix.slice(0, bracket) : '';
    const value = name ? arbitrary(prefix.slice(bracket + 2, -1)) : '';
    let relation: string | undefined;
    let at: number;
    const children = prefix === ASTERISK;
    if (children || prefix === '**') {
      childs.push([
        children ? GREATER : SPACE,
        [
          [
            '',
            ASTERISK,
            undefined,
            undefined,
          ],
        ],
      ]);
      marks.push(prefix);
      return true;
    }
    if (prefix[0] === OPEN_BRACKET && closesBracket) {
      const selector = arbitrary(prefix.slice(1, -1));
      if (selector[0] === AT) {
        medias.push(arbitraryAtRule(
          selector, prefix, comboName,
        ));
        return true;
      }
      at = selector.indexOf(AMPERSAND);
      at < 0 && throwUnknownVariant(
        comboName, prefix, 'an arbitrary variant needs "&" for the element',
      );
      self[1] += selector.slice(at + 1);
      REGEXP_ARBITRARY_CHILD.test(selector.slice(at + 1)) && marks.push(prefix);
      at && pushArbitraryParent(chain, selector.slice(0, at));
      return true;
    }
    if (name === 'supports') {
      // Как в Tailwind: `display:grid` → `(display:grid)`; `not (…)`, `selector(…)` — как есть.
      medias.push(registerAtRule('supports', value.indexOf(COLON) > 0 && value[0] !== OPEN_PAREN
        && !REGEXP_SUPPORTS_FUNCTION.test(value) ? OPEN_PAREN + value + CLOSE_PAREN : value));
      return true;
    }
    if (prefix[0] === AT) {
      return pushContainerVariant(medias, prefix);
    }
    if (name === 'data' || name === 'aria') {
      self[1] += OPEN_BRACKET + name + DASH + value + CLOSE_BRACKET;
      return true;
    }
    if (prefix.slice(0, 5) === 'data-' || prefix.slice(0, 5) === 'aria-') {
      self[1] += OPEN_BRACKET + prefix + (prefix[0] === 'a' ? '="true"' : '') + CLOSE_BRACKET;
      return true;
    }
    if (name === 'has' || name === 'not') {
      self[1] += COLON + name + OPEN_PAREN + value + CLOSE_PAREN;
      return true;
    }
    if (name === 'nth' || name === 'nth-last') {
      self[1] += COLON + name + '-child(' + value + CLOSE_PAREN;
      return true;
    }
    if (name === 'in') {
      chain.push([
        SPACE,
        ':where(' + value + CLOSE_PAREN,
        undefined,
        undefined,
      ]);
      return true;
    }
    const atLeast = name === 'min';
    if (atLeast || name === MAX) {
      medias.push(registerQuery((instance as any).media || {}, mediaCondition(
        WIDTH, atLeast ? AT_LEAST : LESS, value, $$mediaClassic,
      )));
      return true;
    }
    if (name && (relation = ((instance as any)._variantPrefixedSynonyms || {})[name])) {
      // `group-[.is-published]` — метка с произвольным условием.
      chain.push(labelSegment(
        relation, value, undefined, undefined,
      ));
      return true;
    }
    if (prefix.slice(0, 4) === 'min-' || prefix.slice(0, 4) === 'max-') {
      return pushBreakpointCompare(medias, prefix);
    }
    return false;
  }

  /**
   * Произвольное at-правило `[@media …]`, `[@supports …]`, `[@container …]` (D-057) — имя медиа
   * для ядра. Остальные at-правила (`@layer`, `@starting-style`) — предупреждение.
   */
  function arbitraryAtRule(
    rule: string, prefix: string, comboName: string,
  ): string {
    const matchs = REGEXP_AT_RULE.exec(rule);
    const kind = matchs && matchs[1];
    return !matchs ? throwUnknownVariant(
      comboName, prefix, 'only @media, @supports and @container exist in the output',
    ) : kind === 'media'
      ? registerQuery((instance as any).media || {}, matchs[2])
      : registerAtRule(kind as string, matchs[2]);
  }

  /**
   * Контейнерный вариант Tailwind (D-057, D-086): `@min-[…]`, `@max-[…]`, `@{размер}` и `@min-{размер}`
   * (`width >= …`), `@max-{размер}` (`width < …`), `/имя` — именованный контейнер. Ширина размера — из шкалы
   * контейнеров `mn.containers` (`presetTw4`: `@md` — 28rem, как у Tailwind), без записи — у точки медиа.
   *
   * @returns распознан ли вариант
   */
  function pushContainerVariant(medias: string[], prefix: string): boolean {
    const slash = prefix.indexOf('/');
    const noSlash = slash < 0;
    const base = noSlash ? prefix.slice(1) : prefix.slice(1, slash);
    const named = noSlash ? '' : prefix.slice(slash + 1) + SPACE;
    const bracket = base.indexOf('-[');
    const compare = base.slice(0, 4) === 'min-' || base.slice(0, 4) === 'max-' ? base.slice(0, 3) : '';
    const kind = bracket > 0 && base[base.length - 1] === CLOSE_BRACKET ? base.slice(0, bracket) : '';
    const size = kind ? '' : compare ? base.slice(4) : base;
    const width = kind ? undefined : containerWidth(size);
    let condition: string;
    const atLeast = kind === 'min';
    if (atLeast || kind === MAX) {
      condition = '(width ' + (atLeast ? AT_LEAST : LESS) + SPACE + arbitrary(base.slice(bracket + 2, -1)) + CLOSE_PAREN;
    } else if (width !== undefined) {
      condition = '(width ' + (compare === MAX ? LESS : AT_LEAST) + SPACE + pointCss(width) + CLOSE_PAREN;
    } else {
      return false;
    }
    medias.push(registerAtRule('container', named + condition));
    return true;
  }

  /** Ширина размера контейнера: шкала `mn.containers`, иначе точка медиа (`width`). */
  function containerWidth(size: string): string | number | undefined {
    const containers = (instance as any).containers || {};
    const entry = ((instance as any).media || {})[size];
    return containers[size] !== undefined ? containers[size] : entry ? entry.width : undefined;
  }

  /** Условие `@supports`/`@container` как имя медиа: ядро выведет вложенное at-правило. */
  function registerAtRule(kind: string, condition: string): string {
    const media = (instance as any).media || {};
    const name = AT + kind + SPACE + condition;
    media[name] || (media[name] = {
      [kind]: condition,
    });
    return name;
  }

  /** `min-md`/`max-md` — сравнение с точкой медиа (`width`, D-054). */
  function pushBreakpointCompare(medias: string[], prefix: string): boolean {
    const query = pointQuery(
      (instance as any).media || {}, prefix.slice(4), prefix[1] === 'i' ? AT_LEAST : LESS,
    );
    return !!query && !!medias.push(query);
  }

  /**
   * Запрос к точке медиа (`width`/`height`, D-054) в записи Tailwind: `md` → `(width >= 768px)`.
   *
   * @returns имя зарегистрированного запроса или `''`, если у описания нет точки
   */
  function pointQuery(
    media: StrMap<any>, name: string, operator: string,
  ): string {
    const entry = media[name];
    const side = !entry ? '' : entry.width !== undefined ? WIDTH : entry.height !== undefined ? 'height' : '';
    return side ? registerQuery(media, mediaCondition(
      side, operator as MnMediaOperator, pointCss(entry[side]), $$mediaClassic,
    )) : '';
  }

  /** Точка в CSS: число — px, строка — как записана (`'48rem'`, D-069). */
  function pointCss(value: number | string): string {
    return typeof value === 'number' ? value + 'px' : value;
  }

  /** Часть произвольного варианта до `&` — предок: `.dark_&` → `.dark`, `.a>&` → `.a` и `>`. */
  function pushArbitraryParent(chain: MnChain, before: string): void {
    const last = before[before.length - 1];
    const combinator = last === GREATER || last === PLUS || last === TILDE ? last : SPACE;
    chain.push([
      combinator,
      before.slice(0, combinator === SPACE ? before.length : -1).trim(),
      undefined,
      undefined,
    ]);
  }

  /** Произвольное значение Tailwind: `_` — пробел, `\_` — подчёркивание. */
  function arbitrary(value: string): string {
    // В математике — пробелы вокруг операторов, как у Tailwind: `max-[calc(100%-2rem)]:` (`calc(100%-2rem)` —
    // недействительный CSS).
    return mathSpaces(value.replace(REGEXP_ARBITRARY_SPACE, (match) => (match === UNDERSCORE ? SPACE : UNDERSCORE)));
  }

  /** `:` вне `[…]`/`(…)` и не экранированный — разделитель приставок. */
  function splitTopLevelColon(source: string): string[] {
    const out: string[] = [];
    const l = source.length;
    let depth = 0;
    let from = 0;
    let i = 0;
    let ch: string;
    for (; i < l; i++) {
      ch = source[i];
      if (ch === BACKSLASH) {
        i++;
      } else if (ch === OPEN_BRACKET || ch === OPEN_PAREN) {
        depth++;
      } else if (ch === CLOSE_BRACKET || ch === CLOSE_PAREN) {
        depth--;
      } else if (ch === COLON && !depth) {
        out.push(source.slice(from, i));
        from = i + 1;
      }
    }
    out.push(source.slice(from));
    return out;
  }

  /**
   * `{метка}-{синоним|медиа}[/имя]` → метка в цепочке (D-046, D-048). Метка — только
   * зарегистрированная в `mn.variantPrefixedSynonyms` (`group: '.group'`, `peer: '.peer~'`),
   * как в Tailwind: иное имя — неизвестный вариант (опечатка `grop-hover:` не проходит
   * молча). `/имя` — именованная метка: `group-hover/item:` → `.group\/item:hover …`.
   * Перебор с правого дефиса, чтобы хвост рос: `peer-focus-visible` — сначала `visible`,
   * потом `focus-visible`.
   *
   * @returns найдено ли совпадение
   */
  function pushVariantParent(
    chain: MnChain, prefix: string, media: StrMap<unknown>,
  ): boolean {
    const relations: StrMap<string> = (instance as any)._variantPrefixedSynonyms || {};
    const slash = prefix.indexOf('/');
    const noSlash = slash < 0;
    const base = noSlash ? prefix : prefix.slice(0, slash);
    const label = noSlash ? '' : escapeCss(prefix.slice(slash));
    let i = base.lastIndexOf(DASH);
    let rest: string;
    let relation: string | undefined;
    let isState: unknown;
    while (i > 0) {
      relation = relations[base.slice(0, i)];
      rest = base.slice(i + 1);
      isState = $$synonyms[rest] || $$states[rest];
      if (relation && (isState || media[rest])) {
        chain.push(labelSegment(
          relation, label, isState ? [
            [
              [
                '',
                rest,
              ],
              undefined,
            ],
          ] : undefined, isState ? undefined : rest,
        ));
        return true;
      }
      i = base.lastIndexOf(DASH, i - 1);
    }
    return false;
  }

  /**
   * Сегмент метки из `mn.variantPrefixedSynonyms`: комбинатор в конце селектора метки
   * (`.peer~`) — отношение к элементу, без него — предок.
   */
  function labelSegment(
    relation: string, tail: string, states: MnStateNode[] | undefined, mediaName: string | undefined,
  ): MnSegment {
    const last = relation[relation.length - 1];
    const combinator = last === TILDE || last === PLUS || last === GREATER ? last : '';
    return [
      combinator || SPACE,
      (combinator ? relation.slice(0, -1) : relation) + tail,
      states,
      mediaName,
    ];
  }

  /**
   * Разборщик `'breakpoint-prefixed'` (quantum-css, D-045 этап 4): необязательный брейкпоинт
   * заглавными буквами с `_` перед утилитой — `SM_bgc-dfb-hf`, `MD_px15`. Брейкпоинт ищется в
   * `mn.media` как записан, затем строчными (`SM` → `sm`); неизвестный — предупреждение.
   * Утилита целиком — эссенция: остальная грамматика — у хендлеров клона (D-049).
   */
  function parseBreakpointPrefixed(comboName: string,
    targetName: string): Array<[StrMap<number>, AltMap]> {
    const matchs = REGEXP_BREAKPOINT_PREFIX.exec(comboName);
    const media: StrMap<unknown> = (instance as any).media || {};
    const essences: StrMap<number> = {};
    let name: string | undefined;
    if (matchs) {
      name = media[matchs[1]] ? matchs[1] : matchs[1].toLowerCase();
      media[name] || throwUnknownBreakpoint(comboName, matchs[1]);
    }
    essences[unslash(matchs ? matchs[2] : comboName)] = 1;
    return [
      [
        essences,
        buildContext([
          [
            [
              '',
              '',
              undefined,
              name,
            ],
          ],
          [],
        ], targetName),
      ],
    ];
  }

  /**
   * Разборщик `'property-value'` (Master CSS, D-045 этап 5, D-051): `свойство:значение`
   * (`bg:blue-60`, `b:1|solid|red`), шорткат без значения (`block`), группа `{a;b}`, затем
   * в любом порядке — `!`, состояния (`:hover`, `::before`, `:nth(2)`), селекторы (`>li`,
   * `_h1` — потомок, `+span`, `~div`, `[open]`, `.active`) и в конце медиа (`@md`, `@<md`,
   * `@>=1024`, `@768&<1024`, `@dark`, `@media(any-hover:hover)`). Имя свойства — хендлер:
   * эссенция-пара `имя\u0001значение`, без регулярки имени.
   */
  function parsePropertyValue(comboName: string,
    targetName: string): Array<[StrMap<number>, AltMap]> {
    const l = comboName.length;
    const essences: StrMap<number> = {};
    const compounds: Array<[string, string, string[]]> = [
      [
        '',
        '',
        [''],
      ],
    ];
    let decls: string[];
    let important = false;
    let media: string | undefined;
    let current = compounds[0];
    let i: number;
    let j: number;
    let ch: string;
    if (comboName[0] === '{') {
      j = closeAt(comboName, 0);
      j < 0 && throwPropertyValue(comboName, 'the group "{" is not closed');
      decls = splitTopLevel(comboName.slice(1, j), ';');
      i = j + 1;
    } else {
      i = declarationEnd(comboName, 0);
      decls = [comboName.slice(0, i)];
    }
    while (i < l) {
      ch = comboName[i];
      if (ch === EXCLAMATION) {
        important = true;
        i++;
      } else if (ch === AT) {
        media = masterMedia(comboName.slice(i + 1), comboName);
        i = l;
      } else if (ch === COLON) {
        j = partEnd(comboName, i + (comboName[i + 1] === COLON ? 2 : 1));
        pushMasterState(current[2], comboName.slice(i, j));
        i = j;
      } else if (ch === GREATER || ch === UNDERSCORE || ch === PLUS || ch === TILDE) {
        j = partEnd(comboName, i + 1);
        current = [
          ch === UNDERSCORE ? SPACE : ch,
          comboName.slice(i + 1, j),
          [''],
        ];
        compounds.push(current);
        i = j;
      } else {
        j = partEnd(comboName, i + 1);
        current[1] += comboName.slice(i, j);
        i = j;
      }
    }
    for (const decl of decls) {
      j = decl.indexOf(COLON);
      essences[(j < 0 ? decl : decl.slice(0, j) + MN_ESSENCE_PAIR + decl.slice(j + 1)) + (important ? '-i' : '')] = 1;
    }
    if (important && (instance as any)._raisedToken?.(
      comboName, WARNING_IMPORTANT, importantMessage,
    )) {
      return [];
    }
    const childs: Array<[string, MnChain]> = [];
    const compoundsLength = compounds.length;
    let compound: [string, string, string[]];
    for (i = 1; i < compoundsLength; i++) {
      compound = compounds[i];
      if ((compound[0] === GREATER || compound[0] === SPACE) && (instance as any)._raisedToken?.(
        comboName, WARNING_CHILD_SELECTOR,
        (strict: boolean) => childSelectorMessage((compound[0] === SPACE ? UNDERSCORE : GREATER) + compound[1], strict),
      )) {
        return [];
      }
      childs.push([
        compound[0],
        [
          [
            '',
            compound[1],
            statesOf(compound[2]),
            undefined,
          ],
        ],
      ]);
    }
    $$quietStates = true;
    try {
      return [
        [
          essences,
          buildContext([
            [
              [
                '',
                compounds[0][1],
                statesOf(compounds[0][2]),
                media,
              ],
            ],
            childs,
          ], targetName),
        ],
      ];
    } finally {
      $$quietStates = false;
    }
  }

  function statesOf(names: string[]): MnStateNode[] | undefined {
    return names.length > 1 ? [
      [
        names,
        undefined,
      ],
    ] : undefined;
  }

  /**
   * Конец объявления: имя, затем — если это хендлер — `:значение` до первого контекстного
   * символа вне скобок и кавычек. Не хендлер — шорткат без значения (`block`), `:` дальше —
   * состояние.
   */
  function declarationEnd(source: string, start: number): number {
    let i = start;
    const l = source.length;
    while (i < l && REGEXP_PROPERTY_CHAR.test(source[i])) {
      i++;
    }
    if (source[i] !== COLON || !((instance as any).domains || {})[source.slice(start, i)]) {
      return i;
    }
    return valueEnd(source, i + 1);
  }

  /** Конец значения: вне скобок и кавычек — `:`, `@`, `!`, `>`, `_`, `+`, `~`, `[` или `.буква`. */
  function valueEnd(source: string, start: number): number {
    const l = source.length;
    let i = start;
    let depth = 0;
    let quote = '';
    let ch: string;
    for (; i < l; i++) {
      ch = source[i];
      if (quote) {
        ch === quote && (quote = '');
      } else if (ch === QUOTE || ch === DOUBLE_QUOTE) {
        quote = ch;
      } else if (ch === OPEN_PAREN) {
        depth++;
      } else if (ch === CLOSE_PAREN) {
        depth--;
      } else if (!depth && (VALUE_STOPS[ch] || ch === DOT && /[A-Za-z]/.test(source[i + 1] || ''))) {
        return i;
      }
    }
    return i;
  }

  /** Конец состояния или селектора: до следующего контекстного символа вне скобок. */
  function partEnd(source: string, start: number): number {
    const l = source.length;
    let i = start;
    let depth = 0;
    let ch: string;
    for (; i < l; i++) {
      ch = source[i];
      if (ch === OPEN_PAREN || ch === OPEN_BRACKET) {
        depth++;
      } else if (ch === CLOSE_PAREN || ch === CLOSE_BRACKET) {
        depth--;
      } else if (!depth && PART_STOPS[ch]) {
        return i;
      }
    }
    return i;
  }

  /** Индекс парной `}`; `-1` — нет. */
  function closeAt(source: string, start: number): number {
    const l = source.length;
    let depth = 0;
    let i = start;
    for (; i < l; i++) {
      source[i] === '{' && depth++;
      if (source[i] === '}' && !--depth) {
        return i;
      }
    }
    return -1;
  }

  function splitTopLevel(source: string, separator: string): string[] {
    const out: string[] = [];
    const l = source.length;
    let depth = 0;
    let from = 0;
    let i = 0;
    for (; i < l; i++) {
      source[i] === OPEN_PAREN && depth++;
      source[i] === CLOSE_PAREN && depth--;
      if (!depth && source[i] === separator) {
        out.push(source.slice(from, i));
        from = i + 1;
      }
    }
    out.push(source.slice(from));
    return out.filter(Boolean);
  }

  /**
   * Состояние Master CSS: `:hover` — как есть, `::before`/`:before`/`:after` — псевдоэлемент,
   * `:first`, `:last`, `:odd`, `:even`, `:nth(N)` — сокращения оригинала; зарегистрированный
   * синоним важнее.
   */
  function pushMasterState(names: string[], part: string): void {
    const pseudoElement = part[1] === COLON;
    const name = part.slice(pseudoElement ? 2 : 1);
    const head = REGEXP_SCOPE_SUFFIX.exec(name);
    const base = head ? head[1] : name;
    if ($$synonyms[base] || $$states[base]) {
      names.push(name);
    } else if (pseudoElement || MASTER_PSEUDO_ELEMENTS[base]) {
      names.push('', name);
    } else {
      // Сокращение найдено по `head[1]` — значит, `head` есть.
      names.push(MASTER_STATES[base] ? MASTER_STATES[base]((head as RegExpExecArray)[2]) : name);
    }
  }

  /**
   * Медиа Master CSS → выражение для ядра: атомы через `&`. Имя из `mn.media` — как есть;
   * сравнения (`<`, `<=`, `>`, `>=`) с числом или именем брейкпоинта и слова оригинала
   * (`dark`, `print`, `landscape`, …) — готовым запросом; `media(…)` — как написано.
   */
  function masterMedia(expression: string, comboName: string): string {
    const media: StrMap<{ query?: string }> = (instance as any).media || {};
    return splitTopLevel(expression, AMPERSAND).map((atom) => {
      const matchs = REGEXP_MASTER_MEDIA_COMPARE.exec(atom);
      const isNumber = !!matchs && /^[0-9.]+$/.test(matchs[2]);
      let width: number;
      let query: string;
      if (atom.slice(0, 6) === 'media(') {
        return registerQuery(media, atom.slice(5));
      }
      if (!matchs || !matchs[1] && !isNumber) {
        // Имя без сравнения: своё медиа проекта, слово оригинала или неизвестное.
        return media[atom] ? atom : MASTER_MEDIA[atom]
          ? registerQuery(media, MASTER_MEDIA[atom])
          : throwPropertyValue(comboName, 'media "' + atom + '" is unknown');
      }
      width = isNumber ? parseFloat(matchs[2]) : widthOf(
        media[matchs[2]], matchs[2], comboName,
      );
      query = mediaCondition(
        WIDTH, (matchs[1] || AT_LEAST) as MnMediaOperator, width + 'px', $$mediaClassic,
      );
      return registerQuery(media, query);
    }).join(AMPERSAND);
  }

  /** Ширина брейкпоинта из его запроса (`(min-width: 1024px)`). */
  function widthOf(
    entry: { query?: string } | undefined, name: string, comboName: string,
  ): number {
    const matchs = entry && REGEXP_WIDTH.exec(entry.query || '');
    return matchs ? parseFloat(matchs[1]) : throwPropertyValue(comboName, 'media "' + name
      + '" has no width to compare with');
  }

  /** Готовый запрос как имя медиа: ядро разрешит его при выводе (D-051). */
  function registerQuery(media: StrMap<{ query?: string }>, query: string): string {
    media[query] || (media[query] = {
      query,
    });
    return query;
  }

  function throwPropertyValue(comboName: string, message: string): never {
    throw new MnParseError(DOUBLE_QUOTE + comboName + '": ' + message + '. The class gives no CSS.', {
      token: comboName,
      handler: '',
      arg: '',
      utility: 'property-value',
    });
  }

  function throwUnknownBreakpoint(comboName: string, prefix: string): never {
    throw new MnParseError('Breakpoint "' + prefix + '_" is unknown — "' + prefix + '" and "'
      + prefix.toLowerCase() + '" are not media names. The class gives no CSS.', {
      token: comboName,
      handler: '',
      arg: prefix,
      utility: 'breakpoint-prefixed',
    });
  }

  function throwUnknownVariant(
    comboName: string, prefix: string, reason?: string,
  ): never {
    throw new MnParseError('Variant "' + prefix + ':" ' + (reason ? 'is not supported: ' + reason
      : 'is unknown — it is neither a synonym nor a media name, and "{label}-{synonym|media}" does'
        + ' not match a label registered with mn.variantPrefixedSynonyms') + '. The class gives no CSS.', {
      token: comboName,
      handler: '',
      arg: prefix,
      utility: 'tw4-compatible',
    });
  }


  /**
   * Фаза разбора `'context-qualified'` (D-047): строка контекста (`:h@md<.group>1`) →
   * {@link MnContext}. Ошибки и проверки глубины (`getCombinator`) — здесь.
   *
   * @param suffix — нормализованный контекст одного варианта токена
   * @returns эталонная структура контекста
   */
  function parseContext(suffix: string): MnContext {
    const childNames = splitChild(suffix);
    const chain = parseChain(childNames.shift() as string);
    const childs: Array<[string, MnChain]> = [];
    const l = childNames.length;
    let i = 0;
    let part: [string, string];
    for (; i < l; i++) {
      part = getCombinator(
        childNames[i], $$depthCheck, true,
      );
      childs.push([
        part[0],
        parseChain(part[1]),
      ]);
    }
    return [
      chain,
      childs,
    ];
  }

  /**
   * `<`-цепочка (`Child<1Parent<2GrandParent`) → {@link MnChain}: первая часть — сам
   * элемент (без комбинатора), каждая следующая — предок со своим комбинатором глубины
   * (`getCombinator`: `0`/нет → пробел, `1` → `>`, `2+` → `> *>…`), состояниями и медиа.
   */
  function parseChain(name: string): MnChain {
    const parts = splitParent(name);
    const l = parts.length;
    const chain: MnChain = [];
    let i = 0;
    let at: number;
    let segment: string;
    let part: [string, string];
    for (; i < l; i++) {
      // Медиа — до конца сегмента (D-088): `/высота` и `:контейнер` — его части, а не селектор.
      segment = parts[i];
      at = mediaAt(segment);
      part = i
        ? getCombinator(at < 0 ? segment : segment.slice(0, at), $$depthCheck)
        : [
          '',
          at < 0 ? segment : segment.slice(0, at),
        ];
      chain.push(parseSegment(
        part[0], part[1], at < 0 ? undefined : unslash(segment.slice(at + 1)),
      ));
    }
    return chain;
  }

  /** Позиция `@` медиа в сегменте — вне `[…]`, `(…)` и экранирования; нет — `-1`. */
  function mediaAt(segment: string): number {
    const l = segment.length;
    let depth = 0;
    let i = 0;
    let ch: string;
    for (; i < l; i++) {
      ch = segment[i];
      if (ch === BACKSLASH) {
        i++;
      } else if (ch === OPEN_BRACKET || ch === OPEN_PAREN) {
        depth++;
      } else if (ch === CLOSE_BRACKET || ch === CLOSE_PAREN) {
        depth--;
      } else if (ch === AT && !depth) {
        return i;
      }
    }
    return -1;
  }

  /**
   * После `@` — только медиа (D-088): до конца токена или до конца альтернативы группы, в которой стоит
   * `@` (`c00F(@sm|.active)<.parent` — законно). Селектор, состояние или цепочка после медиа — ошибка с
   * подсказкой; `:имя` — контейнер, но имя состояния или синонима там — тоже ошибка: состояния — до `@`.
   */
  function assertMediaPart(comboName: string): void {
    const l = comboName.length;
    // `depth` — круглые скобки групп, `bracket` — `[…]`: `@` внутри атрибута — не медиа.
    let depth = 0;
    let bracket = 0;
    let nested: number;
    let i = 0;
    let j: number;
    let ch: string;
    let name: string;
    for (; i < l; i++) {
      ch = comboName[i];
      if (ch === BACKSLASH) {
        i++;
      } else if (ch === OPEN_BRACKET) {
        bracket++;
      } else if (ch === CLOSE_BRACKET) {
        bracket--;
      } else if (ch === OPEN_PAREN) {
        depth++;
      } else if (ch === CLOSE_PAREN) {
        depth--;
      } else if (ch === AT && !bracket) {
        for (j = i + 1, nested = 0; j < l; j++) {
          ch = comboName[j];
          if (ch === BACKSLASH) {
            // Экранированный символ — часть имени медиа (`@a\\|b`).
            j++;
          } else if (ch === OPEN_PAREN) {
            nested++;
          } else if (ch === CLOSE_PAREN && nested) {
            nested--;
          } else if (ch === CLOSE_PAREN || ch === '|' && !nested && depth || ch === ASTERISK && REGEXP_TAIL_MULTIPLIER.test(comboName.slice(j))) {
            break;
          } else if (!REGEXP_MEDIA_CHAR.test(ch) || ch === DOT && !REGEXP_DIGIT_CHAR.test(comboName[j + 1] || '')) {
            throwMediaPart(
              comboName, comboName.slice(i, j + 1), 'a selector',
            );
          } else if (ch === COLON) {
            name = REGEXP_NAME_HEAD.exec(comboName.slice(j + 1))?.[0] || '';
            ($$synonyms[name] || $$states[name] || CSS_PSEUDO_NAMES[name] || comboName[j + 1] === COLON) && throwMediaPart(
              comboName, comboName.slice(i, j + 1 + (name.length || 1)), 'a state',
            );
          }
        }
        i = j - 1;
      }
    }
  }

  /**
   * Прежний множитель `*N`: CSS нет, сообщение с новой записью `**N`.
   * @param comboName токен как написан
   * @example throwOldMultiplier('p10*2') // «"p10*2" was renamed: write "p10**2" — …»
   */
  function throwOldMultiplier(comboName: string): never {
    const tail = REGEXP_OLD_MULTIPLIER_TAIL.exec(comboName) as RegExpExecArray;
    throw new MnParseError(DOUBLE_QUOTE + comboName + '" was renamed: write "'
      + comboName.slice(0, -tail[0].length) + MULTIPLIER_MARK + tail[1] + '" — the selector multiplier is "**N",'
      + ' and "*" in a value is multiplication. The old spelling gives no CSS.', {
      token: comboName,
      handler: '',
      arg: tail[0],
      utility: 'multiplier',
    });
  }

  function throwMediaPart(
    comboName: string, found: string, what: string,
  ): never {
    throw new MnParseError(DOUBLE_QUOTE + comboName + '": "' + found + '" — ' + what + ' after the media part. After "@" only'
      + ' the media part may follow: selectors, states and chains go before "@" — "cF00.active:hover<.card@md",'
      + ' not "cF00@md.active:hover<.card". The class gives no CSS.', {
      token: comboName,
      handler: '',
      arg: found,
      utility: 'media',
    });
  }

  /** Делит часть цепочки на селектор и состояния (`Parent:hover` → `Parent`, `:hover`). */
  function parseSegment(
    combinator: string, name: string, media: string | undefined,
  ): MnSegment {
    const i = name.indexOf(COLON);
    return i < 0
      ? [
        combinator,
        name,
        undefined,
        media,
      ]
      : [
        combinator,
        unslash(name.slice(0, i)),
        parseStates(name.slice(i)),
        media,
      ];
  }

  /** `':h:f[2n]'` → дерево {@link MnStateNode}: `[`/`]` — вложенность, `:` — состояния. */
  function parseStates(value: string): MnStateNode[] {
    return toStateNodes(scopeSplit2(
      value, SCOPE_START, SCOPE_END,
    ));
  }

  function toStateNodes(scopes: ScopeNode[]): MnStateNode[] {
    const l = scopes.length;
    const out: MnStateNode[] = [];
    let i = 0;
    let scope: ScopeNode;
    for (; i < l; i++) {
      scope = scopes[i];
      out.push([
        splitState(scope[0]),
        scope[1] && toStateNodes(scope[1]),
      ]);
    }
    return out;
  }

  /**
   * Фаза построения (D-047), общая для всех режимов: {@link MnContext} → селекторы с
   * медиа-альтернативами.
   *
   * @param context — эталонная структура контекста
   * @param targetName — готовый селектор самого элемента (`.p10`, `#id`)
   */
  function buildContext(context: MnContext, targetName: string): AltMap {
    const childs = context[1];
    const l = childs.length;
    let i = 0;
    // `contextWhere` (D-049): всё, кроме стилизуемого элемента, — в `:where()`. Без детей
    // элемент — сам класс, его предки уходят в `:is(:where(…) *)`; с детьми элемент — последний
    // ребёнок, всё до него — в `:where(…)`.
    let alts = $$contextWhere && !l
      ? buildChainWhere(context[0], targetName)
      : buildChain(context[0], targetName);
    for (; i < l; i++) {
      alts = joinMapsWithFirstValue(
        $$contextWhere && i === l - 1 ? wrapWhere(alts) : alts,
        buildChain(childs[i][1], ''),
        childs[i][0],
      );
    }
    return mapIn(alts, mediaFilterIteratee as any);
  }

  /**
   * Цепочка с предками в `:where()`: `.x:is(:where(.card:hover) *)`. Если в сегменте самого
   * элемента есть сосед (`cF00+.b`), стилизуется сосед — класс тоже уходит в `:where()`:
   * `:where(.cF00\+\.b)+.b`.
   */
  function buildChainWhere(chain: MnChain, targetName: string): AltMap {
    const segment = chain[0];
    const at = lastSiblingCombinator(segment[1]);
    const subject = joinPrefixWithFirstValue(
      at < 0
        ? targetName + segment[1]
        : ':where(' + targetName + segment[1].slice(0, at) + CLOSE_PAREN + segment[1].slice(at),
      buildStates(segment[2]),
      segment[3],
    );
    return chain.length > 1
      ? joinWhere(
        buildChain(chain.slice(1), ''), subject, chain[1][0],
      )
      : subject;
  }

  /** Позиция последнего неэкранированного `+`/`~` вне скобок; `-1` — нет. */
  function lastSiblingCombinator(selector: string): number {
    let i = selector.length;
    let depth = 0;
    let ch: string;
    while (i--) {
      ch = selector[i];
      if (ch === CLOSE_BRACKET || ch === CLOSE_PAREN) {
        depth++;
      } else if (ch === OPEN_BRACKET || ch === OPEN_PAREN) {
        depth--;
      } else if (!depth && (ch === PLUS || ch === TILDE) && selector[i - 1] !== BACKSLASH) {
        return i;
      }
    }
    return -1;
  }

  /** Цепочка → AltMap: элемент склеивается с `targetName`, предки — через свои комбинаторы. */
  function buildChain(chain: MnChain, targetName: string): AltMap {
    const l = chain.length;
    let segment = chain[0];
    let alts = joinPrefixWithFirstValue(
      targetName + segment[1],
      buildStates(segment[2]),
      segment[3],
    );
    let i = 1;
    for (; i < l; i++) {
      segment = chain[i];
      alts = joinMapsWithFirstValue(
        joinPrefixWithFirstValue(
          segment[1],
          buildStates(segment[2]),
          segment[3],
        ),
        alts,
        segment[0],
      );
    }
    return alts;
  }

  /** Без состояний — одна пустая альтернатива: нечего раскрывать. */
  function buildStates(states: MnStateNode[] | undefined): AltMap {
    return states
      ? getSynonyms(states)
      : {
        '': [],
      };
  }

  /**
   * Разбирает `:state`-часть суффикса (после первого `:` в {@link parseSegment}) в AltMap.
   *
   * `value` сначала делится на вложенные scope через `scopeSplit2(value, SCOPE_START, SCOPE_END)`
   * (границы `[`/`]`; локальный порт `mn-utils/scopeSplit2` из v1 — `fundamentool.scopeSplit`
   * возвращает другую, несовместимую форму, см. `scopeSplit2.ts`), затем на каждом уровне
   * текст сегмента — на `:`-разделённые токены ({@link StrMap} `splitState`). Первый токен
   * уровня — литеральный префикс (не ищется как состояние), остальные разрешаются по приоритету:
   * 1. `mn.synonyms(...)`-регистрация (`$$synonyms[state]`) — раскрывается в её AltMap;
   * 2. именованная группа состояний из `instance.states` (`$$states[state]`, публичный,
   *    но ничем в этом пакете не заполняется — точка расширения для потребителя);
   * 3. иначе — как обычный CSS-псевдокласс, литерально `:state`.
   * Вложенный scope (потомок в дереве `scopeSplit2`) оборачивается в `(...)` на верхнем
   * уровне и в `[...]` глубже — механика унаследована из v1.
   *
   * @param value — `:state`-суффикс (например `:hover`, `:(hover|focus)`)
   * @returns AltMap раскрытых состояний
   */
  function getSynonyms(nodes: MnStateNode[]): AltMap {
    let alts: AltMap = {
      '': [],
    };
    base(nodes, 1);
    return alts;

    function base(scopes: MnStateNode[], hasTop: number): void {
      const scopesL = scopes.length;
      let scopesI = 0;
      let scope: MnStateNode;
      let state: string;
      let _state: string;
      let states: string[];
      let childs: MnStateNode[] | undefined;
      let ns: string[] | undefined;
      let si: number;
      let statesL: number;
      let statesI: number;
      // `shift()` у пустого массива даёт `undefined` — ниже это и
      // проверяется (`if (head)`).
      let head: string | undefined;
      let matches: RegExpExecArray | null;
      let suffix: string;
      let synonyms: AltMap | undefined;
      let wasEmpty: boolean;

      for (; scopesI < scopesL; scopesI++) {
        scope = scopes[scopesI];
        // Узел уже разобран (D-047): `[0]` — литеральный префикс, дальше — имена
        // состояний. Массив общий для кеша разбора — не мутируется.
        states = scope[0];
        head = states[0];
        if (head) {
          _pushSuffix(head);
        }
        statesL = states.length;
        statesI = 1;

        for (; statesI < statesL; statesI++) {
          // Пустое имя — признак псевдоЭЛЕМЕНТА (`p10::before` даёт пару
          // ['', 'before']). О следующем за ним имени предупреждать не о чем:
          // `::before` — не состояние и синонимом не заводится.
          wasEmpty = !states[statesI - 1] && statesI > 1;
          _state = state = unslash(states[statesI]);
          matches = REGEXP_SCOPE_SUFFIX.exec(_state);
          if (matches) {
            state = matches[1];
            suffix = matches[2];
          } else {
            suffix = '';
          }

          // После `::` — псевдоэлемент как есть: синоним с тем же именем (`before: '::before'` у
          // клона Tailwind) иначе дал бы `:::before`.
          synonyms = wasEmpty ? undefined : $$synonyms[state];
          if (synonyms) {
            alts = joinMapsWithFirstValue(
              alts, synonyms, 0 as any, suffix,
            );
          } else {
            ns = wasEmpty ? undefined : $$states[state];
            if (ns && (si = ns.length)) {
              synonyms = {};
              for (; si--;) {
                synonyms[ns[si] + suffix] = [];
              }
              alts = joinMapsWithFirstValue(alts, synonyms);
            } else {
              // Имени нет ни в синонимах, ни в `mn.states` — пропускаем как есть
              // (псевдокласс может быть специфичен для окружения или ещё не быть
              // в стандарте), но предупреждаем: `p10:fv` иначе давал мёртвое
              // правило `.p10\:fv:fv{…}` молча. Пустое имя — это `::before`
              // и подобные, там предупреждать не о чем.
              _state && !wasEmpty && !$$quietStates && (instance as any)._collectWarning?.({
                type: 'unregistered-state',
                token: $$depthCheck.token,
                message: 'State ":' + _state + '" is not registered — neither as a synonym '
                  + 'nor in `mn.states`. It goes to CSS as is; if it is a typo, '
                  + 'the rule is dead. Add a synonym '
                  + '(`mn.synonyms({ … })`) so the project has one canonical spelling',
              });
              _pushSuffix(COLON + _state);
            }
          }
        }

        childs = scope[1];
        if (childs) {
          _pushSuffix(hasTop ? OPEN_PAREN : OPEN_BRACKET);
          base(childs, 0);
          _pushSuffix(hasTop ? CLOSE_PAREN : CLOSE_BRACKET);
        }
      }
    }

    function _pushSuffix(suffix: string): void {
      const prefixes = alts;
      let prefix: string;
      alts = {};
      for (prefix in prefixes) {
        alts[prefix + suffix] = prefixes[prefix];
      }
    }
  }

  /**
   * Селектор `mn.assign`/`mn.css` (D-071): в начале — обычный CSS-селектор (элемент), после него —
   * контекст в записи классов: состояния и синонимы, группы, предки, медиа, приоритет `^N`.
   * Элемент кончается на первом `:`, `(`, `<`, `>`, `@` вне `[…]` и кавычек; запятая вне скобок —
   * альтернативы. Предупреждений, нужных только классам, нет.
   *
   * @param source — `'.selector(:h|.active)@d^3'`, `'html'`, `':root@dark'`, `'h1, h2'`
   * @returns селектор CSS → имя медиа (`''` — без медиа)
   * @example
   * parseSelector('.menu(:h|.active)@d');
   * // → { '.menu:hover': 'd&hover', '.menu.active': 'd' }
   */
  function parseSelector(source: string): StrMap<string> {
    const out: StrMap<string> = {};
    let part: string;
    let media: [string, string];
    let results: Array<[string, string]>;
    let piece: [number, string];
    let result: [string, string];
    $$selectorMode = true;
    $$quietStates = true;
    try {
      // Сначала — группы вариантов по всей строке (`[type=(button|reset)]`, `(button|a)::x`), как
      // разворачивал их прежний разбор селекторов; потом каждый вариант — элемент и контекст.
      // Скобки до развёртки групп (D-077) — как у класса, см. `rewriteGroups`.
      const issues: string[] = [];
      const options = (instance as any).options || {};
      const rewritten = rewriteGroups(
        source, (instance as any)._synonyms || {}, options.groupMode === 'css', issues,
      );
      if (issues.length && raiseGroupSuspect(source, issues)) {
        return out;
      }
      for (part of expandSelectorGroups(rewritten)) {
        // Медиа в селекторе — где угодно (`.a(:h|.active)@m .child`), в отличие от класса: относится
        // ко всему селектору и вынимается до разбора; конец выражения — пробел или комбинатор.
        media = takeSelectorMedia(part);
        results = [
          [
            '',
            media[1],
          ],
        ];
        // Комбинаторы CSS (пробел, `>`, `+`, `~`) остаются CSS — `>` здесь ребёнок, а не потомок,
        // как в записи классов; запись классов действует внутри каждого составного селектора.
        for (piece of splitCompounds(media[0])) {
          results = piece[0] ? joinCompound(results, piece[1]) : results.map((result) => [
            result[0] + piece[1],
            result[1],
          ] as [string, string]);
        }
        for (result of results) {
          out[result[0]] = result[1];
        }
      }
    } finally {
      $$selectorMode = false;
      $$quietStates = false;
    }
    return out;
  }

  /**
   * Подозрительные группы (D-077) — через режим `groupSuspectMode`.
   *
   * @returns `true` — режим `'strict'`: запись CSS не даёт
   */
  function raiseGroupSuspect(token: string, issues: string[]): boolean {
    return !!(instance as any)._raisedToken?.(
      token, 'group-suspect', (strict: boolean) => groupSuspectMessage(issues, strict),
    );
  }

  /**
   * Составной селектор (без комбинаторов) в записи классов: элемент и контекст. Каждый готовый
   * селектор продолжается каждым вариантом составного; медиа — через `&`.
   */
  function joinCompound(results: Array<[string, string]>, compound: string): Array<[string, string]> {
    const at = elementEnd(compound);
    const next: Array<[string, string]> = [];
    let alt: [StrMap<number>, AltMap];
    let selector: string;
    let result: [string, string];
    for (alt of parseComboName(SELECTOR_ESSENCE + compound.slice(at), compound.slice(0, at))) {
      // Значение — имя медиа строкой (после `buildContext`), как видит его ядро в `__assignCore`.
      for (selector in alt[1]) { // eslint-disable-line
        for (result of results) {
          next.push([
            result[0] + selector,
            joinSelectorMedia(result[1], (alt[1] as unknown as StrMap<string>)[selector]),
          ]);
        }
      }
    }
    return next;
  }

  return extend(instance || (instance = parseComboName as ParseComboNameFn),
    {
      states: {} as StrMap<string[]>,
      parseSelector,
      parseComboName,
      parseComboNameProvider,
      parseId,
      parseClass,
    });
}
