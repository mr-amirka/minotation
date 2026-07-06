// @ts-nocheck
/* eslint-disable */
import { forEach, flags, keys, mapEach, push, pushArray, splitProvider, trim, variants } from 'fundamentool';
import { escapedSplitProvider } from 'fundamentool';
const splitReverse = require('./mn-utils-shim/escapedSplitProvider')('!').base;
const regexpClassSubstr = /\.\*([A-Za-z0-9-_$]+)/g;
const regexpIdSubstr = /\#\*([A-Za-z0-9-_$]+)/g;


function selectorNormalize(minimalistNotationSelector) {
  return splitReverse(minimalistNotationSelector)
    .reverse()
    .join('')
    .replace(regexpClassSubstr, '[class*=$1]')
    .replace(regexpIdSubstr, '[id*=$1]');
}

export {
  selectorNormalize,
};
