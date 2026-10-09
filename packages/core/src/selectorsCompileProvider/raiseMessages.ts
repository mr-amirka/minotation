/**
 * Сообщения о токенах, которые перебивают стили весом или тянутся к дальним предкам
 * (D-039): что не так, что делать вместо, как скрыть и как запретить — пользователь
 * не должен искать это в документации. `strict` — режим `'strict'`: токен не даёт CSS.
 */

/** `*N` — накрутка специфичности; `mark` — как записано в токене (`*2`). */
export function specificityMessage(mark: string, strict: boolean): string {
  return strict
    ? 'Raising specificity ("' + mark + '") is forbidden (specificityMode: \'strict\'), the token'
      + ' gives no CSS — remove "' + mark + '" and override the component\'s tokens with mne()/mnClass(),'
      + ' or allow it: specificityMode: \'warn\'.'
    : 'Raising specificity ("' + mark + '") usually means components fight over the same'
      + ' styles — override a component\'s tokens with mne()/mnClass() instead of outweighing them.'
      + ' To hide this warning: specificityMode: \'silent\'; to forbid such tokens: specificityMode: \'strict\'.';
}

/** `-i` — `!important`. */
export function importantMessage(strict: boolean): string {
  return strict
    ? '"!important" ("-i") is forbidden (importantMode: \'strict\'), the token gives no CSS'
      + ' — remove "-i" and override the component\'s tokens with mne()/mnClass(),'
      + ' or allow it: importantMode: \'warn\'.'
    : '"!important" ("-i") overrides everything, including what the component itself controls'
      + ' — override a component\'s tokens with mne()/mnClass() instead.'
      + ' To hide this warning: importantMode: \'silent\'; to forbid such tokens: importantMode: \'strict\'.';
}

/** Глубина контекста больше `maxDepth`. */
export function maxDepthMessage(
  depth: number, maxDepth: number, strict: boolean,
): string {
  return 'Context selector depth ' + depth + ' exceeds maxDepth ' + maxDepth
    + (strict ? ' (maxDepthMode: \'strict\'), the token gives no CSS' : '')
    + ': a long ancestor chain breaks as soon as the markup in between changes'
    + ' — put a class on a closer ancestor instead.'
    + (strict
      ? ' To allow such tokens: raise maxDepth or set maxDepthMode: \'warn\'.'
      : ' To allow such depth: raise maxDepth; to hide this warning: maxDepthMode: \'silent\';'
        + ' to forbid such tokens: maxDepthMode: \'strict\'.');
}

/** `>` — дочерний селектор; `mark` — дочерняя часть токена (`>1`, `>.child`). */
export function childSelectorMessage(mark: string, strict: boolean): string {
  return strict
    ? 'Child selector ("' + mark + '") is forbidden (childSelectorMode: \'strict\'), the token gives no CSS'
      + ' — put the class on the child itself, or allow it: childSelectorMode: \'warn\'.'
    : 'Child selector ("' + mark + '") styles elements the component does not own'
      + ' — put the class on the child itself instead.'
      + ' To hide this warning: childSelectorMode: \'silent\'; to forbid such tokens: childSelectorMode: \'strict\'.';
}
