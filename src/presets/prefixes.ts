/* eslint-disable */
// @ts-nocheck
/**
 * @overview Minimalist-Notation preset "prefixes"
 * @author Amir Absaliamov <amir.absolutely@gmail.com>
 */

const // eslint-disable-line
  WEBKIT = '-webkit-',
  MOZ = '-moz-',
  OPERA = '-o-',// eslint-disable-line
  MS = '-ms-'; // eslint-disable-line
  KHTML = '-khtml-'; // eslint-disable-line

export default (mn: any) => {
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
