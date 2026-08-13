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
export {
  extractTokens,
} from './extractTokens';
export type {
  MnInstance,
} from './types';

// Пресеты — именованные реэкспорты для внешних потребителей (build-плагины,
// см. minotation-vite/minotation-webpack). package.json's "exports" объявляет
// только корневой "." subpath, поэтому import presetStandard from 'minotation/presets/standard'
// у реального потребителя не резолвится — единственный рабочий путь отсюда.
export {
  default as presetStandard,
} from './presets/standard';
export {
  default as presetSynonyms,
} from './presets/synonyms';
export {
  default as presetMedias,
} from './presets/medias';
export {
  default as presetNormalize,
} from './presets/normalize';
export {
  default as presetMain,
} from './presets/main';
