import type {
  StandardContext,
} from './context';
import type {
  MnEssenceParams,
} from '../../core/types';
import type {
  MnHandler,
  MnTokenValue,
  MnStyle,
} from '../../types';
import {
  AXIS_X,
  AXIS_Y,
  BORDER,
  COLOR_SYNONYMS,
  DASH,
  HUNDRED_PERCENT,
  NAME_AUTO,
  NAME_BORDER_BOX,
  NAME_CONTENT_BOX,
  NAME_DASHED,
  NAME_DOTTED,
  NAME_DOUBLE,
  NAME_HIDDEN,
  NAME_MEDIUM,
  NAME_NONE,
  NAME_SOLID,
  NAME_STRETCH,
  NAME_THICK,
  NAME_THIN,
  PX,
  S,
  wordsSet,
} from './words';
import {
  throwInvalid,
} from './messages';
import {
  assertEnumValue,
} from './functions';
import {
  PATTERN_COLOR,
  normalizeDefault,
  styleWrap,
} from './context';

/** Строка семейства сторон: свойство, его хвост (`-width` у рамки), без знака, слова, без процента. */
type SideRow = [
  propName: string, propSuffix: string | 0, nosign: number, synonyms: Record<string, string>, noPercent?: number,
];

const SOLID = 'solid';
const REGEXP_TRIM_KEBAB_LEFT = /^-+/g;


/** `axisMode: 'physical'` — осевые формы `x`/`y` пишут физическую пару сторон. */
const AXIS_PHYSICAL = 'physical';
const INSET = 'inset';
const TOP = '-top';
const BOTTOM = '-bottom';
const LEFT = '-left';
const RIGHT = '-right';

const SIDES_MAP = {
  '': [''],
  t: [TOP],
  b: [BOTTOM],
  l: [LEFT],
  r: [RIGHT],

  y: [
    TOP,
    BOTTOM,
  ],
  yl: [
    TOP,
    BOTTOM,
    LEFT,
  ],
  yr: [
    TOP,
    BOTTOM,
    RIGHT,
  ],

  x: [
    LEFT,
    RIGHT,
  ],
  xt: [
    LEFT,
    RIGHT,
    TOP,
  ],
  xb: [
    LEFT,
    RIGHT,
    BOTTOM,
  ],

  lt: [
    TOP,
    LEFT,
  ],
  rt: [
    TOP,
    RIGHT,
  ],
  lb: [
    BOTTOM,
    LEFT,
  ],
  rb: [
    BOTTOM,
    RIGHT,
  ],
};
/**
 * Логические стороны: `s`/`e` — начало и конец оси строки, `bs`/`be` — оси блока.
 * Пишут одно логическое свойство в любом `axisMode` (`ps10` → `padding-inline-start:10px`).
 */
const LOGICAL_SIDES: Record<string, string> = {
  s: '-inline-start',
  e: '-inline-end',
  bs: '-block-start',
  be: '-block-end',
};
/**
 * Имена логических сторон, занятые другими свойствами, — `pe` (pointer-events) и `bs` (border-style); их стороны
 * берут `pie` и `bisw`, `be` — `biew` в пару к `bisw` (`bis`/`bie` читались как «border-image-…», и `bis`
 * нужен слайсу `border-image`).
 */
const LOGICAL_RENAMED: Record<string, string> = {
  pe: 'pie',
  bs: 'bisw',
  be: 'biew',
};
/**
 * Краткие записи `border-style`.
 *
 * `DTDS` → `dot-dash`, `DTDTDS` → `dot-dot-dash` и `W` → `wave` убраны:
 * таких значений в CSS нет вовсе. Это проприетарный набор старой
 * Mozilla, работавший только под `-moz-border-*-style`; в v1 он попал оттуда, а
 * в стандарт не вошёл ни один из трёх. Любой из них давал правило, которое
 * браузер отбрасывает целиком.
 */
