/* eslint-disable */
import {
  escapedSplitProvider,
} from 'fundamentool';

const splitReverse = escapedSplitProvider('!').base;
const REGEXP_CLASS_SUBSTR = /\.\*([A-Za-z0-9-_$]+)/g;
const REGEXP_ID_SUBSTR = /\#\*([A-Za-z0-9-_$]+)/g;

export function selectorNormalize(minimalistNotationSelector: string): string {
  return splitReverse(minimalistNotationSelector)
    .reverse()
    .join('')
    .replace(REGEXP_CLASS_SUBSTR, '[class*=$1]')
    .replace(REGEXP_ID_SUBSTR, '[id*=$1]');
}
