import type {
  MnStyle,
} from '../../types';
import type {
  StandardContext,
} from './context';
import type {
  LengthRule,
} from './words';
import {
  BORDER,
  COMMA,
  DASH,
  DOUBLE_QUOTE,
  LENGTH_MULTI,
  N,
  NAME_AUTO,
  NAME_COLLAPSE,
  NAME_DASHED,
  NAME_DOTTED,
  NAME_DOUBLE,
  NAME_FILL,
  NAME_MEDIUM,
  NAME_NONE,
  NAME_REPEAT,
  NAME_SOLID,
  NAME_STRETCH,
  NAME_THICK,
  NAME_THIN,
  NONE,
  NONE_ABBREVIATIONS,
  OPEN_PAREN,
  PERCENT,
  PIPE,
  PX,
  R,
  SPACE,
  UNITS,
  ZERO,
} from './words';
import {
  assertNotLongForm,
  throwInvalid,
} from './messages';
import {
  cssVarValue,
  lengthPartRegExp,
} from './functions';
import {
  PATTERN_BASE_COLOR,
  normalizeDefault,
  snakeLeftTrim,
  splitTopLevel,
  styleWrap,
} from './context';

const BORDER_IMAGE_SOURCE = 'borderImageSource';
const OUTLINE_STYLE_SYNONYMS = {
  N: NAME_NONE,
  DT: NAME_DOTTED,
  DS: NAME_DASHED,
  S: NAME_SOLID,
  DB: NAME_DOUBLE,
  G: 'Groove',
  R: 'Ridge',
  I: 'Inset',
  O: 'Outset',
  // `auto` — стиль по усмотрению браузера (обычно системное кольцо фокуса).
  A: NAME_AUTO,
  // Толщина: валидна у шортката `outline`, у `outline-style` игнорируется.
  TH: NAME_THIN,
  M: NAME_MEDIUM,
  TK: NAME_THICK,
};

const SHADOW_HANDLERS: Record<string, [string, (x: string | number, y: string | number, value: string, r: string | number, color: string) => (string | number)[]]> = {
  bxsh: [
    'boxShadow',
    function(
      x, y, value, r, color,
    ) {
      return [
        x,
        y,
        value,
        r,
        color,
      ];
    },
  ],
  tsh: [
    'textShadow',
    function(
      x, y, value, r, color,
    ) {
      return [
        x,
        y,
        value,
        color,
      ];
    },
  ],
};

/** `:name`-аннотации маршрута — та же форма, что вырезает `routeParseProvider`. */
const REGEXP_ROUTE_KEY = /:[_A-Za-z0-9.]+/g;

/**
 * Проверка суффикса теней ЦЕЛИКОМ.
 *
 * `SHADOW_PATTERNS` — независимые НЕанкоренные regex'ы: каждый ищет свой
 * фрагмент где угодно в суффиксе (`19r3c43F` → r-паттерн находит `r3`,
 * c-паттерн — `c43F`). Обратная сторона в том, что неразобранный хвост никто
 * не замечает: `bxsh10zzz` давал ровно тот же CSS, что `bxsh10`, `bxsh0_2_8_F00`
 * (забытый ведущий `_`) — `0px 0px 0px 0px #000`, и всё это без единого
 * предупреждения. Молчаливый мусор в CSS недопустим.
 *
 * Собирается из тех же `SHADOW_PATTERNS` и того же `UNITS`, чтобы не разъехаться
 * с ними при правке: добавили модификатор или единицу — проверка узнала сама.
 * Единица ограничена реальным списком не для красоты: `bxsh10zzz` иначе проходит
 * (`zzz` попадает в группу единицы generic-разбора ядра и тихо отбрасывается),
 * тогда как `w10zzz`/`p10zzz` бракуются — поведение должно быть одинаковым.
 *
 * Первая группа захвата — единица; остальные приходят из самих
 * `SHADOW_PATTERNS` и здесь не нужны. Брать её из `p.unit` нельзя: разбор
 * значения в ядре считает единицей любой буквенный хвост после числа, и у
 * `bxsh19r3c43F` туда попадает начало модификаторов (`r`), а не `em`.
 *
 * Из списка исключены две единицы.
 *
 * `%` — по грамматике тень задаётся `<length>` и процентов не принимает; без
 * исключения `bxsh10%` давало `0% 0% 10% 0% #000`, правило, которое браузер
 * отбрасывает целиком.
 *
 * `in` — коллизия с модификатором `in` (inset): в `bxsh10in` обе трактовки
 * подходят, и побеждает первая по порядку. Модификатор здесь важнее — он
 * документирован и осмыслен, тогда как дюймы в тени на экране не нужны
 * (`in` вообще единица печати). Кому понадобятся — доступны через свободную
 * форму: `bxsh_0_0_10in_#000`.
 */
