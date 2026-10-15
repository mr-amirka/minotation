/**
 * Клон Tailwind CSS 4 — подмножество (D-043, D-068): отступы, размеры, display, позиционирование,
 * flex/grid, типографика, цвета палитры с прозрачностью, рамки и скругления, брейкпоинты,
 * варианты-синонимы и метки `group`/`peer`. Значения — как в Tailwind 4: переменные темы
 * (`calc(var(--spacing) * 4)`, `var(--color-blue-500)`), тема — блоком `:root` из
 * `tw4Theme.ts` (снята с `tailwindcss@4.3.3`).
 *
 * Подключается **вместо** `presetStandard` (D-043), запись классов — режим `'tw4-compatible'`.
 * Холодный путь: только регистрация, разбор значений — в хендлерах при первой встрече класса.
 */
import type {
  MnInstance, MnHandler, MnHandlerResult,
} from '../types';
import type {
  MnPresetObject,
} from '../core/types';
import {
  tw,
} from './tw';
import type {
  MnTwArgs,
} from './tw';
import {
  TW4_THEME,
} from './tw4Theme';
import {
  TW4_NEGATIVE_STATICS, TW4_PROPERTIES, TW4_STATICS,
} from './tw4Statics';

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
  return value === '0px' ? value
    : value === 'var(--spacing)' ? 'calc(var(--spacing) * -1)'
      : value.indexOf('calc(var(--spacing) * ') === 0 ? value.replace('* ', '* -')
        : 'calc(' + value + ' * -1)';
}

/**
 * Шаг шкалы `--spacing`, как пишет его Tailwind 4: `0` → `0px`, `1` → `var(--spacing)`, остальное —
 * `calc(var(--spacing) * n)`.
 */
function spacing(step: string): string {
  return step === '0' ? '0px' : step === '1' ? 'var(--spacing)' : 'calc(var(--spacing) * ' + step + ')';
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
  if (args.arbitrary !== undefined) {
    value = parts.length || args.modifier !== undefined ? undefined : args.arbitrary;
  } else if (parts.length !== 1) {
    value = undefined;
  } else if (args.modifier !== undefined) {
    value = options.fraction && REGEXP_INTEGER.test(step) && REGEXP_INTEGER.test(args.modifier)
      ? 'calc(' + step + ' / ' + args.modifier + ' * 100%)' : undefined;
  } else if (options.keywords && Object.prototype.hasOwnProperty.call(options.keywords, step)) {
    value = options.keywords[step];
  } else if (REGEXP_NUMBER.test(step)) {
    value = spacing(step);
  } else if (options.container && TW4_THEME['--container-' + step]) {
    value = 'var(--container-' + step + ')';
  }
  // Слово с минусом (`-m-auto`) сюда не доходит: его голое имя — статика из таблицы, и у Tailwind
  // отрицательной формы нет. Произвольное значение Tailwind 4 отрицает через `calc(… * -1)`, как бы
  // оно ни выглядело (`-mt-[0px]` → `calc(0px * -1)`).
  return value && args.negative ? (args.arbitrary !== undefined ? 'calc(' + value + ' * -1)' : negate(value)) : value;
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
  return REGEXP_NUMBER.test(modifier) ? modifier + '%'
    : modifier[0] === '[' && modifier[modifier.length - 1] === ']' ? modifier.slice(1, -1) : undefined;
}

function colorValue(args: MnTwArgs): TwColor | undefined {
  const key = args.parts.join('-');
  let color: string | undefined;
  if (args.negative) {
    return undefined;
  }
  if (args.arbitrary !== undefined) {
    color = args.parts.length || args.type && args.type !== 'color' ? undefined : args.arbitrary;
  } else {
    color = SPECIAL_COLORS[key] || (TW4_THEME['--color-' + key] ? 'var(--color-' + key + ')' : undefined);
  }
  if (!color || args.modifier === undefined) {
    return color ? [color] : undefined;
  }
  const alpha = alphaOf(args.modifier);
  if (!alpha) {
    return undefined;
  }
  const mix = 'color-mix(in oklab, ' + color + ' ' + alpha + ', transparent)';
  const literal = args.arbitrary === undefined && TW4_THEME['--color-' + key];
  return literal ? ['color-mix(in srgb, ' + literal + ' ' + alpha + ', transparent)', mix]
    : /var\(|currentcolor/.test(color) ? [color, mix] : [mix];
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

function setupSpacing(mn: MnInstance): void {
  const margin = {
    m: ['margin'],
    mx: ['marginInline'],
    my: ['marginBlock'],
    mt: ['marginTop'],
    mr: ['marginRight'],
    mb: ['marginBottom'],
    ml: ['marginLeft'],
    ms: ['marginInlineStart'],
    me: ['marginInlineEnd'],
  };
  scales(
    mn, margin, {
      keywords: {
        auto: 'auto',
        px: '1px',
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
    }, {
      keywords: {
        px: '1px',
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
        px: '1px',
      },
    },
  );
  // `space-x-4` — промежуток между детьми: всем, кроме последнего, отступ в конце строки.
  mn(
    'space-x', spaceHandler('x', 'Inline'), '', 1,
  );
  mn(
    'space-y', spaceHandler('y', 'Block'), '', 1,
  );
  // `space-x-reverse` — промежутки с другой стороны (`flex-row-reverse`). Хендлер, а не статика:
  // к статике при слиянии добавляется селектор самого элемента, а нужны только дети.
  mn(
    'space-x-reverse', spaceReverse('x'), '', 1,
  );
  mn(
    'space-y-reverse', spaceReverse('y'), '', 1,
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
        ['--tw-space-' + axis + '-reverse']: '1',
      },
    }));
}

