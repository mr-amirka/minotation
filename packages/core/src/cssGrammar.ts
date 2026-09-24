/**
 * Per-свойству грамматическая валидация CSS-значений — расширение точечной
 * эвристики `REGEXP_INVALID_CSS_VALUE` (`core/utils.ts`) до проверки формы
 * значения для свойств, которые ядро само формирует из числового/цветового
 * ввода (не просто пропускает пользовательский текст насквозь).
 *
 * ## Почему не все CSS-свойства покрыты строгой грамматикой
 *
 * Значительная часть хендлеров (`{value:(camelCase|snakeCase)}` в HANDLERS.md)
 * — намеренно permissive pass-through: `toKebabCase(v)` без проверки, что
 * получившееся слово реально входит в спецификацию CSS для этого конкретного
 * свойства (`apc`→`appearance`, `bga`→`background-attachment` и т.д.). Строгая
 * enum-проверка здесь означала бы заново изобретать сознательное решение
 * компилятора "принимать произвольное значение" — и рискует забраковать
 * валидные, но не перечисленные здесь ключевые слова. Для этой группы
 * остаётся только базовая эвристика `REGEXP_INVALID_CSS_VALUE` (мусорные
 * артефакты вида `undefined`/`NaN`/`Rpx`) — см. `PROPERTY_VALIDATORS`,
 * не входящие в неё свойства не проверяются здесь вообще.
 *
 * Для свойств, где ядро само формирует значение из числа/цвета (padding,
 * width, border-*-color, opacity, z-index, ...) — здесь строгая проверка
 * формы: ошибка формирования (конкатенация "R"+"px" без числа между ними)
 * ловится по СТРУКТУРЕ значения, а не по случайному совпадению с "похоже
 * на мусор".
 *
 * @module cssGrammar
 */

const NUM = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)';
const LENGTH_UNIT = '(?:px|em|rem|%|vh|vw|vmin|vmax|pt|pc|cm|mm|ch|ex|in|fr)';

const REGEXP_NUMBER = new RegExp('^' + NUM + '$');
const REGEXP_INTEGER = /^[-+]?\d+$/;
const REGEXP_LENGTH = new RegExp('^(?:0|' + NUM + LENGTH_UNIT + ')$');
const REGEXP_TIME = new RegExp('^' + NUM + '(?:s|ms)$');
const REGEXP_CALC = /^calc\(.*\)$/i;
/**
 * Подстановка custom property / environment variable — по спецификации CSS
 * допустима в значении ЛЮБОГО свойства, грамматика самого свойства к ней не
 * применяется (проверяется уже браузером на этапе подстановки). Ядро
 * генерирует такие значения из токенов `w--v` → `var(--v)`, `w---v` → `env(--v)`,
 * `w--v,10px` → `var(--v,10px)` (см. `PATTERN_VAR` в `presets/standard.ts`).
 */
const REGEXP_VAR_FUNCTION = /^(?:var|env)\(--.*\)$/i;
// 1-8 hex-цифр, не строго 3/4/6/8 по спеке — часть тестовой инфраструктуры
// (не presetStandard) намеренно использует урезанные "цвета" вида #F/#A,
// чтобы изолировать проверку селекторов от полноценной цветовой логики;
// сужать до spec-точного счётчика цифр здесь не даёт заметной пользы в
// отлове реальных багов ("Rpx"-класс мусора не выглядит как валидный hex).
const REGEXP_HEX_COLOR = /^#[0-9a-f]{1,8}$/i;
const REGEXP_RGBA_COLOR = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/i;

/**
 * Свойства, у которых значение приходит из карты синонимов по буквам суффикса
 * (`dF`→flex, `aiC`→center, `jcSB`→space-between). Нераспознанная буква падает
 * в буквальный `toKebabCase` и даёт синтаксически валидный, но нерабочий CSS:
 * `dG` → `display:g`, `aiE` → `align-items:e`, `jcB` → `justify-content:b` —
 * до 2026-09-22 молча, без предупреждения (найдено при интеграции в реальный
 * проект, см. `PROJECTS_CONTEXT/minotation/AGENT_DRAFT/RESEARCH/02_*`).
 *
 * Проверка намеренно **узкая**: бракуется только значение из 1–2 букв, которое
 * не входит в короткий список легальных (`pre`, `top`, `sub`… длиннее двух букв,
 * поэтому в список не нужны). Полная enum-валидация этих свойств сознательно не
 * делается — см. решение в шапке модуля про permissive pass-through.
 */
