import {
  MnInstance,
} from '../types';

/**
 * @overview Minotation preset "runtime prefixes"
 * @author Amir Absaliamov <amir.absolutely@gmail.com>
 */

export default (mn: MnInstance) => {
  const {
    utils, propertiesStringify,
  } = mn;
  const {
    flags, forEach,
  } = utils;
  const style = document.createElement('div').style;
  const prefixes = propertiesStringify.prefixes;
  forEach([
    'webkit',
    'moz',
    'o',
    'ms',
    'khtml',
  ], (prefix) => {
    style[prefix + 'Transform'] && (prefixes['-' + prefix + '-'] = 1);
  });
  flags([
    'appearance',
    'overflowScrolling',
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
    'opacity',
    'boxSizing',
    'textSizeAdjust',
  ], propertiesStringify.prefixedAttrs);
};
