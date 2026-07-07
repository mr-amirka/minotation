/**
 * Проверка валидности CSS-селектора класса.
 *
 * Удаляет закавыченные строки и CSS-экранирования (`\` + символ),
 * затем проверяет, что после ведущей `.` нет недопустимых символов.
 *
 * Проверяются символы **сразу после точки** (`.X`):
 * `[` `]` `#` `.` `*` `^` `$` `(` `)` `>` `<` `+` `~` `=` `|` `:` `,`
 * `"` `'` `` ` `` пробельные `@` `%` `!` `/` `0-9`
 *
 * Используется в `core.ts` для валидации селекторов перед добавлением в карту.
 *
 * @param selector — CSS-селектор класса (начинается с `.`)
 * @returns `true` если селектор содержит недопустимые символы сразу после `.`
 *
 * @example
 * isInvalidSelector('.myClass')   // → false
 * isInvalidSelector('.[myClass]') // → true (скобка сразу после точки)
 * isInvalidSelector('.#myId')     // → true (хэш сразу после точки)
 * isInvalidSelector('.0leading')  // → true (цифра сразу после точки)
 */
// eslint-disable-next-line no-useless-escape
const REGEXP_INVALID = /\.[[\]#.*^$()><+~=|:,"'`\s@%!\/0-9]/g;

/** Закавыченные строки и CSS-escape последовательности (удаляются перед проверкой). */
const REGEXP_IN_QUOTES_AND_ESCAPED = /("[^"]*"|'[^']*'|\\.)/g;

export function isInvalidSelector(selector: string): boolean {
  return REGEXP_INVALID.test(selector.replace(REGEXP_IN_QUOTES_AND_ESCAPED, ''));
}
