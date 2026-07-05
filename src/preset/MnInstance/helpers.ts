/**
 * Внутренние хелперы компиляции MnInstance.
 * Не реэкспортируются из index.ts — детали реализации движка.
 */

import {
  variants, 
} from 'fundamentool';

// §14: .*WORD → [class*=WORD], #*WORD → [id*=WORD]
const classSubstrRe = /\.\*([-A-Za-z0-9_$]+)/g;
const idSubstrRe    = /#\*([-A-Za-z0-9_$]+)/g;

/**
 * Нормализует wildcard-селекторы в CSS-форму.
 *
 * `.*WORD` → `[class*=WORD]` — элемент, у которого в class содержится WORD.
 * `#*WORD` → `[id*=WORD]`   — элемент, у которого в id содержится WORD.
 *
 * Применяется к parent/child сегментам (в parseLexeme) и self-class суффиксам (в MnInstance).
 * Соответствует поведению v1 `selectorNormalize.js`.
 */
export function normalizeSelectorStr(sel: string): string {
  if (sel.indexOf('.*') < 0 && sel.indexOf('#*') < 0) {
    return sel;
  }
  return sel
    .replace(classSubstrRe, '[class*=$1]')
    .replace(idSubstrRe,    '[id*=$1]');
}

// Regex для нормализации псевдоклассов без префикса
const stateNormRe = /^[.:[]/;

/**
 * Разбирает значение синонима в массив пар [stateStr, mediaName|null].
 *
 * Обрабатывает:
 * - Запятые: несколько альтернативных селекторов (`'.m@sm, .l'` → 2 пары)
 * - Вариантные группы: `'.(mmm|hm)@mouse&m'` → `[['.mmm', 'mouse&m'], ['.hm', 'mouse&m']]`
 * - Медиа-суффикс `@name`: стрипается из строки состояния
 * - Нормализация: если stateStr не начинается с `.`, `:`, `[` → добавляется `:`
 *
 * Используется в `setSynonyms`. Разделяемая утилита — не дублировать логику.
 */
export function parseSynonymValue(value: string): Array<[string, string | null]> {
  const result: Array<[string, string | null]> = [];
  const commaParts = value.split(',');
  let ci = 0;
  const cl = commaParts.length;
  while (ci < cl) {
    const part = commaParts[ci++].trim();
    if (!part) {
      continue;
    }
    const expanded = variants(part)[0];
    let ei = 0;
    const el = expanded.length;
    while (ei < el) {
      const exp = expanded[ei++];
      const atIdx = exp.lastIndexOf('@');
      let stateStr: string;
      let mediaName: string | null;
      if (atIdx >= 0) {
        stateStr  = exp.slice(0, atIdx);
        mediaName = exp.slice(atIdx + 1) || null;
      } else {
        stateStr  = exp;
        mediaName = null;
      }
      if (stateStr && !stateNormRe.test(stateStr)) {
        stateStr = ':' + stateStr;
      }
      if (stateStr || mediaName) {
        result.push([stateStr, mediaName]);
      }
    }
  }
  return result;
}

/**
 * Конвертирует camelCase CSS-свойство в kebab-case.
 *
 * @example
 * camelToKebab('backgroundColor') // 'background-color'
 * camelToKebab('zIndex')          // 'z-index'
 */
export function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

/**
 * Генерирует атрибутный CSS-селектор для не-class атрибутов.
 *
 * @example
 * compileAttrSelector({ raw: 'p10' }, 'm') // '[m~="p10"]'
 */
export function compileAttrSelector(lexeme: { raw: string }, attrName: string): string {
  const escaped = lexeme.raw.replace(/"/g, '\\"');
  return `[${attrName}~="${escaped}"]`;
}

/**
 * Парсит короткий формат медиа-значения в CSS media query или `null`.
 *
 * Форматы:
 * - `'768'` → `'(max-width: 768px)'`
 * - `'992-'` → `'(min-width: 992px)'`
 * - `'768-992'` → `'(min-width: 768px) and (max-width: 992px)'`
 * - `'768-992x300-600'` → с height-запросом через `x`
 *
 * @returns CSS media query или `null` если формат не распознан
 */
export function parseMediaTemplate(raw: string): string | null {
  // Одиночное число: 768 → (max-width: 768px)
  if (/^\d+$/.test(raw)) {
    return `(max-width: ${raw}px)`;
  }
  // N- → (min-width: Npx)
  if (/^\d+-$/.test(raw)) {
    return `(min-width: ${raw.slice(0, -1)}px)`;
  }

  const hasX = raw.includes('x');
  const hasDash = raw.includes('-');

  // x100 → (max-height: 100px)  |  x200- → (min-height: 200px)
  if (hasX && !hasDash) {
    const hPart = raw.slice(raw.indexOf('x') + 1);
    if (/^\d+$/.test(hPart))  {
      return `(max-height: ${hPart}px)`;
    }
    if (/^\d+-$/.test(hPart)) {
      return `(min-height: ${hPart.slice(0, -1)}px)`;
    }
  }

  if (!hasDash && !hasX) {
    return null;
  }

  const xIdx   = raw.indexOf('x');
  const wPart  = xIdx >= 0 ? raw.slice(0, xIdx)      : raw;
  const hPart2 = xIdx >= 0 ? raw.slice(xIdx + 1)     : '';
  const queries: string[] = [];

  function parsePart(input: string, dim: 'width' | 'height') {
    if (!input) {
      return;
    }
    const min = `min-${dim}`;
    const max = `max-${dim}`;
    const segs  = input.split('-');
    const first = parseInt(segs[0], 10);
    if (segs.length > 1) {
      const second = parseInt(segs[1], 10);
      if (!isNaN(first)  && first  > 0) {
        queries.push(`(${min}: ${first}px)`);
      }
      if (!isNaN(second) && second > 0) {
        queries.push(`(${max}: ${second}px)`);
      }
    } else if (!isNaN(first) && first > 0) {
      // Одиночное значение без '-': max по умолчанию
      queries.push(`(${max}: ${first}px)`);
    }
  }

  parsePart(wPart,  'width');
  parsePart(hPart2, 'height');

  return queries.length > 0 ? queries.join(' and ') : null;
}
