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
  MnInstance, MnHandlerResult,
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

/** Число шкалы: `4`, `0.5`, `2.5`. */
const REGEXP_NUMBER = /^\d+(?:\.\d+)?$/;

/** Значение-слово без отрицания: `auto`, `min-content`. */
const REGEXP_WORD = /^[a-z-]+$/;

/** Целое: `3`, `12`. */
const REGEXP_INTEGER = /^\d+$/;

/** Произвольное значение похоже на длину, а не на цвет: `14px`, `1.5rem`, `calc(…)`. */
const REGEXP_LENGTH = /^(?:-?[\d.]+(?:px|rem|em|%|vw|vh|svh|dvh|lvh|ch|ex|pt|cm|mm|in|q)|0|(?:calc|clamp|min|max|var)\(.*\))$/;

/** Ширины брейкпоинтов Tailwind 4 в px (`--breakpoint-sm: 40rem` и т.д. при 16px). */
const BREAKPOINTS: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

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
  hover: ':hover',
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

/** `calc(var(--spacing) * 4)` → `… * -4`; дробь → `-100%`; число → `-…`; иначе `calc(… * -1)`. */
function negate(value: string): string {
  return value.indexOf('calc(var(--spacing) * ') === 0 ? value.replace('* ', '* -')
    : / \* 100%\)$/.test(value) ? value.replace('* 100%)', '* -100%)')
      : /^[\d.]/.test(value) ? '-' + value
        : 'calc(' + value + ' * -1)';
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
      ? 'calc(' + step + '/' + args.modifier + ' * 100%)' : undefined;
  } else if (options.keywords && Object.prototype.hasOwnProperty.call(options.keywords, step)) {
    value = options.keywords[step];
  } else if (REGEXP_NUMBER.test(step)) {
    value = 'calc(var(--spacing) * ' + step + ')';
  } else if (options.container && TW4_THEME['--container-' + step]) {
    value = 'var(--container-' + step + ')';
  }
  // Слово (`auto`, `full`) отрицания не имеет; числа, дроби, `calc(…)` и `[…]` — имеют.
  // Произвольное значение Tailwind 4 отрицает через `calc(… * -1)`, как бы оно ни выглядело.
  return value && args.negative ? (REGEXP_WORD.test(value) ? undefined
    : args.arbitrary !== undefined ? 'calc(' + value + ' * -1)' : negate(value)) : value;
}

/** Цвет Tailwind 4: палитра, особые цвета, произвольный; `/50` — `color-mix(…)`. */
function colorValue(args: MnTwArgs): string | undefined {
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
  return !color || args.modifier === undefined ? color
    : REGEXP_NUMBER.test(args.modifier)
      ? 'color-mix(in oklab, ' + color + ' ' + args.modifier + '%, transparent)' : undefined;
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

/** Регистрирует статику: имя → стиль. */
function statics(mn: MnInstance, map: Record<string, Style>): void {
  let name: string;
  for (name in map) { // eslint-disable-line
    mn(name, {
      style: map[name],
    });
  }
}

/** Статика «одно свойство — разные значения»: `items-center` → `align-items: center`. */
function keywordStatics(
  mn: MnInstance, prefix: string, property: string, values: Record<string, string>,
): void {
  let word: string;
  for (word in values) { // eslint-disable-line
    mn(prefix + word, {
      style: {
        [property]: values[word],
      },
    });
  }
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
    'space-x', spaceHandler('marginInlineEnd'), '', 1,
  );
  mn(
    'space-y', spaceHandler('marginBlockEnd'), '', 1,
  );
}