const SYNONYM_PROPERTIES: Record<string, number> = {
  'display': 1,
  'align-items': 1,
  'align-self': 1,
  'align-content': 1,
  'justify-content': 1,
  'justify-items': 1,
  'flex-direction': 1,
  'flex-wrap': 1,
  'position': 1,
  'text-align': 1,
  'text-transform': 1,
  'white-space': 1,
  'vertical-align': 1,
  'overflow': 1,
  'overflow-x': 1,
  'overflow-y': 1,
  'box-sizing': 1,
  'border-style': 1,
  'cursor': 1,
  'float': 1,
  'clear': 1,
  'visibility': 1,
  'text-decoration': 1,
  'text-decoration-line': 1,
  'text-decoration-style': 1,
  'font-style': 1,
  'font-variant': 1,
  'text-overflow': 1,
  'word-break': 1,
  'overflow-wrap': 1,
  'list-style-type': 1,
  'object-fit': 1,
  'pointer-events': 1,
  'resize': 1,
  'user-select': 1,
};
/**
 * Подпись «кебаб из одиночных букв»: `LT` → `l-t`, `SB` → `s-b`. Так выглядит
 * многобуквенный синоним, которого нет в карте, после `toKebabCase` — настоящие
 * значения состоят из слов (`space-between`, `line-through`), а не из букв.
 */
const REGEXP_SINGLE_LETTER_KEBAB = /^[a-z](?:-[a-z])+$/;
/**
 * Свойства, у которых отрицательная длина невозможна по спецификации CSS.
 * Нужны, чтобы поймать `p8-12`: `-` в нотации значит вычитание, поэтому запись
 * читается как `calc(8px - 12px)` — правило синтаксически валидное, но
 * браузером отбрасывается. Автор почти всегда имел в виду два значения
 * (`padding:8px 12px`), которые в нотации пишутся двумя токенами: `py8 px12`.
 */
const NON_NEGATIVE_PROPERTIES: Record<string, number> = {
  'padding': 1,
  'padding-top': 1,
  'padding-right': 1,
  'padding-bottom': 1,
  'padding-left': 1,
  'width': 1,
  'height': 1,
  'min-width': 1,
  'min-height': 1,
  'max-width': 1,
  'max-height': 1,
  'border-radius': 1,
  'border-width': 1,
  'font-size': 1,
  'gap': 1,
  'row-gap': 1,
  'column-gap': 1,
  'grid-gap': 1,
  'grid-row-gap': 1,
  'grid-column-gap': 1,
  'flex-basis': 1,
  'outline-width': 1,
};
/** `calc(8px - 12px)` из двух литералов одной единицы — считаем результат, чтобы поймать минус. */
const REGEXP_CALC_TWO_LITERALS = /^calc\(\s*(-?[\d.]+)([a-z%]*)\s*([-+])\s*(-?[\d.]+)([a-z%]*)\s*\)$/i;

/**
 * `true`, если значение — `calc()` из двух литералов одной единицы, дающий
 * отрицательный результат у свойства, где отрицательная длина запрещена.
 */
export function isNegativeCalcForNonNegative(prop: string, v: string): boolean {
  if (NON_NEGATIVE_PROPERTIES[prop] !== 1) {
    return false;
  }
  const m = REGEXP_CALC_TWO_LITERALS.exec(v);
  if (!m || (m[2] && m[5] && m[2].toLowerCase() !== m[5].toLowerCase())) {
    return false;
  }
  const result = m[3] === '-'
    ? parseFloat(m[1]) - parseFloat(m[4])
    : parseFloat(m[1]) + parseFloat(m[4]);
  return result < 0;
}

/** Легальные значения длиной ≤ 2 символов у перечисленных свойств. */
const SHORT_VALID_VALUES: Record<string, number> = {
  'sw': 1, 
};

/**
 * `true`, если значение похоже на нераспознанную букву синонима
 * (`display:g`, `align-items:e`) — 1–2 буквы у свойства из {@link SYNONYM_PROPERTIES}.
 */
