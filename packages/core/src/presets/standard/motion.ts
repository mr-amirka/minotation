import type {
  StandardContext,
} from './context';
import type {
  MnEssenceParams,
} from '../../core/types';
import {
  A,
  ALL,
  ANGLE_UNITS,
  AUTO,
  AXIS_X,
  AXIS_Y,
  CLOSE_PAREN,
  COMMA,
  DASH,
  DEG,
  DOUBLE_QUOTE,
  LIST_SEPARATOR,
  N,
  NAME_BORDER_BOX,
  NAME_CONTENT_BOX,
  NAME_FILL_BOX,
  NAME_HIDDEN,
  NAME_NORMAL,
  NAME_STROKE_BOX,
  NAME_VIEW_BOX,
  NAME_VISIBLE,
  NONE,
  NONE_ABBREVIATIONS,
  OPEN_PAREN,
  PX,
  R,
  SEMICOLON,
  SPACE,
  TIMING_FUNCTION_SYNONYMS,
  UNDERSCORE,
  ZERO,
  wordsSet,
} from './words';
import {
  MSG_COLON,
  MSG_INSTEAD_OF,
  MSG_IS_INVALID_FOR,
  MSG_VALUE,
  assertNotLongForm,
  throwInvalid,
} from './messages';
import type {
  SingleValues,
} from './functions';
import {
  REGEXP_BARE_NUMBER,
  REGEXP_WRITTEN_SUBSTITUTION,
  cssVarValue,
  functionSet,
  functionsValue,
  substitutionMessage,
  throwParen,
} from './functions';
import {
  PATTERN_DIGITS,
  REGEXP_SUBSTITUTION,
  floatNormalize,
  normalizeDefault,
  splitTopLevel,
  styleWrap,
} from './context';

const MS = 'ms';
/**
 * Хвост `r{x|y|z}{число}{единица?}` в суффиксе `x`-хендлера.
 *
 * Единицу угла здесь нельзя брать из `p.unit`: у составного суффикса это поле
 * заполняет ещё и generic-разбор ядра, и у `x10y20rz45` (единица не написана)
 * туда попадал `y` от `y20`, давая `rotateZ(45y)`. Поворот — последняя часть
 * собственного паттерна хендлера, поэтому его хвост однозначно ловится с конца
 * строки.
 */
const REGEXP_ANGLE_TAIL = /[rR][xyz][-+]?[0-9.]+([a-z]*)$/;
/**
 * Позиции шага `steps()` буквами: `ttfSteps4_JE` → `steps(4,jump-end)`. `start` и `end` — то же, что
 * `jump-start` и `jump-end`, поэтому своих букв не получают: одна запись на значение.
 */
const STEP_POSITIONS: Record<string, string> = {
  JS: 'jump-start',
  JE: 'jump-end',
  JN: 'jump-none',
  JB: 'jump-both',
};
const REGEXP_STEP_POSITION = /^J[SENB]$/;
/** Число шагов — целое от 1. */
const REGEXP_STEP_COUNT = /^[1-9]\d*$/;
/**
 * Функции плавности в нативной форме — у `ttf`, `atf` и в слоте плавности `tn`/`an`: `ttfSteps4_JE` →
 * `steps(4,jump-end)`, `ttfCubicBezier0.4_0_0.2_1` → `cubic-bezier(0.4,0,0.2,1)`. Слова плавности — буквами
 * ({@link TIMING_FUNCTION_SYNONYMS}); у `linear(…)` с точками короткой записи нет — она пишется переменной.
 */
