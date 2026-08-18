/**
 * Извлечение MN-токенов из значений заданного HTML/JSX-атрибута в тексте файла.
 *
 * Используется build-плагинами (`minotation-vite`, `minotation-webpack`) для сбора
 * токенов из исходников без полноценного парсинга AST — под капотом просто ищет
 * значение атрибута в одной из распространённых форм и разбивает его по пробелам.
 *
 * ## Поддерживаемые формы значения
 *
 * 1. **Литеральная строка** (HTML/JSX): `attr="p10 w50"`, `attr='p10 w50'`.
 * 2. **JSX-выражение со строкой**: `attr={'p10 w50'}`, `attr={"p10 w50"}`.
 * 3. **Template literal**: `` attr={`p10 ${cond} w50`} `` — берутся только литеральные
 *    сегменты (между `` ` `` и `${`, между `}` и следующим `${`/`` ` ``);
 *    `${...}`-интерполяции целиком отбрасываются — динамические токены заведомо
 *    непредсказуемы на этапе сборки, не пытаемся их разрешить.
 * 4. **Свойство объектного литерала** (напр. MUI `slotProps`):
 *    `{ className: 'p10 w50' }`, `{ className: "p10 w50" }` — в т.ч. вложенное,
 *    `slotProps={{ paper: { className: 'p10 w50' } }}`. Различие с формой 1 — `:`
 *    вместо `=` перед значением, оба варианта разбираются одним regexp'ом
 *    (`[:=]`). Вложенность объекта не важна — regexp ищет `attrName` где угодно
 *    в тексте, не разбирает структуру объекта.
 *
 * Динамические значения свойства (`{ className: cond ? 'a' : 'b' }`, вычисляемые
 * выражения) — не поддерживаются, как и раньше: извлекается только буквальный текст.
 *
 * @module extractTokens
 */

/** `${...}` — интерполяция внутри template literal, вырезается перед разбиением на токены. */
const REGEXP_INTERPOLATION = /\$\{[^}]*\}/g;

/** Пробельные разделители токенов внутри значения атрибута. */
const REGEXP_SPACE = /\s+/;

/**
 * Символы, требующие экранирования при подстановке произвольного `attrName` в regexp
 * (защита от инъекции спецсимволов, если имя атрибута когда-нибудь станет пользовательским).
 */
const REGEXP_ESCAPE = /[.*+?^${}()|[\]\\]/g;

function buildAttrRegexp(attrName: string): RegExp {
  const name = attrName.replace(REGEXP_ESCAPE, '\\$&');
  // `[:=]` — принимает как JSX-атрибут (`attr=`), так и свойство объектного
  // литерала (`attr:`, включая вложенное — напр. MUI `slotProps={{ paper: { className: ... } }}`).
  return new RegExp(name + '\\s*[:=]\\s*(?:"([^"]*)"'
      + '|\'([^\']*)\''
      + '|\\{\\s*\'([^\']*)\'\\s*\\}'
      + '|\\{\\s*"([^"]*)"\\s*\\}'
      + '|\\{\\s*`([^`]*)`\\s*\\})',
  'g');
}

/**
 * @param source — полный текст файла
 * @param attrName — имя атрибута (`'class'`, `'className'`, ...)
 * @returns массив токенов (может содержать дубликаты — вызывающая сторона обычно
 *   складывает результат в `Set` для дедупликации)
 *
 * @example
 * extractTokens('<div class="p10 w50">', 'class')                  // → ['p10', 'w50']
 * extractTokens('<div className={"m5"}>', 'className')             // → ['m5']
 * extractTokens('<div className={`fx1 ${x} h100`}>', 'className')  // → ['fx1', 'h100']
 * extractTokens('slotProps={{ paper: { className: \'w320 dF\' } }}', 'className')  // → ['w320', 'dF']
 */
export function extractTokens(source: string, attrName: string): string[] {
  const regexp = buildAttrRegexp(attrName);
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  let raw: string;
  let literal: string;
  let parts: string[];
  let i: number;

  while ((match = regexp.exec(source))) {
    raw = match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? '';
    literal = raw.replace(REGEXP_INTERPOLATION, ' ');
    parts = literal.split(REGEXP_SPACE);
    for (i = 0; i < parts.length; i++) {
      parts[i] && tokens.push(parts[i]);
    }
  }

  return tokens;
}
