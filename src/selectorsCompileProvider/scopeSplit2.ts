/**
 * Разбор вложенных скобочных scope-выражений в дерево пар `[текст, дети?]`.
 *
 * Порт `mn-utils/scopeSplit2` (v1) — восстановлен как отдельная функция, потому что
 * `fundamentool.scopeSplit` (на которую заменили `scopeSplit2` при миграции импортов
 * v1→TS) возвращает **другую** форму: плоский массив, где элемент — либо строка-текст,
 * либо вложенный массив-скобка, БЕЗ привязки текста к своей скобке парой. `getSynonyms`
 * в `selectorsCompileProvider.ts` написан под форму `scopeSplit2` (каждый узел — пара
 * `[текст, дети]`) и с `fundamentool.scopeSplit` работал неверно (баг найден и
 * зафиксирован 2026-08-10 — `:hover` компилировался в `:(h)`).
 *
 * @module scopeSplit2
 */
import {
  push,
  startsWith,
} from 'fundamentool';

/** Один узел дерева: `[текст-до-скобки, дети]` — `дети` есть только если сразу после текста открылась скобка. */
export type ScopeNode = [string, ScopeNode[]?];

/**
 * @param input — строка со скобками (например `'not(.disabled(.as).lak).checked'`)
 * @param startKey — открывающая последовательность (default `'('`)
 * @param endKey — закрывающая последовательность (default `')'`)
 * @param escapeExp — экранирующая последовательность, следующий за ней символ пропускается как обычный текст
 * @returns дерево `ScopeNode[]` верхнего уровня
 *
 * @example
 * scopeSplit2('not(.disabled(.as).lak).checked', '(', ')')
 * // → [['not', [['.disabled', [['.as']]], ['.lak']]], ['.checked']]
 */
export function scopeSplit2(
  input: string, startKey?: string, endKey?: string, escapeExp?: string,
): ScopeNode[] {
  const esc = escapeExp || '';
  const start_ = startKey || '(';
  const end_ = endKey || ')';
  const startL = start_.length;
  const endL = end_.length;
  const escapeL = esc.length;
  const length = input.length;
  let level: ScopeNode[] = [];
  const levels: ScopeNode[][] = [level];
  let prevLevel: ScopeNode[];
  let start: boolean;
  let depth = 0;
  let offset = 0;
  let lastOffset = 0;

  function pushFragment(toOffset: number): void {
    push(level, [input.substr(lastOffset, toOffset - lastOffset)] as ScopeNode);
  }
  function scopeClose(): void {
    --depth;
    if (depth < 0) {
      throw new Error('Scope syntax error: "' + input + '"');
    }
    prevLevel = levels[depth];
    prevLevel[prevLevel.length - 1][1] = level;
    level = prevLevel;
  }

  while (offset < length) {
    if (esc && startsWith(
      input, esc, offset,
    )) {
      offset += escapeL + 1;
      continue;
    }
    start = startsWith(
      input, start_, offset,
    );
    if (start || startsWith(
      input, end_, offset,
    )) {
      pushFragment(offset);
      if (start) {
        depth++;
        level = levels[depth] = [];
        offset += startL;
      } else {
        scopeClose();
        offset += endL;
      }
      lastOffset = offset;
      continue;
    }
    offset++;
  }

  lastOffset < length && pushFragment(length);
  while (depth > 0) {
    scopeClose();
  }

  return levels[0];
}
