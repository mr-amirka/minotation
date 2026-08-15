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
//
// ВАЖНО: `export { default as X } from '...'` компилируется (esModuleInterop)
// в геттер `get() { return __importDefault(mod).default; }` — эту форму
// не распознаёт cjs-module-lexer (статический анализ именованных экспортов
// CJS-модуля для Node ESM/CJS-интеропа): `import { presetStandard } from
// 'minotation'` из чужого ESM-кода (например minotation-vite) падал с
// "does not provide an export named 'presetStandard'", хотя `require()`
// видел его нормально. Явный default-импорт + `export const` компилируется
// в простое `exports.presetStandard = ...` — лексер такое находит.
import presetStandardDefault from './presets/standard';
import presetSynonymsDefault from './presets/synonyms';
import presetMediasDefault from './presets/medias';
import presetNormalizeDefault from './presets/normalize';
import presetMainDefault from './presets/main';

export const presetStandard = presetStandardDefault;
export const presetSynonyms = presetSynonymsDefault;
export const presetMedias = presetMediasDefault;
export const presetNormalize = presetNormalizeDefault;
export const presetMain = presetMainDefault;