function spaceHandler(property: string) {
  return tw((args) => {
    const value = scaleValue(args, {
      keywords: {
        px: '1px',
      },
      negative: true,
    });
    return value === undefined ? undefined : {
      // Скобки экранированы: в селекторах пресета скобки — группа вариантов.
      selectors: ['>:not\\(:last-child\\)'],
      style: {
        [property]: value,
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
  statics(mn, {
    block: {
      display: 'block',
    },
    'inline-block': {
      display: 'inline-block',
    },
    inline: {
      display: 'inline',
    },
    'inline-flex': {
      display: 'inline-flex',
    },
    grid: {
      display: 'grid',
    },
    'inline-grid': {
      display: 'inline-grid',
    },
    hidden: {
      display: 'none',
    },
    contents: {
      display: 'contents',
    },
    'flow-root': {
      display: 'flow-root',
    },
    'list-item': {
      display: 'list-item',
    },
    table: {
      display: 'table',
    },
    'table-row': {
      display: 'table-row',
    },
    'table-cell': {
      display: 'table-cell',
    },
    static: {
      position: 'static',
    },
    fixed: {
      position: 'fixed',
    },
    absolute: {
      position: 'absolute',
    },
    relative: {
      position: 'relative',
    },
    sticky: {
      position: 'sticky',
    },
  });
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
      first: 'calc(-infinity)',
      last: 'calc(infinity)',
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
  statics(mn, {
    'flex-row': {
      flexDirection: 'row',
    },
    'flex-row-reverse': {
      flexDirection: 'row-reverse',
    },
    'flex-col': {
      flexDirection: 'column',
    },
    'flex-col-reverse': {
      flexDirection: 'column-reverse',
    },
    'flex-wrap': {
      flexWrap: 'wrap',
    },
    'flex-nowrap': {
      flexWrap: 'nowrap',
    },
    'flex-wrap-reverse': {
      flexWrap: 'wrap-reverse',
    },
    'flex-auto': {
      flex: 'auto',
    },
    'flex-initial': {
      flex: '0 auto',
    },
    'flex-none': {
      flex: 'none',
    },
  });
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
  keywordStatics(
    mn, 'items-', 'alignItems', {
      start: 'flex-start',
      end: 'flex-end',
      center: 'center',
      baseline: 'baseline',
      stretch: 'stretch',
    },
  );
  keywordStatics(
    mn, 'justify-', 'justifyContent', {
      start: 'flex-start',
      end: 'flex-end',
      center: 'center',
      between: 'space-between',
      around: 'space-around',
      evenly: 'space-evenly',
      stretch: 'stretch',
      normal: 'normal',
    },
  );
  keywordStatics(
    mn, 'content-', 'alignContent', {
      start: 'flex-start',
      end: 'flex-end',
      center: 'center',
      between: 'space-between',
      around: 'space-around',
      evenly: 'space-evenly',
      stretch: 'stretch',
      normal: 'normal',
    },
  );
  keywordStatics(
    mn, 'self-', 'alignSelf', {
      auto: 'auto',
      start: 'flex-start',
      end: 'flex-end',
      center: 'center',
      stretch: 'stretch',
      baseline: 'baseline',
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
    : REGEXP_NUMBER.test(args.modifier) ? 'calc(var(--spacing) * ' + args.modifier + ')' : undefined;
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
    lineHeight: lineHeight || 'var(--text-' + key + '--line-height)',
  } : undefined;
}

function setupTypography(mn: MnInstance): void {
  keywordStatics(
    mn, 'text-', 'textAlign', {
      left: 'left',
      center: 'center',
      right: 'right',
      justify: 'justify',
      start: 'start',
      end: 'end',
    },
  );
  // `text-…` — размер шрифта или цвет; размер проверяется первым (`text-sm` — не цвет).
  mn(
    'text', tw((args) => {
      const size = fontSize(args);
      const color = size ? undefined : colorValue(args);
      return size ? result(size) : color === undefined ? undefined : result({
        color,
      });
    }), '', 1,
  );
  mn(
    'font', tw((args) => {
      const key = args.parts.join('-');
      return args.negative || args.modifier !== undefined ? undefined
        : args.arbitrary !== undefined && !args.parts.length
          ? result(REGEXP_INTEGER.test(args.arbitrary) || args.type === 'weight' ? {
            fontWeight: args.arbitrary,
          } : {
            fontFamily: args.arbitrary,
          })
          : TW4_THEME['--font-weight-' + key] ? result({
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
              : args.parts.length === 1 && REGEXP_NUMBER.test(key) ? 'calc(var(--spacing) * ' + key + ')' : undefined;
      return value === undefined ? undefined : result({
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
        letterSpacing: args.negative ? negate(value) : value,
      });
    }), '', 1,
  );
  statics(mn, {
    uppercase: {
      textTransform: 'uppercase',
    },
    lowercase: {
      textTransform: 'lowercase',
    },
    capitalize: {
      textTransform: 'capitalize',
    },
    'normal-case': {
      textTransform: 'none',
    },
    italic: {
      fontStyle: 'italic',
    },
    'not-italic': {
      fontStyle: 'normal',
    },
    underline: {
      textDecorationLine: 'underline',
    },
    overline: {
      textDecorationLine: 'overline',
    },
    'line-through': {
      textDecorationLine: 'line-through',
    },
    'no-underline': {
      textDecorationLine: 'none',
    },
    truncate: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  });
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
  keywordStatics(
    mn, 'border-', 'borderStyle', {
      solid: 'solid',
      dashed: 'dashed',
      dotted: 'dotted',
      double: 'double',
      hidden: 'hidden',
      none: 'none',
    },
  );
  // `border`, `border-2`, `border-t-4`, `border-red-500`, `border-[3px]`. Стиль `solid` рядом с
  // шириной — то, что у Tailwind 4 даёт `--tw-border-style` (по умолчанию `solid`).
  mn(
    'border', tw((args) => {
      const side = BORDER_SIDES[args.parts[0]];
      const rest = side ? args.parts.slice(1) : args.parts;
      const width = args.negative || args.modifier !== undefined ? undefined : borderWidth(args, rest);
      const color = width === undefined && !side ? colorValue(args) : undefined;
      return width !== undefined ? result({
        borderStyle: 'solid',
        ...styleOf(side || ['borderWidth'], width),
      }) : color === undefined ? undefined : result({
        borderColor: color,
      });
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
      return color === undefined ? undefined : result({
        backgroundColor: color,
      });
    }), '', 1,
  );
}

function setupVariants(mn: MnInstance): void {
  let name: string;
  for (name in BREAKPOINTS) { // eslint-disable-line
    mn.media[name] = {
      width: BREAKPOINTS[name],
    };
  }
  mn.synonyms(VARIANTS);
  mn.variantPrefixedSynonyms({
    group: '.group',
    peer: '.peer~',
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
  setup: (mn: MnInstance) => {
    // Тема — блок `:root` с переменными Tailwind 4 (полностью, как `theme(static)`).
    mn('tw4theme', {
      style: TW4_THEME,
    });
    mn.assign(':root', 'tw4theme');
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