const SHADOW_UNITS = UNITS.filter((unit) => unit !== PERCENT && unit !== 'in');
/**
 * Порядок модификаторов тени — **жёсткий**: `blur x y r m c in`.
 *
 * Свободный порядок был следствием реализации: `SHADOW_PATTERNS` — независимые
 * regex'ы, каждый искал свой фрагмент где угодно, поэтому `bxsh19c43Fx5y5r3`
 * давало то же, что `bxsh19x5y5r3c43F`. Порядок жёсткий по тому же доводу, что и у `tn`: одно значение не должно
 * записываться по-разному.
 *
 * Регулярка анкорена и собрана в этом порядке, так что она и проверяет запись,
 * и разбирает её — отдельный обход паттернами больше не нужен.
 *
 * CSS-переменная в позиции blur пишется **явно**, через `B`: `bxshB--blur`.
 * Буква заглавная по той же причине, что `X`/`Y`/`R`/`M`: строчная слилась бы
 * с именем тега — `bxshb…` ядро прочитало бы как тег `bxshb`, не нашло бы
 * хендлера и молча пропустило токен как чужой класс.
 * Без буквы переменная означает всю тень целиком (`bxsh--shadow` →
 * `box-shadow:var(--shadow)`), как `--x` у любого другого свойства. Раньше она
 * молча попадала в позицию blur, а прочие слоты добирались умолчаниями —
 * автор получал правило, которого не писал.
 */
const REGEXP_SHADOW_SUFFIX = new RegExp('^(?:([0-9.]+)('
  + SHADOW_UNITS.join(PIPE) + ')?|B(---?[^;\\s]+;?))?'
  + '(?:[xX](-?[0-9]+))?'
  + '(?:[yY](-?[0-9]+))?'
  + '(?:[rR](-?[0-9]+))?'
  + '(?:[mM]([0-9]+))?'
  + '(?:c(' + PATTERN_BASE_COLOR.replace(REGEXP_ROUTE_KEY, '') + '))?'
  + '(in)?$');
/** Позиции групп в {@link REGEXP_SHADOW_SUFFIX}. */
const MN_SHADOW_VALUE = 1;
const MN_SHADOW_UNIT = 2;
const MN_SHADOW_BLUR_VAR = 3;
const MN_SHADOW_X = 4;
const MN_SHADOW_Y = 5;
const MN_SHADOW_R = 6;
const MN_SHADOW_M = 7;
const MN_SHADOW_COLOR = 8;
/**
 * Что именно принимает свойство-длина — флаги, третья позиция в таблице ниже.
 *
 * Признаков три, и свойства делятся по каждому независимо, поэтому одного флага
 * «это длина» мало: `text-indent:10%` валиден, `word-spacing:10%` — нет;
 * `border-spacing:10px 20px` валиден, `text-indent:10px 20px` — нет;
 * `text-indent:-5px` валиден, `flex-basis:-5px` — нет. Каждое разрешение
 * сверено с арбитром (`css-tree` + `mdn-data`), а не поставлено на глаз.
 *
 * Длина без единственной поблажки — {@link LENGTH_PLAIN}: голый `0` в таблице означает «не длина».
 * Комбинируются через `|`, например `LENGTH_PERCENT | LENGTH_SIGN` у `text-indent`.
 */
