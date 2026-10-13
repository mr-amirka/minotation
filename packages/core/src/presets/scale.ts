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
  /**
   * Отрицательные значения с ведущим `-` в записи Tailwind: `-mt-4` → `margin-top:-1rem`. Минус
   * приходит хендлеру как `p.sign` (D-064); без этой опции такой класс CSS не даёт.
   */
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
  // Шаги карты — тоже статикой: слово-шаг (`pt-v`, `q-pa-md`) — точное имя, без разбора.
  // Хендлер ловит числовой шаг вне карты, `-[…]` и отрицательные значения.
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
      // Имя с дефисом (`min-w`, `gap-x`) ядро находит само: домен `min`, префикс `-w` (D-063).
      mn(
        name, scaleHandler(
          name, properties, separator, keywords, options,
        ) as never, '', 1,
      );
      for (word in keywords) { // eslint-disable-line
        mn(name + separator + word, {
          style: styleOf(properties, keywords[word]),
        } as never);
      }
    }
  }
  return mn;
}

function styleOf(properties: string[], value: string): Record<string, string> {
  const style: Record<string, string> = {};
  for (const property of properties) {
    style[property] = value;
  }
  return style;
}

/**
 * Хендлер шкалы. Ведущий минус Tailwind приходит как `p.sign` (D-064): без `negative: true`
 * хендлер ничего не возвращает — CSS нет, без предупреждения.
 */
function scaleHandler(
  name: string, properties: string[], separator: string, keywords: Record<string, string>,
  options: MnScaleOptions,
): (p: MnEssenceParams) => { style: Record<string, string> } | undefined {
  const scale = options.scale;
  const steps = typeof scale === 'function' ? '' : Object.keys(scale).join(', ');
  return (p: MnEssenceParams) => {
    const suffix = p.suffix;
    const step = suffix.slice(separator.length);
    const negative = p.sign === '-';
    let value: string;
    if (negative && !options.negative) {
      return undefined;
    }
    suffix.slice(0, separator.length) === separator && step || fail(
      name, suffix, 'expects a step of the scale',
    );
    if (options.arbitrary && step[0] === '[' && step[step.length - 1] === ']' && step.length > 2) {
      value = step.slice(1, -1).replace(REGEXP_ARBITRARY_SPACE, (match) => (match === '_' ? ' ' : '_'));
    } else if (Object.prototype.hasOwnProperty.call(keywords, step)) {
      // Сюда слово доходит только с минусом (`-mt-px`): без минуса его берёт статика.
      value = REGEXP_NEGATABLE.test(keywords[step]) ? keywords[step] : fail(
        name, suffix, '"' + step + '" has no negative value',
      );
    } else if (typeof scale === 'function') {
      value = REGEXP_STEP.test(step) ? scale(parseFloat(step)) : fail(
        name, suffix, 'step "' + step + '" is not a number',
      );
    } else {
      value = fail(
        name, suffix, 'step "' + step + '" is not in the scale (' + steps + ')',
      );
    }
    return {
      style: styleOf(properties, negative ? negate(value) : value),
    };
  };
}