const BORDER_STYLE_SYNONYMS: Record<string, string> = {
  N: NAME_NONE,
  H: NAME_HIDDEN,
  DT: NAME_DOTTED,
  DS: NAME_DASHED,
  S: NAME_SOLID,
  DB: NAME_DOUBLE,
  G: 'Groove',
  R: 'Ridge',
  I: 'Inset',
  O: 'Outset',
};
/** `<line-style>` целиком — ровно то, что принимает спецификация. */
const BORDER_STYLE_KEYWORDS = wordsSet('none hidden dotted dashed solid double'
  + ' groove ridge inset outset');
const SIZE_SYNONYMS = {
  A: NAME_AUTO,
  N: NAME_NONE,
  FC: 'FitContent',
  // `ST`, как у выравнивания (`aiST`): `S` там — `start`.
  ST: NAME_STRETCH,
};

/** Внутренние размеры — общая часть для `width`/`height` и их min/max. */
const KEYWORDS_INTRINSIC: Record<string, 1> = {
  'min-content': 1,
  'max-content': 1,
  'fit-content': 1,
  stretch: 1,
};
/** `width`/`height` и `min-*`: внутренние размеры плюс `auto`. */
const KEYWORDS_SIZE: Record<string, 1> = {
  ...KEYWORDS_INTRINSIC,
  auto: 1,
};
/** `max-*`: внутренние размеры плюс `none` (а `auto` — невалиден). */
const KEYWORDS_SIZE_MAX: Record<string, 1> = {
  ...KEYWORDS_INTRINSIC,
  none: 1,
};

/**
 * Хендлеры темы «spacing».
 *
 * @param ctx — контекст пресета (`createContext`)
 */
