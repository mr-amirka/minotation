import type {
  StandardContext,
} from './context';
import type {
  MnEssenceParams,
} from '../../core/types';
import type {
  MnHandler,
} from '../../types';
import {
  A,
  AUTO,
  COMMA,
  DOT,
  DOUBLE_QUOTE,
  N,
  NAME_ALWAYS,
  NAME_AUTO,
  NAME_BLOCK,
  NAME_BOTH,
  NAME_CENTER,
  NAME_CONTAIN,
  NAME_END,
  NAME_FILL,
  NAME_FIXED,
  NAME_INLINE,
  NAME_NONE,
  NAME_NORMAL,
  NAME_START,
  NAME_TEXT,
  NAME_THIN,
  NAME_VISIBLE,
  OPEN_PAREN,
  SPACE,
  UNDERSCORE,
  withPairs,
} from './words';
import {
  MSG_COLON,
  MSG_INSTEAD_OF,
  MSG_IS_INVALID_FOR,
  MSG_SAME_VALUE,
  MSG_VALUE,
  MSG_WRITE_SHORTER,
  throwInvalid,
  throwRenamed,
} from './messages';
import {
  REGEXP_FUNCTION_NAME_ANY,
} from './functions';
import {
  imagePathValue,
  styleWrap,
} from './context';

const OVERSCROLL_BEHAVIOR_PRIORITIES = {
  A: NAME_AUTO,
  CT: NAME_CONTAIN,
  N: NAME_NONE,
};

/**
 * `scroll-snap-type`: ось и, через `_`, строгость —
 * `sstX` → `x`, `sstX_M` → `x mandatory`, `sstBH_P` → `both proximity`.
 * `B` — `block`, как у `display`.
 */
const SCROLL_SNAP_TYPE_SYNONYMS = withPairs(
  {
    N: NAME_NONE,
  }, {
    X: 'X',
    Y: 'Y',
    B: NAME_BLOCK,
    I: NAME_INLINE,
    BH: NAME_BOTH,
  }, {
    M: 'Mandatory',
    P: 'Proximity',
  },
);

/** `scroll-snap-align`: одно значение или пара «блок_строка» — `ssaS`, `ssaC_S`. */
const SCROLL_SNAP_ALIGN_WORDS: Record<string, string> = {
  N: NAME_NONE,
  S: NAME_START,
  E: NAME_END,
  C: NAME_CENTER,
};
const SCROLL_SNAP_ALIGN_SYNONYMS = withPairs(
  {}, SCROLL_SNAP_ALIGN_WORDS, SCROLL_SNAP_ALIGN_WORDS,
);
/**
 * Списки значений свойств с закрытым перечислением.
 *
 * Такие свойства принимали ЛЮБОЕ слово: `irF00` давало `image-rendering:f00`,
 * `apcZzz` — `appearance:zzz`, `tsQwe` — `transform-style:qwe`. Валидатор ядра
 * ни одно из них не знал (permissive pass-through), поэтому мусор уходил в CSS
 * молча.
 *
 * Списки выписаны из `mdn-data`, и тест сверяет каждое слово с грамматикой —
 * разойтись со спецификацией молча они не могут. Вендорные формы
 * (`-moz-crisp-edges`) оставлены: они валидны и реально используются.
 *
 * Это не таблица «свойство → валидатор», от которой уходит Q-01: здесь список
 * принадлежит хендлеру, лежит рядом с ним и проверяет его собственный аргумент,
 * а не разбирает CSS-грамматику.
 *
 * Значение записи — `1` либо строка-замена. Замена нужна там, где каноническое
 * значение в camelCase не записывается: цифра не даёт дефиса (`tsPreserve3D`
 * кебабится в `preserve3d`, а не в `preserve-3d`), а ведущий дефис вендорной
 * формы теряется тем более. Без замены единственное содержательное значение
 * `transform-style` пришлось бы писать сырым режимом — `ts_preserve-3d`.
 */
/**
 * Краткие записи слов у хендлеров общей таблицы: `fxN` → `flex:none`, `arA` → `aspect-ratio:auto`, как
 * `dN` у `display`. Полное слово при краткой записи бракуется с подсказкой — одно значение, одна запись.
 */
/** Старое `apcNone` → новое `apN`: полное слово — сразу краткой записью. */
const APPEARANCE_RENAMED: Record<string, string> = {
  None: N,
  Auto: A,
};

/**
 * Буквы `cursor`. Однобуквенные заняты исторически (`C` — crosshair, `P` — pointer, `A` — auto), поэтому добавленные
 * позже значения берут по две буквы. Курсоры изменения размера — направление + `R`: `crER` (e-resize), `crNWR`
 * (nw-resize), `crNSR` (ns-resize). Те же буквы — запасной курсор после картинки: `cr_a\.png,P`.
 */