export function isUnresolvedSynonym(prop: string, v: string): boolean {
  const low = v.toLowerCase();
  if (SYNONYM_PROPERTIES[prop] !== 1 || SHORT_VALID_VALUES[low] === 1) {
    return false;
  }
  return (low.length <= 2 && /^[a-z]+$/.test(low))
    || REGEXP_SINGLE_LETTER_KEBAB.test(low);
}

/** Ключевые слова, валидные для ЛЮБОГО CSS-свойства (CSS-level globals). */
const GLOBAL_KEYWORDS = [
  'inherit',
  'initial',
  'unset',
  'revert',
];

/**
 * Shorthand-свойство с 1–4 значениями через пробел (`padding:10px 20px`,
 * `margin:0 auto`, `border-radius:4px 8px 12px 16px`, `border-color:#f00 #0f0`).
 * Каждое значение проверяется валидатором одиночного значения.
 */
function multiValue(single: Validator, max = 4): Validator {
  return (v) => {
    const parts = splitTopLevel(v);
    if (parts.length < 1 || parts.length > max) {
      return false;
    }
    for (let i = 0; i < parts.length; i++) {
      if (!single(parts[i])) {
        return false;
      }
    }
    return true;
  };
}
/**
 * {@link multiValue}, но значение целиком может быть и одним из `keywords`.
 * Нужно шорткатам, у которых рядом с набором длин стоит ключевое слово —
 * `gap: normal` (initial value), а не `normal normal`.
 */
function multiValueOrKeyword(
  single: Validator, max: number, keywords: string[],
): Validator {
  const multi = multiValue(single, max);
  return (v) => isKeyword(v, keywords) || multi(v);
}
/** Разбивает по пробелам вне скобок: `calc(10px - 5px) 20px` → 2 части, не 4. */
function splitTopLevel(v: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let c: string;
  for (let i = 0; i < v.length; i++) {
    c = v[i];
    if (c === '(') {
      depth++;
    } else if (c === ')') {
      depth--;
    } else if (c === ' ' && depth === 0) {
      if (i > start) {
        parts.push(v.slice(start, i));
      }
      start = i + 1;
    }
  }
  if (v.length > start) {
    parts.push(v.slice(start));
  }
  return parts;
}

function isKeyword(v: string, set: string[]): boolean {
  return set.indexOf(v.toLowerCase()) !== -1;
}

export function isNumberValue(v: string): boolean {
  return REGEXP_NUMBER.test(v) || isKeyword(v, GLOBAL_KEYWORDS);
}
export function isIntegerValue(v: string): boolean {
  return REGEXP_INTEGER.test(v) || isKeyword(v, GLOBAL_KEYWORDS);
}
export function isLengthValue(v: string): boolean {
  return REGEXP_LENGTH.test(v) || REGEXP_CALC.test(v) || isKeyword(v, GLOBAL_KEYWORDS);
}
/**
 * Ключевые слова внутреннего размера — валидны у ВСЕХ размерных свойств
 * (`width`/`height`/`min-*`/`max-*`). Бракуя их, валидатор терял рабочие
 * правила: `wFitContent` не доходил до CSS (2026-09-24).
 */
const CONTENT_SIZE_KEYWORDS = [
  'min-content',
  'max-content',
  'fit-content',
  'stretch',
];
/** Длина/проценты/`calc()` либо внутренний размер. */
function isSizeValue(v: string): boolean {
  return isLengthValue(v) || isKeyword(v, CONTENT_SIZE_KEYWORDS);
}
/** `width`/`height`/`min-*`: длина, внутренний размер, `auto`. */
export function isLengthOrAutoValue(v: string): boolean {
  return isSizeValue(v) || v.toLowerCase() === 'auto';
}
/**
 * `max-width`/`max-height` (и логические `max-inline-size`/`max-block-size`):
 * длина, внутренний размер, `none`.
 *
 * У этих свойств `none` — initial value, а `auto` наоборот НЕ валиден: их
 * грамматика отличается от `width`/`min-*`, хотя раньше валидатор был общий.
 * Из-за этого `wmaxN` (`max-width:none`) молча не доходил до CSS, а бессмысленный
 * `max-width:auto` пропускался (2026-09-24, трек `notation-ergonomics`, задача 1).
 */
