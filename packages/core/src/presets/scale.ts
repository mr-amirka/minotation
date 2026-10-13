/**
 * Общая основа шкал отступов и размеров для пресетов-клонов (D-059): одним вызовом —
 * все сочетания «свойство × сторона» по таблице. Tailwind (`mt-4` = 1rem), Bootstrap
 * (`mt-3` = 1rem), Vuetify (`ma-2` = 8px), Primer — шкала и имена задаются пресетом.
 *
 * Холодный путь: вызывается из `setup` пресета один раз.
 */
import type {
  MnInstance,
} from '../types';
import {
  MnParseError,
} from '../core/types';
import type {
  MnEssenceParams,
} from '../core/types';
import {
  checkOptions, isBoolean, isObject, isString,
} from '../checkOptions';
import type {
  OptionCheck,
} from '../checkOptions';
import {
  foreign,
} from './tw';
import type {
  MnTwWrapped,
} from './tw';
import {
  REGEXP_FOREIGN_KEBAB,
} from '../core/utils';

/** Опции {@link defineScale}. */
export interface MnScaleOptions {
  /** Имя → свойство CSS: `{ m: 'margin', p: 'padding' }`. */
  properties: Record<string, string>;
  /**
   * Имя стороны → стороны свойства: `{ t: ['top'], x: ['left', 'right'] }`. Пустое имя —
   * свойство целиком (`m-4` → `margin`). По умолчанию — только `{ '': [''] }`.
   */
  sides?: Record<string, string[]>;
  /** Между именем и шагом: `'-'` (`mt-4`, по умолчанию) или `''` (`mt4`, Basscss). */
  separator?: string;
  /**
   * Шкала: функция числового шага (`(step) => step * 0.25 + 'rem'`) или карта шагов
   * (`{ 0: '0', 1: '.25rem', … }`). Шаг вне карты — предупреждение со списком шагов.
   */
  scale: ((step: number) => string) | Record<string, string>;
  /** Слова — статикой: `{ auto: 'auto', px: '1px' }` → `mx-auto`, `mt-px`. */
  keywords?: Record<string, string>;
  /** Отрицательные значения с ведущим `-`: `-mt-4` → `margin-top:-1rem` (D-059). */
  negative?: boolean;
  /** Произвольное значение в скобках, как в Tailwind: `mt-[37px]` (`_` — пробел). */
  arbitrary?: boolean;
}

const isScale: OptionCheck = (value) => (
  typeof value === 'function' || isObject(
    value, '', '',
  ) === undefined
    && Object.keys(value as object).every((key) => typeof (value as Record<string, unknown>)[key] === 'string')
    ? undefined : 'a function (step) => value or an object of strings'
);

const isStringMap: OptionCheck = (value) => (
  isObject(
    value, '', '',
  ) === undefined
    && Object.keys(value as object).every((key) => typeof (value as Record<string, unknown>)[key] === 'string')
    ? undefined : 'an object of strings'
);

const isSidesMap: OptionCheck = (value) => (
  isObject(
    value, '', '',
  ) === undefined && Object.keys(value as object).every((key) => {
    const sides = (value as Record<string, unknown>)[key];
    return Array.isArray(sides) && sides.length > 0 && sides.every((side) => typeof side === 'string');
  }) ? undefined : 'an object of non-empty string arrays: { t: [\'top\'], x: [\'left\', \'right\'] }'
);

const SCALE_SCHEMA = {
  properties: isStringMap,
  sides: isSidesMap,
  separator: isString,
  scale: isScale,
  keywords: isStringMap,
  negative: isBoolean,
  arbitrary: isBoolean,
};

/** Шаг-слово: такой класс, не найденный среди статики, — чужой. */
const REGEXP_WORD = /^[a-z]/i;

/** Числовой шаг: `4`, `2.5`. */
const REGEXP_STEP = /^\d+(?:\.\d+)?$/;

/** Значение начинается с числа — минус ставится прямо перед ним. */
const REGEXP_LEADING_NUMBER = /^[\d.]/;

