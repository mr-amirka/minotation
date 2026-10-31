import type {
  StandardContext,
} from './context';
import type {
  MnEssenceParams,
} from '../../core/types';
import {
  AUTO,
  CLOSE_PAREN,
  DOUBLE_QUOTE,
  ENUM_KEYWORDS,
  NAME_ALWAYS,
  NAME_AUTO,
  NAME_BLOCK,
  NAME_BOTH,
  NAME_BOTTOM,
  NAME_COLLAPSE,
  NAME_CONTAIN,
  NAME_COVER,
  NAME_FILL,
  NAME_FIXED,
  NAME_HIDDEN,
  NAME_INLINE,
  NAME_LEFT,
  NAME_NONE,
  NAME_NORMAL,
  NAME_RIGHT,
  NAME_TOP,
  NAME_VISIBLE,
  NORMAL,
  OPEN_PAREN,
  PERCENT,
  POS,
  PX,
  S,
  SPACE,
  UNDERSCORE,
  VAR_OPEN,
} from './words';
import {
  MSG_VALUE,
  throwInvalid,
  throwRenamed,
} from './messages';
import type {
  SingleValues,
} from './functions';
import {
  REGEXP_LENGTH_PART,
  assertEnumValue,
  cssVarValue,
} from './functions';
import {
  REGEXP_SLOT_INTEGER,
  calc,
  floatNormalize,
  normalizeDefault,
  styleWrap,
} from './context';

const RELATIVE = 'relative';
const BREAK_AFTER_SYNONYMS = {
  A: NAME_AUTO,
  AW: NAME_ALWAYS,
  AV: 'Avoid',
  AVP: 'AvoidPage',
  AVC: 'AvoidColumn',
  AVRN: 'AvoidRegion',
  RN: 'Region',
  C: 'Column',
  P: 'Page',
  L: NAME_LEFT,
  R: NAME_RIGHT,
  RE: 'Recto',
  VE: 'Verso',
};
const POSITION_SYNONYMS: Record<string, string> = {
  R: 'Relative',
  A: 'Absolute',
  F: NAME_FIXED,
  S: 'Static',
  SK: 'Sticky',
  WS: '-webkit-sticky',
};

const POSITION_PRIORITIES: Record<string, number> = {
  relative: 0,
  absolute: 1,
  fixed: 2,
  static: 3,
  sticky: 4,
};

/**
 * Бракует токен: аргумент хендлера не разобрался.
 *
 * Бросает {@link MnParseError}, а не обычный `Error`, чтобы ядро увело это в
 * {@link MnInstance.warnings$} (тип `parse-error`), а не в `error$`: битый
 * аргумент — ошибка автора токена, а не сбой библиотеки. Контекст здесь
 * заполнить нечем — `throwInvalid` зовут из глубины разбора значения
 * (`getVal`, `normalizeDefault`, …), где ни имени хендлера, ни самого токена
 * уже не видно. Поля остаются пустыми, а ядро подставляет реальные в
 * `__initEssence` (`core/index.ts`), где и токен, и имя хендлера известны.
 */
/** Имена контейнера через пробел — идентификаторы CSS или переменная: `sidebar`, `side main`, `var(--c)`. */
const REGEXP_CONTAINER_NAMES = /^(?:var\(--[\w-]+\)|(?:-?[a-zA-Z_][\w-]*)(?: -?[a-zA-Z_][\w-]*)*)$/;

/** Имена контейнера из суффикса — как записаны: ведущий `_` снят, `_` — пробел, `--c` — `var(--c)`. */
function containerNames(suffix: string): string {
  const raw = suffix[0] === UNDERSCORE ? suffix.slice(1) : suffix;
  return raw.indexOf('--') === 0 ? VAR_OPEN + raw + CLOSE_PAREN : raw.split(UNDERSCORE).join(SPACE);
}
/** Целое со знаком — `z-index` дробей не принимает. */
const REGEXP_INTEGER = /^[-+]?\d+$/;
/** Неотрицательное число или процент — `zoom:1.5`, `zoom:150%`. */
const REGEXP_VALUE_ZOOM = /^(?:\d+\.?\d*|\.\d+)%?$/;
/** Неотрицательное число или дробь — `aspect-ratio:1.5`, `aspect-ratio:16/9`. */
const REGEXP_VALUE_RATIO = /^(?:\d+\.?\d*|\.\d+)(?:\/(?:\d+\.?\d*|\.\d+))?$/;

