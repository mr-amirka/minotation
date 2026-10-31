/**
 * Сообщения о токенах, которые перебивают стили весом, тянутся к дальним предкам или
 * стилизуют дочерние элементы (D-039, D-041): что замечено, к чему это может
 * указывать, как скрыть и как запретить. Тон нейтральный — запись может быть
 * осознанным решением, поэтому сообщение не указывает, что делать вместо
 * (замечание владельца 2026-10-09). `strict` — режим `'strict'`: токен не даёт CSS.
 */

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

/** `>` — дочерний селектор; `mark` — дочерняя часть токена (`>1`, `>.child`). */
export function childSelectorMessage(mark: string, strict: boolean): string {
  return strict
    ? 'Styles for child elements ("' + mark + '") are forbidden (childSelectorMode: \'strict\'),'
      + ' the token gives no CSS. To allow them: childSelectorMode: \'warn\'.'
    : 'Styles are applied to child elements ("' + mark + '") — this may indicate that the design'
      + ' architecture could be improved. To hide this warning: childSelectorMode: \'silent\';'
      + ' to forbid such tokens: childSelectorMode: \'strict\'.';
}