/** Значение, у которого есть отрицание: число или функция CSS. */
const REGEXP_NEGATABLE = /^[\d.]|\(/;

/** `_` — пробел в произвольном значении, `\_` — само подчёркивание. */
const REGEXP_ARBITRARY_SPACE = /\\_|_/g;

/** `margin-top` → `marginTop`. */
function camel(property: string): string {
  return property.replace(/-([a-z])/g, (match, letter: string) => letter.toUpperCase());
}

/** Отрицание значения: `1rem` → `-1rem`, `0` → `0`, `var(--x)` → `calc(var(--x) * -1)`. */
function negate(value: string): string {
  return value === '0' ? value : REGEXP_LEADING_NUMBER.test(value) ? '-' + value : 'calc(' + value + ' * -1)';
}

function required(option: string): never {
  throw new Error('[minotation] defineScale: option "' + option + '" is required');
}

function fail(
  name: string, suffix: string, message: string,
): never {
  throw new MnParseError('"' + name + suffix + '": ' + message, {
    token: name + suffix,
    handler: name,
    arg: suffix,
  });
}

/**
 * Регистрирует шкалу отступов или размеров: хендлер на каждое сочетание «свойство ×
 * сторона» (`mt`, `px`, …) и статику на каждое слово (`mx-auto`). Опции проверяются:
 * неизвестный ключ — ошибка с подсказкой.
 *
 * @param mn — экземпляр из `setup` пресета
 * @param options — таблица имён, шкала и слова
 * @returns mn (чейнинг)
 * @example
 * defineScale(mn, {
 *   properties: { m: 'margin', p: 'padding' },
 *   sides: { '': [''], t: ['top'], x: ['left', 'right'] },
 *   scale: (step) => step * 0.25 + 'rem',
 *   keywords: { auto: 'auto' },
 *   negative: true,
 * });
 * // mt-4 → margin-top:1rem; -mx-2 → margin-left:-.5rem;margin-right:-.5rem; mx-auto → auto
 */
export function defineScale(mn: MnInstance, options: MnScaleOptions): MnInstance {
  checkOptions(
    options, SCALE_SCHEMA, 'defineScale',
  );
  options && options.properties || required('properties');
  options.scale || required('scale');
  const sides = options.sides || {
    '': [''],
  };
  const separator = options.separator === undefined ? '-' : options.separator;
  // Шаги карты — тоже статикой: буквенный шаг (`pt-v`, `q-pa-md`) ядро сочло бы чужим
  // kebab-классом, и до хендлера он не дошёл бы. Хендлер ловит числовой шаг вне карты.
  const keywords: Record<string, string> = typeof options.scale === 'function'
    ? options.keywords || {}
    : {
      ...options.scale,
      ...options.keywords,
    };
  let key: string;
  let side: string;
  let word: string;
  let name: string;
  let properties: string[];
  for (key in options.properties) { // eslint-disable-line
    for (side in sides) { // eslint-disable-line
      name = key + side;
      properties = sides[side].map((part) => camel(options.properties[key] + (part ? '-' + part : '')));
      // Статика важнее хендлера; хендлер — для числовых шагов, `-[…]` и шага с `!important`.
      register(
        mn, name, scaleHandler(
          name, properties, separator, options,
        ),
      );
      for (word in keywords) { // eslint-disable-line
        mn(name + separator + word, {
          style: styleOf(properties, keywords[word]),
        } as never);
        // `-mt-px` — слово с минусом: число или функция (`var(--gap)`); `auto` не отрицается.
        options.negative && REGEXP_NEGATABLE.test(keywords[word]) && mn('-' + name + separator + word, {
          style: styleOf(properties, negate(keywords[word])),
        } as never);
      }
    }
  }
  return mn;
}

/** Хендлер шкалы: флаг `negative` — для ядра. */
type ScaleHandler = ((p: MnEssenceParams) => { style: Record<string, string> }) & { negative?: number };

/** Хендлер-диспетчер первой части имени (`min` для `min-w`, `min-h`), D-061. */
type Dispatcher = MnTwWrapped & {
  table: Record<string, ScaleHandler>;
  fallback?: ScaleHandler;
};

/**
 * Регистрирует хендлер шкалы. Имя с дефисом (`min-w`, `gap-x`) ядро не найдёт — хендлер
 * ищется по первым буквам (D-061): под первой частью (`min`) — диспетчер, он выбирает
 * самую длинную подходящую вторую часть. Простое имя при уже заведённом диспетчере —
 * его запасной хендлер (`gap` рядом с `gap-x`).
 */
function register(
  mn: MnInstance, name: string, handler: ScaleHandler,
): void {
  const at = name.indexOf('-');
  const head = at < 0 ? name : name.slice(0, at);
  // `handlerMap` у экземпляра есть всегда (ядро заводит его при создании).
  const existing = (mn as unknown as { handlerMap: Record<string, Dispatcher> }).handlerMap[head];
  let dispatcher = existing && existing.table ? existing : undefined;
  if (at < 0 && !dispatcher) {
    mn(
      name, handler as never, '', 1,
    );
    return;
  }
  if (!dispatcher) {
    dispatcher = dispatcherOf(existing as ScaleHandler | undefined);
    mn(
      head, dispatcher as never, '', 1,
    );
  }
  at < 0 ? (dispatcher.fallback = handler) : (dispatcher.table[name.slice(at + 1)] = handler);
  handler.negative && (dispatcher.negative = 1);
}

function dispatcherOf(fallback: ScaleHandler | undefined): Dispatcher {
  const dispatcher = ((p: MnEssenceParams) => {
    const suffix = p.suffix;
    const table = dispatcher.table;
    let best = '';
    let tail: string;
    for (tail in table) { // eslint-disable-line
      tail.length > best.length && suffix.slice(1, tail.length + 1) === tail && suffix[0] === '-'
        && (suffix.length === tail.length + 1 || suffix[tail.length + 1] === '-') && (best = tail);
    }
    const handler = best ? table[best] : dispatcher.fallback;
    const rest = best ? suffix.slice(best.length + 1) : suffix;
    // Запасной хендлер видит то же, что видел бы без диспетчера: kebab-остаток и чужой минус — чужой класс.
    return handler && (!p.sign || handler.negative) && (best || !REGEXP_FOREIGN_KEBAB.test(rest))
      ? handler({
        ...p,
        suffix: rest,
      })
      : foreign(p);
  }) as Dispatcher;
  dispatcher.table = {};
  dispatcher.kebab = 1;
  dispatcher.fallback = fallback;
  return dispatcher;
}

function styleOf(properties: string[], value: string): Record<string, string> {
  const style: Record<string, string> = {};
  for (const property of properties) {
    style[property] = value;
  }
  return style;
}

function scaleHandler(
  name: string, properties: string[], separator: string, options: MnScaleOptions,
): ScaleHandler {
  const scale = options.scale;
  const steps = typeof scale === 'function' ? '' : Object.keys(scale).join(', ');
  const handler = (p: MnEssenceParams): { style: Record<string, string> } => {
    const suffix = p.suffix;
    const step = suffix.slice(separator.length);
    let value: string | undefined;
    suffix.slice(0, separator.length) === separator && step || fail(
      name, suffix, 'expects a step of the scale',
    );
    // Слово вне слов и карты (`min-w-foo`) — чужой класс, молча; кривое число — предупреждение.
    REGEXP_WORD.test(step) && foreign(p);
    if (options.arbitrary && step[0] === '[' && step[step.length - 1] === ']' && step.length > 2) {
      value = step.slice(1, -1).replace(REGEXP_ARBITRARY_SPACE, (match) => (match === '_' ? ' ' : '_'));
    } else if (typeof scale === 'function') {
      value = REGEXP_STEP.test(step) ? scale(parseFloat(step)) : fail(
        name, suffix, 'step "' + step + '" is not a number',
      );
    } else {
      // Шаги карты — статика (в том числе с `!important`): сюда доходит только шаг вне карты.
      value = fail(
        name, suffix, 'step "' + step + '" is not in the scale (' + steps + ')',
      );
    }
    return {
      style: styleOf(properties, p.sign === '-' ? negate(value) : value),
    };
  };
  options.negative && ((handler as { negative?: number }).negative = 1);
  return handler;
}
