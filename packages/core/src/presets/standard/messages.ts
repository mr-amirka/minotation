import type {
  MnEssenceParams,
} from '../../core/types';
import {
  MnParseError,
} from '../../core/types';
import {
  handlerWrap,
} from '../../core/utils';
import type {
  MnHandler,
  MnInstance,
} from '../../types';
import {
  BOX_SIZING_WORDS,
  CLOSE_PAREN,
  CURSOR_WORDS,
  DASH,
  DOUBLE_QUOTE,
  FLOAT_WORDS,
  LIST_SEPARATOR,
  POS,
  POSITION_WORDS,
  S,
  UNDERSCORE,
  ZERO,
} from './words';

/** Начало пояснения в подсказке: `aiC (center)`. */
export const HINT_OPEN = ' (';
export const MSG_INSTEAD_OF = '" instead of "';
export const MSG_SAME_VALUE = '" — same value';
export const MSG_WRITE_SHORTER = 'Write it shorter: "';
export const MSG_VALUE = 'Value "';
export const MSG_IS_INVALID_FOR = '" is invalid for "';
export const MSG_COLON = '": ';
/** Пример записи в конце сообщения: `… — as "ftBlur2"`. */
export const MSG_AS = ' — as "';
/** Начало цитаты слова после двоеточия: `…for "bgs": "cover" stands alone`. */
export const MSG_COLON_QUOTE = MSG_COLON + DOUBLE_QUOTE;
const REGEXP_DASHES = /-/g;

export function throwInvalid(message?: string): never {
  throw new MnParseError(message || 'Parameter is invalid', {
    token: '',
    handler: '',
    arg: '',
  });
}

/**
 * Старая запись после переименования: сообщение с новой, CSS нет. Убирается через один выпуск — задача
 * в PLAN; это сообщение, а не вторая реализация.
 * @param decision решение, которым переименовано: D-094 (по умолчанию), D-106 (`ww` → `owr`) или D-127 (`mki` → `mk`)
 */
export function throwRenamed(
  token: string, replacement: string, decision?: string,
): never {
  throw new MnParseError(DOUBLE_QUOTE + token + '" was renamed: write "' + replacement + '" ('
    + (decision || 'D-094') + '). The old spelling gives no CSS and is removed in the next release.', {
    token,
    handler: '',
    arg: '',
  });
}
/**
 * Бракует значение свойства с закрытым перечислением.
 *
 * Регистр не важен: ключевые слова в CSS регистронезависимы, и сырой режим
 * (`tems_Filled_Dot`) оставляет их как написано. Ключи списка — в нижнем
 * регистре, значение — `1` либо каноническая запись, которой заменяется
 * найденное слово.
 */
/**
 * Слово CSS в записи нотации: `crisp-edges` → `CrispEdges`, как его пишут после
 * имени хендлера (`irCrispEdges`).
 */