const CURSOR_SYNONYMS: Record<string, string> = {
  '': 'Pointer',
  A: NAME_AUTO,
  D: 'Default',
  C: 'Crosshair',
  HA: 'Hand',
  HE: 'Help',
  M: 'Move',
  P: 'Pointer',
  T: NAME_TEXT,
  N: NAME_NONE,
  NA: 'NotAllowed',
  W: 'Wait',
  PR: 'Progress',
  CM: 'ContextMenu',
  CE: 'Cell',
  VT: 'VerticalText',
  AL: 'Alias',
  CO: 'Copy',
  ND: 'NoDrop',
  G: 'Grab',
  GG: 'Grabbing',
  ZI: 'ZoomIn',
  ZO: 'ZoomOut',
  AS: 'AllScroll',
  CR: 'ColResize',
  RR: 'RowResize',
  ER: 'EResize',
  NR: 'NResize',
  SR: 'SResize',
  WR: 'WResize',
  NER: 'NeResize',
  NWR: 'NwResize',
  SER: 'SeResize',
  SWR: 'SwResize',
  EWR: 'EwResize',
  NSR: 'NsResize',
  NESWR: 'NeswResize',
  NWSER: 'NwseResize',
};
/** Горячая точка курсора — число: `cr_a\.png_4_4,P`. */
const REGEXP_HOT_SPOT = /^\d*\.?\d+$/;
/** Часть из одних заглавных — буква, а не имя файла: `cr_a\.png,ZZ`. */
const REGEXP_CAPITALS = /^[A-Z]+$/;

/**
 * Хендлеры темы «interaction».
 *
 * @param ctx — контекст пресета (`createContext`)
 */
