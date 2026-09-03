/**
 * Minotation — точка входа.
 * Реэкспортирует все публичные модули.
 */

// ВАЖНО: `export { X } from '...'` (и `export { default as X } from '...'`)
// компилируется (esModuleInterop) в геттер `get() { return mod.X; }` — эту
// форму не распознаёт cjs-module-lexer (статический анализ именованных
// экспортов CJS-модуля для Node ESM/CJS-интеропа): `import { X } from
// 'minotation'` из чужого ESM-кода (Vite-бандл minotation-docs, см.
// 2026-09-03) падал с "does not provide an export named 'X'", хотя
// `require()` видел его нормально. Тот же баг, что уже чинили для пресетов
// (2026-08-15) — здесь применён ко всем остальным реэкспортам. Явный импорт +
// `export const` компилируется в простое `exports.X = ...` — лексер находит.
import { minotationProvider as minotationProviderImpl } from './core/index';
import coreDefault from './core/index';
import {
  selectorsCompileProvider as selectorsCompileProviderImpl,
  extractMedia as extractMediaImpl,
  getCombinatorByDepth as getCombinatorByDepthImpl,
  getCombinator as getCombinatorImpl,
} from './selectorsCompileProvider';
import { selectorNormalize as selectorNormalizeImpl } from './selectorNormalize';
import { isInvalidSelector as isInvalidSelectorImpl } from './isInvalidSelector';
import { extractTokens as extractTokensImpl } from './extractTokens';
import presetStandardDefault from './presets/standard';
import presetSynonymsDefault from './presets/synonyms';
import presetMediasDefault from './presets/medias';
import presetNormalizeDefault from './presets/normalize';
import presetMainDefault from './presets/main';
import presetPrefixesDefault from './presets/prefixes';

export const minotationProvider = minotationProviderImpl;
export default coreDefault;
export const selectorsCompileProvider = selectorsCompileProviderImpl;
export const extractMedia = extractMediaImpl;
export const getCombinatorByDepth = getCombinatorByDepthImpl;
export const getCombinator = getCombinatorImpl;
export const selectorNormalize = selectorNormalizeImpl;
export const isInvalidSelector = isInvalidSelectorImpl;
export const extractTokens = extractTokensImpl;
export type {
  MnInstance,
} from './types';

export const presetStandard = presetStandardDefault;
export const presetSynonyms = presetSynonymsDefault;
export const presetMedias = presetMediasDefault;
export const presetNormalize = presetNormalizeDefault;
export const presetMain = presetMainDefault;
export const presetPrefixes = presetPrefixesDefault;
