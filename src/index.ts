/**
 * Minotation — точка входа.
 * Реэкспортирует все публичные модули.
 */

export {
  minotationProvider,
} from './core/index';
export {
  default,
} from './core/index';
export {
  selectorsCompileProvider,
  extractMedia,
  getCombinatorByDepth,
  getCombinator,
} from './selectorsCompileProvider';
export {
  selectorNormalize,
} from './selectorNormalize';
export {
  isInvalidSelector,
} from './isInvalidSelector';
