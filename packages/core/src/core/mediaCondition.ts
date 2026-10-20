/**
 * Условие ширины или высоты для `@media` (D-087) — одно для всех режимов записи: по умолчанию в форме
 * диапазона (`(width >= 48rem)`, `(width < 480px)`), с опцией `mediaSyntax: 'classic'` — через
 * `min-`/`max-` для старых браузеров (`(min-width: 48rem)`, `(max-width: 479.98px)`).
 *
 * Классическая форма не знает строгих сравнений: `<` и `>` сдвигаются на 0.02px (в rem/em — на 0.00125,
 * те же 0.02px при 16px), как делают Bootstrap и прежний вывод minotation.
 *
 * @module mediaCondition
 */

/** Запись условий медиа: диапазон (по умолчанию) или `min-`/`max-`. */
export type MnMediaSyntax = 'range' | 'classic';

/** Сравнение в условии. */
export type MnMediaOperator = '>=' | '>' | '<' | '<=';

/** Длина с единицей: `480px`, `48rem`, `30.5em`. */
const REGEXP_LENGTH = /^(\d+(?:\.\d+)?|\.\d+)(px|rem|em)$/;

/** Сдвиг строгого сравнения в классической форме: px и rem/em. */
const STRICT_SHIFT: Record<string, number> = {
  px: 0.02,
  rem: 0.00125,
  em: 0.00125,
};

/**
 * Условие медиа.
 *
 * @param side — `width` или `height`
 * @param operator — сравнение
 * @param length — длина CSS (`480px`, `48rem`)
 * @param classic — классическая форма `min-`/`max-`
 * @returns условие в скобках
 * @example
 * mediaCondition('width', '<', '480px', false);  // → '(width < 480px)'
 * mediaCondition('width', '<', '480px', true);   // → '(max-width: 479.98px)'
 * mediaCondition('width', '>=', '48rem', true);  // → '(min-width: 48rem)'
 */
export function mediaCondition(
  side: string, operator: MnMediaOperator, length: string, classic: boolean,
): string {
  const greater = operator === '>';
  const strict = operator === '<' || greater;
  const matchs = classic && strict ? REGEXP_LENGTH.exec(length) : null;
  // Строгое сравнение длины, которую не сдвинуть (`calc(…)`, `var(…)`), — остаётся диапазоном.
  return !classic || strict && !matchs
    ? '(' + side + ' ' + operator + ' ' + length + ')'
    : '(' + (operator[0] === '>' ? 'min-' : 'max-') + side + ': ' + (matchs
      ? round(parseFloat(matchs[1]) + (greater ? 1 : -1) * STRICT_SHIFT[matchs[2]]) + matchs[2]
      : length) + ')';
}

/** Без хвоста плавающей точки: `479.97999999` → `479.98`. */
function round(value: number): number {
  return Math.round(value * 100000) / 100000;
}
