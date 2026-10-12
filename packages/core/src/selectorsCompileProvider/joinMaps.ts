/**
 * Соединение карт альтернативных селекторов (AltMap) в MN-компиляторе.
 *
 * AltMap = `Record<string, [number, string][]>` — карта селектор → массив пар
 * `[приоритет медиа, имя медиа]`.
 *
 * @module joinMaps
 */

import {
  pushArray,
  slice,
} from 'fundamentool';
import type {
  AltEntry,
  AltMap,
} from './types';

/**
 * Декартово произведение двух AltMap.
 *
 * Для каждой пары (prefix, suffix) создаёт ключ `prefix + separator + suffix + end`,
 * подставляя `pv[0]` (медиа-приоритет) в первый элемент результата.
 *
 * @param prefixes — карта префиксных селекторов
 * @param suffixes — карта суффиксных селекторов
 * @param separator — разделитель между префиксом и суффиксом (обычно комбинатор)
 * @param end — суффикс после склейки
 * @returns объединённая AltMap
 *
 * @example
 * // prefixes: { '.a': [[0, 'mobile']] }
 * // suffixes: { '.b': [[0, 'desktop']] }
 * joinMapsWithFirstValue(prefixes, suffixes, ' ', '')
 * // → { '.a.b': [[0, 'mobile'], [0, 'desktop']] }
 */
export function joinMapsWithFirstValue(
  prefixes: AltMap,
  suffixes: AltMap,
  separator?: string,
  end?: string,
): AltMap {
  const sep = separator || '';
  const e = end || '';
  const output: AltMap = {};
  let prefix: string;
  let suffix: string;
  let pv: AltEntry[];
  let p: string;
  let tmp: AltEntry[];
  for (prefix in prefixes) {
    pv = prefixes[prefix];
    p = prefix + sep;
    for (suffix in suffixes) {
      tmp = output[p + suffix + e] = slice(suffixes[suffix]);
      tmp[0] = pv[0] || tmp[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pushArray(tmp as any, slice(pv, 1));
    }
  }
  return output;
}

/**
 * Соединяет префикс с AltMap суффиксов.
 *
 * В отличие от joinMapsWithFirstValue, префикс — одиночная строка, а не карта.
 *
 * @param prefix — префиксная строка (например `'.w50'`)
 * @param suffixes — карта суффиксов
 * @param pv — на практике всегда строка (имя медиа с текущего уровня) или `undefined`;
 *   если задана — ЗАМЕНЯЕТ собой весь первый элемент `tmp[0]` (не кортеж `AltEntry`,
 *   а голая строка) — типовая неточность `AltMap`/`AltEntry`, унаследованная из v1
 * ; если `pv`
 *   не задан — первый элемент остаётся как в исходном `suffixes`
 * @returns AltMap с ключами `prefix + suffix`
 *
 * @example
 * // suffixes: { '.b': [[0, 'desktop']] }
 * joinPrefixWithFirstValue('.a', suffixes, 'mobile')
 * // → { '.a.b': ['mobile', 'desktop'] } — tmp[0] заменён строкой, не кортежем
 */
export function joinPrefixWithFirstValue(
  prefix: string,
  suffixes: AltMap,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pv: any,
): AltMap {
  const output: AltMap = {};
  let suffix: string;
  let tmp: AltEntry[];
  for (suffix in suffixes) {
    tmp = output[prefix + suffix] = slice(suffixes[suffix]);
    tmp[0] = pv || tmp[0];
  }
  return output;
}

/**
 * Склейка «предок + элемент» с контекстом в `:where()` (`contextWhere`, D-049): специфичность
 * остаётся только у элемента. `.card:hover` + ` ` + `.x` → `.x:is(:where(.card:hover) *)`;
 * висячий комбинатор соседа уходит из скобок: `.peer:focus~` → `.x:is(:where(.peer:focus)~*)`.
 * Медиа — как у {@link joinMapsWithFirstValue} (префикс — предок).
 *
 * @param parents — селекторы предка (префиксы)
 * @param subjects — селекторы элемента
 * @param combinator — комбинатор между ними (` `, `>`, `>*>`)
 */
export function joinWhere(
  parents: AltMap,
  subjects: AltMap,
  combinator: string,
): AltMap {
  const output: AltMap = {};
  let parent: string;
  let subject: string;
  let pv: AltEntry[];
  let inner: string;
  let tail: string;
  let tmp: AltEntry[];
  let last: string;
  for (parent in parents) {
    pv = parents[parent];
    last = parent[parent.length - 1];
    if ((last === '~' || last === '+') && parent[parent.length - 2] !== '\\') {
      inner = parent.slice(0, -1);
      tail = ')' + last + '*)';
    } else {
      inner = parent;
      tail = ')' + (combinator === ' ' ? ' ' : combinator) + '*)';
    }
    for (subject in subjects) {
      tmp = output[subject + ':is(:where(' + inner + tail] = slice(subjects[subject]);
      tmp[0] = pv[0] || tmp[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pushArray(tmp as any, slice(pv, 1));
    }
  }
  return output;
}

/** Ключи карты в `:where(…)`: контекст перед ребёнком `>` (`contextWhere`, D-049). */
export function wrapWhere(alts: AltMap): AltMap {
  const output: AltMap = {};
  let key: string;
  for (key in alts) {
    output[':where(' + key + ')'] = alts[key];
  }
  return output;
}