const EASING_FUNCTIONS = functionSet(
  {
    Steps: {
      css: 'steps',
      min: 1,
      max: 2,
      example: 'Steps4_JE',
      more: REGEXP_STEP_POSITION,
      args: (args, call) => {
        const count = cssVarValue(args[0]) || (REGEXP_STEP_COUNT.test(args[0]) ? args[0]
          : call.fail('a whole number of steps from 1'));
        if (args.length < 2) {
          return count;
        }
        const position = STEP_POSITIONS[args[1]] || call.fail('a step position: JS (jump-start), JE (jump-end),'
        + ' JN (jump-none) or JB (jump-both)');
        // `steps(1, jump-none)` невалиден: без прыжков на концах один шаг — ни одного перехода.
        (+count !== 1 || args[1] !== 'JN') || call.fail('two steps or more with JN (jump-none)');
        return count + COMMA + position;
      },
    },
    CubicBezier: {
      css: 'cubic-bezier',
      min: 4,
      max: 4,
      example: 'CubicBezier0.4_0_0.2_1',
      args: (args, call) => {
        const out: string[] = new Array(4);
        let i = 0;
        let v: string;
        for (; i < 4; i++) {
          v = args[i];
          // x1 и x2 — время, от 0 до 1; y — любое число (выход за 0…1 — «отскок»).
          out[i] = cssVarValue(v) || (REGEXP_BARE_NUMBER.test(v) && (i % 2 || (+v >= 0 && +v <= 1)) ? v
            : call.fail(i % 2 ? 'four numbers' : 'x1 and x2 from 0 to 1'));
        }
        return out.join(COMMA);
      },
    },
  }, 'an easing function', 1,
);
/**
 * Функция плавности в части слота `tn`/`an`: после кебаба `cubic-bezier0.4`, `steps4`, в сыром режиме —
 * как написана (`CubicBezier0.4`).
 */
const REGEXP_EASING_PART = /^(cubic-bezier|steps|CubicBezier|Steps)(.*)$/;
/** Буквы после кебаба: `j-e` (из `JE`). */
const REGEXP_KEBAB_LETTERS = /^[a-z](?:-[a-z])+$/;
/**
 * Слоты `transition` в фиксированном порядке:
 * `свойство длительность плавность задержка`.
 *
 * Грамматика CSS порядок не фиксирует — `<single-transition>` это набор `||`,
 * и `all 0.2s` с `0.2s all` равноправны. Нотация фиксирует один: так проверка
 * становится однозначной, ошибка называется словами («в позиции 2 ожидается
 * длительность»), и не плодится зоопарк записей одного и того же. Тот же
 * размен в пользу единообразия, что снял общий `ol`.
 *
 * Проверки не было вовсе: `tn200` давало `transition:200` (число без единицы),
 * `tnAll` — `transition:all` без длительности, `tn10zz` — `transition:10zz`.
 */
/** Время: число с `s`/`ms`, либо голое число — оно получает `ms`, как у `dn`. */
const REGEXP_TIME = /^[0-9]*\.?[0-9]+(m?s)?$/;
/**
 * Имя CSS-свойства у `tn`: `all`, `none` или несколько имён через `;` — сокращение `tn` для общих параметров.
 *
 * Список свойств CSS открыт, поэтому проверяется форма, а не словарь. `;` здесь
 * разделитель списка, а не терминатор имени переменной: имя переменной
 * начинается с `--`, и до этой проверки оно уже развёрнуто в `var(…)`. Имя — от
 * двух знаков: свойства из одной буквы в CSS нет, а `tnA_200` давало
 * `transition:a 200ms`; теперь `A` — буква `all` ({@link TRANSITION_LETTERS}).
 */
const REGEXP_PROPERTY_LIST = /^-?[a-z][a-z0-9-]+(?:;-?[a-z][a-z0-9-]+)*;?$/;
/**
 * Буквы у `tn`: плавность — те же, что у `ttf`/`atf` ({@link TIMING_FUNCTION_SYNONYMS}), `A` — `all` в слоте
 * свойства, как у `tp`. Слот: 1 — свойство, 3 — плавность. Ключ — в обеих формах части: как написана (сырой режим
 * `tn_opacity_200_EI`) и после кебаба (`tnOpacity_200_EI` → `e-i`, `tnA_200` → `a`). Одна буква или буквы через
 * дефис другим не бывают: имя свойства — от двух знаков, буквы в нём не разделены дефисами.
 */
const TRANSITION_LETTERS: Record<string, [slot: number, value: string]> = {};
/** Длинное слово → его буква: `tn_opacity_200_ease-in` отвечает «пиши "EI"». */
const TRANSITION_LONG_WORDS: Record<string, string> = {};
/**
 * Буквы части слота — как в токене: кебаб превратил `JE` в `j-e`.
 * @param part часть слота
 * @returns буквы заглавными, прочее — как есть
 */