export function registerInteraction(ctx: StandardContext): void {
  const {
    mn,
    registerSingleProperties,
    synonymProvider,
    toKebabCase,
  } = ctx;

  mn({
    fsz: synonymProvider('fieldSizing', {
      F: NAME_FIXED,
      C: 'Content',
    }),
  });
  mn('apc', (p) => throwRenamed('apc' + p.suffix, 'ap' + (APPEARANCE_RENAMED[p.suffix] || p.suffix)));

  mn({

    // `composite`: берёт два значения — по оси X и Y
    // (`overscroll-behavior: contain auto`).
    ovb: synonymProvider(
      'overscrollBehavior', OVERSCROLL_BEHAVIOR_PRIORITIES, 0, undefined, undefined, 1,
    ),
    ovbx: synonymProvider('overscrollBehaviorX', OVERSCROLL_BEHAVIOR_PRIORITIES),
    ovby: synonymProvider('overscrollBehaviorY', OVERSCROLL_BEHAVIOR_PRIORITIES),

    // Группа B: привязка прокрутки и полоса прокрутки. Пары
    // значений перечислены словарём (`sstX_M`, `ssaC_S`), поэтому сырой
    // режим этим свойствам не нужен.
    sst: synonymProvider('scrollSnapType', SCROLL_SNAP_TYPE_SYNONYMS),
    ssa: synonymProvider('scrollSnapAlign', SCROLL_SNAP_ALIGN_SYNONYMS),
    sss: synonymProvider('scrollSnapStop', {
      N: NAME_NORMAL,
      A: NAME_ALWAYS,
    }),
    sbw: synonymProvider('scrollbarWidth', {
      A: NAME_AUTO,
      T: NAME_THIN,
      N: NAME_NONE,
    }),
    sbg: synonymProvider('scrollbarGutter', {
      A: NAME_AUTO,
      S: 'Stable',
      SB: 'Stable_BothEdges',
    }),
    ovs: synonymProvider('overflowStyle', {
      '': 'Scrollbar',
      S: 'Scrollbar',
      A: NAME_AUTO,
      P: 'Panner',
      M: 'Move',
      MQ: 'Marquee',
    }),
    ovsc: synonymProvider('-webkitOverflowScrolling', {
      '': 'Touch',
      A: NAME_AUTO,
      T: 'Touch',
    }),
    rsz: synonymProvider('resize', {
      '': NAME_NONE,
      N: NAME_NONE,
      B: NAME_BOTH,
      H: 'Horizontal',
      V: 'Vertical',
      // Логические оси: `BL`, а не `B` — та уже занята `both`.
      BL: NAME_BLOCK,
      IL: NAME_INLINE,
    }),
    // `cursor`: буквы ({@link CURSOR_SYNONYMS}) и картинки по пути с запасным курсором.
    cr: cursorProvider(),
    tcha: synonymProvider(
      'touchAction', {
        A: NAME_AUTO,
        N: NAME_NONE,
        M: 'Manipulation',
        PX: 'PanX',
        PY: 'PanY',
        PL: 'PanLeft',
        PR: 'PanRight',
        PU: 'PanUp',
        PD: 'PanDown',
        PZ: 'PinchZoom',
        // `composite`: оси комбинируются (`touch-action: pan-x pan-y`).
      }, 0, undefined, undefined, 1,
    ),
    us: synonymProvider('userSelect', {
      A: NAME_AUTO,
      N: NAME_NONE,
      T: NAME_TEXT,
      C: NAME_CONTAIN,
      E: 'Element',
      // `A` занято `auto`, поэтому `all` — `AL`.
      AL: 'All',
    }),
    pe: synonymProvider('pointerEvents', {
      A: NAME_AUTO,
      N: NAME_NONE,
      V: NAME_VISIBLE,
      VP: '_visiblePainted',
      VF: '_visibleFill',
      VS: '_visibleStroke',
      P: 'Painted',
      F: NAME_FILL,
      S: 'Stroke',
      // `A` занято `auto`, поэтому `all` — `AL`.
      AL: 'All',
    }),
  });

  /**
   * `cursor` — части через запятую: буквы — как у остальных хендлеров (`crP`), картинка — по пути в `_`-форме.
   * Запятая разделяет то, что разделяет CSS: `cr_a\.png` → `url("a.png"),auto`, `cr_a\.svg,b\.png,P` →
   * `url("a.svg"),url("b.png"),pointer`. Последняя часть — буква запасного курсора, без неё — `auto`: CSS требует
   * ключевое слово, а `auto` ничего не меняет. Два числа в конце пути — горячая точка: `cr_a\.png_4_4,P` →
   * `url("a.png") 4 4,pointer`.
   * @returns хендлер `cr`
   */
  function cursorProvider(): MnHandler {
    const words = synonymProvider('cursor', CURSOR_SYNONYMS);
    return (p: MnEssenceParams) => {
      const s = p.suffix;
      const name = p.name;
      if (s[0] !== UNDERSCORE) {
        s.indexOf(OPEN_PAREN) > -1 && throwInvalid(MSG_VALUE + s + MSG_IS_INVALID_FOR + name + MSG_COLON
          + 'a function is not written in a class — the picture by its path, as "' + name + '_a\\.png,P"');
        return words(p);
      }
      const items = s.slice(1).split(COMMA);
      const l = items.length;
      const last = items[l - 1];
      const word = last && CURSOR_SYNONYMS[last];
      const n = word ? l - 1 : l;
      const out: string[] = [];
      let i = 0;
      let parts: string[];
      let k: number;
      let spot: boolean;
      let key: string;
      n || throwInvalid(MSG_VALUE + s + MSG_IS_INVALID_FOR + name + '": a picture goes before the fallback — as "'
        + name + '_a\\.png,' + last + '", or the letter alone, "' + name + last + DOUBLE_QUOTE);
      if (!word && REGEXP_FUNCTION_NAME_ANY.test(last) && last.indexOf(DOT) < 0) {
        // Курсор словом: `cr_a\.png,pointer` давал бы картинку `pointer`; без картинки — `crP`.
        for (key in CURSOR_SYNONYMS) {
          key && toKebabCase(CURSOR_SYNONYMS[key]) === toKebabCase(last) && throwInvalid(MSG_WRITE_SHORTER + name
            + (l > 1 ? s.slice(0, s.length - last.length) : '') + key + MSG_INSTEAD_OF + name + s + MSG_SAME_VALUE);
        }
        // Заглавные — буква, а не путь: `cr_a\.png,ZZ` давал картинку `ZZ`.
        REGEXP_CAPITALS.test(last) && throwInvalid(MSG_VALUE + s + MSG_IS_INVALID_FOR + name + '": "' + last
          + '" is not a cursor letter — as "' + name + '_a\\.png,P"');
      }
      for (; i < n; i++) {
        parts = items[i].split(UNDERSCORE);
        k = parts.length;
        spot = k > 1 && REGEXP_HOT_SPOT.test(parts[k - 1]);
        if (!spot) {
          out.push(imagePathValue(items[i], name));
          continue;
        }
        // Одно число в конце — горячая точка без второй координаты, а не часть имени файла.
        k > 2 && REGEXP_HOT_SPOT.test(parts[k - 2]) || throwInvalid(MSG_VALUE + s + MSG_IS_INVALID_FOR + name
          + '": the hot spot is two numbers, x and y — as "' + name + '_a\\.png_4_4,P"');
        out.push(imagePathValue(parts.slice(0, k - 2).join(UNDERSCORE), name) + SPACE + parts[k - 2] + SPACE
          + parts[k - 1]);
      }
      out.push(word ? toKebabCase(word) : AUTO);
      return styleWrap({
        cursor: out.join(COMMA),
      });
    };
  }

  registerSingleProperties({
    ap: ['appearance'],
  });

  // Переименовано: `e` → `pe` (pointer-events).
  mn('e', (p) => throwRenamed('e' + p.suffix, 'pe' + p.suffix));
}