/** `space-x-4`: отступы детей с поправкой `--tw-space-x-reverse`, как у Tailwind 4. */
function spaceHandler(axis: string, side: string) {
  const reverse = 'var(--tw-space-' + axis + '-reverse)';
  return tw((args) => {
    const value = scaleValue(args, {
      keywords: {
        px: '1px',
      },
      negative: true,
    });
    // Как у Tailwind 4: ноль — просто `0`, отрицательный `px` — литерал `-1px`.
    const step = value === 'calc(1px * -1)' ? '-1px' : value;
    return step === undefined ? undefined : {
      selectors: [SPACE_CHILDREN],
      style: {
        ['--tw-space-' + axis + '-reverse']: '0',
        ['margin' + side + 'Start']: step === '0px' ? '0' : 'calc(' + step + ' * ' + reverse + ')',
        ['margin' + side + 'End']: step === '0px' ? '0' : 'calc(' + step + ' * calc(1 - ' + reverse + '))',
      },
    };
  });
}

function setupSizing(mn: MnInstance): void {
  const common = {
    auto: 'auto',
    px: '1px',
    full: '100%',
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
        none: 'none',
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
        none: 'none',
      },
      fraction: true,
    },
  );
  scales(
    mn, {
      size: ['width', 'height'],
    }, {
      keywords: common,
      fraction: true,
    },
  );
}

