/**
 * @overview Minotation preset "prefixes"
 * @author Amir Absaliamov <amir.absolutely@gmail.com>
 */

import {
  MnInstance,
} from '../types';

const WEBKIT = '-webkit-',
  MOZ = '-moz-';

export default (mn: MnInstance) => {
  const {
    utils,
    propertiesStringify,
  } = mn;
  const {
    flags,
    extend,
  } = utils;
  const {
    prefixedAttrs,
  } = propertiesStringify;
  flags([WEBKIT, MOZ], propertiesStringify.prefixes);

  extend(prefixedAttrs, {
    appearance: flags([WEBKIT]),
    overflowScrolling: flags([WEBKIT]),
  });

  flags([
    'backdropFilter',
    'backgroundClip',
    'transform',
    'transformStyle',
    'transitionDuration',
    'pointerEvents',
    'userSelect',
    'filter',
    'flex',
    'flexDirection',
    'flexBasis',
    'flexWrap',
    'flexFlow',
    'flexGrow',
    'flexShrink',
    'justifyContent',
    'alignItems',
    'alignContent',
    'alignSelf',
    'boxPack',
    'boxDirection',
    'boxOrient',
    'order',
    // 'opacity',
    'boxSizing',
    'textSizeAdjust',
  ], prefixedAttrs);
};