export function isMaxSizeValue(v: string): boolean {
  return isSizeValue(v) || v.toLowerCase() === 'none';
}
/** `line-height`: либо длина (`1px`), либо голое число-множитель (из `%`-ввода, `115%` → `1.15`). */
export function isLengthOrNumberValue(v: string): boolean {
  return isLengthValue(v) || isNumberValue(v);
}
/**
 * `letter-spacing`: длина (`0.06em`, `1px`), голое число (v1-совместимость —
 * хендлер `lts` не добавляет единицу автоматически, см. HANDLERS.md) или `normal`.
 * До 2026-09-22 здесь стоял {@link isNumberValue}, из-за чего валидное `lts0.06em`
 * браковалось как «битое значение», а синоним `ltsN` (`normal`) не проходил вовсе.
 */
export function isSpacingValue(v: string): boolean {
  return isLengthOrNumberValue(v) || v.toLowerCase() === 'normal';
}
export function isTimeValue(v: string): boolean {
  return REGEXP_TIME.test(v) || isKeyword(v, GLOBAL_KEYWORDS);
}
/**
 * hex, `rgba()` или одно из немногих словесных значений, которые кодом не
 * выразить: {@link COLOR_KEYWORDS} и {@link SYSTEM_COLORS}.
 *
 * До 2026-09-24 сюда проходил ЛЮБОЙ CSS-идентификатор, то есть и все ~150
 * именованных цветов (`cRed` → `color:red`). Решение владельца — принимать
 * только коды: `cRed` и `cF00` дают один результат двумя записями, а в CSS
 * попадут оба правила. Побочная польза от закрытого списка: мусор вида
 * `undefined`/`NaN` теперь отсекается прямо здесь, а не только вторым уровнем
 * (`REGEXP_INVALID_CSS_VALUE` в `validateEssenceStyle`).
 *
 * Синонимы (`F`/`D`/`T`/`CT`) ядро резолвит ДО этой точки — сюда приходит уже
 * `#fff`/`transparent`/`currentColor`.
 */
/**
 * Словесные значения, которые цветовое свойство принимает ПОМИМО кода.
 *
 * Именованных цветов (`red`, `aliceblue`, …) здесь намеренно нет: решение
 * владельца 2026-09-24 — «пусть принимаются только коды (F00)». Причина та же,
 * что у остальной канонизации: `cRed` и `cF00` дают один результат двумя
 * записями, и в CSS поедут оба правила. Код ещё и короче.
 *
 * Оставлены только два:
 *
 * - `currentcolor` — зависит от `color` элемента, кодом не выразить;
 * - `transparent` — формально равен `#0000`, но код туда писать невыгодно:
 *   ядро разворачивает 4-значный hex в ДВА объявления (`#000` как fallback
 *   плюс `rgba(0,0,0,0)`), тогда как слово даёт одно и короче.
 *
 * `invert` убран 2026-09-24: по текущей спецификации он невалиден ни у
 * `outline-color`, ни у `outline` (проверено `lexer.matchProperty`) — остаток
 * CSS 2.1. Одноимённый ФИЛЬТР (`ftInvert20` → `filter:invert(20%)`) — другое
 * значение и другое свойство, он не тронут.
 */
const COLOR_KEYWORDS = ['currentcolor', 'transparent'];
/**
 * Системные цвета (CSS Color 4) — берутся из темы операционной системы,
 * поэтому кодом их выразить нельзя и правило «только коды» на них не
 * распространяется. Уже используются в пресетах: `ol_1px_dotted_ButtonText`
 * (`presets/main.ts`, `presets/normalize.ts`) — стандартное кольцо фокуса.
 */
const SYSTEM_COLORS = [
  'accentcolor',
  'accentcolortext',
  'activetext',
  'buttonborder',
  'buttonface',
  'buttontext',
  'canvas',
  'canvastext',
  'field',
  'fieldtext',
  'graytext',
  'highlight',
  'highlighttext',
  'linktext',
  'mark',
  'marktext',
  'selecteditem',
  'selecteditemtext',
  'visitedtext',
];
/**
 * Цветовые функции CSS Color 4/5: `color-mix()`, `oklch()`, `light-dark()` и
 * родня. Проверяется только ИМЯ функции и парность скобок — содержимое
 * отдаётся браузеру как есть: перечислять грамматику каждой здесь значило бы
 * повторять спецификацию, которая ещё меняется.
 *
 * Нужны с 2026-09-25: `bc--warn.3` компилируется в `color-mix(…)`, а цветовые
 * хендлеры научились пропускать функции насквозь (`rawColorValue` в
 * `presets/standard.ts`).
 *
 * `rgb()`/`hsl()` сюда НЕ входят намеренно: у них состав аргументов
 * фиксированный и давно устоявшийся, поэтому он проверяется строго
 * ({@link REGEXP_RGBA_COLOR}) — иначе `rgba(1,2)` прошло бы как валидное.
 */
