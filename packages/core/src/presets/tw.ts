/**
 * Декоратор хендлера для имён Tailwind из нескольких частей (D-061): регистрация не меняется
 * (`mn('gap', tw(handler))`), хендлер находится по первым буквам, а остаток класса
 * (`gap-x-2` → `-x-2`) разбирается здесь один раз и отдаётся хендлеру готовой структурой.
 */
import {
  MnParseError,
} from '../core/types';
import type {
  MnEssenceParams, MnEssenceRaw,
} from '../core/types';

/** Разобранный остаток класса для хендлера в {@link tw}. */
export interface MnTwArgs {
  /** Части до произвольного значения: `gap-x-2` → `['x', '2']`, `bg-blue-500` → `['blue', '500']`. */
  parts: string[];
  /**
   * Произвольное значение: `w-[37px]` → `37px` (`_` — пробел, `\_` — подчёркивание),
   * `fill-(--brand)` → `var(--brand)`.
   */
  arbitrary?: string;
  /** Тип перед произвольным значением: `text-[length:1rem]` → `length` (значение — `1rem`). */
  type?: string;
  /** После `/` вне скобок: `bg-blue-500/50` → `50`, `w-1/2` → `2`. */
  modifier?: string;
  /** Класс с ведущим `-` (`-translate-x-2`): только при `negative: true`. */
  negative: boolean;
}

/** Хендлер под {@link tw}: ничего не вернул — класс чужой, без предупреждения. */
export type MnTwHandler = (args: MnTwArgs, p: MnEssenceParams) => MnEssenceRaw | void | 0;

/** Опции {@link tw}. */
export interface MnTwOptions {
  /** Принимать ли ведущий `-` (`-mt-4`, `-translate-x-2`), D-059. */
  negative?: boolean;
}

/** `[тип:значение]`: тип — слово перед двоеточием. */
const REGEXP_ARBITRARY_TYPE = /^([a-z-]+):(.+)$/;

/** `_` — пробел, `\_` — само подчёркивание. */
const REGEXP_ARBITRARY_SPACE = /\\_|_/g;

/** Хендлер, обёрнутый в {@link tw}: флаги для ядра. */
export type MnTwWrapped = ((p: MnEssenceParams) => MnEssenceRaw | void | 0) & {
  kebab: number;
  negative?: number;
};

/**
 * Разбирает остаток класса после имени хендлера: части через `-`, произвольное значение в
 * `[…]` или `(…)`, модификатор после `/`.
 *
 * @param suffix — остаток после имени: `-x-2`, `-blue-500/50`, `-[37px]`, `''`
 * @param negative — был ли ведущий `-`
 * @returns структура для хендлера или `undefined`, если остаток не в форме Tailwind
 */
export function parseTwSuffix(suffix: string, negative: boolean): MnTwArgs | undefined {
  const args: MnTwArgs = {
    parts: [],
    negative,
  };
  if (!suffix) {
    return args;
  }
  if (suffix[0] !== '-') {
    return undefined;
  }
  const l = suffix.length;
  let depth = 0;
  let slash = -1;
  let open = -1;
  let i = 1;
  let ch: string;
  for (; i < l; i++) {
    ch = suffix[i];
    if (ch === '[' || ch === '(') {
      depth++ || open < 0 && suffix[i - 1] === '-' && (open = i);
    } else if (ch === ']' || ch === ')') {
      depth--;
    } else if (ch === '/' && !depth) {
      slash = i;
    }
  }
  const body = slash < 0 ? suffix.slice(1) : suffix.slice(1, slash);
  slash < 0 || (args.modifier = suffix.slice(slash + 1));
  if (depth || !body || slash > -1 && !args.modifier) {
    return undefined;
  }
  if (open < 0) {
    args.parts = body.split('-');
    return args.parts.indexOf('') < 0 ? args : undefined;
  }
  const head = suffix.slice(1, open - 1);
  const close = slash < 0 ? l - 1 : slash - 1;
  const bracket = suffix[open];
  if (suffix[close] !== (bracket === '[' ? ']' : ')') || close - open < 2) {
    return undefined;
  }
  args.parts = head ? head.split('-') : [];
  let value = suffix.slice(open + 1, close).replace(REGEXP_ARBITRARY_SPACE, (match) => (match === '_' ? ' ' : '_'));
  const typed = REGEXP_ARBITRARY_TYPE.exec(value);
  typed && (args.type = typed[1], value = typed[2]);
  args.arbitrary = bracket === '(' ? 'var(' + value + ')' : value;
  return args.parts.indexOf('') < 0 ? args : undefined;
}

/**
 * Оборачивает хендлер для записи Tailwind (D-061): разбор остатка — здесь, хендлеру —
 * готовая структура {@link MnTwArgs}. Хендлер ничего не вернул или остаток не в форме
 * Tailwind — класс чужой, без предупреждения (как в Tailwind). Ошибка разбора значения
 * (`throw` из хендлера) — предупреждение, как у любого хендлера.
 *
 * @param handler — хендлер, получающий разобранный остаток
 * @param options — `negative: true` — принимать ведущий `-`
 * @returns хендлер для `mn(name, …)`
 * @example
 * mn('gap', tw(({ parts, arbitrary }) => {
 *   const property = parts[0] === 'x' ? 'columnGap' : parts[0] === 'y' ? 'rowGap' : 'gap';
 *   const step = property === 'gap' ? parts[0] : parts[1];
 *   const value = arbitrary || (step && step * 0.25 + 'rem');
 *   return value ? { style: { [property]: value } } : undefined;
 * }));
 * // gap-2 → gap:.5rem; gap-x-4 → column-gap:1rem; gap-y-[3px] → row-gap:3px; gap-foo → чужой класс
 */
export function tw(handler: MnTwHandler, options?: MnTwOptions): MnTwWrapped {
  const wrapped = ((p: MnEssenceParams) => {
    const args = parseTwSuffix(p.suffix, p.sign === '-');
    const result = args && handler(args, p);
    return result || foreign(p);
  }) as MnTwWrapped;
  wrapped.kebab = 1;
  options && options.negative && (wrapped.negative = 1);
  return wrapped;
}

/** Чужой класс: без CSS и без предупреждения. */
export function foreign(p: MnEssenceParams): never {
  throw new MnParseError('', {
    token: p.name + p.suffix,
    handler: p.name,
    arg: p.suffix,
    silent: true,
  });
}