export function notationWord(word: string): string {
  return word.split(DASH).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

/**
 * Хвост сообщения со списком допустимых записей — чтобы не идти за ним в
 * справочник. Строится только на пути ошибки: на обычную компиляцию не влияет.
 */
export function availableHint(items: string[]): string {
  // Пустым список не бывает: подсказку строят только хендлеры со словарём
  // сокращений или перечислением, а пустых среди них нет.
  return '. Available: ' + items.join(LIST_SEPARATOR);
}

/** Слово без регистра и дефисов: `-webkit-sticky`, `WebkitSticky` и `webkit-sticky` совпадают. */
function squashWord(word: string): string {
  return word.toLowerCase().replace(REGEXP_DASHES, '');
}

/**
 * Допустимые значения перечисления в записи нотации — каждое каноническое слово один раз. Запись со строкой — алиас:
 * в подсказку идёт каноническое (`optimizeSpeed`, а не `optimizespeed`), и только если алиас пишет то же слово
 * (без регистра и дефисов): `optimize-speed` → `optimizeSpeed` — да, `contrast` → `optimize-contrast` — нет.
 */
export function enumHint(
  words: Record<string, 1 | string>, essenceName: string, abbreviations?: Record<string, string>,
): string {
  const items: string[] = [];
  const short: Record<string, string> = {};
  let abbr: string;
  // Словари букв пишут слово по-разному (`Solid`, `-webkit-sticky`, `optimizeSpeed`), поэтому сверка — без регистра
  // и дефисов.
  for (abbr in abbreviations) {
    short[squashWord((abbreviations as Record<string, string>)[abbr])] = abbr;
  }
  const seen: Record<string, 1> = {};
  let canon: string;
  let key: string;
  // Слово с краткой записью предлагается краткой (D-094): `apN (none)`, а не `apNone`. Алиас, который пишет то же
  // слово иначе (`optimizespeed` → `optimizeSpeed`), даёт одну строку, а не две.
  for (const word of Object.keys(words)) {
    canon = words[word] === 1 ? word : words[word] as string;
    key = squashWord(canon);
    key === squashWord(word) && !seen[key] && (seen[key] = 1, items.push((abbr = short[key])
      ? essenceName + abbr + HINT_OPEN + canon + CLOSE_PAREN : essenceName + notationWord(canon)));
  }
  return availableHint(items);
}

/**
 * Полное слово, у которого есть краткая запись (D-094), бракуется с подсказкой: `fxNone` → «Write it shorter: "fxN"». Иное
 * значение возвращается как есть.
 */
export function assertNotLongForm(
  value: string, abbreviations: Record<string, string>, essenceName: string, raw: string,
): string {
  let abbr: string;
  for (abbr in abbreviations) {
    abbreviations[abbr] === value && throwInvalid(MSG_WRITE_SHORTER + essenceName + abbr + MSG_INSTEAD_OF + essenceName
      + raw + MSG_SAME_VALUE);
  }
  return value;
}

/**
 * Суффикс с буквой на месте полного слова — для подсказки (D-113): `1_Auto` → `1_A`, `_1_auto` → `1_A`. Ведущий `_`
 * сырого режима снимается: буквы пишутся без него. Заменяется первая часть, записанная этим словом.
 */
export function shorterSuffix(
  suffix: string, written: string, abbr: string,
): string {
  const parts = suffix.split(UNDERSCORE);
  const l = parts.length;
  let i = 0;
  for (; i < l; i++) {
    if (parts[i] === written) {
      parts[i] = abbr;
      break;
    }
  }
  const out = parts.join(UNDERSCORE);
  return out[0] === UNDERSCORE ? out.slice(1) : out;
}

/**
 * Значение вида `-слово` (`-bold`, `-only`, `-red-500`, `-caption`): в записи minotation таких
 * нет (проверено 2026-09-27: `--v`, `w-5`, `w10-5`, `_a-b`, `From-font` под него не подходят),
 * а у классов других систем — сплошь (`fw-bold` — Bootstrap, `sr-only` — Bootstrap/Tailwind).
 */
const REGEXP_SUSPECT_VALUE = /^-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function throwSuspect(p: MnEssenceParams): never {
  throw new MnParseError(DOUBLE_QUOTE + p.name + p.suffix + MSG_COLON_QUOTE + p.suffix + '" is not a value of "' + p.name
    + '" — this looks like a class of another CSS framework, it gives no CSS', {
    token: p.name + p.suffix,
    handler: p.name,
    arg: p.suffix,
    warningType: 'suspect-class',
  });
}

/**
 * Хендлеры пресета сами распознают класс другой системы (D-065, D-066): значение `-слово`
 * не разбирается, а даёт отчёт `suspect-class` (`suspectClassMode`). Одна проверка на все
 * хендлеры пресета — при регистрации, а не в каждом: раньше 25 из них такие значения
 * принимали и давали неверный CSS (`fw-bold` → `font-weight:100`). Паттерн разбора
 * (`mn(name, handler, pattern)`) оборачивается здесь же, чтобы проверка шла раньше него.
 */
/** Подсказка в ошибке хендлера: значение подходит другому свойству (D-094). */
type CrossHint = [test: (suffix: string) => boolean, tag: string, property: string];

/**
 * Частые промахи по имени (замер угадываемости, D-094): угаданное имя занято другим свойством, и для него значение
 * неверно — к ошибке добавляется «did you mean». Проверка значения — до вызова хендлера, дешёвая; сам хендлер
 * вызывается как всегда.
 */
const CROSS_HINTS: Record<string, CrossHint[]> = {
  fs: [
    [
      startsWithDigit,
      'f',
      'font-size',
    ],
  ],
  td: [
    [
      (suffix) => suffix[suffix.length - 1] === S && startsWithDigit(suffix),
      'dn',
      'transition-duration',
    ],
  ],
  // `pe10`, `bs1` — привычка Tailwind (A2): эти стороны названы `pie`, `bisw` (K3, D-103, D-117).
  pe: [
    [
      startsWithDigit,
      'pie',
      'padding-inline-end',
    ],
  ],
  bs: [
    [
      (suffix) => !!BOX_SIZING_WORDS[suffix],
      'bxz',
      'box-sizing',
    ],
    [
      startsWithDigit,
      'bisw',
      'border-inline-start-width',
    ],
  ],
  c: [
    [
      (suffix) => !!CURSOR_WORDS[suffix],
      'cr',
      'cursor',
    ],
  ],
  p: [
    [
      (suffix) => !!POSITION_WORDS[suffix],
      POS,
      'position',
    ],
  ],
  f: [
    [
      (suffix) => !!FLOAT_WORDS[suffix],
      'fl',
      'float',
    ],
  ],
};

/** Значение начинается с цифры (`10`, `1px`). */
function startsWithDigit(suffix: string): boolean {
  return suffix[0] >= ZERO && suffix[0] <= '9';
}

/** Первая подсказка, чьё условие подходит значению; `undefined` — подсказки нет. */
function findCrossHint(hints: CrossHint[], suffix: string): CrossHint | undefined {
  const l = hints.length;
  let i = 0;
  for (; i < l; i++) {
    if (hints[i][0](suffix)) {
      return hints[i];
    }
  }
  return undefined;
}

/** Вызов хендлера; его ошибка разбора получает подсказку `did you mean "flL" (float)?`. */
function withCrossHint(
  handler: MnHandler, p: MnEssenceParams, hint: CrossHint,
): ReturnType<MnHandler> {
  try {
    return handler(p);
  } catch (ex) {
    // Эти хендлеры бракуют только разбором (`throwInvalid`, `throwSuspect`) — ошибка всегда `MnParseError`.
    throw new MnParseError((ex as MnParseError).message + ' — did you mean "' + hint[1] + p.suffix + '" ('
      + hint[2] + ')?', (ex as MnParseError).context);
  }
}

export function withSuspectCheck(instance: MnInstance): MnInstance {
  const guard = (handler: MnHandler, name: string): MnHandler => {
    const hints = CROSS_HINTS[name];
    const checked: MnHandler = (p) => (REGEXP_SUSPECT_VALUE.test(p.suffix) ? throwSuspect(p) : handler(p));
    return hints ? (p) => {
      const hint = findCrossHint(hints, p.suffix);
      return hint ? withCrossHint(
        checked, p, hint,
      ) : checked(p);
    } : checked;
  };
  return new Proxy(instance, {
    apply(
      target, thisArg, args: unknown[],
    ) {
      const first = args[0];
      const essence = args[1];
      const pattern = args[2] as string | string[] | undefined;
      const map: Record<string, unknown> = {};
      let name: string;
      if (typeof first === 'string') {
        return typeof essence === 'function'
          ? target(
            first, guard(pattern
              ? handlerWrap(essence as MnHandler as never, pattern) as MnHandler
              : essence as MnHandler, first) as never, '', args[3] as number,
          )
          : target(...(args as Parameters<MnInstance>));
      }
      // Форма-карта `mn({ fw: handler, cfx: { … } })`: хендлеры в ней — те же хендлеры.
      for (name in first as Record<string, unknown>) {
        map[name] = typeof (first as Record<string, unknown>)[name] === 'function'
          ? guard((first as Record<string, MnHandler>)[name], name)
          : (first as Record<string, unknown>)[name];
      }
      return target(map as never);
    },
  });
}