function slotLetters(part: string): string {
  return REGEXP_KEBAB_LETTERS.test(part) ? part.split(DASH).join('').toUpperCase() : part;
}
/**
 * Функция плавности в слотах `tn`/`an`: `tn_color_0.2s_CubicBezier0.4_0_0.2_1`. Берёт ровно `min` частей и
 * сверх них — те, что подходят под `more` (`Steps4_JE`, а `100` после него — уже задержка), и читает их общим
 * читателем {@link functionsValue}.
 * @param parts части одного перехода или анимации
 * @param i номер части, которая, может быть, начинает функцию
 * @param name имя хендлера — для сообщения
 * @returns `[CSS, номер последней взятой части]`, или `undefined` — часть не функция плавности
 * @example easingInSlot(['color', '0.2s', 'steps4', 'j-e'], 2, 'tn') // ['steps(4,jump-end)', 3]
 */
function easingInSlot(
  parts: string[], i: number, name: string,
): [css: string, last: number] | undefined {
  const m = REGEXP_EASING_PART.exec(parts[i]);
  if (!m) {
    return;
  }
  const key = m[1] === 'steps' ? 'Steps' : m[1] === 'cubic-bezier' ? 'CubicBezier' : m[1];
  const form = EASING_FUNCTIONS.forms[key];
  const more = form.more;
  const l = parts.length;
  const args: string[] = m[2] ? [m[2]] : [];
  let j = i + 1;
  let part: string;
  for (; args.length < form.min && j < l; j++) {
    args.push(slotLetters(parts[j]));
  }
  for (; args.length < form.max && j < l && more && more.test(part = slotLetters(parts[j])); j++) {
    args.push(part);
  }
  return [
    functionsValue(
      {
        name,
        // Части — как написаны: `Steps_4` бракуется читателем с записью `Steps4`.
        suffix: key + (m[2] || !args.length ? '' : UNDERSCORE) + args.join(UNDERSCORE),
      } as MnEssenceParams, EASING_FUNCTIONS, false, true,
    ),
    j - 1,
  ];
}
function addTransitionLetter(
  letters: string, slot: number, value: string,
): void {
  TRANSITION_LETTERS[letters] = TRANSITION_LETTERS[letters.toLowerCase().split('').join(DASH)] = [
    slot,
    value,
  ];
  TRANSITION_LONG_WORDS[value] = letters;
}
addTransitionLetter(
  A, 1, ALL,
);
/** Заглавная не в начале слова: перед ней — дефис. */
const REGEXP_INNER_CAPITAL = /(?!^)[A-Z]/g;
for (const letters in TIMING_FUNCTION_SYNONYMS) {
  // `EaseIn` → `ease-in`: слова таблицы — CamelCase без цифр.
  addTransitionLetter(
    letters, 3, TIMING_FUNCTION_SYNONYMS[letters].replace(REGEXP_INNER_CAPITAL, '-$&').toLowerCase(),
  );
}
/** Одно имя CSS-свойства — от двух знаков, как в {@link REGEXP_PROPERTY_LIST}. */
const REGEXP_PROPERTY_NAME = /^-?[a-z][a-z0-9-]+$/;
/** Имя `@keyframes`: идентификатор CSS. */
const REGEXP_KEYFRAMES_NAME = /^-?[a-zA-Z_][a-zA-Z0-9_-]*$/;
/** Число повторов анимации: `2`, `1.5`, `infinite`. */
const REGEXP_ITERATION_COUNT = /^(?:[0-9]*\.?[0-9]+|infinite)$/;
const ANIMATION_DIRECTIONS = wordsSet('normal reverse alternate alternate-reverse');
const ANIMATION_FILL_MODES = wordsSet('none forwards backwards both');
const ANIMATION_PLAY_STATES = wordsSet('running paused');

/**
 * Именованные анимации — четыре анимации Tailwind: значение без имени и ключевые кадры. Кадры
 * регистрируются при первом использовании имени в `an` и не перезаписывают уже заданные под этим именем
 * (`mn.setKeyframes('spin', …)` автора выигрывает). Голое имя (`anSpin`) получает ещё и длительность, плавность и
 * повторы; в форме с частями (`an_spin_2s`) значение остаётся как написано.
 */