export function registerSpacing(ctx: StandardContext): void {
  const {
    assertColorAbbr,
    assertShortestHex,
    forEach,
    forIn,
    getColor,
    getVal,
    instance,
    isDefined,
    lettersValue,
    mapIn,
    mn,
    rawColorValue,
    reduce,
    size,
    synonymProvider,
    toKebabCase,
  } = ctx;

  forIn(mapIn({
    ...SIDES_MAP,
    ...mapIn(LOGICAL_SIDES, (side) => [side]),
  }, (sides) => reduce(
    sides, (dst, key) => {
      dst[key] = 1; return dst;
    }, {},
  )), (sides, suffix) => {
    const priority = suffix ? (4 - size(sides)) : 0;
    // Ось `x`/`y`: по умолчанию логическое свойство (`padding-inline`), `axisMode: 'physical'` —
    // физическая пара. Остальные стороны (`t`, `xt`, `lb`…) — физические всегда.
    const axis = suffix === AXIS_X ? '-inline' : suffix === AXIS_Y ? '-block' : '';
    const logicalSide = LOGICAL_SIDES[suffix];
    const bsSidesSet = axisSetter((side) => BORDER + side + '-style');
    const bcSidesSet = axisSetter((side) => BORDER + side + '-color');

    function sidesSetter(handle: (side: string) => string): (v: MnTokenValue) => MnStyle {
      const propsMap: Record<string, number> = {};
      forIn(sides, (_val, propSide) => {
        propsMap[handle(propSide)] = 1;
      });
      return (v: MnTokenValue) => {
      /* istanbul ignore next — защита фабрики, а не живая ветка: единственный
         вызывающий (`handleProvider` ниже) передаёт сюда `getVal()[0]`, а тот
         всегда возвращает строку (`output.join(' ')`), битый же вход роняет
         сам `getVal`. Страховка оставлена: `sidesSetter` — фабрика, её
         результат живёт в замыкании и может быть вызван из нового места. */
        isDefined(v) || throwInvalid();
        const style: MnStyle = {};
        let pName: string;
        for (pName in propsMap) {
          style[pName] = v;
        }
        return style;
      };
    }

    /**
     * {@link sidesSetter} с осью: для `x`/`y` выбирает логическое свойство или физическую пару по
     * `axisMode` инстанса — в момент компиляции токена, поэтому `setOptions` + `recompile` переключают живой
     * инстанс. Для остальных сторон — сам `sidesSetter`.
     * @param handle имя свойства по стороне (`'-left'` → `padding-left`, `'-inline'` → `padding-inline`)
     * @param logical имя логического свойства, если `handle(axis)` его не даёт (`inset-inline`)
     */
    function axisSetter(handle: (side: string) => string, logical?: string): (v: MnTokenValue) => MnStyle {
      const physicalSet = sidesSetter(handle);
      if (!axis) {
        return physicalSet;
      }
      const logicalName = logical || handle(axis);
      return (v: MnTokenValue) => {
        if (instance.options.axisMode === AXIS_PHYSICAL) {
          return physicalSet(v);
        }
        const style: MnStyle = {};
        style[logicalName] = v;
        return style;
      };
    }

    function handleProvider(
      sidesSet: (v: MnTokenValue) => MnStyle,
      // Порядок параметров унаследован; `synonyms` обязателен по смыслу, но
      // объявить его таким нельзя — он идёт после необязательных (TS1016).
      // Оба вызывающих передают словарь своего семейства.
      nosign?: number,
      one?: number,
      synonyms?: Record<string, string>,
      noPercent?: number,
    ): MnHandler {
    // Словарь задан на семейство, а не общий на все размеры: `mA` →
    // `margin:auto` валиден, а `pA` → `padding:auto` — нет. Допустимые слова
    // выводятся из значений словаря; полная запись слова с буквой (`bThin`)
    // бракуется в пользу краткой (`bTN`). Буква разбирается тем же
    // `getVal`, что и любая часть, — значение сразу, а не алиас на полную
    // запись (алиас делал полную запись несущей).
      const keywords: Record<string, 1> = {};
      forIn(synonyms as Record<string, string>, (word: string) => {
        keywords[toKebabCase(word)] = 1;
      });
      return (p: MnEssenceParams) => {
        let suffix: string;
        if (!(suffix = p.suffix)) {
          return normalizeDefault(p, 0);
        }
        const v = getVal(
          suffix, nosign, one, PX, 0, synonyms, keywords, noPercent, p.name,
        );
        return styleWrap(sidesSet(v[0]), priority + v[1]);
      };
    }

    forIn({
      p: [
        'padding',
        0,
        1,
        // Ключевых слов у padding нет вовсе — только длины и CSS-wide.
        {},
      ],
      m: [
        'margin',
        0,
        0,
        {
          A: NAME_AUTO,
        },
      ],
      b: [
        BORDER,
        '-width',
        1,
        {
          TN: NAME_THIN,
          M: NAME_MEDIUM,
          TC: NAME_THICK,
        },
        // `border-width` — это `<line-width>`, то есть длина или одно из трёх
        // слов. Процентов не принимает, в отличие от `padding`/`margin`.
        1,
      ],
      // Группа B: отступы прокрутки. `scroll-margin` — только
      // длина, зато со знаком; `scroll-padding` — длина, процент или `auto`.
      sm: [
        'scroll-margin',
        0,
        0,
        {},
        1,
      ],
      sp: [
        'scroll-padding',
        0,
        1,
        {
          A: NAME_AUTO,
        },
      ],
    } satisfies Record<string, SideRow>, (args, pfx) => {
      const propName = args[0];
      const propSuffix = args[1] || '';
      const name = pfx + suffix;
      mn(
        LOGICAL_RENAMED[name] || name, handleProvider(
          axisSetter((side) => propName + side + propSuffix),
          args[2],
          // Сторона (`pt`, `px`) берёт одно значение, всё свойство (`p`) — до четырёх.
          suffix ? 1 : 0,
          args[3],
          args[4],
        ), '', 1,
      );
    });

    mn(
      S + suffix, handleProvider(
        suffix
          ? axisSetter((side) => (logicalSide ? INSET + side : side.replace(REGEXP_TRIM_KEBAB_LEFT, '')), INSET + axis)
          : (v) => {
          /* istanbul ignore next — та же защита, что в `sidesSetter` выше:
             `v` приходит из `getVal()[0]` и строкой быть обязан. */
            isDefined(v) || throwInvalid();
            return {
              top: v,
              bottom: v,
              left: v,
              right: v,
            };
          },
        0,
        1,
        {
          A: NAME_AUTO,
        },
      ), '', 1,
    );
    mn('bs' + suffix, (p) => {
      const s = p.suffix;
      return styleWrap(bsSidesSet(s
      // Стиль границы — закрытый перечень (`<line-style>`), но
      // проверки не было вовсе: `bs10` давало `border-style:10`,
      // `bsF00` — `border-style:f00`, `bsZzz` — `border-style:zzz`.
      // Без стороны свойство берёт до четырёх значений
      // (`border-style: solid dotted`), со стороной — одно. Буквы — в каждой
      // части (`bsS_DT`), полные слова бракуются.
        ? assertEnumValue(
          lettersValue(p, BORDER_STYLE_SYNONYMS), BORDER_STYLE_KEYWORDS,
          suffix ? 0 : 1, 'bs' + suffix, s, BORDER_STYLE_SYNONYMS,
        )
        : SOLID), priority + 1);
    });
    mn(
      'bc' + suffix, (p) => {
        let v: string | undefined; let synonym: string;
        const raw = rawColorValue(p.suffix, p.name);
        if (raw) {
          return styleWrap(bcSidesSet(raw), priority + 1);
        }
        return (synonym = COLOR_SYNONYMS[p.suffix || 'CT'])
          ? styleWrap(bcSidesSet(getColor(synonym)), priority + 1)
          : (
            (v = p.value)
              ? (assertColorAbbr(p),
              assertShortestHex(p, p.color),
              styleWrap(bcSidesSet(getColor(v)), priority + 1))
            // Суффикс есть, но PATTERN_COLOR его не разобрал (напр. второй
            // цвет через `_` — множественные border-color не поддерживаются,
            // см. HANDLERS.md) — бракуем токен, а не тихо подставляем чёрный
            // (`normalizeDefault(p)` без 2-го аргумента = дефолт essence
            // `bc0`).
            //
            // Проверка `p.suffix ?` убрана как недостижимая: пустой
            // суффикс перехватывает `COLOR_SYNONYMS[p.suffix || 'CT']` выше
            // (голый `bc` → currentColor), так что сюда доходит только непустой.
              : throwInvalid()
          );
      }, PATTERN_COLOR, 1,
    );
  });

  forIn({
    sq: [
      'width',
      'height',
    ],
    w: ['width'],
    h: ['height'],
    // Логические размеры: `iz` — по оси строки, `bz` — по оси блока; `izmin`, `bzmax`… как `wmin`.
    iz: ['inline-size'],
    bz: ['block-size'],
  }, (props, essencePrefix) => {
    const length = props.length;
    const priority = 2 - length;
    forEach([
      '',
      'min',
      'max',
    ], (sfx) => {
    // `max-*` принимает `none` и НЕ принимает `auto`; `width`/`min-*` —
    // наоборот. Словарь кратких записей сужается под свой вариант, поэтому
    // `wmaxN` работает, а `wN` (`width:none`) бракуется.
      const keywords = sfx === 'max' ? KEYWORDS_SIZE_MAX : KEYWORDS_SIZE;
      const synonyms: Record<string, string> = {};
      forIn(SIZE_SYNONYMS, (word: string, abbr: string) => {
        keywords[toKebabCase(word)] && (synonyms[abbr] = word);
      });
      const propMap: Record<string, number> = {};
      let propName, i = 0;
      for (; i < length; i++) {
        propName = props[i];
        propMap[sfx ? (sfx + DASH + propName) : propName] = 1;
      }
      mn(
        essencePrefix + sfx, (p) => {
          const suffix = p.suffix;
          if (!suffix) {
            return normalizeDefault(p, HUNDRED_PERCENT);
          }
          const v = getVal(
            suffix, 1, 1, PX, 0, synonyms, keywords, 0, p.name,
          );
          const [value] = v;
          const style: MnStyle = {};
          let propName;
          for (propName in propMap) {
            style[propName] = value;
          }
          return styleWrap(style, priority + v[1]);
        }, '', 1,
      );
    });
  });

  mn({
    bxz: synonymProvider('boxSizing', {
      '': NAME_BORDER_BOX,
      BB: NAME_BORDER_BOX,
      CB: NAME_CONTENT_BOX,
    }),
  });
}
