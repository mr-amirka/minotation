/**
 * Утилиты для разбора комбинаторов в MN-селекторах.
 *
 * ## Комбинаторы
 *
 * MN поддерживает числовые префиксы глубины:
 * - `2Parent` → `> *> Parent` (2 уровня вложенности)
 * - `1Child` → `> Child` (прямой потомок)
 * - `Child` → ` Child` (пробел = потомок любой глубины)
 *
 * @module getCombinator
 */

import {
  repeat,
} from 'fundamentool';
import {
  REGEXP_DEPTH,
} from './constants';

/**
 * Генерирует CSS-комбинатор по глубине вложенности.
 *
 * @param depth — глубина (0 = пробел, 1 = `>`, 2+ = `> *> ...`)
 * @returns CSS-комбинаторная строка
 *
 * @example
 * getCombinatorByDepth(0)  // → ''
 * getCombinatorByDepth(1)  // → '>'
 * getCombinatorByDepth(2)  // → '> *>'
 */
export function getCombinatorByDepth(depth: number): string {
  return depth < 1 ? '' : ('>' + repeat('*>', depth - 1));
}

/**
 * Разбирает имя на комбинатор и остаток.
 *
 * Формат: `(\d+)(.*)` — число = глубина, остаток = имя.
 *
 * @param name — имя с опциональным числовым префиксом (например `2Parent`)
 * @returns `[комбинатор, имя]` (например `['> *>', 'Parent']`)
 *
 * @example
 * getCombinator('Parent')    // → [' ', 'Parent']
 * getCombinator('1Child')    // → ['>', 'Child']
 * getCombinator('2Parent')   // → ['> *>', 'Parent']
 */
export function getCombinator(name: string): [string, string] {
  const depthMatchs = REGEXP_DEPTH.exec(name);
  return depthMatchs
    ? [getCombinatorByDepth(parseInt(depthMatchs[1])), depthMatchs[2] || '']
    : [' ', name];
}