const NAMED_ANIMATIONS: Record<string, [string, Record<string, Record<string, string>>]> = {
  spin: [
    '1s linear infinite',
    {
      to: {
        transform: 'rotate(360deg)',
      },
    },
  ],
  ping: [
    '1s cubic-bezier(0,0,.2,1) infinite',
    {
      '75%,100%': {
        transform: 'scale(2)',
        opacity: ZERO,
      },
    },
  ],
  pulse: [
    '2s cubic-bezier(.4,0,.6,1) infinite',
    {
      '50%': {
        opacity: '.5',
      },
    },
  ],
  bounce: [
    '1s infinite',
    {
      '0%,100%': {
        transform: 'translateY(-25%)',
        animationTimingFunction: 'cubic-bezier(.8,0,1,1)',
      },
      '50%': {
        transform: NONE,
        animationTimingFunction: 'cubic-bezier(0,0,.2,1)',
      },
    },
  ],
};

/** Имя свойства в списке `will-change`: идентификатор, не число и не длина. */
// От двух знаков: `wcB` давало `will-change:b`.
const REGEXP_WILL_CHANGE_ITEM = /^-?[a-z_][a-z0-9_-]+$/;
/** Слова, которых в списке `will-change` быть не может: `auto` — только целиком, остальные — никогда. */
const WILL_CHANGE_RESERVED: Record<string, 1> = wordsSet('auto none all will-change');

/** Движение: перечни свойств перехода и `will-change`. */
const MOTION_VALUES: SingleValues = {
  slots: {
    transitionProperty: transitionPropertyValue,
    willChange: willChangeValue,
  },
};
/**
 * Длина без поблажек — `perspective:500px`, но не `50%`, `-5px` или два значения. Флаг нужен, потому что `0` в
 * таблице читается как «не длина».
 */
const LENGTH_PLAIN = 8;
/**
 * Разбирает один переход по слотам и возвращает его в каноническом виде.
 *
 * Слот определяется по форме части, а порядок обязан не убывать: увидев
 * длительность, дальше нельзя вернуться к имени свойства. Голое число в слоте
 * времени получает `ms` — как у `dn`/`delay`.
 */
function transitionValue(parts: string[], raw: string): string[] {
  let l = parts.length;
  const out: string[] = [];
  let i = 0;
  let slot = 0;
  let hasDuration = 0;
  let part: string;
  let at: number;
  let time: RegExpExecArray | null;
  let names: string[] | 0 = 0;
  let letter: [number, string] | undefined;
  let easing: [string, number] | undefined;
  const prefix = MSG_VALUE + raw + '" is invalid for "tn": the order is ';
  for (; i < l; i++) {
    part = parts[i];
    if (REGEXP_SUBSTITUTION.test(part)) {
      // Подстановка годится в любой слот и порядок не сдвигает.
      out[i] = part;
      continue;
    }
    part.indexOf(OPEN_PAREN) > -1 && throwParen(
      MSG_VALUE + raw + '" is invalid for "tn": ', '', [part], EASING_FUNCTIONS,
    );
    TRANSITION_LONG_WORDS[part] && throwInvalid(MSG_VALUE + raw + '" is invalid for "tn": write it shorter — "'
      + TRANSITION_LONG_WORDS[part] + '" instead of "' + part + DOUBLE_QUOTE);
    if (letter = TRANSITION_LETTERS[part]) {
      at = letter[0];
      out[i] = letter[1];
    } else if (time = REGEXP_TIME.exec(part)) {
      // Первое время — длительность, второе — задержка. После плавности может
      // идти только задержка: место длительности — перед плавностью.
      at = hasDuration ? 4 : 2;
      at === 4 || slot < 3 || throwInvalid(prefix + 'property, duration, '
        + 'easing, delay — duration goes before easing');
      hasDuration = 1;
      out[i] = time[1] ? part : part + MS;
    } else if (easing = easingInSlot(
      parts, i, 'tn',
    )) {
      // Функция плавности — нативной формой, её части уже взяты.
      at = 3;
      out[i] = easing[0];
      parts = parts.slice(0, i + 1).concat(parts.slice(easing[1] + 1));
      l = parts.length;
    } else if (REGEXP_PROPERTY_LIST.test(part)) {
      at = 1;
      // Несколько свойств с одними параметрами — через `;`. В CSS такого
      // сокращения нет: там пришлось бы перечислять каждое свойство целым
      // блоком (`color .2s, background .2s, border-color .2s`).
      part.indexOf(SEMICOLON) > -1 && (names = part.split(SEMICOLON));
      out[i] = part;
    } else {
      return throwInvalid(prefix + 'property, duration, easing, delay; '
        + DOUBLE_QUOTE + part + '" fits none of them');
    }
    at > slot || throwInvalid(prefix + 'property, duration, easing, '
      + 'delay — "' + part + '" is out of place');
    slot = at;
  }
  if (!names) {
    return [out.join(SPACE)];
  }
  // Список свойств разворачивается в отдельный переход на каждое: остальные
  // слоты у них общие.
  const tail = out.slice(1).join(SPACE);
  const namesLength = names.length;
  const expanded: string[] = new Array(namesLength);
  for (i = 0; i < namesLength; i++) {
    names[i] || throwInvalid(prefix + 'empty property name in the list "' + out[0] + DOUBLE_QUOTE);
    expanded[i] = tail ? (names[i] + SPACE + tail) : names[i];
  }
  return expanded;
}

