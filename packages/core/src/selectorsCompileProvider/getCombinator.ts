/**
 * Утилиты для разбора комбинаторов в MN-селекторах.
 *
 * ## Комбинаторы
 *
 * MN поддерживает числовые префиксы глубины:
 * - `2Parent` → `>*>Parent` (2 уровня вложенности)
 * - `1Child` → `>Child` (прямой потомок)
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
import { MnParseError } from '../core/types';

/**
 * Жёсткий потолок глубины контекстного селектора — НЕ настраивается опциями
 * инстанса, применяется всегда и безусловно (см. `AGENT_DRAFT/SPEC/10-error-warnings.md`
 * и решение пользователя 2026-09-03: «лимит всегда может резаться до 30»).
 * Защищает от патологически длинных/дорогих селекторов (`>*>*>...`) независимо
 * от того, настроен ли мягкий {@link MnDepthCheck.maxDepth} вообще.
 */
export const MN_MAX_DEPTH_HARD_LIMIT = 30;

/**
 * Генерирует CSS-комбинатор по глубине вложенности. Глубина всегда клэмпится
 * к {@link MN_MAX_DEPTH_HARD_LIMIT} — безусловно, без исключений.
 *
 * @param depth — глубина (0 = пробел, 1 = `>`, 2+ = `>*>...`)
 * @returns CSS-комбинаторная строка
 *
 * @example
 * getCombinatorByDepth(0)  // → ''
 * getCombinatorByDepth(1)  // → '>'
 * getCombinatorByDepth(2)  // → '>*>'
 */
export function getCombinatorByDepth(depth: number): string {
  const clamped = depth < MN_MAX_DEPTH_HARD_LIMIT ? depth : MN_MAX_DEPTH_HARD_LIMIT;
  return clamped < 1 ? '' : ('>' + repeat('*>', clamped - 1));
}

/** Опциональная проверка мягкого лимита глубины — {@link MnOptions.maxDepth}/`maxDepthMode`. */
export interface MnDepthCheck {
  /** Мягкий лимит; `undefined` — проверка пропускается (действует только жёсткий потолок). */
  maxDepth: number | undefined;
  /** `'block'` — бросает {@link MnParseError} (токен не даёт CSS); иначе — предупреждение, компиляция продолжается. */
  maxDepthMode: 'warn' | 'block' | undefined;
  /** Вызывается при превышении в режиме `'warn'` (в `'block'` вместо этого бросается `MnParseError`). */
  onExceed: (depth: number, maxDepth: number) => void;
  /** Исходный токен — для контекста в {@link MnParseError}/warning. */
  token: string;
}

/**
 * Разбирает имя на комбинатор и остаток.
 *
 * Формат: `(\d+)(.*)` — число = глубина, остаток = имя.
 *
 * @param name — имя с опциональным числовым префиксом (например `2Parent`)
 * @param depthCheck — опциональная проверка мягкого `maxDepth` (жёсткий потолок 30 — всегда, см. {@link getCombinatorByDepth})
 * @returns `[комбинатор, имя]` (например `['> *>', 'Parent']`)
 *
 * @example
 * getCombinator('Parent')    // → [' ', 'Parent']
 * getCombinator('1Child')    // → ['>', 'Child']
 * getCombinator('2Parent')   // → ['>*>', 'Parent']
 */
export function getCombinator(name: string, depthCheck?: MnDepthCheck): [string, string] {
  const depthMatchs = REGEXP_DEPTH.exec(name);
  if (!depthMatchs) {
    return [' ', name];
  }
  const depth = parseInt(depthMatchs[1]);
  if (depthCheck && depthCheck.maxDepth !== undefined && depth > depthCheck.maxDepth) {
    if (depthCheck.maxDepthMode === 'block') {
      throw new MnParseError(
        `Глубина контекстного селектора (${depth}) превышает maxDepth (${depthCheck.maxDepth})`,
        { token: depthCheck.token, handler: '', arg: name, utility: 'getCombinator' },
      );
    }
    depthCheck.onExceed(depth, depthCheck.maxDepth);
  }
  return [getCombinatorByDepth(depth), depthMatchs[2] || ''];
}
