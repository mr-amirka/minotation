/**
 * Сообщения о токенах, которые перебивают стили весом, тянутся к дальним предкам или
 * стилизуют дочерние элементы (D-039, D-041): что замечено, к чему это может
 * указывать, как скрыть и как запретить. Тон нейтральный — запись может быть
 * осознанным решением, поэтому сообщение не указывает, что делать вместо
 * (замечание владельца 2026-10-09). `strict` — режим `'strict'`: токен не даёт CSS.
 */

const OPEN_BRACE = '{';
const CLOSE_BRACE = '}';
const SEMICOLON = ';';
const DOLLAR = '$';

/** `*N` — накрутка специфичности; `mark` — как записано в токене (`*2`). */
export function specificityMessage(mark: string, strict: boolean): string {
  return strict
    ? 'Raising specificity ("' + mark + '") is forbidden (specificityMode: \'strict\'), the token'
      + ' gives no CSS. To allow it: specificityMode: \'warn\'.'
    : 'Specificity is raised ("' + mark + '") — this may mean that component styles override'
      + ' each other. To hide this warning: specificityMode: \'silent\';'
      + ' to forbid such tokens: specificityMode: \'strict\'.';
}

/**
 * `**N` больше `maxSpecificity` (D-089). `ceiling` — системный потолок 16: выше него CSS нет и в `'warn'`.
 */
export function maxSpecificityMessage(
  multiplier: number, limit: number, ceiling: number, strict: boolean,
): string {
  return strict
    ? 'Specificity multiplier **' + multiplier + ' exceeds maxSpecificity ' + limit
      + ' (maxSpecificityMode: \'strict\'), the token gives no CSS. To allow it: raise maxSpecificity (up to '
      + ceiling + ') or set maxSpecificityMode: \'warn\'.'
    : 'Specificity multiplier **' + multiplier + ' exceeds maxSpecificity ' + limit
      + (multiplier > ceiling ? ' and the ceiling ' + ceiling + ', the token gives no CSS.'
        : ', the CSS is still output (the ceiling is ' + ceiling + ').')
      + ' To forbid such tokens: maxSpecificityMode: \'strict\'.';
}

/** `-i` — `!important`. */
/**
 * Отчёт `suspect-class` (D-065, D-066): хендлер распознал в значении класс другой системы
 * (`fw-bold`). `reason` — что сказал сам хендлер.
 */
export function suspectClassMessage(reason: string, strict: boolean): string {
  return strict
    ? reason + ' (suspectClassMode: \'strict\'). To allow such classes: suspectClassMode: \'warn\'.'
    : reason + '. To hide this warning: suspectClassMode: \'silent\'; to forbid such classes:'
      + ' suspectClassMode: \'strict\'.';
}

export function importantMessage(strict: boolean): string {
  return strict
    ? '"!important" ("-i") is forbidden (importantMode: \'strict\'), the token gives no CSS.'
      + ' To allow it: importantMode: \'warn\'.'
    : '"!important" is used ("-i") — this may mean that component styles override each other.'
      + ' To hide this warning: importantMode: \'silent\'; to forbid such tokens: importantMode: \'strict\'.';
}

/** Глубина контекста больше `maxDepth`. */
export function maxDepthMessage(
  depth: number, maxDepth: number, strict: boolean,
): string {
  return strict
    ? 'Context selector depth ' + depth + ' exceeds maxDepth ' + maxDepth
      + ' (maxDepthMode: \'strict\'), the token gives no CSS.'
      + ' To allow such tokens: raise maxDepth or set maxDepthMode: \'warn\'.'
    : 'Context selector depth ' + depth + ' exceeds maxDepth ' + maxDepth
      + ' — styles depend on a long chain of ancestors, which may make the markup harder to change.'
      + ' To allow such depth: raise maxDepth; to hide this warning: maxDepthMode: \'silent\';'
      + ' to forbid such tokens: maxDepthMode: \'strict\'.';
}

/**
 * Математика без скобок (D-139): токен и он же со скобками — его можно скопировать.
 * @param token — токен
 * @param found — пары «как часть написана в токене», «выражение» от читателя математики
 * @param strict — режим `'strict'`
 * @returns сообщение
 * @example bareMathMessage('w1/2+32', ['1/2+32', '1/2+32'], false) // '"w1/2+32" writes math without braces: …'
 */
export function bareMathMessage(
  token: string, found: string[], strict: boolean,
): string {
  const head = '"' + token + '" writes math without braces: write "' + bracedToken(token, found) + '"';
  return strict
    ? head + ' (bareMathMode: \'strict\'), the token gives no CSS. To allow it: bareMathMode: \'silent\'.'
    : head + '. To hide this warning: bareMathMode: \'silent\'; to forbid such tokens: bareMathMode: \'strict\'.';
}

/**
 * Токен со скобками вокруг каждой части с математикой, слева направо. `;`, закрывавший переменную перед буквой
 * следующего слота, в скобках не нужен: `x$a*2;y3` → `x{$a*2}y3`; перед следующей переменной он остаётся
 * разделителем. Часть, прочитанная дважды, ставит скобки один раз. Выражение с группы в начале — как написано:
 * `w{1+2}*3` → `w{{1+2}*3}`; `{{` в шаблоне с интерполяцией автор разделяет термом сам — `w{1*{1+2}*3}`.
 * @param token — токен
 * @param found — пары «как написано», «выражение»
 * @returns токен со скобками
 * @example bracedToken('bxshB$a*2;x2', ['B$a*2', '$a*2']) // 'bxsh{$a*2}x2'
 */
function bracedToken(token: string, found: string[]): string {
  const l = found.length;
  let out = token;
  let at = 0;
  let i = 0;
  let k: number;
  let tail: number;
  let braced: string;
  for (; i < l; i += 2) {
    k = out.indexOf(found[i], at);
    if (k > -1) {
      tail = k + found[i].length;
      out[tail] === SEMICOLON && out[tail + 1] !== DOLLAR && tail++;
      braced = OPEN_BRACE + found[i + 1] + CLOSE_BRACE;
      out = out.slice(0, k) + braced + out.slice(tail);
      at = k + braced.length;
    }
  }
  return out;
}

/** `>` — дочерний селектор; `mark` — дочерняя часть токена (`>1`, `>.child`). */
export function childSelectorMessage(mark: string, strict: boolean): string {
  return strict
    ? 'Styles for child elements ("' + mark + '") are forbidden (childSelectorMode: \'strict\'),'
      + ' the token gives no CSS. To allow them: childSelectorMode: \'warn\'.'
    : 'Styles are applied to child elements ("' + mark + '") — this may indicate that the design'
      + ' architecture could be improved. To hide this warning: childSelectorMode: \'silent\';'
      + ' to forbid such tokens: childSelectorMode: \'strict\'.';
}