/**
 * Одна анимация по слотам в фиксированном порядке, как у `tn` (запрос web-games):
 * `имя длительность плавность задержка повторы направление заполнение состояние`. Любой слот
 * можно пропустить, порядок — не убывает. Голое число в слоте времени — `ms`; голое число после
 * задержки — число повторов. `none` до длительности — имя, после — заполнение.
 *
 * Плавность — буквами, как у `tn` и `atf`: `an_fade_0.2s_EO`. Буква — плавность только после имени или
 * длительности: первая часть — всегда имя (`an_e_1s` — анимация `e`: значение до кебаба одно и то же, что `anE_1s`).
 * Длинное слово (`ease-out`) — ошибка с буквой, как у `tn`.
 */
function animationValue(parts: string[], raw: string): string {
  let l = parts.length;
  const out: string[] = [];
  const prefix = MSG_VALUE + raw + '" is invalid for "an": the order is name, duration, easing, delay,'
    + ' iteration count, direction, fill mode, play state';
  let i = 0;
  let slot = 0;
  let times = 0;
  let part: string;
  let at: number;
  let time: RegExpExecArray | null;
  let letter: [number, string] | undefined;
  let easing: [string, number] | undefined;
  for (; i < l; i++) {
    part = parts[i];
    if (REGEXP_SUBSTITUTION.test(part)) {
      out[i] = part;
      continue;
    }
    part.indexOf(OPEN_PAREN) > -1 && throwParen(
      MSG_VALUE + raw + '" is invalid for "an": ', '', [part], EASING_FUNCTIONS,
    );
    (letter = TRANSITION_LETTERS[TRANSITION_LONG_WORDS[part]]) && letter[0] === 3
      && throwInvalid(MSG_VALUE + raw + '" is invalid for "an": write it shorter — "' + TRANSITION_LONG_WORDS[part]
        + MSG_INSTEAD_OF + part + DOUBLE_QUOTE + (slot ? '' : '; easing goes after the name or the duration'));
    if (slot && (letter = TRANSITION_LETTERS[part]) && letter[0] === 3) {
      at = 3;
      out[i] = letter[1];
    } else if (times < 2 && slot < 5 && (time = REGEXP_TIME.exec(part))) {
      // Первое время — длительность, второе — задержка (после плавности — только задержка).
      at = times || slot === 3 ? 4 : 2;
      times = at === 4 ? 2 : 1;
      out[i] = time[1] ? part : part + MS;
    } else if (slot && (easing = easingInSlot(
      parts, i, 'an',
    ))) {
      // Функция плавности — нативной формой, как буква: только после имени (первая часть — всегда имя).
      at = 3;
      out[i] = easing[0];
      parts = parts.slice(0, i + 1).concat(parts.slice(easing[1] + 1));
      l = parts.length;
    } else if (REGEXP_ITERATION_COUNT.test(part)) {
      at = 5;
      out[i] = part;
    } else if (ANIMATION_DIRECTIONS[part]) {
      at = 6;
      out[i] = part;
    } else if (ANIMATION_FILL_MODES[part] && (part !== NONE || slot > 1)) {
      at = 7;
      out[i] = part;
    } else if (ANIMATION_PLAY_STATES[part]) {
      at = 8;
      out[i] = part;
    } else if (REGEXP_KEYFRAMES_NAME.test(part)) {
      at = 1;
      out[i] = part;
    } else {
      return throwInvalid(prefix + '; "' + part + '" fits none of them');
    }
    at > slot || throwInvalid(prefix + ' — "' + part + '" is out of place');
    slot = at;
  }
  return out.join(SPACE);
}
/**
 * `will-change`: `auto` либо имена свойств через запятую — `wcT`, `wc_transform,opacity`. Список свойств
 * открыт, поэтому проверяется форма имени: `wc10` давало `will-change:10`, `wc10_20` — `will-change:10 20`.
 */