function setupLayout(mn: MnInstance): void {
  scales(
    mn, {
      inset: ['inset'],
      'inset-x': ['insetInline'],
      'inset-y': ['insetBlock'],
      top: ['top'],
      right: ['right'],
      bottom: ['bottom'],
      left: ['left'],
      start: ['insetInlineStart'],
      end: ['insetInlineEnd'],
    }, {
      keywords: {
        auto: 'auto',
        px: '1px',
        full: '100%',
      },
      fraction: true,
      negative: true,
    },
  );
  integers(
    mn, 'z', 'zIndex', {
      auto: 'auto',
    },
  );
  integers(
    mn, 'order', 'order', {
      first: '-9999',
      last: '9999',
      none: '0',
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
    'flex', tw((args) => (!args.parts.length && args.arbitrary === undefined ? result({
      display: 'flex',
    }) : args.arbitrary !== undefined ? result({
      flex: args.arbitrary,
    }) : args.parts.length === 1 && REGEXP_INTEGER.test(args.parts[0]) && args.modifier === undefined
      ? result({
        flex: args.parts[0],
      }) : undefined)), '', 1,
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
        auto: 'auto',
        px: '1px',
        full: '100%',
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
    const value = !args.parts.length && args.arbitrary === undefined ? '1'
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
          : step === 'none' ? 'none' : step === 'subgrid' ? 'subgrid' : undefined;
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
  integers(
    mn, axis + '-start', property + 'Start', {
      auto: 'auto',
    },
  );
  integers(
    mn, axis + '-end', property + 'End', {
      auto: 'auto',
    },
  );
}

/** Размер шрифта `text-sm`, `text-sm/6`, `text-[14px]` — или `undefined`. */
function fontSize(args: MnTwArgs): Style | undefined {
  const key = args.parts.join('-');
  const lineHeight = args.modifier === undefined ? undefined
    : REGEXP_NUMBER.test(args.modifier) ? spacing(args.modifier) : undefined;
  if (args.negative || args.modifier !== undefined && !lineHeight) {
    return undefined;
  }
  if (args.arbitrary !== undefined) {
    return !args.parts.length && (args.type === 'length' || !args.type && REGEXP_LENGTH.test(args.arbitrary))
      ? lineHeight ? {
        fontSize: args.arbitrary,
        lineHeight,
      } : {
        fontSize: args.arbitrary,
      } : undefined;
  }
  return TW4_THEME['--text-' + key] && TW4_THEME['--text-' + key].indexOf('rem') > 0 ? {
    fontSize: 'var(--text-' + key + ')',
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
      return size ? result(size) : color === undefined ? undefined : colorResult(['color'], color);
    }), '', 1,
  );
  mn(
    'font', tw((args) => {
      const key = args.parts.join('-');
      return args.negative || args.modifier !== undefined ? undefined
        : args.arbitrary !== undefined && !args.parts.length
          ? result(REGEXP_INTEGER.test(args.arbitrary) || args.type === 'weight' ? {
            '--tw-font-weight': args.arbitrary,
            fontWeight: args.arbitrary,
          } : {
            fontFamily: args.arbitrary,
          })
          : TW4_THEME['--font-weight-' + key] ? result({
            '--tw-font-weight': 'var(--font-weight-' + key + ')',
            fontWeight: 'var(--font-weight-' + key + ')',
          }) : TW4_THEME['--font-' + key] ? result({
            fontFamily: 'var(--font-' + key + ')',
          }) : undefined;
    }), '', 1,
  );
  mn(
    'leading', tw((args) => {
      const key = args.parts.join('-');
      const value = args.negative || args.modifier !== undefined ? undefined
        : args.arbitrary !== undefined && !args.parts.length ? args.arbitrary
          : key === 'none' ? '1'
            : TW4_THEME['--leading-' + key] ? 'var(--leading-' + key + ')'
              : args.parts.length === 1 && REGEXP_NUMBER.test(key) ? spacing(key) : undefined;
      return value === undefined ? undefined : result({
        '--tw-leading': value,
        lineHeight: value,
      });
    }), '', 1,
  );
  mn(
    'tracking', tw((args) => {
      const key = args.parts.join('-');
      const value = args.modifier !== undefined ? undefined
        : args.arbitrary !== undefined && !args.parts.length ? args.arbitrary
          : TW4_THEME['--tracking-' + key] ? 'var(--tracking-' + key + ')' : undefined;
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
};

const RADIUS_SIDES: Record<string, string[]> = {
  t: ['borderTopLeftRadius', 'borderTopRightRadius'],
  r: ['borderTopRightRadius', 'borderBottomRightRadius'],
  b: ['borderBottomRightRadius', 'borderBottomLeftRadius'],
  l: ['borderTopLeftRadius', 'borderBottomLeftRadius'],
  s: ['borderStartStartRadius', 'borderEndStartRadius'],
  e: ['borderStartEndRadius', 'borderEndEndRadius'],
  tl: ['borderTopLeftRadius'],
  tr: ['borderTopRightRadius'],
  br: ['borderBottomRightRadius'],
  bl: ['borderBottomLeftRadius'],
  ss: ['borderStartStartRadius'],
  se: ['borderStartEndRadius'],
  ee: ['borderEndEndRadius'],
  es: ['borderEndStartRadius'],
};

/** Ширина рамки: пусто → `1px`, целое → `Npx`, `[…]` — как есть. */
function borderWidth(args: MnTwArgs, rest: string[]): string | undefined {
  return args.arbitrary !== undefined ? (!rest.length && (args.type === 'length'
    || !args.type && REGEXP_LENGTH.test(args.arbitrary)) ? args.arbitrary : undefined)
    : !rest.length ? '1px' : rest.length === 1 && REGEXP_INTEGER.test(rest[0]) ? rest[0] + 'px' : undefined;
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
    'none',
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
        ...styleOf(widths.map((name) => name.replace('Width', 'Style')), 'var(--tw-border-style)'),
        ...styleOf(widths, width),
      }) : color === undefined ? undefined : colorResult(widths.map((name) => name.replace('Width', 'Color')), color);
    }), '', 1,
  );
  // `rounded`, `rounded-lg`, `rounded-t-lg`, `rounded-full`, `rounded-[3px]`.
  mn(
    'rounded', tw((args) => {
      const side = RADIUS_SIDES[args.parts[0]];
      const rest = side ? args.parts.slice(1) : args.parts;
      const key = rest.join('-');
      const value = args.negative || args.modifier !== undefined ? undefined
        : args.arbitrary !== undefined ? (rest.length ? undefined : args.arbitrary)
          : !rest.length ? '0.25rem'
            : key === 'none' ? '0' : key === 'full' ? 'calc(infinity * 1px)'
              : TW4_THEME['--radius-' + key] ? 'var(--radius-' + key + ')' : undefined;
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

function setupVariants(mn: MnInstance): void {
  let name: string;
  mn.media[COLOR_MIX_MEDIA] = {
    supports: '(color: color-mix(in lab, red, red))',
  };
  for (name of BREAKPOINTS) {
    mn.media[name] = {
      width: TW4_THEME['--breakpoint-' + name],
    };
  }
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
    setupVariants(mn);
  },
} as MnPresetObject;