const REGEXP_COLOR_FUNCTION
  = /^(?:color-mix|color|oklch|oklab|lch|lab|hwb|light-dark|device-cmyk)\([^()]*(?:\([^()]*\)[^()]*)*\)$/i;
export function isColorValue(v: string): boolean {
  return REGEXP_HEX_COLOR.test(v)
    || REGEXP_COLOR_FUNCTION.test(v)
    || REGEXP_RGBA_COLOR.test(v)
    || isKeyword(v, COLOR_KEYWORDS)
    || isKeyword(v, SYSTEM_COLORS)
    || isKeyword(v, GLOBAL_KEYWORDS);
}
/**
 * `linear-gradient(…)` и родственные, включая `repeating-`.
 *
 * Нужна свойству `background`: ядро строит градиент из компактной записи
 * (`bgF00-00F` → `linear-gradient(180deg,#f00 0%,#00f 100%)`,
 * `colorGetBackground` в `fundamentool`), но валидатором для `background`
 * стоял чистый {@link isColorValue}, и КАЖДЫЙ градиент отбраковывался как
 * «битое значение» — правило не доходило до CSS вообще. Того же класса баг,
 * что с `var()` до 2026-09-17. Найдено 2026-09-23.
 */
const REGEXP_GRADIENT = /^(?:repeating-)?(?:linear|radial|conic)-gradient\(.+\)$/i;
export function isGradientValue(v: string): boolean {
  return REGEXP_GRADIENT.test(v);
}
/** `border-width`/`outline-width`: длина ИЛИ одно из трёх ключевых слов толщины. */
export function isLengthOrWidthKeywordValue(v: string): boolean {
  return isLengthValue(v) || isKeyword(v, [
    'thin',
    'medium',
    'thick',
  ]);
}
/** `font-weight`: число 100-900 (или произвольное, ядро не клэмпит) либо ключевое слово начертания. */
export function isFontWeightValue(v: string): boolean {
  return isNumberValue(v) || isKeyword(v, [
    'normal',
    'bold',
    'bolder',
    'lighter',
  ]);
}

type Validator = (v: string) => boolean;

/**
 * Реестр строгих валидаторов по CSS-свойству (ключ — kebab-case, см.
 * {@link canonicalizeCssPropertyName}). Свойства вне реестра не проверяются
 * здесь — для них действует только базовая эвристика (см. module doc).
 */
