/* eslint-disable */
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

function mediaFilterIteratee(mediaNames: string[]): string {
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
        mediaParts.length > 1 && push(mediaNames as any, unslash(mediaParts[1]));
        return output;
      },
      [],
    ))
    : '';
}
