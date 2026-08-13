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
 *
 * Объектные литералы (`slotProps={{ root: { className: '...' } }}`) — **не
 * поддерживаются** (см. `PLAN.md` minotation, открытый пункт).
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
  return new RegExp(name + '\\s*=\\s*(?:"([^"]*)"'
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
