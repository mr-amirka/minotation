/**
 * Клон Tailwind CSS 4 — подмножество (D-043, D-068): отступы, размеры, display, позиционирование,
 * flex/grid, типографика, цвета палитры с прозрачностью, рамки и скругления, брейкпоинты,
 * варианты-синонимы и метки `group`/`peer`. Значения — как в Tailwind 4: переменные темы
 * (`calc(var(--spacing) * 4)`, `var(--color-blue-500)`), тема — блоком `:root` из
 * `theme.ts` (снята с `tailwindcss@4.3.3`).
 *
 * Подключается **вместо** `presetStandard` (D-043), запись классов — режим `'tw4-compatible'`.
 * Холодный путь: только регистрация, разбор значений — в хендлерах при первой встрече класса.
 */
import type {
  MnInstance,
  MnHandler,
  MnHandlerResult,
} from '../../types';
import type {
  MnPresetObject,
} from '../../core/types';
import {
  MnParseError,
} from '../../core/types';
import {
  tw,
} from '../shared/tw';
import {
  mathSpaces,
} from '../../core/mathSpaces';
import type {
  MnTwArgs,
} from '../shared/tw';
import {
  TW4_KEYFRAMES,
  TW4_THEME,
} from './theme';
import {
  TW4_NEGATIVE_STATICS,
  TW4_PROPERTIES,
  TW4_STATICS,
} from './statics';

const ZERO = '0';
const ONE = '1';
const ZERO_PX = '0px';
const CALC_OPEN = 'calc(';
const CLOSE_PAREN = ')';
const PERCENT = '%';
const OPEN_BRACKET = '[';
const DASH = '-';
const COLOR = 'color';
const COLOR_VAR_PREFIX = '--color-';
const COLOR_MIX_OPEN = 'color-mix(in oklab, ';
const SPACE = ' ';
const COLOR_MIX_TRANSPARENT = ', transparent)';
const MARGIN = 'margin';
const AUTO = 'auto';
const ONE_PX = '1px';
const X = 'x';
const Y = 'y';
const REVERSE_SUFFIX = '-reverse';
const CLOSE_TWO_PARENS = '))';
const HUNDRED_PERCENT = '100%';
const NONE = 'none';
const BLOCK = 'block';
const TOP = 'top';
const RIGHT = 'right';
const BOTTOM = 'bottom';
const LEFT = 'left';
const Z = 'z';
const LENGTH = 'length';
const BORDER_TOP_LEFT_RADIUS = 'borderTopLeftRadius';
const BORDER_TOP_RIGHT_RADIUS = 'borderTopRightRadius';
const BORDER_BOTTOM_RIGHT_RADIUS = 'borderBottomRightRadius';
const BORDER_BOTTOM_LEFT_RADIUS = 'borderBottomLeftRadius';
const PX = 'px';
const WIDTH = 'Width';
const VAR_TW_BORDER_STYLE = 'var(--tw-border-style)';
const OPEN_PAREN = '(';
const VAR_OPEN = 'var(';
const LIST_SEPARATOR = ', ';
const DEG = 'deg';
const NORMAL = 'normal';
const ROTATE = 'rotate';
const SKEW = 'skew';
const TO = 'to';
const LINEAR = 'linear';
const CONIC = 'conic';
const VIA = 'via';
const FROM = 'from';
const OPACITY = 'opacity';
const TW_MASK_PREFIX = '--tw-mask-';
const AT = '@';

/** Число шкалы: `4`, `0.5`, `2.5`. */
const REGEXP_NUMBER = /^\d+(?:\.\d+)?$/;


/** Целое: `3`, `12`. */
const REGEXP_INTEGER = /^\d+$/;

/** Произвольное значение похоже на длину, а не на цвет: `14px`, `1.5rem`, `calc(…)`. */
const REGEXP_LENGTH = /^(?:-?[\d.]+(?:px|rem|em|%|vw|vh|svh|dvh|lvh|ch|ex|pt|cm|mm|in|q)|0|(?:calc|clamp|min|max|var)\(.*\))$/;

/** Брейкпоинты Tailwind 4 — из темы, в rem, как у Tailwind (`--breakpoint-md: 48rem`, D-069). */
const BREAKPOINTS = [
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
];


/** Правило темы (D-071): `:root` в блоке с приоритетом −3000 — раньше утилит (−2000). */
const THEME_SELECTOR = ':root@^-3000';

/**
 * Начальные значения помощников `--tw-*` — на все элементы, в том же блоке. Группа, а не запятая:
 * через запятую — независимые селекторы, и `@^-3000` достался бы только последнему.
 */
const DEFAULTS_SELECTOR = '(*|::before|::after|::backdrop)@^-3000';

