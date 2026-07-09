/**
 * Нормализация селектора Minotation → CSS-селектор.
 *
 * ## Обработка
 *
 * 1. **Разворот через `!`** — сплит по `!` с учётом экранирования,
 *    разворот массива, склейка. Позволяет писать селекторы в обратном порядке:
 *    `Parent!Child` → `ChildParent`.
 *
 * 2. **Wildcard-класс (`.*`)** — `.*className` → `[class*=className]`.
 *    В MN звёздочка означает «содержит подстроку».
 *
 * 3. **Wildcard-id (`#*`)** — `#*idName` → `[id*=idName]`.
 *
 * @param minotationSelector — селектор в синтаксисе MN
 * @returns нормализованный CSS-совместимый селектор
 *
 * @example
 * // Простой класс
 * selectorNormalize('myClass')        // → 'myClass'
 *
 * @example
 * // Разворот через !
 * selectorNormalize('Parent!Child')   // → 'ChildParent'
 *
 * @example
 * // Wildcard-класс
 * selectorNormalize('.*active')       // → '[class*=active]'
 *
 * @example
 * // Wildcard-id
 * selectorNormalize('#*main')         // → '[id*=main]'
 */
import {
  escapedSplitProvider,
} from 'fundamentool';

/** Сплиттер по `!` с учётом экранирования (base-версия без unslash). */
const splitReverse = escapedSplitProvider('!').base;

/** `.*className` → `[class*=className]` */
const REGEXP_CLASS_SUBSTR = /\.\*([A-Za-z0-9-_$]+)/g;

/** `#*idName` → `[id*=idName]` */
const REGEXP_ID_SUBSTR = /#\*([A-Za-z0-9-_$]+)/g;

export function selectorNormalize(minotationSelector: string): string {
  return splitReverse(minotationSelector)
    .reverse()
    .join('')
    .replace(REGEXP_CLASS_SUBSTR, '[class*=$1]')
    .replace(REGEXP_ID_SUBSTR, '[id*=$1]');
}
