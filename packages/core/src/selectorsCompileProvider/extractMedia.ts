/**
 * Извлечение медиа-суффиксов и фильтрация медиа-имён в MN-селекторах.
 *
 * ## extractMedia
 *
 * Разделяет часть селектора на основной селектор и медиа-имя.
 * Медиа-часть отделяется символом `@`:
 * - `mySelector@mobile` → селектор `mySelector`, медиа `mobile`
 *
 * ## mediaFilterIteratee
 *
 * Фильтрует дубликаты медиа-имён и объединяет их через `&`.
 *
 * @module extractMedia
 */

import {
  filter,
  indexOf,
  joinOnly,
  map,
  push,
  pushArray,
  reduce,
  unslash,
} from 'fundamentool';
import {
  splitComma,
  splitMedia,
  splitSelector,
} from './constants';

/**
 * Фильтрует массив медиа-имён: убирает дубликаты, разделяет главное медиа.
 *
 * @param mediaNames — массив медиа-имён (изменяется in-place)
 * @returns строка медиа-имён через `&`
 * @example
 * mediaFilterIteratee(['mobile', 'mobile', 'dark']) // → 'mobile&dark'
 * mediaFilterIteratee([])                            // → ''
 */
export function mediaFilterIteratee(mediaNames: string[]): string {
  const excludes: string[] = [];
  const mainMedia = mediaNames.shift() as string;
  mediaNames = filter(mediaNames, (mediaName: string): boolean => {
    return !!(mediaName && indexOf(excludes, mediaName) < 0
      && push(excludes, mediaName));
  });
  return mainMedia
    ? (map(splitComma(mainMedia), (m: string) => {
      return (pushArray([m], mediaNames) as string[]).join('&');
    }) as string[]).join(',')
    : mediaNames.join('&');
}

/**
 * Извлекает медиа-часть из имени селектора.
 *
 * Разделитель `@` отделяет основное имя от медиа-имени.
 * Медиа-имя добавляется в `mediaNames`.
 *
 * @param mediaNames — массив для сбора медиа-имён
 * @param partName — часть селектора (может содержать `@mediaName`)
 * @returns очищенное имя селектора (без медиа-части)
 * @example
 * const names = [];
 * extractMedia(names, 'myClass@mobile')  // → 'myClass', names = ['mobile']
 * extractMedia(names, 'myClass')         // → 'myClass', names = []
 */
export function extractMedia(mediaNames: string[], partName: string): string {
  const separators: string[] = [];
  return partName
    ? joinOnly(reduce(
      splitSelector(partName, separators),
      (
        output: string[], selector: string, index: number,
      ) => {
        const mediaParts = splitMedia(selector);
        push(output, mediaParts[0] + (separators[index] || ''));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mediaParts.length > 1 && push(mediaNames as any, unslash(mediaParts[1]));
        return output;
      },
      [],
    ))
    : '';
}
