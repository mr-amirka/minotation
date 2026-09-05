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
/** CSS identifier ("red", "invert", "ButtonText", "-moz-something") — для permissive keyword-passthrough. */
const REGEXP_IDENTIFIER = /^-?[a-z_][a-z0-9_-]*$/i;

const REGEXP_NUMBER = new RegExp('^' + NUM + '$');
const REGEXP_INTEGER = /^[-+]?\d+$/;
const REGEXP_LENGTH = new RegExp('^(?:0|' + NUM + LENGTH_UNIT + ')$');
const REGEXP_TIME = new RegExp('^' + NUM + '(?:s|ms)$');
const REGEXP_CALC = /^calc\(.*\)$/i;
// 1-8 hex-цифр, не строго 3/4/6/8 по спеке — часть тестовой инфраструктуры
// (не presetStandard) намеренно использует урезанные "цвета" вида #F/#A,
// чтобы изолировать проверку селекторов от полноценной цветовой логики;
// сужать до spec-точного счётчика цифр здесь не даёт заметной пользы в
// отлове реальных багов ("Rpx"-класс мусора не выглядит как валидный hex).
const REGEXP_HEX_COLOR = /^#[0-9a-f]{1,8}$/i;
const REGEXP_RGBA_COLOR = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)$/i;

/** Ключевые слова, валидные для ЛЮБОГО CSS-свойства (CSS-level globals). */
const GLOBAL_KEYWORDS = ['inherit', 'initial', 'unset', 'revert'];

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
export function isLengthOrAutoValue(v: string): boolean {
  return isLengthValue(v) || v.toLowerCase() === 'auto';
}
/** `line-height`: либо длина (`1px`), либо голое число-множитель (из `%`-ввода, `115%` → `1.15`). */
export function isLengthOrNumberValue(v: string): boolean {
  return isLengthValue(v) || isNumberValue(v);
}
export function isTimeValue(v: string): boolean {
  return REGEXP_TIME.test(v) || isKeyword(v, GLOBAL_KEYWORDS);
}
/**
 * hex/rgba() ИЛИ произвольный CSS-идентификатор — ядро резолвит синонимы
 * (F/D/T/CT) до этой точки, но пропускает насквозь и буквальные именованные
 * цвета (`cRed`→`color:red`) и не-цветовые keyword-значения отдельных
 * цветовых свойств (`olcI`→`outline-color:invert`) — полный список ~150
 * именованных CSS-цветов + системных цветов (`ButtonText` и т.п.) здесь не
 * enum'ится, идентификатор-по-форме уже достаточно узок, чтобы не пропустить
 * реальный мусор (`undefined`/`NaN` содержат не-identifier контекст в других
 * свойствах, но САМИ по себе, увы, являются валidными идентификаторами — это
 * ловит {@link REGEXP_INVALID_CSS_VALUE} универсально, см. `validateEssenceStyle`).
 */
export function isColorValue(v: string): boolean {
  return REGEXP_HEX_COLOR.test(v) || REGEXP_RGBA_COLOR.test(v) || REGEXP_IDENTIFIER.test(v);
}
/** `border-width`/`outline-width`: длина ИЛИ одно из трёх ключевых слов толщины. */
export function isLengthOrWidthKeywordValue(v: string): boolean {
  return isLengthValue(v) || isKeyword(v, ['thin', 'medium', 'thick']);
}
/** `font-weight`: число 100-900 (или произвольное, ядро не клэмпит) либо ключевое слово начертания. */
export function isFontWeightValue(v: string): boolean {
  return isNumberValue(v) || isKeyword(v, ['normal', 'bold', 'bolder', 'lighter']);
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
  'max-width': isLengthOrAutoValue,
  'min-height': isLengthOrAutoValue,
  'max-height': isLengthOrAutoValue,
  'top': isLengthOrAutoValue,
  'right': isLengthOrAutoValue,
  'bottom': isLengthOrAutoValue,
  'left': isLengthOrAutoValue,
  'margin': isLengthOrAutoValue,
  'margin-top': isLengthOrAutoValue,
  'margin-bottom': isLengthOrAutoValue,
  'margin-left': isLengthOrAutoValue,
  'margin-right': isLengthOrAutoValue,
  'padding': isLengthValue,
  'padding-top': isLengthValue,
  'padding-bottom': isLengthValue,
  'padding-left': isLengthValue,
  'padding-right': isLengthValue,
  'flex-basis': isLengthOrAutoValue,
  'border-radius': isLengthValue,
  'gap': isLengthValue,
  'grid-gap': isLengthValue,
  'grid-column-gap': isLengthValue,
  'grid-row-gap': isLengthValue,
  'text-indent': isLengthValue,
  'letter-spacing': isNumberValue,
  'word-spacing': (v) => isLengthValue(v) || isKeyword(v, ['normal']),
  'outline-offset': isLengthValue,
  'outline-width': isLengthOrWidthKeywordValue,
  'border-width': isLengthOrWidthKeywordValue,
  'border-top-width': isLengthOrWidthKeywordValue,
  'border-right-width': isLengthOrWidthKeywordValue,
  'border-bottom-width': isLengthOrWidthKeywordValue,
  'border-left-width': isLengthOrWidthKeywordValue,
  'stroke-width': isLengthValue,
  'border-spacing': isLengthValue,
  'line-height': isLengthOrNumberValue,
  'text-size-adjust': (v) => isLengthValue(v) || isKeyword(v, ['none', 'auto']),
  'color': isColorValue,
  'background': isColorValue,
  'background-color': isColorValue,
  'border-color': isColorValue,
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
  const validator = PROPERTY_VALIDATORS[canonicalizeCssPropertyName(prop)];
  return !validator || validator('' + value);
}