export const PROPERTY_VALIDATORS: Record<string, Validator> = {
  'width': isLengthOrAutoValue,
  'height': isLengthOrAutoValue,
  'min-width': isLengthOrAutoValue,
  'max-width': isMaxSizeValue,
  'min-height': isLengthOrAutoValue,
  'max-height': isMaxSizeValue,
  // Логические аналоги — та же грамматика.
  'max-inline-size': isMaxSizeValue,
  'max-block-size': isMaxSizeValue,
  'min-inline-size': isLengthOrAutoValue,
  'min-block-size': isLengthOrAutoValue,
  'inline-size': isLengthOrAutoValue,
  'block-size': isLengthOrAutoValue,
  'top': isLengthOrAutoValue,
  'right': isLengthOrAutoValue,
  'bottom': isLengthOrAutoValue,
  'left': isLengthOrAutoValue,
  'margin': multiValue(isLengthOrAutoValue),
  'margin-top': isLengthOrAutoValue,
  'margin-bottom': isLengthOrAutoValue,
  'margin-left': isLengthOrAutoValue,
  'margin-right': isLengthOrAutoValue,
  'padding': multiValue(isLengthValue),
  'padding-top': isLengthValue,
  'padding-bottom': isLengthValue,
  'padding-left': isLengthValue,
  'padding-right': isLengthValue,
  'flex-basis': isLengthOrAutoValue,
  'border-radius': multiValue(isLengthValue),
  // `normal` — initial value у `row-gap`/`column-gap` по спецификации, а не
  // экзотика: `ggcN` (синоним `N`→`Normal`) давал валидный CSS, который
  // валидатор молча браковал как «не длину» (2026-09-23).
  'gap': multiValueOrKeyword(
    isLengthValue, 2, ['normal'],
  ),
  'grid-gap': multiValueOrKeyword(
    isLengthValue, 2, ['normal'],
  ),
  'grid-column-gap': (v) => isLengthValue(v) || isKeyword(v, ['normal']),
  'grid-row-gap': (v) => isLengthValue(v) || isKeyword(v, ['normal']),
  'row-gap': (v) => isLengthValue(v) || isKeyword(v, ['normal']),
  'column-gap': (v) => isLengthValue(v) || isKeyword(v, ['normal']),
  'text-indent': isLengthValue,
  'letter-spacing': isSpacingValue,
  'word-spacing': (v) => isLengthValue(v) || isKeyword(v, ['normal']),
  'outline-offset': isLengthValue,
  'outline-width': isLengthOrWidthKeywordValue,
  'border-width': multiValue(isLengthOrWidthKeywordValue),
  'border-top-width': isLengthOrWidthKeywordValue,
  'border-right-width': isLengthOrWidthKeywordValue,
  'border-bottom-width': isLengthOrWidthKeywordValue,
  'border-left-width': isLengthOrWidthKeywordValue,
  'stroke-width': isLengthValue,
  'border-spacing': multiValue(isLengthValue, 2),
  'line-height': isLengthOrNumberValue,
  'text-size-adjust': (v) => isLengthValue(v) || isKeyword(v, ['none', 'auto']),
  'color': isColorValue,
  // Шорткат, а не чистый цвет: ядро кладёт сюда и градиент (`bgF00-00F`).
  'background': (v) => isColorValue(v) || isGradientValue(v),
  'background-color': isColorValue,
  'border-color': multiValue(isColorValue),
  'border-top-color': isColorValue,
  'border-right-color': isColorValue,
  'border-bottom-color': isColorValue,
  'border-left-color': isColorValue,
  'outline-color': isColorValue,
  'text-decoration-color': isColorValue,
  'text-emphasis-color': isColorValue,
  'fill': isColorValue,
  'stroke': isColorValue,
  'opacity': isNumberValue,
  'z-index': (v) => isIntegerValue(v) || isKeyword(v, ['auto']),
  'order': isIntegerValue,
  'flex-grow': isNumberValue,
  'flex-shrink': isNumberValue,
  'font-weight': isFontWeightValue,
  // `font` — shorthand: минимум размер и семейство («12px Arial»), либо системное
  // ключевое слово. Ловит `font12` → `font:12` (невалидный CSS, браузер отбрасывает).
  'font': (v) => /\s/.test(v) || isKeyword(v, [
    'caption',
    'icon',
    'menu',
    'message-box',
    'small-caption',
    'status-bar',
    'inherit',
    'initial',
    'unset',
    'revert',
  ]),
  'transition-duration': isTimeValue,
  'transition-delay': isTimeValue,
};

/**
 * `paddingLeft` / `padding-left` / `-webkitOverflowScrolling` → `padding-left` /
 * `padding-left` / `-webkit-overflow-scrolling`. Хендлеры возвращают ключи
 * `essence.style` в camelCase (`boxSizing`) ИЛИ уже в kebab-case (`normalize`/
 * `main`-пресеты пишут `'border-width'` литералом напрямую) — единая функция
 * канонизации нужна, чтобы искать в {@link PROPERTY_VALIDATORS} независимо
 * от того, в какой форме пришёл ключ.
 */
export function canonicalizeCssPropertyName(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * @param prop — ключ `essence.style` (camelCase или kebab-case, см. {@link canonicalizeCssPropertyName})
 * @param value — значение (строка ИЛИ число — `fontWeight` иногда приходит как JS number)
 * @returns `true`, если для свойства нет строгого валидатора (не проверяем) ИЛИ значение прошло проверку
 */
export function isValidCssPropertyValue(prop: string, value: string | number): boolean {
  const name = canonicalizeCssPropertyName(prop);
  const v = '' + value;
  if (REGEXP_VAR_FUNCTION.test(v)) {
    return true;
  }
  if (isUnresolvedSynonym(name, v) || isNegativeCalcForNonNegative(name, v)) {
    return false;
  }
  const validator = PROPERTY_VALIDATORS[name];
  return !validator || validator(v);
}