/** `var(--имя)` в значении — какие переменные темы оно использует. */
const REGEXP_VAR = /var\((--[a-z0-9-]+)/g;

/** Особые цвета вне палитры. */
const SPECIAL_COLORS: Record<string, string> = {
  transparent: 'transparent',
  current: 'currentcolor',
  inherit: 'inherit',
};

/**
 * Варианты-синонимы Tailwind 4 → селектор элемента. Строки — в записи селекторов minotation:
 * скобки — группа вариантов, поэтому настоящие скобки экранируются (`\\(`), запятая —
 * альтернативы (`open` → `[open]` или `:popover-open`).
 */
const VARIANTS: Record<string, string> = {
  // Как в Tailwind 4: hover — только при устройстве с наведением (D-069).
  hover: ':hover@hover',
  focus: ':focus',
  'focus-visible': ':focus-visible',
  'focus-within': ':focus-within',
  active: ':active',
  visited: ':visited',
  target: ':target',
  disabled: ':disabled',
  enabled: ':enabled',
  checked: ':checked',
  indeterminate: ':indeterminate',
  required: ':required',
  optional: ':optional',
  invalid: ':invalid',
  valid: ':valid',
  'read-only': ':read-only',
  'placeholder-shown': ':placeholder-shown',
  autofill: ':autofill',
  open: '[open],:popover-open',
  first: ':first-child',
  last: ':last-child',
  only: ':only-child',
  odd: ':nth-child\\(odd\\)',
  even: ':nth-child\\(even\\)',
  'first-of-type': ':first-of-type',
  'last-of-type': ':last-of-type',
  'only-of-type': ':only-of-type',
  empty: ':empty',
  placeholder: '::placeholder',
  before: '::before',
  after: '::after',
  selection: '::selection',
  marker: '::marker',
  file: '::file-selector-button',
  backdrop: '::backdrop',
  'first-letter': '::first-letter',
  'first-line': '::first-line',
};

type Style = Record<string, string>;

function styleOf(properties: string[], value: string): Style {
  const style: Style = {};
  for (const property of properties) {
    style[property] = value;
  }
  return style;
}

function result(style: Style | undefined): MnHandlerResult | undefined {
  return style && {
    style,
  };
}

/** `calc(var(--spacing) * 4)` → `… * -4`; число → `-…`; иначе (и дробь) — `calc(… * -1)`, как у Tailwind 4. */
function negate(value: string): string {
  return value === ZERO_PX ? value
    : value === 'var(--spacing)' ? 'calc(var(--spacing) * -1)'
      : value.indexOf('calc(var(--spacing) * ') === 0 ? value.replace('* ', '* -')
        : CALC_OPEN + value + ' * -1)';
}

/** Отрицание через `calc(… * -1)` с пробелами вокруг операторов внутри: `-mt-[1/2]` → `calc(1 / 2 * -1)`. */
function negateCalc(value: string): string {
  return mathSpaces(CALC_OPEN + value + ' * -1)');
}

/**
 * Шаг шкалы `--spacing`, как пишет его Tailwind 4: `0` → `0px`, `1` → `var(--spacing)`, остальное —
 * `calc(var(--spacing) * n)`.
 */
function spacing(step: string): string {
  return step === ZERO ? ZERO_PX : step === ONE ? 'var(--spacing)' : 'calc(var(--spacing) * ' + step + CLOSE_PAREN;
}

/** Опции значения шкалы. */
interface ScaleOptions {
  /** Слова: `auto`, `full`, `px`, … */
  keywords?: Record<string, string>;
  /** Дроби `1/2` → `calc(1/2 * 100%)`. */
  fraction?: boolean;
  /** Принимать ведущий `-` (D-064). */
  negative?: boolean;
  /** Именованные размеры контейнера `md` → `var(--container-md)`. */
  container?: boolean;
}

/**
 * Значение шкалы Tailwind 4: число → `calc(var(--spacing) * n)`, дробь, слово, контейнер или
 * произвольное `[…]`. Не подходит — `undefined` (класс CSS не даёт).
 */
function scaleValue(args: MnTwArgs, options: ScaleOptions): string | undefined {
  const parts = args.parts;
  const step = parts[0];
  let value: string | undefined;
  if (args.negative && !options.negative) {
    return undefined;
  }
  const hasArbitrary = args.arbitrary !== undefined;
  if (hasArbitrary) {
    value = parts.length || args.modifier !== undefined ? undefined : args.arbitrary;
  } else if (parts.length !== 1) {
    value = undefined;
  } else if (args.modifier !== undefined) {
    value = options.fraction && REGEXP_INTEGER.test(step) && REGEXP_INTEGER.test(args.modifier)
      ? CALC_OPEN + step + ' / ' + args.modifier + ' * 100%)' : undefined;
  } else if (options.keywords && Object.prototype.hasOwnProperty.call(options.keywords, step)) {
    value = options.keywords[step];
  } else if (REGEXP_NUMBER.test(step)) {
    value = spacing(step);
  } else if (options.container && TW4_THEME['--container-' + step]) {
    value = 'var(--container-' + step + CLOSE_PAREN;
  }
  // Слово с минусом (`-m-auto`) сюда не доходит: его голое имя — статика из таблицы, и у Tailwind
  // отрицательной формы нет. Произвольное значение Tailwind 4 отрицает через `calc(… * -1)`, как бы
  // оно ни выглядело (`-mt-[0px]` → `calc(0px * -1)`).
  return value && args.negative ? (hasArbitrary ? negateCalc(value) : negate(value)) : value;
}

/**
 * Цвет Tailwind 4: значение и, при прозрачности, значение для `@supports` (как у Tailwind):
 * - цвет темы `bg-blue-500/50` — запасной `color-mix(in srgb, <литерал темы> 50%, transparent)`,
 *   в `@supports` — `color-mix(in oklab, var(--color-blue-500) 50%, transparent)`;
 * - `var(…)` и `currentcolor` — запасной сам цвет, в `@supports` — смесь;
 * - литерал (`[#f00]/50`) — сразу `color-mix(in oklab, …)`, без `@supports`.
 */
type TwColor = [value: string, supports?: string];

/** Прозрачность модификатора: `50` → `50%`, `[33%]` → `33%`. */
function alphaOf(modifier: string): string | undefined {
  return REGEXP_NUMBER.test(modifier) ? modifier + PERCENT
    : modifier[0] === OPEN_BRACKET && modifier[modifier.length - 1] === ']' ? modifier.slice(1, -1) : undefined;
}

function colorValue(args: MnTwArgs): TwColor | undefined {
  const key = args.parts.join(DASH);
  let color: string | undefined;
  if (args.negative) {
    return undefined;
  }
  if (args.arbitrary !== undefined) {
    color = args.parts.length || args.type && args.type !== COLOR ? undefined : args.arbitrary;
  } else {
    color = SPECIAL_COLORS[key] || (TW4_THEME[COLOR_VAR_PREFIX + key] ? 'var(--color-' + key + CLOSE_PAREN : undefined);
  }
  if (!color || args.modifier === undefined) {
    return color ? [color] : undefined;
  }
  const alpha = alphaOf(args.modifier);
  if (!alpha) {
    return undefined;
  }
  const mix = COLOR_MIX_OPEN + color + SPACE + alpha + COLOR_MIX_TRANSPARENT;
  const literal = args.arbitrary === undefined && TW4_THEME[COLOR_VAR_PREFIX + key];
  return literal ? [
    'color-mix(in srgb, ' + literal + SPACE + alpha + COLOR_MIX_TRANSPARENT,
    mix,
  ]
    : /var\(|currentcolor/.test(color) ? [
      color,
      mix,
    ] : [mix];
}

/** Медиа `@supports` для смеси цветов — как у Tailwind 4. */
const COLOR_MIX_MEDIA = 'twColorMix';

/** Стиль цвета: свойства → значение; при `@supports`-значении — то же под медиа `twColorMix`. */
function colorResult(
  properties: string[], color: TwColor, extra?: Style,
): MnHandlerResult {
  const out: MnHandlerResult = {
    style: {
      ...extra,
      ...styleOf(properties, color[0]),
    },
  };
  color[1] === undefined || (out.media = {
    [COLOR_MIX_MEDIA]: {
      style: styleOf(properties, color[1]),
    },
  });
  return out;
}

/** Регистрирует хендлеры шкалы: имя → свойства CSS. */
function scales(
  mn: MnInstance, names: Record<string, string[]>, options: ScaleOptions,
): void {
  let name: string;
  for (name in names) { // eslint-disable-line
    mn(
      name, scaleHandler(names[name], options), '', 1,
    );
  }
}

/** Хендлер шкалы для одного имени — отдельной функцией, чтобы замыкание не делило переменную цикла. */
function scaleHandler(properties: string[], options: ScaleOptions) {
  return tw((args) => {
    const value = scaleValue(args, options);
    return value === undefined ? undefined : result(styleOf(properties, value));
  });
}



/**
 * Статические утилиты Tailwind 4 — таблицей, сгенерированной из эталона (`scripts/tw4-statics.mjs`,
 * D-068). Хендлер на точное имя (без значения), а не статика: так переменные темы из объявлений
 * уходят в `:root` по требованию. Регистрируются первыми — хендлер с тем же именем ниже (`flex`,
 * `border`) заменяет их и сам отвечает за голое имя.
 */
function setupStatics(mn: MnInstance): void {
  const names = Object.keys(TW4_STATICS).concat(Object.keys(TW4_NEGATIVE_STATICS).filter((name) => !TW4_STATICS[name]));
  for (const name of names) {
    mn(
      name, staticHandler(TW4_STATICS[name], TW4_NEGATIVE_STATICS[name]), '', 1,
    );
  }
}

/** Пары объявлений → стиль. */
function styleFromPairs(declarations: Array<[string, string]>): Style {
  const style: Style = {};
  for (const pair of declarations) {
    style[pair[0]] = pair[1];
  }
  return style;
}

/**
 * Хендлер статической утилиты: голое имя — свои объявления, с минусом — объявления отрицательной
 * статики (`-translate-full`); со значением или модификатором — не эта утилита.
 */
function staticHandler(positive: Array<[string, string]> | undefined, negative: Array<[string, string]> | undefined) {
  return tw((args) => {
    const declarations = args.negative ? negative : positive;
    return args.parts.length || args.arbitrary !== undefined || args.modifier !== undefined || !declarations
      ? undefined : result(styleFromPairs(declarations));
  });
}

/** Сторона отступа прокрутки → свойство (`*` — `Margin` или `Padding`). */
const SCROLL_SIDES: Record<string, string> = {
  '': 'scroll*',
  x: 'scroll*Inline',
  y: 'scroll*Block',
  t: 'scroll*Top',
  r: 'scroll*Right',
  b: 'scroll*Bottom',
  l: 'scroll*Left',
  s: 'scroll*InlineStart',
  e: 'scroll*InlineEnd',
  bs: 'scroll*BlockStart',
  be: 'scroll*BlockEnd',
};

function setupSpacing(mn: MnInstance): void {
  const margin = {
    m: [MARGIN],
    mx: ['marginInline'],
    my: ['marginBlock'],
    mt: ['marginTop'],
    mr: ['marginRight'],
    mb: ['marginBottom'],
    ml: ['marginLeft'],
    ms: ['marginInlineStart'],
    me: ['marginInlineEnd'],
    mbs: ['marginBlockStart'],
    mbe: ['marginBlockEnd'],
  };
  scales(
    mn, margin, {
      keywords: {
        auto: AUTO,
        px: ONE_PX,
      },
      negative: true,
    },
  );
  scales(
    mn, {
      p: ['padding'],
      px: ['paddingInline'],
      py: ['paddingBlock'],
      pt: ['paddingTop'],
      pr: ['paddingRight'],
      pb: ['paddingBottom'],
      pl: ['paddingLeft'],
      ps: ['paddingInlineStart'],
      pe: ['paddingInlineEnd'],
      pbs: ['paddingBlockStart'],
      pbe: ['paddingBlockEnd'],
    }, {
      keywords: {
        px: ONE_PX,
      },
    },
  );
  scales(
    mn, {
      gap: ['gap'],
      'gap-x': ['columnGap'],
      'gap-y': ['rowGap'],
    }, {
      keywords: {
        px: ONE_PX,
      },
    },
  );
  // `scroll-mt-4`, `scroll-pbs-2`: отступы прокрутки — те же стороны, что у `m`/`p`.
  const scrollMargin: Record<string, string[]> = {};
  const scrollPadding: Record<string, string[]> = {};
  let side: string;
  for (side of [
    '',
    X,
    Y,
    't',
    'r',
    'b',
    'l',
    's',
    'e',
    'bs',
    'be',
  ]) {
    scrollMargin['scroll-m' + side] = [SCROLL_SIDES[side].replace('*', 'Margin')];
    scrollPadding['scroll-p' + side] = [SCROLL_SIDES[side].replace('*', 'Padding')];
  }
  scales(
    mn, scrollMargin, {
      keywords: {
        px: ONE_PX,
      },
      negative: true,
    },
  );
  scales(
    mn, scrollPadding, {
      keywords: {
        px: ONE_PX,
      },
    },
  );
  // `space-x-4` — промежуток между детьми: всем, кроме последнего, отступ в конце строки.
  mn(
    'space-x', spaceHandler(X, 'Inline'), '', 1,
  );
  mn(
    'space-y', spaceHandler(Y, 'Block'), '', 1,
  );
  // `space-x-reverse` — промежутки с другой стороны (`flex-row-reverse`). Хендлер, а не статика:
  // к статике при слиянии добавляется селектор самого элемента, а нужны только дети.
  mn(
    'space-x-reverse', spaceReverse(X), '', 1,
  );
  mn(
    'space-y-reverse', spaceReverse(Y), '', 1,
  );
}

/**
 * `:where(.space-x-4>:not(:last-child))` — `&` — сам элемент (D-069): нулевая специфичность, как у
 * Tailwind 4, — собственный отступ ребёнка (`mx-2`) не перебивается. Скобки экранированы: в
 * селекторах пресета скобки — группа вариантов.
 */
const SPACE_CHILDREN = ':where\\(&>:not\\(:last-child\\)\\)';

function spaceReverse(axis: string) {
  return tw((args) => (args.parts.length || args.arbitrary !== undefined || args.modifier !== undefined
    || args.negative ? undefined : {
      selectors: [SPACE_CHILDREN],
      style: {
        ['--tw-space-' + axis + REVERSE_SUFFIX]: ONE,
      },
    }));
}

/** `space-x-4`: отступы детей с поправкой `--tw-space-x-reverse`, как у Tailwind 4. */
function spaceHandler(axis: string, side: string) {
  const reverse = 'var(--tw-space-' + axis + '-reverse)';
  return tw((args) => {
    const value = scaleValue(args, {
      keywords: {
        px: ONE_PX,
      },
      negative: true,
    });
    // Как у Tailwind 4: ноль — просто `0`, отрицательный `px` — литерал `-1px`.
    const step = value === 'calc(1px * -1)' ? '-1px' : value;
    const zero = step === ZERO_PX;
    return step === undefined ? undefined : {
      selectors: [SPACE_CHILDREN],
      style: {
        ['--tw-space-' + axis + REVERSE_SUFFIX]: ZERO,
        [MARGIN + side + 'Start']: zero ? ZERO : CALC_OPEN + step + ' * ' + reverse + CLOSE_PAREN,
        [MARGIN + side + 'End']: zero ? ZERO : CALC_OPEN + step + ' * calc(1 - ' + reverse + CLOSE_TWO_PARENS,
      },
    };
  });
}

function setupSizing(mn: MnInstance): void {
  const common = {
    auto: AUTO,
    px: ONE_PX,
    full: HUNDRED_PERCENT,
    min: 'min-content',
    max: 'max-content',
    fit: 'fit-content',
  };
  const width = {
    ...common,
    screen: '100vw',
    svw: '100svw',
    lvw: '100lvw',
    dvw: '100dvw',
  };
  const height = {
    ...common,
    screen: '100vh',
    svh: '100svh',
    lvh: '100lvh',
    dvh: '100dvh',
    lh: '1lh',
  };
  scales(
    mn, {
      w: ['width'],
      'min-w': ['minWidth'],
    }, {
      keywords: width,
      fraction: true,
      container: true,
    },
  );
  scales(
    mn, {
      'max-w': ['maxWidth'],
    }, {
      keywords: {
        ...width,
        none: NONE,
        prose: '65ch',
      },
      fraction: true,
      container: true,
    },
  );
  scales(
    mn, {
      h: ['height'],
      'min-h': ['minHeight'],
    }, {
      keywords: height,
      fraction: true,
    },
  );
  scales(
    mn, {
      'max-h': ['maxHeight'],
    }, {
      keywords: {
        ...height,
        none: NONE,
      },
      fraction: true,
    },
  );
  scales(
    mn, {
      size: [
        'width',
        'height',
      ],
    }, {
      keywords: common,
      fraction: true,
    },
  );
  // Логические размеры: `inline-*` — как ширина, `block-*` — как высота. Голые `block`, `inline` —
  // статики `display`, поэтому хендлер отвечает и за них.
  mn(
    'inline', logicalSize(
      'inline', 'inlineSize', {
        keywords: width,
        fraction: true,
        container: true,
      },
    ), '', 1,
  );
  mn(
    BLOCK, logicalSize(
      BLOCK, 'blockSize', {
        keywords: height,
        fraction: true,
      },
    ), '', 1,
  );
  scales(
    mn, {
      'min-inline': ['minInlineSize'],
    }, {
      keywords: width,
      fraction: true,
      container: true,
    },
  );
  scales(
    mn, {
      'max-inline': ['maxInlineSize'],
    }, {
      keywords: {
        ...width,
        none: NONE,
      },
      fraction: true,
      container: true,
    },
  );
  scales(
    mn, {
      'min-block': ['minBlockSize'],
    }, {
      keywords: height,
      fraction: true,
    },
  );
  scales(
    mn, {
      'max-block': ['maxBlockSize'],
    }, {
      keywords: {
        ...height,
        none: NONE,
      },
      fraction: true,
    },
  );
}

/** `border-spacing`, `border-spacing-x/y`: шкала `--spacing` в переменные осей и общая сборка. */
function borderSpacing(axes: string[]) {
  return tw((args) => {
    const value = scaleValue(args, {
      keywords: {
        px: ONE_PX,
      },
    });
    return value === undefined ? undefined : result({
      ...styleOf(axes.map((axis) => '--tw-border-spacing-' + axis), value),
      borderSpacing: 'var(--tw-border-spacing-x) var(--tw-border-spacing-y)',
    });
  });
}

/** `block-4`, `inline-full`: размер по шкале; голое имя — статика `display` того же имени. */
function logicalSize(
  name: string, property: string, options: ScaleOptions,
) {
  const display = styleFromPairs(TW4_STATICS[name]);
  return tw((args) => {
    const value = scaleValue(args, options);
    const bare = !args.parts.length && args.arbitrary === undefined && args.modifier === undefined && !args.negative;
    return bare ? result(display) : value === undefined ? undefined : result(styleOf([property], value));
  });
}

function setupLayout(mn: MnInstance): void {
  scales(
    mn, {
      inset: ['inset'],
      'inset-x': ['insetInline'],
      'inset-y': ['insetBlock'],
      top: [TOP],
      right: [RIGHT],
      bottom: [BOTTOM],
      left: [LEFT],
      start: ['insetInlineStart'],
      end: ['insetInlineEnd'],
      'inset-s': ['insetInlineStart'],
      'inset-e': ['insetInlineEnd'],
      'inset-bs': ['insetBlockStart'],
      'inset-be': ['insetBlockEnd'],
    }, {
      keywords: {
        auto: AUTO,
        px: ONE_PX,
        full: HUNDRED_PERCENT,
      },
      fraction: true,
      negative: true,
    },
  );
  integers(
    mn, Z, 'zIndex', {
      auto: AUTO,
    },
  );
  integers(
    mn, 'order', 'order', {
      first: '-9999',
      last: '9999',
      none: ZERO,
    },
  );
}

/** Целое значение свойства (`z-10`, `order-2`) с ведущим `-`, словами и `[…]`. */
function integers(
  mn: MnInstance, name: string, property: string, keywords: Record<string, string>,
): void {
  mn(
    name, tw((args) => {
      const step = args.parts[0];
      const value = args.arbitrary !== undefined && !args.parts.length ? args.arbitrary
        : args.parts.length === 1 && args.modifier === undefined
          ? REGEXP_INTEGER.test(step) ? step
            : Object.prototype.hasOwnProperty.call(keywords, step) && !args.negative ? keywords[step] : undefined
          : undefined;
      return value === undefined ? undefined : result({
        [property]: args.negative ? negate(value) : value,
      });
    }), '', 1,
  );
}

function setupFlexGrid(mn: MnInstance): void {
  // `flex` — display, `flex-1` — сокращение `flex`.
  mn(
    'flex', tw((args) => {
      const step = args.parts[0];
      const modifier = args.modifier;
      const noModifier = modifier === undefined;
      // Модификатор — только у дроби: `flex-1/2` → `calc(1/2 * 100%)`.
      const value = args.arbitrary !== undefined ? (noModifier ? args.arbitrary : undefined)
        : args.parts.length !== 1 || !REGEXP_INTEGER.test(step) ? undefined
          : noModifier ? step
            : REGEXP_INTEGER.test(modifier) ? CALC_OPEN + step + '/' + modifier + ' * 100%)' : undefined;
      return !args.parts.length && args.arbitrary === undefined ? (noModifier ? result({
        display: 'flex',
      }) : undefined) : value === undefined ? undefined : result({
        flex: value,
      });
    }), '', 1,
  );
  mn(
    'grow', flexFactor('flexGrow'), '', 1,
  );
  mn(
    'shrink', flexFactor('flexShrink'), '', 1,
  );
  scales(
    mn, {
      basis: ['flexBasis'],
    }, {
      keywords: {
        auto: AUTO,
        px: ONE_PX,
        full: HUNDRED_PERCENT,
      },
      fraction: true,
      container: true,
    },
  );
  // `grid-cols-3` → `repeat(3, minmax(0, 1fr))`.
  mn(
    'grid-cols', gridTemplate('gridTemplateColumns'), '', 1,
  );
  mn(
    'grid-rows', gridTemplate('gridTemplateRows'), '', 1,
  );
  gridPlacement(
    mn, 'col', 'gridColumn',
  );
  gridPlacement(
    mn, 'row', 'gridRow',
  );
}

/** `grow`, `grow-0`, `grow-[2]` — множитель flex. */
function flexFactor(property: string) {
  return tw((args) => {
    const value = args.modifier !== undefined ? undefined
      : !args.parts.length && args.arbitrary === undefined ? ONE
        : args.arbitrary !== undefined ? args.arbitrary
          : args.parts.length === 1 && REGEXP_INTEGER.test(args.parts[0]) ? args.parts[0] : undefined;
    return value === undefined ? undefined : result({
      [property]: value,
    });
  });
}

/** `grid-cols-3`, `grid-cols-none`, `grid-cols-subgrid`, `grid-cols-[…]`. */
function gridTemplate(property: string) {
  return tw((args) => {
    const step = args.parts[0];
    const value = args.arbitrary !== undefined && !args.parts.length ? args.arbitrary
      : args.parts.length !== 1 ? undefined
        : REGEXP_INTEGER.test(step) ? 'repeat(' + step + ', minmax(0, 1fr))'
          : step === NONE ? NONE : step === 'subgrid' ? 'subgrid' : undefined;
    return value === undefined ? undefined : result({
      [property]: value,
    });
  });
}

/** `col-span-2`, `col-span-full`, `col-start-2`, `col-end-3` (то же для `row`). */
function gridPlacement(
  mn: MnInstance, axis: string, property: string,
): void {
  mn(
    axis + '-span', tw((args) => {
      const step = args.parts[0];
      const value = args.arbitrary !== undefined && !args.parts.length ? 'span ' + args.arbitrary + ' / span '
        + args.arbitrary : args.parts.length !== 1 ? undefined
        : REGEXP_INTEGER.test(step) ? 'span ' + step + ' / span ' + step : step === 'full' ? '1 / -1' : undefined;
      return value === undefined ? undefined : result({
        [property]: value,
      });
    }), '', 1,
  );
  // `col-3`, `-col-3`, `col-auto`, `col-[1/3]` — сама линия.
  mn(
    axis, tw((args) => {
      const step = args.parts[0];
      const value = args.modifier !== undefined ? undefined
        : args.arbitrary !== undefined ? (args.parts.length ? undefined : args.negative ? negateCalc(args.arbitrary) : args.arbitrary)
          : args.parts.length !== 1 ? undefined
            : REGEXP_INTEGER.test(step) ? (args.negative ? negateCalc(step) : step)
              : step === AUTO && !args.negative ? step : undefined;
      return value === undefined ? undefined : result({
        [property]: value,
      });
    }), '', 1,
  );
  integers(
    mn, axis + '-start', property + 'Start', {
      auto: AUTO,
    },
  );
  integers(
    mn, axis + '-end', property + 'End', {
      auto: AUTO,
    },
  );
}

/** Размер шрифта `text-sm`, `text-sm/6`, `text-[14px]` — или `undefined`. */
function fontSize(args: MnTwArgs): Style | undefined {
  const key = args.parts.join(DASH);
  const lineHeight = args.modifier === undefined ? undefined
    : REGEXP_NUMBER.test(args.modifier) ? spacing(args.modifier) : undefined;
  if (args.negative || args.modifier !== undefined && !lineHeight) {
    return undefined;
  }
  if (args.arbitrary !== undefined) {
    return !args.parts.length && (args.type === LENGTH || !args.type && REGEXP_LENGTH.test(args.arbitrary))
      ? lineHeight ? {
        fontSize: args.arbitrary,
        lineHeight,
      } : {
        fontSize: args.arbitrary,
      } : undefined;
  }
  return TW4_THEME['--text-' + key] && TW4_THEME['--text-' + key].indexOf('rem') > 0 ? {
    fontSize: 'var(--text-' + key + CLOSE_PAREN,
    // `leading-*` задаёт `--tw-leading` — у Tailwind 4 размер шрифта её уважает.
    lineHeight: lineHeight || 'var(--tw-leading, var(--text-' + key + '--line-height))',
  } : undefined;
}

function setupTypography(mn: MnInstance): void {
  // `text-…` — размер шрифта или цвет; размер проверяется первым (`text-sm` — не цвет).
  mn(
    'text', tw((args) => {
      const size = fontSize(args);
      const color = size ? undefined : colorValue(args);
      return size ? result(size) : color === undefined ? undefined : colorResult([COLOR], color);
    }), '', 1,
  );
  mn(
    'font', tw((args) => {
      const key = args.parts.join(DASH);
      return args.negative || args.modifier !== undefined ? undefined
        : args.arbitrary !== undefined && !args.parts.length
          ? result(REGEXP_INTEGER.test(args.arbitrary) || args.type === 'weight' ? {
            '--tw-font-weight': args.arbitrary,
            fontWeight: args.arbitrary,
          } : {
            fontFamily: args.arbitrary,
          })
          : TW4_THEME['--font-weight-' + key] ? result({
            '--tw-font-weight': 'var(--font-weight-' + key + CLOSE_PAREN,
            fontWeight: 'var(--font-weight-' + key + CLOSE_PAREN,
          }) : TW4_THEME['--font-' + key] ? result({
            fontFamily: 'var(--font-' + key + CLOSE_PAREN,
          }) : undefined;
    }), '', 1,
  );
  mn(
    'leading', tw((args) => {
      const key = args.parts.join(DASH);
      const value = args.negative || args.modifier !== undefined ? undefined
        : args.arbitrary !== undefined && !args.parts.length ? args.arbitrary
          : key === NONE ? ONE
            : TW4_THEME['--leading-' + key] ? 'var(--leading-' + key + CLOSE_PAREN
              : args.parts.length === 1 && REGEXP_NUMBER.test(key) ? spacing(key) : undefined;
      return value === undefined ? undefined : result({
        '--tw-leading': value,
        lineHeight: value,
      });
    }), '', 1,
  );
  mn(
    'tracking', tw((args) => {
      const key = args.parts.join(DASH);
      const value = args.modifier !== undefined ? undefined
        : args.arbitrary !== undefined && !args.parts.length ? args.arbitrary
          : TW4_THEME['--tracking-' + key] ? 'var(--tracking-' + key + CLOSE_PAREN : undefined;
      return value === undefined ? undefined : result({
        '--tw-tracking': args.negative ? negate(value) : value,
        letterSpacing: args.negative ? negate(value) : value,
      });
    }), '', 1,
  );
}

/** Стороны рамки и скругления. */
const BORDER_SIDES: Record<string, string[]> = {
  x: ['borderInlineWidth'],
  y: ['borderBlockWidth'],
  t: ['borderTopWidth'],
  r: ['borderRightWidth'],
  b: ['borderBottomWidth'],
  l: ['borderLeftWidth'],
  s: ['borderInlineStartWidth'],
  e: ['borderInlineEndWidth'],
  bs: ['borderBlockStartWidth'],
  be: ['borderBlockEndWidth'],
};

const RADIUS_SIDES: Record<string, string[]> = {
  t: [
    BORDER_TOP_LEFT_RADIUS,
    BORDER_TOP_RIGHT_RADIUS,
  ],
  r: [
    BORDER_TOP_RIGHT_RADIUS,
    BORDER_BOTTOM_RIGHT_RADIUS,
  ],
  b: [
    BORDER_BOTTOM_RIGHT_RADIUS,
    BORDER_BOTTOM_LEFT_RADIUS,
  ],
  l: [
    BORDER_TOP_LEFT_RADIUS,
    BORDER_BOTTOM_LEFT_RADIUS,
  ],
  s: [
    'borderStartStartRadius',
    'borderEndStartRadius',
  ],
  e: [
    'borderStartEndRadius',
    'borderEndEndRadius',
  ],
  tl: [BORDER_TOP_LEFT_RADIUS],
  tr: [BORDER_TOP_RIGHT_RADIUS],
  br: [BORDER_BOTTOM_RIGHT_RADIUS],
  bl: [BORDER_BOTTOM_LEFT_RADIUS],
  ss: ['borderStartStartRadius'],
  se: ['borderStartEndRadius'],
  ee: ['borderEndEndRadius'],
  es: ['borderEndStartRadius'],
};

/** Ширина рамки: пусто → `1px`, целое → `Npx`, `[…]` — как есть. */
function borderWidth(args: MnTwArgs, rest: string[]): string | undefined {
  return args.arbitrary !== undefined ? (!rest.length && (args.type === LENGTH
    || !args.type && REGEXP_LENGTH.test(args.arbitrary)) ? args.arbitrary : undefined)
    : !rest.length ? ONE_PX : rest.length === 1 && REGEXP_INTEGER.test(rest[0]) ? rest[0] + PX : undefined;
}

function setupBorders(mn: MnInstance): void {
  // `border-dashed` ставит и стиль, и переменную: `border` берёт стиль из неё, поэтому
  // `border border-dashed` — пунктир при любом порядке правил, как у Tailwind 4 (D-069).
  let style: string;
  for (style of [
    'solid',
    'dashed',
    'dotted',
    'double',
    'hidden',
    NONE,
  ]) {
    mn('border-' + style, {
      style: {
        '--tw-border-style': style,
        borderStyle: style,
      },
    });
  }
  // `border`, `border-2`, `border-t-4`, `border-red-500`, `border-[3px]`. Стиль `solid` рядом с
  // шириной — то, что у Tailwind 4 даёт `--tw-border-style` (по умолчанию `solid`).
  mn(
    'border', tw((args) => {
      const side = BORDER_SIDES[args.parts[0]];
      const rest = side ? args.parts.slice(1) : args.parts;
      const width = args.negative || args.modifier !== undefined ? undefined : borderWidth(args, rest);
      const color = width === undefined ? colorValue({
        ...args,
        parts: rest,
      }) : undefined;
      const widths = side || ['borderWidth'];
      // Сторона — свой стиль и свой цвет: `border-t-4` → `border-top-style`, `border-t-red-500` → `border-top-color`.
      return width !== undefined ? result({
        ...styleOf(widths.map((name) => name.replace(WIDTH, 'Style')), VAR_TW_BORDER_STYLE),
        ...styleOf(widths, width),
      }) : color === undefined ? undefined : colorResult(widths.map((name) => name.replace(WIDTH, 'Color')), color);
    }), '', 1,
  );
  mn(
    'border-spacing', borderSpacing([
      X,
      Y,
    ]), '', 1,
  );
  mn(
    'border-spacing-x', borderSpacing([X]), '', 1,
  );
  mn(
    'border-spacing-y', borderSpacing([Y]), '', 1,
  );
  // `rounded`, `rounded-lg`, `rounded-t-lg`, `rounded-full`, `rounded-[3px]`.
  mn(
    'rounded', tw((args) => {
      const side = RADIUS_SIDES[args.parts[0]];
      const rest = side ? args.parts.slice(1) : args.parts;
      const key = rest.join(DASH);
      const value = args.negative || args.modifier !== undefined ? undefined
        : args.arbitrary !== undefined ? (rest.length ? undefined : args.arbitrary)
          : !rest.length ? '0.25rem'
            : key === NONE ? ZERO : key === 'full' ? 'calc(infinity * 1px)'
              : TW4_THEME['--radius-' + key] ? 'var(--radius-' + key + CLOSE_PAREN : undefined;
      return value === undefined ? undefined : result(styleOf(side || ['borderRadius'], value));
    }), '', 1,
  );
}

function setupColors(mn: MnInstance): void {
  mn(
    'bg', tw((args) => {
      const color = colorValue(args);
      return color === undefined ? undefined : colorResult(['backgroundColor'], color);
    }), '', 1,
  );
}


/** Длина-«пиксели» Tailwind 4: `2` → `2px`, произвольная длина как есть; с минусом — `calc(… * -1)`. */
function pixels(args: MnTwArgs, negative?: boolean): string | undefined {
  const value = args.modifier !== undefined || args.negative && !negative ? undefined
    : args.arbitrary !== undefined ? (args.parts.length ? undefined : args.arbitrary)
      : args.parts.length === 1 && REGEXP_INTEGER.test(args.parts[0]) ? args.parts[0] + PX : undefined;
  return value && args.negative ? negateCalc(value) : value;
}

/** Произвольное значение — длина (`[3px]`, `[length:var(--x)]`), а не цвет. */
function isLengthArg(args: MnTwArgs): boolean {
  return args.arbitrary !== undefined && (args.type === LENGTH || !args.type && REGEXP_LENGTH.test(args.arbitrary));
}

/** Хендлер «цвет — в эти свойства»; `other` — другая форма той же утилиты (ширина, толщина). */
function colorOr(properties: string[], other?: (args: MnTwArgs) => MnHandlerResult | undefined) {
  return tw((args) => {
    const alternative = other && other(args);
    if (alternative) {
      return alternative;
    }
    // Тип произвольного значения Tailwind 4 выясняет, только когда у утилиты есть выбор (цвет или
    // толщина); у утилиты одного вида значение идёт как есть (`fill-[3px]` → `fill: 3px`).
    const color = other && isLengthArg(args) ? undefined : colorValue(args);
    return color && colorResult(properties, color);
  });
}

/** Тень-кольцо Tailwind 4 — общая сумма теней. */
const BOX_SHADOW = 'var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)';

/** `:where(.divide-x>:not(:last-child))` — как у `space-*`: дети, кроме последнего. */
const DIVIDE_CHILDREN = SPACE_CHILDREN;

/** `divide-x`, `divide-y-2`: рамки между детьми с поправкой `--tw-divide-*-reverse`. */
function divideWidth(axis: 'x' | 'y', args: MnTwArgs): MnHandlerResult | undefined {
  const width = args.modifier !== undefined || args.negative ? undefined
    : args.arbitrary !== undefined ? (args.parts.length ? undefined : args.arbitrary)
      : !args.parts.length ? ONE_PX : args.parts.length === 1 && REGEXP_INTEGER.test(args.parts[0]) ? args.parts[0] + PX : undefined;
  const reverse = 'var(--tw-divide-' + axis + '-reverse)';
  const inline = axis === X;
  const start = inline ? 'borderInlineStart' : 'borderTop';
  const end = inline ? 'borderInlineEnd' : 'borderBottom';
  return width === undefined ? undefined : {
    selectors: [DIVIDE_CHILDREN],
    style: {
      ['--tw-divide-' + axis + REVERSE_SUFFIX]: ZERO,
      ...(inline ? {
        borderInlineStyle: VAR_TW_BORDER_STYLE,
      } : {
        borderBottomStyle: VAR_TW_BORDER_STYLE,
        borderTopStyle: VAR_TW_BORDER_STYLE,
      }),
      [start + WIDTH]: CALC_OPEN + width + ' * ' + reverse + CLOSE_PAREN,
      [end + WIDTH]: CALC_OPEN + width + ' * calc(1 - ' + reverse + CLOSE_TWO_PARENS,
    },
  };
}

/** Цвета и толщины: декор, обводка, заливка, кольца, разделители, полоса прокрутки (Tailwind 4). */
function setupColorUtilities(mn: MnInstance): void {
  mn(
    'decoration', colorOr(['textDecorationColor'], (args) => {
      const width = isLengthArg(args) || args.arbitrary === undefined ? pixels(args) : undefined;
      return width === undefined ? undefined : result({
        textDecorationThickness: width,
      });
    }), '', 1,
  );
  mn(
    'underline-offset', tw((args) => {
      const offset = args.parts.length === 1 && args.parts[0] === AUTO && !args.negative && args.modifier === undefined
        ? AUTO : pixels(args, true);
      return offset === undefined ? undefined : result({
        textUnderlineOffset: offset,
      });
    }), '', 1,
  );
  mn(
    'outline', colorOr(['outlineColor'], (args) => {
      const noArbitrary = args.arbitrary === undefined;
      const width = !args.parts.length && noArbitrary && args.modifier === undefined && !args.negative
        ? ONE_PX : isLengthArg(args) || noArbitrary ? pixels(args) : undefined;
      return width === undefined ? undefined : result({
        outlineStyle: 'var(--tw-outline-style)',
        outlineWidth: width,
      });
    }), '', 1,
  );
  mn(
    'outline-offset', tw((args) => {
      const offset = pixels(args, true);
      return offset === undefined ? undefined : result({
        outlineOffset: offset,
      });
    }), '', 1,
  );
  mn(
    'fill', colorOr(['fill']), '', 1,
  );
  mn(
    'stroke', colorOr(['stroke'], (args) => {
      // Как у Tailwind 4: ширина — целое; модификатор у ширины не значит ничего и пропускается.
      const width = args.negative ? undefined
        : isLengthArg(args) ? args.arbitrary
          : args.arbitrary === undefined && args.parts.length === 1 && REGEXP_INTEGER.test(args.parts[0]) ? args.parts[0] : undefined;
      return width === undefined ? undefined : result({
        strokeWidth: width,
      });
    }), '', 1,
  );
  mn(
    'accent', colorOr(['accentColor']), '', 1,
  );
  mn(
    'caret', colorOr(['caretColor']), '', 1,
  );
  mn(
    'placeholder', tw((args) => {
      const color = colorValue(args);
      return color && {
        ...colorResult([COLOR], color),
        selectors: ['&::placeholder'],
      };
    }), '', 1,
  );
  mn(
    'divide', tw((args) => {
      const axis = args.parts[0] === X || args.parts[0] === Y ? args.parts[0] : undefined;
      if (axis) {
        return divideWidth(axis, {
          ...args,
          parts: args.parts.slice(1),
        });
      }
      const color = colorValue(args);
      return color && {
        ...colorResult(['borderColor'], color),
        selectors: [DIVIDE_CHILDREN],
      };
    }), '', 1,
  );
  mn(
    'ring', colorOr(['--tw-ring-color'], (args) => {
      const noArbitrary = args.arbitrary === undefined;
      const width = !args.parts.length && noArbitrary && args.modifier === undefined && !args.negative
        ? ONE_PX : isLengthArg(args) || noArbitrary ? pixels(args) : undefined;
      return width === undefined ? undefined : result({
        '--tw-ring-shadow': 'var(--tw-ring-inset,) 0 0 0 calc(' + width + ' + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)',
        boxShadow: BOX_SHADOW,
      });
    }), '', 1,
  );
  mn(
    'ring-offset', colorOr(['--tw-ring-offset-color'], (args) => {
      const width = isLengthArg(args) || args.arbitrary === undefined ? pixels(args) : undefined;
      return width === undefined ? undefined : result({
        '--tw-ring-offset-width': width,
        '--tw-ring-offset-shadow': 'var(--tw-ring-inset,) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)',
      });
    }), '', 1,
  );
  mn(
    'inset-ring', colorOr(['--tw-inset-ring-color'], (args) => {
      const noArbitrary = args.arbitrary === undefined;
      const width = !args.parts.length && noArbitrary && args.modifier === undefined && !args.negative
        ? ONE_PX : isLengthArg(args) || noArbitrary ? pixels(args) : undefined;
      return width === undefined ? undefined : result({
        '--tw-inset-ring-shadow': 'inset 0 0 0 ' + width + ' var(--tw-inset-ring-color, currentcolor)',
        boxShadow: BOX_SHADOW,
      });
    }), '', 1,
  );
  let part: string;
  for (part of [
    'thumb',
    'track',
  ]) {
    mn(
      'scrollbar-' + part, scrollbarColor(part), '', 1,
    );
  }
}

/** `scrollbar-thumb-red-500` → `--tw-scrollbar-thumb` и `scrollbar-color` из обеих переменных. */
function scrollbarColor(part: string) {
  return tw((args) => {
    const color = colorValue(args);
    return color && colorResult(
      ['--tw-scrollbar-' + part], color, {
        scrollbarColor: 'var(--tw-scrollbar-thumb) var(--tw-scrollbar-track)',
      },
    );
  });
}


/** Цепочка фильтров Tailwind 4 — `filter` из переменных отдельных фильтров. */
const FILTER = 'var(--tw-blur,) var(--tw-brightness,) var(--tw-contrast,) var(--tw-grayscale,) var(--tw-hue-rotate,)'
  + ' var(--tw-invert,) var(--tw-saturate,) var(--tw-sepia,) var(--tw-drop-shadow,)';

/** Токен тени — не цвет: длина, число, `inset`. */
const REGEXP_SHADOW_PART = /^(?:inset|-?[\d.]+[a-z%]*)$/;

/** Произвольное значение похоже на цвет, а не на тень: `#f00`, `rgb(…)`, `var(--c)`, `red`. */
const REGEXP_COLOR_LIKE = /^(?:#|rgb|hsl|oklch|oklab|lab|lch|color|var\()|^[a-z]+$/;

/** Деление по разделителю вне скобок. */
function splitTop(value: string, separator: string): string[] {
  const out: string[] = [];
  const l = value.length;
  let depth = 0;
  let from = 0;
  let i = 0;
  let ch: string;
  for (; i < l; i++) {
    ch = value[i];
    depth += ch === OPEN_PAREN ? 1 : ch === CLOSE_PAREN ? -1 : 0;
    if (ch === separator && !depth) {
      out.push(value.slice(from, i));
      from = i + 1;
    }
  }
  out.push(value.slice(from));
  return out;
}

/** Номер токена-цвета в тени — последний, что не длина и не `inset`; нет — `-1`. */
function colorIndex(tokens: string[]): number {
  let i = tokens.length - 1;
  while (i >= 0 && REGEXP_SHADOW_PART.test(tokens[i])) {
    i--;
  }
  return i;
}

/**
 * Тени, по одной на элемент списка, с цветом через переменную, как у Tailwind 4: `0 1px rgb(0 0 0 / 0.05)` →
 * `0 1px var(--tw-shadow-color, rgb(0 0 0 / 0.05))`; с прозрачностью — `oklab(from <цвет> l a b / 50%)`.
 */
function shadowParts(
  value: string, colorVar: string, alpha?: string,
): string[] {
  return splitTop(value, ',').map((part) => {
    const tokens = splitTop(part.trim(), SPACE).filter(Boolean);
    const i = colorIndex(tokens);
    i < 0 || (tokens[i] = VAR_OPEN + colorVar + LIST_SEPARATOR + (alpha ? 'oklab(from ' + tokens[i] + ' l a b / ' + alpha + CLOSE_PAREN : tokens[i]) + CLOSE_PAREN);
    return tokens.join(SPACE);
  });
}

/**
 * Цвет тени с переменной прозрачностью (`--tw-shadow-alpha`), как у Tailwind 4: запасной цвет и
 * `@supports`-смесь `color-mix(in oklab, <цвет> var(--tw-shadow-alpha), transparent)`.
 */
function shadowColor(args: MnTwArgs, alphaVar: string): TwColor | undefined {
  const base = colorValue({
    ...args,
    modifier: undefined,
  });
  const alpha = args.modifier === undefined ? undefined : alphaOf(args.modifier);
  if (!base || args.modifier !== undefined && !alpha) {
    return undefined;
  }
  const color = base[0];
  if (color === 'inherit') {
    return alpha ? undefined : [color];
  }
  const literal = args.arbitrary === undefined && TW4_THEME[COLOR_VAR_PREFIX + args.parts.join(DASH)] || color;
  const mix = (value: string) => COLOR_MIX_OPEN + value + ' var(' + alphaVar + '), transparent)';
  return alpha ? [
    'color-mix(in srgb, ' + literal + SPACE + alpha + COLOR_MIX_TRANSPARENT,
    mix(COLOR_MIX_OPEN + color + SPACE + alpha + COLOR_MIX_TRANSPARENT),
  ]
    : [
      literal,
      mix(color),
    ];
}

/** Ключ размера для произвольной тени `[…]` — не имя темы. */
const ARBITRARY = '[]';

/** Описание семейства теней. */
interface ShadowFamily {
  /** Префикс переменных темы размеров: `--shadow-`. */
  theme: string;
  /** Переменные цвета и прозрачности: `--tw-shadow-color`, `--tw-shadow-alpha`. */
  colorVar: string;
  alphaVar: string;
  /** Размеры вне темы: голое имя, `inner`. */
  sizes: Record<string, string>;
  /** Стиль размера: части тени с цветом в переменной, прозрачность, ключ темы (`''` — голое имя, `ARBITRARY` — `[…]`). */
  size: (parts: string[], alpha: string | undefined, key: string) => Style;
  /** `*-none`. */
  none: Style;
  /** Добавка к стилю цвета: `drop-shadow` — `--tw-drop-shadow`. */
  colorExtra?: Style;
}

/** Хендлер семейства теней: размер темы (`/50` — прозрачность), `none`, произвольная тень или цвет. */
function shadowHandler(family: ShadowFamily) {
  return tw((args) => {
    const key = args.parts.join(DASH);
    // Непонятная прозрачность у размера (`shadow-md/x`) Tailwind 4 пропускает — тень без неё.
    const noArbitrary = args.arbitrary === undefined;
    const modifier = args.modifier;
    const noModifier = modifier === undefined;
    const alpha = noModifier ? undefined : alphaOf(modifier);
    const value = args.negative ? undefined
      : args.arbitrary !== undefined ? (args.parts.length || args.type === COLOR || REGEXP_COLOR_LIKE.test(args.arbitrary)
        ? undefined : args.arbitrary)
        : family.sizes[key] || TW4_THEME[family.theme + key];
    if (noArbitrary && key === NONE) {
      return noModifier && !args.negative ? result(family.none) : undefined;
    }
    if (value !== undefined) {
      return result({
        ...alpha ? {
          [family.alphaVar]: alpha,
        } : {},
        ...family.size(
          shadowParts(
            value, family.colorVar, alpha,
          ), alpha, noArbitrary ? key : ARBITRARY,
        ),
      });
    }
    const color = args.negative ? undefined : shadowColor(args, family.alphaVar);
    return color && colorResult(
      [family.colorVar], color, family.colorExtra,
    );
  });
}

function setupShadows(mn: MnInstance): void {
  mn(
    'shadow', shadowHandler({
      theme: '--shadow-',
      colorVar: '--tw-shadow-color',
      alphaVar: '--tw-shadow-alpha',
      sizes: {
        '': TW4_THEME['--shadow-sm'],
        inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
      },
      size: (parts) => ({
        '--tw-shadow': parts.join(LIST_SEPARATOR),
        boxShadow: BOX_SHADOW,
      }),
      none: {
        '--tw-shadow': '0 0 #0000',
        boxShadow: BOX_SHADOW,
      },
    }), '', 1,
  );
  mn(
    'inset-shadow', shadowHandler({
      theme: '--inset-shadow-',
      colorVar: '--tw-inset-shadow-color',
      alphaVar: '--tw-inset-shadow-alpha',
      sizes: {},
      size: (parts) => ({
        '--tw-inset-shadow': parts.map((part) => (part.indexOf('inset') === 0 ? part : 'inset ' + part)).join(LIST_SEPARATOR),
        boxShadow: BOX_SHADOW,
      }),
      none: {
        '--tw-inset-shadow': 'inset 0 0 #0000',
        boxShadow: BOX_SHADOW,
      },
    }), '', 1,
  );
  mn(
    'text-shadow', shadowHandler({
      theme: '--text-shadow-',
      colorVar: '--tw-text-shadow-color',
      alphaVar: '--tw-text-shadow-alpha',
      sizes: {},
      size: (parts) => ({
        textShadow: parts.join(LIST_SEPARATOR),
      }),
      none: {
        textShadow: NONE,
      },
    }), '', 1,
  );
  mn(
    'drop-shadow', shadowHandler({
      theme: '--drop-shadow-',
      colorVar: '--tw-drop-shadow-color',
      alphaVar: '--tw-drop-shadow-alpha',
      sizes: {
        '': '0 1px 2px rgb(0 0 0 / 0.1), 0 1px 1px rgb(0 0 0 / 0.06)',
      },
      // Размер темы — `drop-shadow(var(--drop-shadow-sm))`; голое имя — сама тень (и с прозрачностью:
      // `drop-shadow/50`); размер темы с прозрачностью и произвольный — через `--tw-drop-shadow-size`.
      size: (
        parts, alpha, key,
      ) => ({
        '--tw-drop-shadow-size': parts.map((part) => 'drop-shadow(' + part + CLOSE_PAREN).join(SPACE),
        '--tw-drop-shadow': alpha && key || key === ARBITRARY ? 'var(--tw-drop-shadow-size)'
          : key ? 'drop-shadow(var(--drop-shadow-' + key + CLOSE_TWO_PARENS
            : 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.1)) drop-shadow(0 1px 1px rgb(0 0 0 / 0.06))',
        filter: FILTER,
      }),
      none: {
        '--tw-drop-shadow': SPACE,
        filter: FILTER,
      },
      colorExtra: {
        '--tw-drop-shadow': 'var(--tw-drop-shadow-size)',
      },
    }), '', 1,
  );
}

/** Сборка 3D-поворотов и наклонов — `transform` Tailwind 4. */
const TRANSFORM = 'var(--tw-rotate-x,) var(--tw-rotate-y,) var(--tw-rotate-z,) var(--tw-skew-x,) var(--tw-skew-y,)';

/** Сборка сдвига: по двум осям, по трём — у `translate-z`. */
const TRANSLATE_XY = 'var(--tw-translate-x) var(--tw-translate-y)';
const TRANSLATE_XYZ = TRANSLATE_XY + ' var(--tw-translate-z)';

/** Сборка масштаба: по двум осям, по трём — у `scale-z`. */
const SCALE_XY = 'var(--tw-scale-x) var(--tw-scale-y)';
const SCALE_XYZ = SCALE_XY + ' var(--tw-scale-z)';

/** Точки `origin-*` и `perspective-origin-*` — как пишет их Tailwind 4. */
const ORIGINS: Record<string, string> = {
  center: 'center',
  top: TOP,
  'top-right': '100% 0',
  right: HUNDRED_PERCENT,
  'bottom-right': '100% 100%',
  bottom: BOTTOM,
  'bottom-left': '0 100%',
  left: ZERO,
  'top-left': '0 0',
};

/**
 * Значение поворота, наклона, масштаба: целое → с единицей (`45` → `45deg`, `50` → `50%`), произвольное —
 * как есть; минус — `calc(… * -1)`. Дробей, модификатора и слов нет.
 */
function unitValue(args: MnTwArgs, unit: string): string | undefined {
  const value = args.modifier !== undefined ? undefined
    : args.arbitrary !== undefined ? (args.parts.length ? undefined : args.arbitrary)
      : args.parts.length === 1 && REGEXP_INTEGER.test(args.parts[0]) ? args.parts[0] + unit : undefined;
  return value && args.negative ? negateCalc(value) : value;
}

/** Слово из таблицы или произвольное значение; минуса нет. */
function keywordValue(args: MnTwArgs, keywords: Record<string, string>): string | undefined {
  const key = args.parts.join(DASH);
  return args.negative || args.modifier !== undefined ? undefined
    : args.arbitrary !== undefined ? (args.parts.length ? undefined : args.arbitrary)
      : Object.prototype.hasOwnProperty.call(keywords, key) ? keywords[key] : undefined;
}

/** `translate`, `translate-x/y/z`: шкала `--spacing`, дроби (кроме `z`), произвольное; `full`, `px` — статики. */
function translateHandler(axes: string[], value: string) {
  return tw((args) => {
    const shift = scaleValue(args, {
      fraction: axes[0] !== Z,
      negative: true,
    });
    return shift === undefined ? undefined : result({
      ...styleOf(axes.map((axis) => '--tw-translate-' + axis), shift),
      translate: value,
    });
  });
}

/** `scale`, `scale-x/y/z`: голое имя с произвольным — сразу `scale`, иначе через переменные осей. */
function scaleTransformHandler(axes: string[], value: string) {
  return tw((args) => {
    const factor = unitValue(args, PERCENT);
    return factor === undefined ? undefined : result(axes.length === 3 && args.arbitrary !== undefined ? {
      scale: factor,
    } : {
      ...styleOf(axes.map((axis) => '--tw-scale-' + axis), factor),
      scale: value,
    });
  });
}

/** `rotate-x/y/z`, `skew`, `skew-x/y`: функции в переменных осей и общий `transform`. */
function transformHandler(prefix: string, axes: string[]) {
  return tw((args) => {
    const angle = unitValue(args, DEG);
    const style: Style = {};
    if (angle === undefined) {
      return undefined;
    }
    for (const axis of axes) {
      style['--tw-' + prefix + DASH + axis] = prefix + axis.toUpperCase() + OPEN_PAREN + angle + CLOSE_PAREN;
    }
    style.transform = TRANSFORM;
    return result(style);
  });
}

/** Хендлер слова или произвольного значения: `origin-top-left`, `perspective-near`. */
function keywordHandler(property: string, keywords: Record<string, string>) {
  return tw((args) => {
    const value = keywordValue(args, keywords);
    return value === undefined ? undefined : result({
      [property]: value,
    });
  });
}

function setupTransforms(mn: MnInstance): void {
  const perspectives: Record<string, string> = {
    none: NONE,
  };
  let name: string;
  for (name of [
    'dramatic',
    'near',
    NORMAL,
    'midrange',
    'distant',
  ]) {
    perspectives[name] = 'var(--perspective-' + name + CLOSE_PAREN;
  }
  mn(
    'translate', translateHandler([
      X,
      Y,
    ], TRANSLATE_XY), '', 1,
  );
  mn(
    'translate-x', translateHandler([X], TRANSLATE_XY), '', 1,
  );
  mn(
    'translate-y', translateHandler([Y], TRANSLATE_XY), '', 1,
  );
  mn(
    'translate-z', translateHandler([Z], TRANSLATE_XYZ), '', 1,
  );
  mn(
    'scale', scaleTransformHandler([
      X,
      Y,
      Z,
    ], SCALE_XY), '', 1,
  );
  mn(
    'scale-x', scaleTransformHandler([X], SCALE_XY), '', 1,
  );
  mn(
    'scale-y', scaleTransformHandler([Y], SCALE_XY), '', 1,
  );
  mn(
    'scale-z', scaleTransformHandler([Z], SCALE_XYZ), '', 1,
  );
  mn(
    ROTATE, tw((args) => {
      const angle = unitValue(args, DEG);
      return angle === undefined ? undefined : result({
        rotate: angle,
      });
    }), '', 1,
  );
  mn(
    'rotate-x', transformHandler(ROTATE, [X]), '', 1,
  );
  mn(
    'rotate-y', transformHandler(ROTATE, [Y]), '', 1,
  );
  mn(
    'rotate-z', transformHandler(ROTATE, [Z]), '', 1,
  );
  mn(
    SKEW, transformHandler(SKEW, [
      X,
      Y,
    ]), '', 1,
  );
  mn(
    'skew-x', transformHandler(SKEW, [X]), '', 1,
  );
  mn(
    'skew-y', transformHandler(SKEW, [Y]), '', 1,
  );
  mn(
    'origin', keywordHandler('transformOrigin', ORIGINS), '', 1,
  );
  mn(
    'perspective-origin', keywordHandler('perspectiveOrigin', ORIGINS), '', 1,
  );
  mn(
    'perspective', keywordHandler('perspective', perspectives), '', 1,
  );
  mn(
    'transform', keywordHandler('transform', {
      '': TRANSFORM,
    }), '', 1,
  );
}

/** Медиа `@supports` для пространства интерполяции линейного градиента — как у Tailwind 4. */
const GRADIENT_MEDIA = 'twGradientInterpolation';

/** Опорные точки градиента без `via`. */
const GRADIENT_STOPS = 'var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) '
  + 'var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position))';

/** Опорные точки градиента с `via`. */
const GRADIENT_VIA_STOPS = 'var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), '
  + 'var(--tw-gradient-via) var(--tw-gradient-via-position), var(--tw-gradient-to) var(--tw-gradient-to-position)';

/** `bg-linear-to-tr` → `to top right`. */
const GRADIENT_SIDES: Record<string, string> = {
  t: TOP,
  r: RIGHT,
  b: BOTTOM,
  l: LEFT,
};

/** Модификаторы оттенка: `/longer` → `in oklch longer hue`. */
const HUE_INTERPOLATIONS = [
  'longer',
  'shorter',
  'increasing',
  'decreasing',
];

/** Целый процент — позиция точки: `from-10%`. */
const REGEXP_PERCENT = /^\d+%$/;

/** Пространство интерполяции по модификатору: нет — `in oklab`, `/hsl` — `in hsl`, `/[in_hsl]` — как есть. */
function interpolation(modifier: string | undefined): string {
  return modifier === undefined ? 'in oklab'
    : modifier[0] === OPEN_BRACKET ? modifier.slice(1, -1).replace(/_/g, SPACE)
      : HUE_INTERPOLATIONS.indexOf(modifier) >= 0 ? 'in oklch ' + modifier + ' hue' : 'in ' + modifier;
}

/** Направление линейного градиента: `to-tr` → `to top right`, `45` → `45deg` (минус — `calc`). */
function linearPosition(args: MnTwArgs): string | undefined {
  const parts = args.parts;
  const side = parts.length === 2 && parts[0] === TO && parts[1].length <= 2 ? parts[1] : undefined;
  if (side) {
    return args.negative || !GRADIENT_SIDES[side[0]] || side[1] && !GRADIENT_SIDES[side[1]] ? undefined
      : 'to ' + GRADIENT_SIDES[side[0]] + (side[1] ? SPACE + GRADIENT_SIDES[side[1]] : '');
  }
  return parts.length === 1 && REGEXP_INTEGER.test(parts[0])
    ? (args.negative ? CALC_OPEN + parts[0] + 'deg * -1)' : parts[0] + DEG) : undefined;
}

/** `bg-linear`, `bg-radial`, `bg-conic`: произвольное — запасным значением в `var(--tw-gradient-stops, …)`. */
function gradientHandler(kind: 'linear' | 'radial' | 'conic') {
  return tw((args) => {
    const image = kind + '-gradient(var(--tw-gradient-stops';
    let position: string | undefined;
    if (args.arbitrary !== undefined) {
      return args.parts.length || args.negative || args.modifier !== undefined ? undefined : result({
        '--tw-gradient-position': args.arbitrary,
        backgroundImage: image + ',' + args.arbitrary + CLOSE_TWO_PARENS,
      });
    }
    if (kind === LINEAR) {
      position = linearPosition(args);
      return position === undefined ? undefined : {
        style: {
          '--tw-gradient-position': position,
          backgroundImage: image + CLOSE_TWO_PARENS,
        },
        media: {
          [GRADIENT_MEDIA]: {
            style: {
              '--tw-gradient-position': position + SPACE + interpolation(args.modifier),
            },
          },
        },
      };
    }
    // У радиального — только голое имя; у конического — ещё угол начала.
    position = !args.parts.length ? (args.negative ? undefined : '')
      : kind === CONIC && args.parts.length === 1 && REGEXP_INTEGER.test(args.parts[0])
        ? 'from ' + (args.negative ? CALC_OPEN + args.parts[0] + 'deg * -1)' : args.parts[0] + DEG) + SPACE : undefined;
    return position === undefined ? undefined : result({
      '--tw-gradient-position': position + interpolation(args.modifier),
      backgroundImage: image + CLOSE_TWO_PARENS,
    });
  });
}

/** Произвольное значение — позиция точки (`[10px]`, `[length:var(--x)]`), а не цвет; `var()` без типа — цвет. */
function isPositionArg(args: MnTwArgs): boolean {
  return args.arbitrary !== undefined && (args.type === LENGTH || args.type === 'percentage'
    || !args.type && args.arbitrary.indexOf(VAR_OPEN) !== 0 && REGEXP_LENGTH.test(args.arbitrary));
}

/** `from`, `via`, `to`: цвет точки или её позиция (`from-10%`, `from-[10px]`). */
function gradientStopHandler(stop: 'from' | 'via' | 'to') {
  return tw((args) => {
    const position = args.negative || args.modifier !== undefined ? undefined
      : isPositionArg(args) ? (args.parts.length ? undefined : args.arbitrary)
        : args.parts.length === 1 && REGEXP_PERCENT.test(args.parts[0]) ? args.parts[0] : undefined;
    const color = position === undefined && !isPositionArg(args) ? colorValue(args) : undefined;
    if (position !== undefined) {
      return result({
        ['--tw-gradient-' + stop + '-position']: position,
      });
    }
    return color && colorResult(
      ['--tw-gradient-' + stop], color, stop === VIA ? {
        '--tw-gradient-via-stops': GRADIENT_VIA_STOPS,
        '--tw-gradient-stops': 'var(--tw-gradient-via-stops)',
      } : {
        '--tw-gradient-stops': GRADIENT_STOPS,
      },
    );
  });
}

function setupGradients(mn: MnInstance): void {
  mn(
    'bg-linear', gradientHandler(LINEAR), '', 1,
  );
  mn(
    'bg-radial', gradientHandler('radial'), '', 1,
  );
  mn(
    'bg-conic', gradientHandler(CONIC), '', 1,
  );
  mn(
    FROM, gradientStopHandler(FROM), '', 1,
  );
  mn(
    VIA, gradientStopHandler(VIA), '', 1,
  );
  mn(
    TO, gradientStopHandler(TO), '', 1,
  );
}

/** Сборка фильтров фона — `backdrop-filter` Tailwind 4. */
const BACKDROP_FILTER = 'var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) '
  + 'var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) '
  + 'var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,)';

/** Описание функции фильтра. */
interface FilterFunction {
  /** Единица целого значения: `%`, `deg`; у `blur` — нет (размеры темы). */
  unit?: string;
  /** Значение голого имени: `grayscale` → `100%`, `blur` → `8px`. */
  bare?: string;
  /** Принимает минус (`-hue-rotate-15`). */
  negative?: boolean;
}

/** Функции фильтра Tailwind 4: имя утилиты → описание; имя функции CSS — то же. */
const FILTER_FUNCTIONS: Record<string, FilterFunction> = {
  blur: {
    bare: '8px',
  },
  brightness: {
    unit: PERCENT,
  },
  contrast: {
    unit: PERCENT,
  },
  grayscale: {
    unit: PERCENT,
    bare: HUNDRED_PERCENT,
  },
  'hue-rotate': {
    unit: DEG,
    negative: true,
  },
  invert: {
    unit: PERCENT,
    bare: HUNDRED_PERCENT,
  },
  saturate: {
    unit: PERCENT,
  },
  sepia: {
    unit: PERCENT,
    bare: HUNDRED_PERCENT,
  },
};

/** Аргумент функции фильтра: голое имя, целое с единицей, размер темы `blur`, `none` или произвольное. */
function filterArgument(args: MnTwArgs, fn: FilterFunction): string | undefined {
  const key = args.parts.join(DASH);
  const value = args.modifier !== undefined || args.negative && !fn.negative ? undefined
    : args.arbitrary !== undefined ? (args.parts.length ? undefined : args.arbitrary)
      : !args.parts.length ? fn.bare
        : fn.unit ? (args.parts.length === 1 && REGEXP_INTEGER.test(key) ? key + fn.unit : undefined)
          : TW4_THEME['--blur-' + key] ? 'var(--blur-' + key + CLOSE_PAREN : undefined;
  return value && args.negative ? negateCalc(value) : value;
}

/**
 * Хендлер функции фильтра: `blur-sm` → `--tw-blur: blur(var(--blur-sm))` и общая сборка; у `backdrop-*` — те же
 * значения в `--tw-backdrop-*` и `backdrop-filter` с префиксом `-webkit-`.
 */
function filterHandler(
  name: string, fn: FilterFunction, backdrop: boolean,
) {
  const variable = '--tw-' + (backdrop ? 'backdrop-' : '') + name;
  return tw((args) => {
    const none = name === 'blur' && args.parts.length === 1 && args.parts[0] === NONE && args.arbitrary === undefined;
    const value = none ? undefined : filterArgument(args, fn);
    if (!none && value === undefined || none && (args.negative || args.modifier !== undefined)) {
      return undefined;
    }
    return result({
      [variable]: none ? SPACE : name + OPEN_PAREN + value + CLOSE_PAREN,
      ...backdrop ? styleOf([
        '-webkit-backdrop-filter',
        'backdropFilter',
      ], BACKDROP_FILTER) : {
        filter: FILTER,
      },
    });
  });
}

/** `filter`, `backdrop-filter`: голое имя — сборка, `none`, произвольное — само значение. */
function filterRootHandler(properties: string[], value: string) {
  return tw((args) => {
    const key = args.parts.join(DASH);
    const own = args.negative || args.modifier !== undefined ? undefined
      : args.arbitrary !== undefined ? (key ? undefined : args.arbitrary)
        : key === NONE ? key : key ? undefined : value;
    return own === undefined ? undefined : result(styleOf(properties, own));
  });
}

function setupFilters(mn: MnInstance): void {
  let name: string;
  for (name in FILTER_FUNCTIONS) { // eslint-disable-line
    mn(
      name, filterHandler(
        name, FILTER_FUNCTIONS[name], false,
      ), '', 1,
    );
    mn(
      'backdrop-' + name, filterHandler(
        name, FILTER_FUNCTIONS[name], true,
      ), '', 1,
    );
  }
  mn(
    'backdrop-opacity', filterHandler(
      OPACITY, {
        unit: PERCENT,
      }, true,
    ), '', 1,
  );
  mn(
    'filter', filterRootHandler(['filter'], FILTER), '', 1,
  );
  mn(
    'backdrop-filter', filterRootHandler([
      '-webkit-backdrop-filter',
      'backdropFilter',
    ], BACKDROP_FILTER), '', 1,
  );
}

/** Свойства перехода `transition-colors`. */
const TRANSITION_COLORS = 'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, '
  + '--tw-gradient-from, --tw-gradient-via, --tw-gradient-to';

/** Слова `transition-*` → `transition-property`; голое имя — набор по умолчанию. */
const TRANSITION_PROPERTIES: Record<string, string> = {
  '': TRANSITION_COLORS + ', opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, '
    + 'backdrop-filter, display, content-visibility, overlay, pointer-events',
  all: 'all',
  colors: TRANSITION_COLORS,
  opacity: OPACITY,
  shadow: 'box-shadow',
  transform: 'transform, translate, scale, rotate',
};

/** Кривые `ease-*`: `linear`, `initial` — сами слова, остальные — из темы. */
const EASE_KEYWORDS: Record<string, string> = {
  linear: LINEAR,
  initial: 'initial',
};

/** Время: целое → `Nms`, произвольное — как есть; минуса и модификатора нет. */
function milliseconds(args: MnTwArgs): string | undefined {
  return args.negative || args.modifier !== undefined ? undefined
    : args.arbitrary !== undefined ? (args.parts.length ? undefined : args.arbitrary)
      : args.parts.length === 1 && REGEXP_INTEGER.test(args.parts[0]) ? args.parts[0] + 'ms' : undefined;
}

function setupTransitions(mn: MnInstance): void {
  mn(
    'transition', tw((args) => {
      const key = args.parts.join(DASH);
      const none = key === NONE;
      const property = args.negative || args.modifier !== undefined ? undefined
        : args.arbitrary !== undefined ? (key ? undefined : args.arbitrary)
          : none ? key : TRANSITION_PROPERTIES[key];
      // `transition-none` — только свойство, без кривой и длительности.
      return property === undefined ? undefined : result(none ? {
        transitionProperty: property,
      } : {
        transitionProperty: property,
        transitionTimingFunction: 'var(--tw-ease, var(--default-transition-timing-function))',
        transitionDuration: 'var(--tw-duration, var(--default-transition-duration))',
      });
    }), '', 1,
  );
  mn(
    'duration', tw((args) => {
      const time = milliseconds(args);
      return time === undefined ? undefined : result({
        '--tw-duration': time,
        transitionDuration: time,
      });
    }), '', 1,
  );
  mn(
    'delay', tw((args) => {
      const time = milliseconds(args);
      return time === undefined ? undefined : result({
        transitionDelay: time,
      });
    }), '', 1,
  );
  mn(
    'ease', tw((args) => {
      const key = args.parts.join(DASH);
      const noArbitrary = args.arbitrary === undefined;
      const ease = keywordValue(args, EASE_KEYWORDS) || (noArbitrary && key && !args.negative
        && args.modifier === undefined && TW4_THEME['--ease-' + key] ? 'var(--ease-' + key + CLOSE_PAREN : undefined);
      // `ease-initial` — только сброс переменной.
      return ease === undefined ? undefined : result(key === 'initial' && noArbitrary ? {
        '--tw-ease': ease,
      } : {
        '--tw-ease': ease,
        transitionTimingFunction: ease,
      });
    }), '', 1,
  );
  mn(
    'animate', tw((args) => {
      const key = args.parts.join(DASH);
      const theme = args.arbitrary === undefined && key && TW4_THEME['--animate-' + key];
      const animation = theme ? (args.negative || args.modifier !== undefined ? undefined : 'var(--animate-' + key + CLOSE_PAREN)
        : keywordValue(args, {
          none: NONE,
        });
      const frames = theme && TW4_KEYFRAMES[theme.split(SPACE)[0]];
      // Кадры темы (`@keyframes spin`) — по требованию, как у Tailwind: один раз на имя.
      animation && frames && mn.setKeyframes(
        theme.split(SPACE)[0], frames, 1,
      );
      return animation === undefined ? undefined : result({
        animation,
      });
    }), '', 1,
  );
}

/** Точки `object-*` — как пишет их Tailwind 4 (`object-top-left` → `left top`). */
const OBJECT_POSITIONS: Record<string, string> = {
  center: 'center',
  top: TOP,
  'top-right': 'right top',
  right: RIGHT,
  'bottom-right': 'right bottom',
  bottom: BOTTOM,
  'bottom-left': 'left bottom',
  left: LEFT,
  'top-left': 'left top',
};

/** Ширины `font-stretch-*` словами. */
const FONT_STRETCHES = [
  'ultra-condensed',
  'extra-condensed',
  'condensed',
  'semi-condensed',
  NORMAL,
  'semi-expanded',
  'expanded',
  'extra-expanded',
  'ultra-expanded',
];

/** `line-clamp-none` — снятие обрезки. */
const LINE_CLAMP_NONE: Style = {
  overflow: 'visible',
  display: BLOCK,
  '-webkit-box-orient': 'horizontal',
  '-webkit-line-clamp': 'unset',
};

/** Число по правилу `test` (с единицей `unit`), слово из таблицы или произвольное; минуса и модификатора нет. */
function plainValue(
  args: MnTwArgs, test: RegExp, unit: string, keywords: Record<string, string>,
): string | undefined {
  const key = args.parts.join(DASH);
  return args.parts.length === 1 && test.test(key) && !args.negative && args.modifier === undefined ? key + unit
    : keywordValue(args, keywords);
}

/** Хендлер {@link plainValue} для одного свойства. */
function plainHandler(
  property: string, test: RegExp, unit: string, keywords: Record<string, string>,
) {
  return tw((args) => {
    const value = plainValue(
      args, test, unit, keywords,
    );
    return value === undefined ? undefined : result({
      [property]: value,
    });
  });
}

/** Ничего не подходит: числа не принимаются. */
const REGEXP_NONE = /$^/;

/** Голое имя без значения, минуса и модификатора — для вложенных статик. */
function bareOnly(make: () => MnHandlerResult) {
  return tw((args) => (args.parts.length || args.arbitrary !== undefined || args.modifier !== undefined || args.negative
    ? undefined : make()));
}

/**
 * Статики с вложенными блоками (`TW4_NESTED_STATICS`): `divide-*` — детям, `outline-hidden` — с запасным контуром
 * в `forced-colors`, `container` — максимальная ширина по брейкпоинтам.
 */
function setupNestedStatics(mn: MnInstance): void {
  const breakpoints: Record<string, MnHandlerResult> = {};
  let name: string;
  let query: string;
  for (name of [
    'solid',
    'dashed',
    'dotted',
    'double',
    NONE,
  ]) {
    mn(
      'divide-' + name, bareOnly(divideStyle(name)), '', 1,
    );
  }
  for (name of [
    X,
    Y,
  ]) {
    mn(
      'divide-' + name + REVERSE_SUFFIX, bareOnly(divideStyle('', '--tw-divide-' + name + REVERSE_SUFFIX)), '', 1,
    );
  }
  mn(
    'outline-hidden', bareOnly(() => ({
      style: {
        '--tw-outline-style': NONE,
        outlineStyle: NONE,
      },
      media: {
        'forced-colors': {
          style: {
            outline: '2px solid transparent',
            outlineOffset: '2px',
          },
        },
      },
    })), '', 1,
  );
  // Тот же запрос «от брейкпоинта», что даёт вариант `sm:` (медиа с ключом-запросом, как у ядра).
  for (name of BREAKPOINTS) {
    query = '(width >= ' + TW4_THEME['--breakpoint-' + name] + CLOSE_PAREN;
    mn.media[query] || (mn.media[query] = {
      query,
    });
    breakpoints[query] = {
      style: {
        maxWidth: TW4_THEME['--breakpoint-' + name],
      },
    };
  }
  mn(
    'container', bareOnly(() => ({
      style: {
        width: HUNDRED_PERCENT,
      },
      media: breakpoints,
    })), '', 1,
  );
}

/** Стиль рамок между детьми (`divide-dashed`) или флаг обратного порядка (`divide-x-reverse`). */
function divideStyle(style: string, reverse?: string) {
  return (): MnHandlerResult => ({
    selectors: [DIVIDE_CHILDREN],
    style: reverse ? {
      [reverse]: ONE,
    } : {
      '--tw-border-style': style,
      borderStyle: style,
    },
  });
}

function setupMisc(mn: MnInstance): void {
  const containers: Record<string, string> = {
    auto: AUTO,
  };
  const stretches: Record<string, string> = {};
  const autoTracks = {
    auto: AUTO,
    min: 'min-content',
    max: 'max-content',
    fr: 'minmax(0, 1fr)',
  };
  let name: string;
  for (name in TW4_THEME) { // eslint-disable-line
    name.indexOf('--container-') === 0 && (containers[name.slice(12)] = VAR_OPEN + name + CLOSE_PAREN);
  }
  for (name of FONT_STRETCHES) {
    stretches[name] = name;
  }
  mn(
    OPACITY, plainHandler(
      OPACITY, REGEXP_NUMBER, PERCENT, {},
    ), '', 1,
  );
  mn(
    'zoom', plainHandler(
      'zoom', REGEXP_INTEGER, PERCENT, {},
    ), '', 1,
  );
  mn(
    'tab', plainHandler(
      'tabSize', REGEXP_INTEGER, '', {},
    ), '', 1,
  );
  mn(
    'columns', plainHandler(
      'columns', REGEXP_INTEGER, '', containers,
    ), '', 1,
  );
  mn(
    'font-stretch', plainHandler(
      'fontStretch', REGEXP_PERCENT, '', stretches,
    ), '', 1,
  );
  mn(
    'object', plainHandler(
      'objectPosition', REGEXP_NONE, '', OBJECT_POSITIONS,
    ), '', 1,
  );
  mn(
    'auto-cols', plainHandler(
      'gridAutoColumns', REGEXP_NONE, '', autoTracks,
    ), '', 1,
  );
  mn(
    'auto-rows', plainHandler(
      'gridAutoRows', REGEXP_NONE, '', autoTracks,
    ), '', 1,
  );
  mn(
    'list', plainHandler(
      'listStyleType', REGEXP_NONE, '', {
        disc: 'disc',
        decimal: 'decimal',
        none: NONE,
      },
    ), '', 1,
  );
  mn(
    'list-image', plainHandler(
      'listStyleImage', REGEXP_NONE, '', {
        none: NONE,
      },
    ), '', 1,
  );
  mn(
    'indent', scaleHandler(['textIndent'], {
      keywords: {
        px: ONE_PX,
      },
      negative: true,
    }), '', 1,
  );
  // `aspect-4/3` → `4/3`: дробь — модификатором.
  mn(
    'aspect', tw((args) => {
      const key = args.parts.join(DASH);
      const ratio = args.modifier !== undefined && args.arbitrary === undefined && !args.negative
        && args.parts.length === 1 && REGEXP_NUMBER.test(key) && REGEXP_NUMBER.test(args.modifier)
        ? key + '/' + args.modifier
        : keywordValue(args, {
          auto: AUTO,
          square: '1 / 1',
          video: 'var(--aspect-video)',
        });
      return ratio === undefined ? undefined : result({
        aspectRatio: ratio,
      });
    }), '', 1,
  );
  mn(
    'line-clamp', tw((args) => {
      const lines = plainValue(
        args, REGEXP_INTEGER, '', {},
      );
      return args.parts.length === 1 && args.parts[0] === NONE && !args.negative && args.modifier === undefined
        ? result(LINE_CLAMP_NONE) : lines === undefined ? undefined : result({
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': lines,
        });
    }), '', 1,
  );
}

/** Общая часть всех масок Tailwind 4: три слоя, пересечение. */
const MASK_BASE: Style = {
  maskImage: 'var(--tw-mask-linear), var(--tw-mask-radial), var(--tw-mask-conic)',
  maskComposite: 'intersect',
};

/** Стороны масок-краёв: `mask-x-*` — правая и левая, `mask-y-*` — верх и низ. */
const MASK_EDGES: Record<string, string[]> = {
  t: [TOP],
  r: [RIGHT],
  b: [BOTTOM],
  l: [LEFT],
  x: [
    RIGHT,
    LEFT,
  ],
  y: [
    TOP,
    BOTTOM,
  ],
};

/** Точки форм `mask-linear/radial/conic-from/to-*`: переменная точек и сама форма. */
const MASK_SHAPE_STOPS: Record<string, Style> = {
  linear: {
    '--tw-mask-linear-stops': 'var(--tw-mask-linear-position), var(--tw-mask-linear-from-color) '
      + 'var(--tw-mask-linear-from-position), var(--tw-mask-linear-to-color) var(--tw-mask-linear-to-position)',
    '--tw-mask-linear': 'linear-gradient(var(--tw-mask-linear-stops))',
  },
  radial: {
    '--tw-mask-radial-stops': 'var(--tw-mask-radial-shape) var(--tw-mask-radial-size) at var(--tw-mask-radial-position), '
      + 'var(--tw-mask-radial-from-color) var(--tw-mask-radial-from-position), var(--tw-mask-radial-to-color) '
      + 'var(--tw-mask-radial-to-position)',
    '--tw-mask-radial': 'radial-gradient(var(--tw-mask-radial-stops))',
  },
  conic: {
    '--tw-mask-conic-stops': 'from var(--tw-mask-conic-position), var(--tw-mask-conic-from-color) '
      + 'var(--tw-mask-conic-from-position), var(--tw-mask-conic-to-color) var(--tw-mask-conic-to-position)',
    '--tw-mask-conic': 'conic-gradient(var(--tw-mask-conic-stops))',
  },
};

/** Стиль края маски: `--tw-mask-top: linear-gradient(to top, …)` и сборка краёв. */
function maskEdgeStyle(sides: string[]): Style {
  const style: Style = {
    '--tw-mask-linear': 'var(--tw-mask-left), var(--tw-mask-right), var(--tw-mask-bottom), var(--tw-mask-top)',
  };
  let side: string;
  for (side of sides) {
    style[TW_MASK_PREFIX + side] = 'linear-gradient(to ' + side + ', var(--tw-mask-' + side + '-from-color) var(--tw-mask-' + side
      + '-from-position), var(--tw-mask-' + side + '-to-color) var(--tw-mask-' + side + '-to-position))';
  }
  return style;
}

/**
 * Хендлер точки маски `from`/`to`: позиция (`50%`, шаг `--spacing`, произвольная длина, `(--x)`) или цвет
 * (палитра с прозрачностью, произвольный цвет) — в переменные `--tw-mask-<имя>-<точка>-*` каждого имени.
 */
function maskStopHandler(
  names: string[], stop: string, shape: Style,
) {
  return tw((args) => {
    const key = args.parts.join(DASH);
    const arbitrary = args.arbitrary;
    const hasArbitrary = arbitrary !== undefined;
    const colorArbitrary = hasArbitrary && (args.type === COLOR
      || !args.type && arbitrary.indexOf(VAR_OPEN) !== 0 && REGEXP_COLOR_LIKE.test(arbitrary));
    const position = args.negative || args.modifier !== undefined || colorArbitrary ? undefined
      : hasArbitrary ? (key ? undefined : arbitrary)
        : args.parts.length !== 1 ? undefined
          : REGEXP_PERCENT.test(key) ? key : REGEXP_NUMBER.test(key) ? spacing(key) : undefined;
    const noPosition = position === undefined;
    const color = noPosition && (arbitrary === undefined || colorArbitrary) ? colorValue(args) : undefined;
    const suffix = DASH + stop + DASH + (noPosition ? COLOR : 'position');
    if (noPosition && color === undefined) {
      return undefined;
    }
    return colorResult(
      names.map((name) => TW_MASK_PREFIX + name + suffix), color || [position as string], {
        ...MASK_BASE,
        ...shape,
      },
    );
  });
}

/** Угол шага, как пишет Tailwind 4: `0` → `0deg` (и с минусом), `1` → `1deg`/`-1deg`, иначе `calc(1deg * ±n)`. */
function maskAngle(step: string, negative: boolean): string {
  return step === ZERO ? '0deg' : step === ONE ? (negative ? '-1deg' : '1deg')
    : 'calc(1deg * ' + (negative ? DASH : '') + step + CLOSE_PAREN;
}

/** `mask-linear-45`, `-mask-conic-90`, `mask-linear-[3deg]`: угол формы. */
function maskAngleHandler(shape: 'linear' | 'conic') {
  return tw((args) => {
    const key = args.parts.join(DASH);
    const angle = args.modifier !== undefined ? undefined
      : args.arbitrary !== undefined ? (key ? undefined : args.negative ? negateCalc(args.arbitrary) : args.arbitrary)
        : args.parts.length === 1 && REGEXP_INTEGER.test(key) ? maskAngle(key, args.negative) : undefined;
    return angle === undefined ? undefined : result({
      ...MASK_BASE,
      [TW_MASK_PREFIX + shape]: shape + '-gradient(var(--tw-mask-' + shape + '-stops, var(--tw-mask-' + shape + '-position)))',
      [TW_MASK_PREFIX + shape + '-position']: angle,
    });
  });
}

function setupMasks(mn: MnInstance): void {
  let name: string;
  let stop: string;
  for (name in MASK_EDGES) { // eslint-disable-line
    for (stop of [
      FROM,
      TO,
    ]) {
      mn(
        'mask-' + name + DASH + stop, maskStopHandler(
          MASK_EDGES[name], stop, maskEdgeStyle(MASK_EDGES[name]),
        ), '', 1,
      );
    }
  }
  for (name in MASK_SHAPE_STOPS) { // eslint-disable-line
    for (stop of [
      FROM,
      TO,
    ]) {
      mn(
        'mask-' + name + DASH + stop, maskStopHandler(
          [name], stop, MASK_SHAPE_STOPS[name],
        ), '', 1,
      );
    }
  }
  mn(
    'mask-linear', maskAngleHandler(LINEAR), '', 1,
  );
  mn(
    'mask-conic', maskAngleHandler(CONIC), '', 1,
  );
}

/** Типы `@container-*`: голое имя — `inline-size`. */
const CONTAINER_TYPES: Record<string, string> = {
  '': 'inline-size',
  normal: NORMAL,
  size: 'size',
};

/** `@…` без утилиты — сообщение вместо тишины (D-086): в этом режиме `@` начинает только `@container`. */
function failAtToken(token: string): never {
  throw new MnParseError('"' + token + '": in tw4-compatible mode a class starting with "@" is a container — '
    + '@container, @container/name, @container-normal, @container-size; a container variant needs ":" '
    + '(@md:flex). The class gives no CSS.', {
    token,
    handler: AT,
    arg: token.slice(1),
  });
}

/**
 * Контейнерные запросы (D-086): маркер `@container` (`/имя` — `container-name`), тип `-normal`, `-size`,
 * `-[…]`. Шкала контейнеров и брейкпоинты — общие, из `presetMedias` (D-090). Прочее на `@` — сообщение.
 */
function setupContainers(mn: MnInstance): void {
  mn(
    '@container', tw((args, p) => {
      const label = args.modifier === undefined ? undefined
        : args.modifier[0] === OPEN_BRACKET ? args.modifier.slice(1, -1) : args.modifier;
      const type = args.negative ? undefined : keywordValue({
        ...args,
        modifier: undefined,
      }, CONTAINER_TYPES);
      if (type === undefined) {
        return failAtToken((args.negative ? DASH : '') + '@container' + p.suffix);
      }
      return result(label ? {
        containerType: type,
        containerName: label,
      } : {
        containerType: type,
      });
    }), '', 1,
  );
  mn(
    AT, (p) => failAtToken(AT + p.suffix), '', 1,
  );
}

function setupVariants(mn: MnInstance): void {
  mn.media[COLOR_MIX_MEDIA] = {
    supports: '(color: color-mix(in lab, red, red))',
  };
  mn.media[GRADIENT_MEDIA] = {
    supports: '(background-image: linear-gradient(in lab, red, red))',
  };
  mn.synonyms(VARIANTS);
  mn.variantPrefixedSynonyms({
    group: '.group',
    peer: '.peer~',
  });
}

/** Переменные из значений стиля — в `use`. */
function trackStyle(style: Style | undefined, use: (value: string) => void): void {
  let property: string;
  for (property in style) { // eslint-disable-line
    use(String((style as Style)[property]));
  }
}

/**
 * Переменные темы — по требованию (D-069, D-071): хендлер пресета вернул стиль с
 * `var(--color-blue-500)` — переменная один раз уходит в `:root` через `mn.css`, как и у Tailwind 4 в
 * CSS попадают только использованные. Все — одним правилом в блоке `^-3000`, раньше утилит.
 * Помощники `--tw-*` — так же, но на все элементы (их начальные значения).
 */
function withThemeVars(instance: MnInstance): MnInstance {
  const used: Record<string, 1> = {};
  const use = (value: string): void => {
    let matchs: RegExpExecArray | null;
    let variable: string;
    REGEXP_VAR.lastIndex = 0;
    while ((matchs = REGEXP_VAR.exec(value))) {
      variable = matchs[1];
      used[variable] || !(TW4_THEME[variable] || TW4_PROPERTIES[variable]) || (
        used[variable] = 1,
        TW4_THEME[variable]
          ? instance.css(THEME_SELECTOR, {
            [variable]: TW4_THEME[variable],
          })
          : instance.css(DEFAULTS_SELECTOR, {
            [variable]: TW4_PROPERTIES[variable],
          })
      );
    }
  };
  const track = (handler: MnHandler): MnHandler => (p) => {
    const essence = handler(p);
    const media = essence ? essence.media || {} : {};
    let name: string;
    essence && trackStyle(essence.style as Style | undefined, use);
    // Переменные из вариантов под медиа (`@supports` смеси цветов) — тоже в `:root`.
    for (name in media) { // eslint-disable-line
      trackStyle(media[name].style as Style | undefined, use);
    }
    return essence;
  };
  return new Proxy(instance, {
    apply(
      target, thisArg, args: unknown[],
    ) {
      return typeof args[1] === 'function'
        ? target(
          args[0] as string, track(args[1] as MnHandler) as never, args[2] as string, args[3] as number,
        )
        : target(...(args as Parameters<MnInstance>));
    },
  });
}

/**
 * Пресет-клон Tailwind 4 (D-068): `ecosystems: ['tw4']`, запись `'tw4-compatible'`. Требует
 * `presetMedias` — признаки устройства (`dark:`, `print:`, `motion-safe:`, …).
 *
 * @example
 * mn.setPresets([presetTw4]);
 * // class="mt-4 md:flex hover:bg-blue-500/50 text-sm font-bold rounded-lg"
 */
export default {
  name: 'presetTw4',
  requires: ['presetMedias'],
  ecosystems: ['tw4'],
  notationMode: 'tw4-compatible',
  setup: (instance: MnInstance) => {
    const mn = withThemeVars(instance);
    setupStatics(mn);
    setupSpacing(mn);
    setupSizing(mn);
    setupLayout(mn);
    setupFlexGrid(mn);
    setupTypography(mn);
    setupBorders(mn);
    setupColors(mn);
    setupColorUtilities(mn);
    setupShadows(mn);
    setupTransforms(mn);
    setupGradients(mn);
    setupFilters(mn);
    setupTransitions(mn);
    setupMisc(mn);
    setupNestedStatics(mn);
    setupMasks(mn);
    setupContainers(mn);
    setupVariants(mn);
  },
} as MnPresetObject;