/**
 * `columns`: `<count> [<width>]` либо `auto`. В CSS порядок свободный
 * (`30em 3` тоже валидно) — нотация принимает один.
 */
function columnsValue(parts: string[], raw: string): string {
  const l = parts.length;
  const prefix = MSG_VALUE + raw + '" is invalid for "col": ';
  l < 3 || throwInvalid(prefix + 'at most two parts: column count and width');
  let i = 0;
  let part: string;
  for (; i < l; i++) {
    part = parts[i];
    if (part === AUTO || part.indexOf(OPEN_PAREN) > -1) {
      continue;
    }
    (i ? REGEXP_LENGTH_PART.test(part) : REGEXP_SLOT_INTEGER.test(part))
      || throwInvalid(prefix + (i
        ? 'column width is a length'
        : 'column count is an integer; width goes second'));
  }
  return parts.join(SPACE);
}

/** Раскладка: колонки, масштаб, соотношение сторон. */
const LAYOUT_VALUES: SingleValues = {
  slots: {
    columns: columnsValue,
  },
  // Ни то, ни другое отрицательных не принимает; дробь есть только у соотношения сторон, процент — только у масштаба.
  patterns: {
    zoom: REGEXP_VALUE_ZOOM,
    aspectRatio: REGEXP_VALUE_RATIO,
  },
};
function normalizeCalc(
  base: string, signAndVal: string, unit: string,
): string {
  const sign = signAndVal[0];
  const val = signAndVal.slice(1);
  // Единственный вызов (ratio-хендлер) всегда передаёт третьим аргументом
  // validateUnit(p.addu || 'px') — тот никогда не возвращает пустую строку
  // при непустом входе, поэтому фолбэк на '' здесь недостижим
  // (в v1 — тот же единственный вызов).
  return calc(
    base, sign, val + unit,
  );
}

/**
 * Хендлеры темы «layout».
 *
 * @param ctx — контекст пресета (`createContext`)
 */