/**
 * Ключевые слова одиночных свойств-длин. Пусто означает «только CSS-wide»:
 * `outline-offset:auto` и `letter-spacing:auto` по грамматике невалидны, хотя
 * оба свойства выглядят так, будто `auto` должны принимать.
 */
const EMPTY_KEYWORDS: Record<string, 1> = {};

/** Повтор рамочной картинки (`border-image-repeat`) — те же буквы, что у повтора фона (`bgrRD`) и `stretch` (`aiST`). */
const BORDER_IMAGE_REPEAT_SYNONYMS: Record<string, string> = {
  ST: NAME_STRETCH,
  R: NAME_REPEAT,
  RD: 'Round',
  SP: 'Space',
};
/** Слайс рамки: число без единицы или процент. */
const REGEXP_BORDER_SLICE = /^[0-9]*\.?[0-9]+%?$/;
/** `border-image-slice`: до четырёх слайсов — чисел без единицы (пиксели картинки) или процентов. */
const BORDER_IMAGE_SLICES: LengthRule = {
  signed: false,
  max: 4,
  part: REGEXP_BORDER_SLICE,
  unitless: 1,
  needsNumber: 1,
  expected: 'a slice: a number without a unit (pixels of the image) or a percentage',
  noun: 'slice',
};
/**
 * `border-image-width`: до четырёх длин, процентов или чисел. Голое число остаётся числом — в CSS это кратное ширины
 * рамки (`biw2` → `border-image-width:2`: при `b10` кольцо 20px), `px` к нему не приписывается: единица по умолчанию
 * ставится только там, где число без неё ничего не значит; пиксели — с единицей, `biw10px`.
 */
const BORDER_IMAGE_WIDTHS: LengthRule = {
  signed: false,
  max: 4,
  part: lengthPartRegExp(UNITS, 1),
  unitless: 1,
  expected: 'a length with a unit (`10px`), a percentage or a number — multiples of the border width (`2`)',
};
/**
 * `border-image-outset`: до четырёх длин без процентов или чисел. Голое число — кратное ширины рамки, как у `biw`:
 * `bio2` → `border-image-outset:2`, при `b10` кольцо выносится на 20px; пиксели — с единицей, `bio10px`.
 */
const BORDER_IMAGE_OUTSETS: LengthRule = {
  signed: false,
  max: 4,
  part: lengthPartRegExp(UNITS.filter((unit) => unit !== PERCENT), 1),
  unitless: 1,
  expected: 'a length with a unit (`10px`) or a number — multiples of the border width (`2`); no percentage',
};

/**
 * Склеивает части тени, дописывая единицу каждой длине.
 *
 * Последняя часть — цвет, единицы не получает. Подстановка тоже: `var(--blur)`
 * уже несёт единицу внутри себя, а `var(--blur)px` — мусор.
 */
function shadowJoin(parts: (string | number)[], unit: string): string {
  const last = parts.length - 1;
  const out: string[] = new Array(parts.length);
  let i = 0;
  let part: string;
  for (; i <= last; i++) {
    part = '' + parts[i];
    out[i] = (i === last || part.indexOf(OPEN_PAREN) > -1) ? part : part + unit;
  }
  return out.join(SPACE);
}

/**
 * Хендлеры темы «borders».
 *
 * @param ctx — контекст пресета (`createContext`)
 */