function willChangeValue(
  parts: string[], raw: string, essenceName: string,
): string {
  const v = parts[0];
  const items = v.split(COMMA);
  const l = items.length;
  let valid = parts.length < 2;
  let i = v === AUTO ? l : 0;
  let item: string;
  for (; valid && i < l; i++) {
    item = items[i];
    valid = item.indexOf(OPEN_PAREN) > -1 || REGEXP_WILL_CHANGE_ITEM.test(item) && !WILL_CHANGE_RESERVED[item];
  }
  valid || throwInvalid(MSG_VALUE + raw + MSG_IS_INVALID_FOR + essenceName
    + '": "A" (auto) or property names separated by commas, as "wcT" or "wc_transform,opacity"');
  return v;
}

/**
 * `transition-property`: `none` либо имена свойств через запятую, как в CSS и как было в старой версии
 * (`tp_color,opacity`). Список свойств CSS открыт, поэтому проверяется форма имени — число, длина,
 * одна буква свойством быть не могут. `;` — сокращение `tn` для общих параметров; у `tp` параметров нет, и
 * `tp_color;opacity` давало `transition-property:color;opacity` — `;` обрывал объявление в CSS.
 */
function transitionPropertyValue(parts: string[], raw: string): string {
  const items = splitTopLevel(parts[0]);
  const l = items.length;
  let valid = parts.length < 2;
  let i = 0;
  let item: string;
  for (; valid && i < l; i++) {
    item = items[i];
    // `none` — только одно: в списке CSS его не принимает.
    valid = item.indexOf(OPEN_PAREN) > -1
      || REGEXP_PROPERTY_NAME.test(item) && (l < 2 || item !== NONE);
  }
  valid || throwInvalid(MSG_VALUE + raw + '" is invalid for "tp": "A" (all), "N" (none) or CSS property names '
    + 'separated by commas, as "tp_color,opacity"');
  return parts[0];
}

/**
 * Хендлеры темы «motion».
 *
 * @param ctx — контекст пресета (`createContext`)
 */
