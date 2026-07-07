/**
 * Minimalist Notation — точка входа.
 * Реэкспортирует все публичные модули.
 */

export {
  minimalistNotationProvider,
} from './core';
export {
  default,
} from './core';
export {
  selectorsCompileProvider,
  extractMedia,
} from './selectorsCompileProvider';
export {
  selectorNormalize,
} from './selectorNormalize';
export {
  isInvalidSelector,
} from './isInvalidSelector';