export function registerBorders(ctx: StandardContext): void {
  const {
    backgroundProvider,
    forIn,
    getColor,
    getVal,
    intval,
    lengthOrWord,
    mn,
    registerLengthProperties,
    registerSingleProperties,
    synonymProvider,
  } = ctx;

  mn({
    bi: backgroundProvider(BORDER_IMAGE_SOURCE, 1),
    bis: synonymProvider(
      'borderImageSlice', {
        F: NAME_FILL,
      }, 0, undefined, BORDER_IMAGE_SLICES, 1,
    ),
    biw: synonymProvider(
      'borderImageWidth', {
        A: NAME_AUTO,
      }, 0, undefined, BORDER_IMAGE_WIDTHS, 1,
    ),
    bio: synonymProvider(
      'borderImageOutset', {}, 0, undefined, BORDER_IMAGE_OUTSETS, 1,
    ),
    bir: synonymProvider(
      'borderImageRepeat', BORDER_IMAGE_REPEAT_SYNONYMS, 0, undefined, undefined, 1,
    ),
  });

  mn({
    // Safari понимает только префиксное свойство, поэтому пишутся оба.
    bdb: synonymProvider([
      'WebkitBoxDecorationBreak',
      'boxDecorationBreak',
    ], {
      S: 'Slice',
      C: 'Clone',
    }),
  });

  forIn(SHADOW_HANDLERS, ([
    propName,
    handler,
  ], pfx) => {
    /**
     * Собирает ОДНУ тень из её разобранного суффикса.
     *
     * Возвращает пустую строку, когда тени нет (`bxsh` без значения или
     * `m0` — ноль повторов): вызывающий превращает это в `none`.
     */
    function shadowValue(part: string, name: string): string {
    // Вся тень одной переменной: `bxsh--shadow` → `box-shadow:var(--shadow)`.
    // У любого другого свойства `--x` означает значение целиком, и тень не
    // исключение. В позицию blur переменная ставится явно — `bxshB--blur`.
      const whole = cssVarValue(part);
      if (whole) {
        return whole;
      }
      const parsed = REGEXP_SHADOW_SUFFIX.exec(part);
      parsed || throwInvalid(DOUBLE_QUOTE + name + part + '" is only partly parsed: '
      + 'the order is blur (a number or a B-- variable), then x, y, r, m, c, in');
      const p = parsed as RegExpExecArray;
      const repeatCount = intval(
        p[MN_SHADOW_M], 1, 0,
      );
      // Значение (blur) — ведущее число или переменная; модификаторы его не
      // содержат.
      let value = p[MN_SHADOW_VALUE] || p[MN_SHADOW_BLUR_VAR];
      if (!value) {
      // Модификаторы без ведущего значения — описка: `bxshR3` раньше давало
      // мусор `Rpx` в позиции blur, а потом молча превращалось в `none`.
        part && throwInvalid(DOUBLE_QUOTE + name + part + '" has no leading value: '
        + 'blur goes first — "' + name + '19r3"');
        return '';
      }
      if (repeatCount < 1) {
        return '';
      }
      // `;` — терминатор имени переменной, как везде в нотации: без него имя
      // жадно забрало бы следующие модификаторы (`bxshB--blur;c--shadow`).
      value[0] === DASH && (value = cssVarValue(value) as string);
      const colors = getColor(p[MN_SHADOW_COLOR] || ZERO);
      // Последняя группа регулярки — `in` (inset).
      const prefixIn = p[p.length - 1] ? 'inset ' : '';
      const colorsLength = colors.length;
      // Единица склейки была жёстко `px`: `bxsh10em` давало
      // `0px 0px 10px 0px #000` — единица молча терялась. Модификаторы x/y/r
      // по грамматике суффикса — целые без единицы, поэтому единица у записи
      // одна на все её длины.
      const unit = p[MN_SHADOW_UNIT] || PX;
      const output = new Array(colorsLength);
      let sample, v, color, i, ci = 0;
      for (;ci < colorsLength; ci++) {
        color = colors[ci];
        sample = prefixIn
        + shadowJoin(handler(
          p[MN_SHADOW_X] || 0, p[MN_SHADOW_Y] || 0,
          value, p[MN_SHADOW_R] || 0, color,
        ),
        unit);
        v = new Array(repeatCount);
        for (i = repeatCount; i--;) {
          v[i] = sample;
        }
        output[ci] = v.join(COMMA);
      }
      return output.join(COMMA);
    }

    mn(pfx, (p) => {
      const suffix = p.suffix;
      const style: MnStyle = {};
      // «Тени нет» — `bxshN` (наравне с голым `bxsh`); `bxshNone`, `bxsh_none` бракуются.
      if (suffix === N) {
        style[propName] = NONE;
        return styleWrap(style);
      }
      assertNotLongForm(
        snakeLeftTrim(suffix).toLowerCase(), NONE_ABBREVIATIONS, pfx, suffix,
      );
      // Несколько РАЗНЫХ теней — через запятую. Модификатор `m` повторяет одну
      // и ту же, а сырой режим на списке ломался: запятая уходила внутрь
      // `var(…)` и давала `var(--shadow,0) 1px 2px var(--shadow2)`.
      const parts = splitTopLevel(suffix);
      const l = parts.length;
      const out: string[] = new Array(l);
      let i = 0;
      let one: string;
      for (; i < l; i++) {
        one = shadowValue(parts[i], p.name);
        if (!one) {
          style[propName] = NONE;
          return styleWrap(style);
        }
        out[i] = one;
      }
      style[propName] = out.join(COMMA);
      return styleWrap(style);
    });
  });


  mn(
    R, (p) => {
      const v = getVal(
        p.suffix || 10000, 1, 0, PX, 1,
      );
      return styleWrap({
        borderRadius: v[0],
      }, v[1]);
    }, '', 1,
  );


  // border-radius by corners; логические углы и пары углов `rs`/`re` — `border-<блок>-<строка>-radius`
  forIn({
    lt: ['top-left'],
    lb: ['bottom-left'],
    rt: ['top-right'],
    rb: ['bottom-right'],
    ss: ['start-start'],
    se: ['start-end'],
    es: ['end-start'],
    ee: ['end-end'],
    // `rs` — оба угла начала строки, `re` — оба угла её конца (Tailwind `rounded-s` / `rounded-e`).
    s: [
      'start-start',
      'end-start',
    ],
    e: [
      'start-end',
      'end-end',
    ],
  }, (corners, suffix) => {
    const length = corners.length;
    const propNames = corners.map((corner) => BORDER + DASH + corner + '-radius');
    // Угол (2) позже пары углов (1): `rs8 rss0` — угол перекрывает пару.
    const priority = 3 - length;
    mn(
      R + suffix, (p) => {
        const value = getVal(
          p.suffix || 10000, 1, 1, PX, 1,
        )[0];
        const style: MnStyle = {};
        let i = 0;
        for (; i < length; i++) {
          style[propNames[i]] = value;
        }
        return styleWrap(style, priority);
      }, '', 1,
    );
  });

  registerLengthProperties({
    olw: [
      'outlineWidth',
      0,
      1,
      1,
      {
        TN: NAME_THIN,
        M: NAME_MEDIUM,
        TC: NAME_THICK,
      },
      // Та же `<line-width>`, что у `border-width`: длина или слово, без
      // процентов.
      1,
    ],
  });

  mn({
    // `outline-offset` — длина со знаком, без процентов и без ключевых слов
    // помимо CSS-wide.
    olo: (p) => {
      let v;
      return (v = cssVarValue(p.suffix || '')) ? styleWrap({
        outlineOffset: v,
      }) : (p.value ? styleWrap({
        outlineOffset: lengthOrWord(
          p, EMPTY_KEYWORDS, 0, PX,
        ),
      }) : normalizeDefault(p));
    },
    ols: synonymProvider(
      'outlineStyle', OUTLINE_STYLE_SYNONYMS, 1,
    ),
    bdcl: synonymProvider(
      'borderCollapse', {
        C: NAME_COLLAPSE,
        S: 'Separate',
      }, 1,
    ),
  });

  registerSingleProperties({
    bsp: [
      'borderSpacing',
      0,
      LENGTH_MULTI,
    ],
  });
}
