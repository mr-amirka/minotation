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
  MnInstance, MnHandler, MnHandlerResult,
} from '../../types';
import type {
  MnPresetObject,
} from '../../core/types';
import {
  tw,
} from '../shared/tw';
import type {
  MnTwArgs,
} from '../shared/tw';
import {
  TW4_THEME,
} from './theme';
import {
  TW4_NEGATIVE_STATICS, TW4_PROPERTIES, TW4_STATICS,
} from './statics';

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
    'flex', tw((args) => {
      const step = args.parts[0];
      // Модификатор — только у дроби: `flex-1/2` → `calc(1/2 * 100%)`.
      const value = args.arbitrary !== undefined ? (args.modifier === undefined ? args.arbitrary : undefined)
        : args.parts.length !== 1 || !REGEXP_INTEGER.test(step) ? undefined
          : args.modifier === undefined ? step
            : REGEXP_INTEGER.test(args.modifier) ? 'calc(' + step + '/' + args.modifier + ' * 100%)' : undefined;
      return !args.parts.length && args.arbitrary === undefined ? (args.modifier === undefined ? result({
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
    const value = args.modifier !== undefined ? undefined
      : !args.parts.length && args.arbitrary === undefined ? '1'
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


/** Длина-«пиксели» Tailwind 4: `2` → `2px`, произвольная длина как есть; с минусом — `calc(… * -1)`. */
function pixels(args: MnTwArgs, negative?: boolean): string | undefined {
  const value = args.modifier !== undefined || args.negative && !negative ? undefined
    : args.arbitrary !== undefined ? (args.parts.length ? undefined : args.arbitrary)
      : args.parts.length === 1 && REGEXP_INTEGER.test(args.parts[0]) ? args.parts[0] + 'px' : undefined;
  return value && args.negative ? 'calc(' + value + ' * -1)' : value;
}

/** Произвольное значение — длина (`[3px]`, `[length:var(--x)]`), а не цвет. */
function isLengthArg(args: MnTwArgs): boolean {
  return args.arbitrary !== undefined && (args.type === 'length' || !args.type && REGEXP_LENGTH.test(args.arbitrary));
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
      : !args.parts.length ? '1px' : args.parts.length === 1 && REGEXP_INTEGER.test(args.parts[0]) ? args.parts[0] + 'px' : undefined;
  const reverse = 'var(--tw-divide-' + axis + '-reverse)';
  const start = axis === 'x' ? 'borderInlineStart' : 'borderTop';
  const end = axis === 'x' ? 'borderInlineEnd' : 'borderBottom';
  return width === undefined ? undefined : {
    selectors: [DIVIDE_CHILDREN],
    style: {
      ['--tw-divide-' + axis + '-reverse']: '0',
      ...(axis === 'x' ? {
        borderInlineStyle: 'var(--tw-border-style)',
      } : {
        borderBottomStyle: 'var(--tw-border-style)',
        borderTopStyle: 'var(--tw-border-style)',
      }),
      [start + 'Width']: 'calc(' + width + ' * ' + reverse + ')',
      [end + 'Width']: 'calc(' + width + ' * calc(1 - ' + reverse + '))',
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
      const offset = pixels(args, true);
      return offset === undefined ? undefined : result({
        textUnderlineOffset: offset,
      });
    }), '', 1,
  );
  mn(
    'outline', colorOr(['outlineColor'], (args) => {
      const width = !args.parts.length && args.arbitrary === undefined && args.modifier === undefined && !args.negative
        ? '1px' : isLengthArg(args) || args.arbitrary === undefined ? pixels(args) : undefined;
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
        ...colorResult(['color'], color),
        selectors: ['&::placeholder'],
      };
    }), '', 1,
  );
  mn(
    'divide', tw((args) => {
      const axis = args.parts[0] === 'x' || args.parts[0] === 'y' ? args.parts[0] : undefined;
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
      const width = !args.parts.length && args.arbitrary === undefined && args.modifier === undefined && !args.negative
        ? '1px' : isLengthArg(args) || args.arbitrary === undefined ? pixels(args) : undefined;
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
      const width = !args.parts.length && args.arbitrary === undefined && args.modifier === undefined && !args.negative
        ? '1px' : isLengthArg(args) || args.arbitrary === undefined ? pixels(args) : undefined;
      return width === undefined ? undefined : result({
        '--tw-inset-ring-shadow': 'inset 0 0 0 ' + width + ' var(--tw-inset-ring-color, currentcolor)',
        boxShadow: BOX_SHADOW,
      });
    }), '', 1,
  );
  let part: string;
  for (part of ['thumb', 'track']) {
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
    depth += ch === '(' ? 1 : ch === ')' ? -1 : 0;
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
    const tokens = splitTop(part.trim(), ' ').filter(Boolean);
    const i = colorIndex(tokens);
    i < 0 || (tokens[i] = 'var(' + colorVar + ', ' + (alpha ? 'oklab(from ' + tokens[i] + ' l a b / ' + alpha + ')' : tokens[i]) + ')');
    return tokens.join(' ');
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
  const literal = args.arbitrary === undefined && TW4_THEME['--color-' + args.parts.join('-')] || color;
  const mix = (value: string) => 'color-mix(in oklab, ' + value + ' var(' + alphaVar + '), transparent)';
  return alpha ? ['color-mix(in srgb, ' + literal + ' ' + alpha + ', transparent)', mix('color-mix(in oklab, ' + color + ' ' + alpha + ', transparent)')]
    : [literal, mix(color)];
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
    const key = args.parts.join('-');
    // Непонятная прозрачность у размера (`shadow-md/x`) Tailwind 4 пропускает — тень без неё.
    const alpha = args.modifier === undefined ? undefined : alphaOf(args.modifier);
    const value = args.negative ? undefined
      : args.arbitrary !== undefined ? (args.parts.length || args.type === 'color' || REGEXP_COLOR_LIKE.test(args.arbitrary)
        ? undefined : args.arbitrary)
        : family.sizes[key] || TW4_THEME[family.theme + key];
    if (args.arbitrary === undefined && key === 'none') {
      return args.modifier === undefined && !args.negative ? result(family.none) : undefined;
    }
    if (value !== undefined) {
      return result({
        ...alpha ? {
          [family.alphaVar]: alpha,
        } : {},
        ...family.size(
          shadowParts(
            value, family.colorVar, alpha,
          ), alpha, args.arbitrary === undefined ? key : ARBITRARY,
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
        '--tw-shadow': parts.join(', '),
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
        '--tw-inset-shadow': parts.map((part) => (part.indexOf('inset') === 0 ? part : 'inset ' + part)).join(', '),
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
        textShadow: parts.join(', '),
      }),
      none: {
        textShadow: 'none',
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
        '--tw-drop-shadow-size': parts.map((part) => 'drop-shadow(' + part + ')').join(' '),
        '--tw-drop-shadow': alpha && key || key === ARBITRARY ? 'var(--tw-drop-shadow-size)'
          : key ? 'drop-shadow(var(--drop-shadow-' + key + '))'
            : 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.1)) drop-shadow(0 1px 1px rgb(0 0 0 / 0.06))',
        filter: FILTER,
      }),
      none: {
        '--tw-drop-shadow': ' ',
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
  top: 'top',
  'top-right': '100% 0',
  right: '100%',
  'bottom-right': '100% 100%',
  bottom: 'bottom',
  'bottom-left': '0 100%',
  left: '0',
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
  return value && args.negative ? 'calc(' + value + ' * -1)' : value;
}

/** Слово из таблицы или произвольное значение; минуса нет. */
function keywordValue(args: MnTwArgs, keywords: Record<string, string>): string | undefined {
  const key = args.parts.join('-');
  return args.negative || args.modifier !== undefined ? undefined
    : args.arbitrary !== undefined ? (args.parts.length ? undefined : args.arbitrary)
      : Object.prototype.hasOwnProperty.call(keywords, key) ? keywords[key] : undefined;
}

/** `translate`, `translate-x/y/z`: шкала `--spacing`, дроби (кроме `z`), произвольное; `full`, `px` — статики. */
function translateHandler(axes: string[], value: string) {
  return tw((args) => {
    const shift = scaleValue(args, {
      fraction: axes[0] !== 'z',
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
    const factor = unitValue(args, '%');
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
    const angle = unitValue(args, 'deg');
    const style: Style = {};
    if (angle === undefined) {
      return undefined;
    }
    for (const axis of axes) {
      style['--tw-' + prefix + '-' + axis] = prefix + axis.toUpperCase() + '(' + angle + ')';
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
    none: 'none',
  };
  let name: string;
  for (name of [
    'dramatic',
    'near',
    'normal',
    'midrange',
    'distant',
  ]) {
    perspectives[name] = 'var(--perspective-' + name + ')';
  }
  mn(
    'translate', translateHandler(['x', 'y'], TRANSLATE_XY), '', 1,
  );
  mn(
    'translate-x', translateHandler(['x'], TRANSLATE_XY), '', 1,
  );
  mn(
    'translate-y', translateHandler(['y'], TRANSLATE_XY), '', 1,
  );
  mn(
    'translate-z', translateHandler(['z'], TRANSLATE_XYZ), '', 1,
  );
  mn(
    'scale', scaleTransformHandler([
      'x',
      'y',
      'z',
    ], SCALE_XY), '', 1,
  );
  mn(
    'scale-x', scaleTransformHandler(['x'], SCALE_XY), '', 1,
  );
  mn(
    'scale-y', scaleTransformHandler(['y'], SCALE_XY), '', 1,
  );
  mn(
    'scale-z', scaleTransformHandler(['z'], SCALE_XYZ), '', 1,
  );
  mn(
    'rotate', tw((args) => {
      const angle = unitValue(args, 'deg');
      return angle === undefined ? undefined : result({
        rotate: angle,
      });
    }), '', 1,
  );
  mn(
    'rotate-x', transformHandler('rotate', ['x']), '', 1,
  );
  mn(
    'rotate-y', transformHandler('rotate', ['y']), '', 1,
  );
  mn(
    'rotate-z', transformHandler('rotate', ['z']), '', 1,
  );
  mn(
    'skew', transformHandler('skew', ['x', 'y']), '', 1,
  );
  mn(
    'skew-x', transformHandler('skew', ['x']), '', 1,
  );
  mn(
    'skew-y', transformHandler('skew', ['y']), '', 1,
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
  t: 'top',
  r: 'right',
  b: 'bottom',
  l: 'left',
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
    : modifier[0] === '[' ? modifier.slice(1, -1).replace(/_/g, ' ')
      : HUE_INTERPOLATIONS.indexOf(modifier) >= 0 ? 'in oklch ' + modifier + ' hue' : 'in ' + modifier;
}

/** Направление линейного градиента: `to-tr` → `to top right`, `45` → `45deg` (минус — `calc`). */
function linearPosition(args: MnTwArgs): string | undefined {
  const parts = args.parts;
  const side = parts.length === 2 && parts[0] === 'to' && parts[1].length <= 2 ? parts[1] : undefined;
  if (side) {
    return args.negative || !GRADIENT_SIDES[side[0]] || side[1] && !GRADIENT_SIDES[side[1]] ? undefined
      : 'to ' + GRADIENT_SIDES[side[0]] + (side[1] ? ' ' + GRADIENT_SIDES[side[1]] : '');
  }
  return parts.length === 1 && REGEXP_INTEGER.test(parts[0])
    ? (args.negative ? 'calc(' + parts[0] + 'deg * -1)' : parts[0] + 'deg') : undefined;
}

/** `bg-linear`, `bg-radial`, `bg-conic`: произвольное — запасным значением в `var(--tw-gradient-stops, …)`. */
function gradientHandler(kind: 'linear' | 'radial' | 'conic') {
  return tw((args) => {
    const image = kind + '-gradient(var(--tw-gradient-stops';
    let position: string | undefined;
    if (args.arbitrary !== undefined) {
      return args.parts.length || args.negative || args.modifier !== undefined ? undefined : result({
        '--tw-gradient-position': args.arbitrary,
        backgroundImage: image + ',' + args.arbitrary + '))',
      });
    }
    if (kind === 'linear') {
      position = linearPosition(args);
      return position === undefined ? undefined : {
        style: {
          '--tw-gradient-position': position,
          backgroundImage: image + '))',
        },
        media: {
          [GRADIENT_MEDIA]: {
            style: {
              '--tw-gradient-position': position + ' ' + interpolation(args.modifier),
            },
          },
        },
      };
    }
    // У радиального — только голое имя; у конического — ещё угол начала.
    position = !args.parts.length ? (args.negative ? undefined : '')
      : kind === 'conic' && args.parts.length === 1 && REGEXP_INTEGER.test(args.parts[0])
        ? 'from ' + (args.negative ? 'calc(' + args.parts[0] + 'deg * -1)' : args.parts[0] + 'deg') + ' ' : undefined;
    return position === undefined ? undefined : result({
      '--tw-gradient-position': position + interpolation(args.modifier),
      backgroundImage: image + '))',
    });
  });
}

/** Произвольное значение — позиция точки (`[10px]`, `[length:var(--x)]`), а не цвет; `var()` без типа — цвет. */
function isPositionArg(args: MnTwArgs): boolean {
  return args.arbitrary !== undefined && (args.type === 'length' || args.type === 'percentage'
    || !args.type && args.arbitrary.indexOf('var(') !== 0 && REGEXP_LENGTH.test(args.arbitrary));
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
      ['--tw-gradient-' + stop], color, stop === 'via' ? {
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
    'bg-linear', gradientHandler('linear'), '', 1,
  );
  mn(
    'bg-radial', gradientHandler('radial'), '', 1,
  );
  mn(
    'bg-conic', gradientHandler('conic'), '', 1,
  );
  mn(
    'from', gradientStopHandler('from'), '', 1,
  );
  mn(
    'via', gradientStopHandler('via'), '', 1,
  );
  mn(
    'to', gradientStopHandler('to'), '', 1,
  );
}

function setupVariants(mn: MnInstance): void {
  let name: string;
  mn.media[COLOR_MIX_MEDIA] = {
    supports: '(color: color-mix(in lab, red, red))',
  };
  mn.media[GRADIENT_MEDIA] = {
    supports: '(background-image: linear-gradient(in lab, red, red))',
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
    setupColorUtilities(mn);
    setupShadows(mn);
    setupTransforms(mn);
    setupGradients(mn);
    setupVariants(mn);
  },
} as MnPresetObject;