export function registerLayout(ctx: StandardContext): void {
  const {
    floatval,
    forIn,
    lettersValue,
    mn,
    positionProvider,
    registerSingleProperties,
    synonymProvider,
    toFixed,
    toUpper,
    validateUnit,
  } = ctx;

  mn('tbl', styleWrap({
    display: 'table',
  }));
  mn('tbl.cell', {
    selectors: ['>*'],
    style: {
      display: 'table-cell',
      verticalAlign: 'middle',
    },
  });
  // Переименовано: `lt`/`rt`/`jt` → `flL`/`flR`/`flN`, `apc` → `ap`.
  forIn({
    lt: 'flL',
    rt: 'flR',
    jt: 'flN',
  }, (replacement: string, name: string) => {
    mn(name, (p) => (p.suffix ? 0 : throwRenamed(name, replacement)));
  });


  forIn({
    '': 0,
    x: 1,
    y: 1,
  }, (priority, suffix) => {
    const propName = 'overflow' + toUpper(suffix);
    const handle = synonymProvider(
      propName, {
        '': NAME_HIDDEN,
        V: NAME_VISIBLE,
        H: NAME_HIDDEN,
        S: 'Scroll',
        A: NAME_AUTO,
        // `clip` — как `hidden`, но без создания scroll-контейнера.
        C: 'Clip',
      // `composite`: две оси в одном значении — `overflow: hidden auto`.
      }, priority, undefined, undefined, 1,
    );

    mn('ov' + suffix, function (this: unknown) {
      // `arguments` вместо rest — §6.1: хендлер зовётся на каждый токен.
      // Приведение нужно только для `apply` в строгом режиме.
      const essence = handle.apply(this, arguments as unknown as [MnEssenceParams]);
      if (essence) {
        const s = essence.style;
        const v = s && s[propName];
        if (v === 'scroll' || v === AUTO) {
          essence.exts = ['ovscT'];
        }
      }
      return essence;
    });
  });

  mn(POS, (p) => {
    const s = p.suffix;
    // Перечень у `position` закрыт, поэтому значение — буква или ошибка:
    // `pos10` давало `position:10`, `posZzz` — `position:zzz`, `posAbsolute`
    // и `pos_absolute` — вторые записи `posA`. Голый `pos` — `relative`.
    const v = s ? assertEnumValue(
      lettersValue(
        p, POSITION_SYNONYMS, ENUM_KEYWORDS.position,
      ), ENUM_KEYWORDS.position, 0, POS, s, POSITION_SYNONYMS,
    ) : RELATIVE;
    return styleWrap({
      position: v,
    }, POSITION_PRIORITIES[v] || 0);
  });

  mn({
    cfx: {
      exts: ['posS'],
      childs: {
        pale: {
          selectors: [
            ':before',
            ':after',
          ],
          style: {
            content: '" "',
            clear: 'both',
            display: 'table',
          },
        },
      },
    },

    // position
    rlv: 'posR',
    abs: 'posA',
    fixed: 'posF',
    'static': 'posS',
    sticky: 'posSK',

    'break': styleWrap({
      whiteSpace: NORMAL,
      wordBreak: 'break-word',
    }),
    z: (p) => {
      let num, v;
      // `z-index` — целое число или `auto`. Дробь давала `z-index:1.5`,
      // правило, которое браузер отбрасывает целиком.
      return p.camel ? 0 : (v = cssVarValue(p.suffix)) ? styleWrap({
        zIndex: v,
      }) : ((num = p.num) ? (
        REGEXP_INTEGER.test(num) || throwInvalid(MSG_VALUE + p.suffix
        + '" is invalid: z-index is an integer'),
        styleWrap({
          zIndex: num,
        })
      ) : normalizeDefault(p, 1));
    },

    of: synonymProvider('objectFit', {
      '': NAME_COVER,
      F: NAME_FILL,
      CT: NAME_CONTAIN,
      CV: NAME_COVER,
      N: NAME_NONE,
      SD: 'ScaleDown',
    }),

    d: synonymProvider(
      'display', {
        '': NAME_BLOCK,
        B: NAME_BLOCK,
        N: NAME_NONE,
        F: 'Flex',
        IF: 'InlineFlex',
        I: NAME_INLINE,
        IB: 'InlineBlock',
        LI: 'ListItem',
        RI: 'RunIn',
        CP: 'Compact',
        TB: 'Table',
        ITB: 'InlineTable',
        TBCP: 'TableCaption',
        TBCL: 'TableColumn',
        TBCLG: 'TableColumnGroup',
        TBHG: 'TableHeaderGroup',
        TBFG: 'TableFooterGroup',
        TBR: 'TableRow',
        TBRG: 'TableRowGroup',
        TBC: 'TableCell',
        RB: 'Ruby',
        RBB: 'RubyBase',
        RBBG: 'RubyBaseGroup',
        RBT: 'RubyText',
        RBTG: 'RubyTextGroup',
        // Современные значения: раньше `dG` падало в
        // буквальный `display:g` — короткие формы должны работать, а не ломаться.
        G: 'Grid',
        IG: 'InlineGrid',
        FR: 'FlowRoot',
        CN: 'Contents',
        // `F` занято `flex`, `FR` — `flow-root`, поэтому `flow` — `FW`.
        FW: 'Flow',
        ILI: 'InlineListItem',
        RBBC: 'RubyBaseContainer',
        RBTC: 'RubyTextContainer',
        IFR: 'InlineFlowRoot',
        // `composite`: внешний и внутренний тип разом
        // (`display: inline flow-root`).
      }, 0, undefined, undefined, 1,
    ),

    dir: synonymProvider('direction', {
      LTR: 'Ltr',
      RTL: 'Rtl',
    }),

    // `float`: `flL`, `flR`, `flN`, логические `flIS`, `flIE`.
    fl: synonymProvider('float', {
      L: NAME_LEFT,
      R: NAME_RIGHT,
      N: NAME_NONE,
      IS: 'InlineStart',
      IE: 'InlineEnd',
    }),
    cl: synonymProvider('clear', {
      '': NAME_BOTH,
      B: NAME_BOTH,
      N: NAME_NONE,
      L: NAME_LEFT,
      R: NAME_RIGHT,
      IS: 'InlineStart',
      IE: 'InlineEnd',
    }),
    v: synonymProvider('visibility', {
      '': NAME_HIDDEN,
      V: NAME_VISIBLE,
      H: NAME_HIDDEN,
      C: NAME_COLLAPSE,
    }),
    // Контейнер для запросов `@…:имя`: имя — как записано, как и в запросе: `cnMainNav` →
    // `container-name: MainNav`, `cn_main-nav` → `main-nav`, несколько — через `_` (`cn_side_main`), `cn--c` —
    // переменная.
    cn: (p) => {
      const names = p.suffix ? containerNames(p.suffix) : '';
      return !names ? 0 : REGEXP_CONTAINER_NAMES.test(names) ? styleWrap({
        containerName: names,
      }) : throwInvalid(DOUBLE_QUOTE + names + '" is not a container name: expected CSS identifiers written as they are'
        + ' (cnSidebar, cn_main-nav, cn_side_main) or a variable');
    },
    // `ctIS` → `container-type: inline-size`; размер по обеим осям — `ctS`.
    ct: synonymProvider('containerType', {
      IS: 'InlineSize',
      S: 'Size',
      N: NAME_NORMAL,
    }),
    cps: synonymProvider('captionSide', {
      T: NAME_TOP,
      B: NAME_BOTTOM,
      L: NAME_LEFT,
      R: NAME_RIGHT,
      TO: 'TopOutside',
      BO: 'BottomOutside',
    }),
    ec: synonymProvider('emptyCells', {
      S: 'Show',
      H: 'Hide',
    }),
    pgbb: synonymProvider([
      'pageBreakBefore',
      'breakBefore',
    ], BREAK_AFTER_SYNONYMS),
    pgba: synonymProvider([
      'pageBreakAfter',
      'breakAfter',
    ], BREAK_AFTER_SYNONYMS),
    pgbi: synonymProvider([
      'pageBreakInside',
      'breakInside',
    ], {
      A: NAME_AUTO,
      AV: 'Avoid',
      AVP: 'AvoidPage',
      AVC: 'AvoidColumn',
      AVRN: 'AvoidRegion',
    }),
    /**
   * `object-position`. Общий хендлер здесь остаётся: атомарных
   * `object-position-x/y` в CSS не существует, разложить не на что.
   * Составные формы — свободным значением: `op_left_top`, `op50%_0`.
   *
   * `background-position` (`bgp`) убран: общий хендлер порождал уникальный класс
   * на каждую комбинацию осей, тогда как атомарные `bgpx`/`bgpy`
   * переиспользуются между комбинациями.
   */
    // `composite`: две координаты в одном значении
    // (`object-position: left top`). Атомарных `object-position-x/y` в CSS нет,
    // поэтому разложить его, как `bgpx`/`bgpy`, нельзя.
    // `numeric`: координаты задаются и числами — `op50%_50%`.
    op: positionProvider('objectPosition', 1),
  });

  registerSingleProperties({
    ar: ['aspectRatio'],

    col: ['columns'],
    // bdrs: ['borderRadius'],
    zm: ['zoom'],
  }, LAYOUT_VALUES);

  mn(
    'ratio', (p) => {
      p.other && throwInvalid();
      const v = '' + toFixed(100 * floatval(
        p.oh || p.h || 100, 1, 1,
      )
    / floatval(
      p.w || 100, 1, 1,
    )) + PERCENT;
      return {
        exts: ['rlv'],
        style: {
          paddingTop: p.add
            ? normalizeCalc(
              v,
              '' + p.sa + floatNormalize(p.addv),
              validateUnit('' + (p.addu || PX)) as string,
            )
            : v,
        },
        childs: {
          overlay: {
            selectors: ['>*'],
            exts: [
              'abs' + p.ni,
              S + p.ni,
            ],
          },
        },
      };
    }, '^((((\\d+):w)x((\\d+):h))|(\\d+):oh)?(([-+]):sa([0-9\\.]+):addv([a-z%]+):addu?):add?|(.*):other', 1,
  );
}