export function registerMotion(ctx: StandardContext): void {
  const {
    forEach,
    forIn,
    indexOf,
    mn,
    positionProvider,
    registerSingleProperties,
    setKeyframes,
    synonymProvider,
    toUpper,
    valueNormalize,
  } = ctx;
  function assertAngle(
    value: string, unit: string | undefined, raw: string,
  ): string {
    REGEXP_BARE_NUMBER.test(value) || throwInvalid(MSG_VALUE + raw
    + '" is invalid: rotation is a number');
    (!unit || indexOf(ANGLE_UNITS, unit) > -1) || throwInvalid('Unit "' + unit
    + '" is invalid: rotation is measured in angle units (' + ANGLE_UNITS.join(LIST_SEPARATOR) + CLOSE_PAREN);
    return value + (unit || DEG);
  }

  forIn({
    dn: 'transitionDuration',
    delay: 'transitionDelay',
  }, (propName, essenceName) => {
    mn(essenceName, (p) => {
      let num, v;
      return p.camel || p.negative ? 0 : ((num = p.num)
        ? styleWrap({
          [propName]: num + MS,
        }, 1)
        : (v = cssVarValue(p.suffix)) ? styleWrap({
          [propName]: v,
        }, 1) : normalizeDefault(p, 250)
      );
    });
  });

  mn({
    tfo: positionProvider(
      'transformOrigin', 0, 1,
    ),
    pspo: positionProvider('perspectiveOrigin'),
    tfb: synonymProvider('transformBox', {
      CB: NAME_CONTENT_BOX,
      BB: NAME_BORDER_BOX,
      FB: NAME_FILL_BOX,
      SB: NAME_STROKE_BOX,
      VB: NAME_VIEW_BOX,
    }),
    bfv: synonymProvider('backfaceVisibility', {
      V: NAME_VISIBLE,
      H: NAME_HIDDEN,
    }),
  });

  mn({
    tnb: synonymProvider('transitionBehavior', {
      N: NAME_NORMAL,
      AD: 'AllowDiscrete',
    }),
    // Функции — нативной формой: `atfSteps4_JE`, `atfCubicBezier0.4_0_0.2_1`.
    atf: synonymProvider(
      'animationTimingFunction', TIMING_FUNCTION_SYNONYMS, undefined, undefined, undefined, undefined,
      EASING_FUNCTIONS,
    ),
    // Буквы `atf`; приоритет выше `tn`, как у прочих полных свойств перехода.
    ttf: synonymProvider(
      'transitionTimingFunction', TIMING_FUNCTION_SYNONYMS, 1, undefined, undefined, undefined, EASING_FUNCTIONS,
    ),
  });

  mn(
    'x', (p) => {
      // Суффикс не той формы молча давал `translate(0px,0px)`: `x--v`, `x_translate\(10px\)`.
      p.suffix && p.all === undefined && throwInvalid(MSG_VALUE + p.suffix + MSG_IS_INVALID_FOR
        + 'x": expected a shift, as "x10", "x10y20", "x10y20z5", with a scale "s50" and a turn "rz45" after it');
      const scale = p.s;
      const angle = p.angle;
      const z = p.z;
      return styleWrap({
        transform:
      'translate(' + (floatNormalize(p.x || ZERO) + ('' + (p.xu || PX))) + COMMA
      + (floatNormalize(p.y || ZERO) + ('' + (p.yu || PX))) + CLOSE_PAREN
      + (z ? (' translateZ('
        + floatNormalize(z) + ('' + (p.zu || PX)) + CLOSE_PAREN) : '')
      + (scale ? (' scale(' + (0.01 * floatNormalize(scale)) + CLOSE_PAREN) : '')
      + (angle ? (' rotate' + toUpper('' + p.dir)
      + OPEN_PAREN + assertAngle(
        '' + floatNormalize(angle),
        (REGEXP_ANGLE_TAIL.exec(p.suffix) as RegExpExecArray)[1],
        p.name + p.suffix,
      ) + CLOSE_PAREN) : ''),
      });
    }, '^' + PATTERN_DIGITS + ':x?(%):xu?([yY]' + PATTERN_DIGITS
  + ':y(%):yu?)?([zZ]' + PATTERN_DIGITS
  + ':z(%):zu?)?([sS]([0-9\\.]+):s)?([rR](x|y|z):dir'
  + PATTERN_DIGITS + ':angle([a-z]+):unit?)?$',
  );

  mn('spnr', (p) => {
    let v;
    // Суффикс без числа молча давал спиннер по умолчанию: `spnr_linear`, `spnrZzz` — `3000ms` (аудит).
    p.suffix && !p.value && throwInvalid(MSG_VALUE + p.suffix + MSG_IS_INVALID_FOR
      + 'spnr": expected a period in milliseconds, as "spnr2000"');
    return isNaN(v = (v = p.value) ? parseInt(v) : 3000) || v < 1 ? 0 : (
      setKeyframes(
        'spinner-animate', {
          from: {
            transform: 'rotateZ(0deg)',
          },
          to: {
            transform: 'rotateZ(360deg)',
          },
        }, 1,
      ),
      styleWrap({
        animation: 'spinner-animate ' + v + 'ms infinite linear',
      })
    );
  });

  forEach([
    AXIS_X,
    AXIS_Y,
    'z',
  ], (suffix) => {
    const prefix = 'rotate' + toUpper(suffix) + OPEN_PAREN;
    mn(R + suffix, (p) => {
      let v;
      // Переменная — угол поворота, часть `transform` (`rx--a` → `rotateX(var(--a))`).
      return (v = cssVarValue(p.suffix)) ? styleWrap({
        transform: prefix + v + CLOSE_PAREN,
      }) : (v = p.value) ? styleWrap({
        transform: prefix + assertAngle(
          v, p.unit, p.name + p.suffix,
        ) + CLOSE_PAREN,
      }) : normalizeDefault(p, 180);
    });
  });

  mn({
    /**
     * `transition` — слоты в фиксированном порядке
     * `свойство длительность плавность задержка`, несколько переходов через
     * запятую.
     *
     * Атомарные `tp`/`dn`/`ttf`/`delay` покрывают одиночный переход целиком,
     * но задать РАЗНЫЕ параметры разным свойствам ими нельзя — они пишут по
     * одному значению на все сразу. Ради этого случая shorthand и остаётся.
     */
    // `an_fade_0.2s_EO_0.3s_both` → `animation:fade 0.2s ease-out 0.3s both` (плавность — буквами);
    // ключевые кадры — из пресета (`mn.setKeyframes`). Несколько анимаций — через `,`.
    an: (p) => {
      let s, i;
      if (!(s = p.suffix)) {
        return 0;
      }
      if (s === N) {
        return styleWrap({
          animation: NONE,
        });
      }
      // Подстановка словом (`an_env\(x\)`) прошла бы частью как подстановка: у неё своя запись, `an---x`.
      REGEXP_WRITTEN_SUBSTITUTION.test(s) && throwInvalid(MSG_VALUE + s + MSG_IS_INVALID_FOR + p.name + MSG_COLON
        + substitutionMessage(p.name));
      // `anNone`, `an_none` — вторые записи `anN`.
      const list = splitTopLevel(assertNotLongForm(
        valueNormalize(s), NONE_ABBREVIATIONS, p.name, s,
      ));
      const l = list.length;
      const out: string[] = new Array(l);
      let parts: string[];
      let named: [string, Record<string, Record<string, string>>] | undefined;
      for (i = 0; i < l; i++) {
        parts = list[i].trim().split(SPACE);
        out[i] = animationValue(parts, s);
        if (named = NAMED_ANIMATIONS[parts[0]]) {
          setKeyframes(
            parts[0], named[1], 1,
          );
          parts.length < 2 && (out[i] += SPACE + named[0]);
        }
      }
      return styleWrap({
        animation: out.join(COMMA),
      });
    },
    tn: (p) => {
      let s, i;
      if (!(s = p.suffix)) {
        return 0;
      }
      // `tnN` — `transition:none`, как `tpN` и `anN`; длинная запись — с подсказкой.
      if (s === N) {
        return styleWrap({
          transition: NONE,
        });
      }
      // Подстановка словом (`tn_var\(--d\)`) — как у `an`.
      REGEXP_WRITTEN_SUBSTITUTION.test(s) && throwInvalid(MSG_VALUE + s + MSG_IS_INVALID_FOR + p.name + MSG_COLON
        + substitutionMessage(p.name));
      const value = assertNotLongForm(
        valueNormalize(s), NONE_ABBREVIATIONS, p.name, s,
      );
      // `,` разделяет переходы, пробел — части одного перехода. Запятые
      // внутри скобок (`cubic-bezier(0,0,1,1)`) разделителем не считаются.
      const list = splitTopLevel(value);
      const l = list.length;
      const out: string[] = new Array(l);
      // Переход со списком свойств разворачивается в несколько: они склеиваются той же запятой на своём месте.
      for (i = 0; i < l; i++) {
        out[i] = transitionValue(list[i].trim().split(SPACE), s).join(COMMA);
      }
      return styleWrap({
        transition: out.join(COMMA),
      });
    },
  });

  registerSingleProperties({

    tp: [
      'transitionProperty',
      1,
    ],

    ts: ['transformStyle'],
    // Группа F: `wcT` → `transform`; любое другое свойство — словом (`wcBackgroundColor`).
    wc: ['willChange'],
    // `perspective`: неотрицательная длина или `none` — `psp500`, `pspN`.
    psp: [
      'perspective',
      0,
      LENGTH_PLAIN,
      0,
      {
        none: 1,
      },
    ],
  }, MOTION_VALUES);
}
