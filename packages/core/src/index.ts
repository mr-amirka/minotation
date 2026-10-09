/**
 * Minotation — точка входа.
 * Реэкспортирует все публичные модули.
 */

// ВАЖНО: `export { X } from '...'` (и `export { default as X } from '...'`)
// компилируется (esModuleInterop) в геттер `get { return mod.X; }` — эту
// форму не распознаёт cjs-module-lexer (статический анализ именованных
// экспортов CJS-модуля для Node ESM/CJS-интеропа): `import { X } from
// 'minotation'` из чужого ESM-кода (Vite-бандл minotation-docs, см.
// 2026-09-03) падал с "does not provide an export named 'X'", хотя
// `require` видел его нормально. Тот же баг, что уже чинили для пресетов
// (2026-08-15) — здесь применён ко всем остальным реэкспортам. Явный импорт +
// `export const` компилируется в простое `exports.X =...` — лексер находит.
import {
  minotationProvider as minotationProviderImpl, 
} from './core/index';
import coreDefault from './core/index';
import {
  selectorsCompileProvider as selectorsCompileProviderImpl,
  extractMedia as extractMediaImpl,
  getCombinatorByDepth as getCombinatorByDepthImpl,
  getCombinator as getCombinatorImpl,
} from './selectorsCompileProvider';
import {
  selectorNormalize as selectorNormalizeImpl, 
} from './selectorNormalize';
import {
  isInvalidSelector as isInvalidSelectorImpl, 
} from './isInvalidSelector';
import {
  extractTokens as extractTokensImpl,
  extractClassVarTokens as extractClassVarTokensImpl,
  extractMergeCallTokens as extractMergeCallTokensImpl,
  scanTokens as scanTokensImpl,
  stripComments as stripCommentsImpl,
} from './extractTokens';
import {
  createScanner as createScannerImpl,
  isSyntaxScannable as isSyntaxScannableImpl,
} from './scanner';
import {
  checkOptions as checkOptionsImpl,
  checkKnownValues as checkKnownValuesImpl,
  describeValue as describeValueImpl,
  oneOf as oneOfImpl,
  optionsOf as optionsOfImpl,
  isBoolean as isBooleanImpl,
  isString as isStringImpl,
  isFunction as isFunctionImpl,
  isCount as isCountImpl,
  isObject as isObjectImpl,
  isBooleanOrString as isBooleanOrStringImpl,
  isStringArray as isStringArrayImpl,
  isFunctionArray as isFunctionArrayImpl,
  CORE_OPTIONS_SCHEMA as CORE_OPTIONS_SCHEMA_IMPL,
} from './checkOptions';
import {
  mne as mneImpl,
  mnClass as mnClassImpl,
  mnKey as mnKeyImpl,
  mnMap as mnMapImpl,
} from './mne';
import presetStandardDefault from './presets/standard';
import presetSynonymsDefault from './presets/synonyms';
import presetMediasDefault from './presets/medias';
import presetNormalizeDefault from './presets/normalize';
import presetMainDefault from './presets/main';
import presetPrefixesDefault from './presets/prefixes';
import presetHintsDefault from './presets/hints';

export const minotationProvider = minotationProviderImpl;
export default coreDefault;
export const selectorsCompileProvider = selectorsCompileProviderImpl;
export const extractMedia = extractMediaImpl;
export const getCombinatorByDepth = getCombinatorByDepthImpl;
export const getCombinator = getCombinatorImpl;
export const selectorNormalize = selectorNormalizeImpl;
export const isInvalidSelector = isInvalidSelectorImpl;
export const extractTokens = extractTokensImpl;

/**
 * Сбор токенов для плагинов сборщиков: атрибут + переменные с суффиксом `Class`
 * + строковые аргументы `mne`/`mnClass`.
 *
 * Плагины вызывают именно `scanTokens`, а не собирают механизмы по отдельности —
 * иначе набор возможностей расходится от сборщика к сборщику (так и было
 * до 2026-09-25: `classVarSuffixes` работал только в `minotation-vite`).
 */
export const scanTokens = scanTokensImpl;

/**
 * Сканер по настройкам: текстовый или синтаксический (`syntax: true`).
 *
 * Плагины должны звать её и передавать имя файла, а не выбирать сканер сами —
 * по той же причине, по которой они зовут `scanTokens`, а не три механизма
 * по отдельности.
 */
export const createScanner = createScannerImpl;

/** Годится ли файл для синтаксического разбора — проверка без загрузки парсера. */
export const isSyntaxScannable = isSyntaxScannableImpl;
export const extractClassVarTokens = extractClassVarTokensImpl;
export const extractMergeCallTokens = extractMergeCallTokensImpl;

/**
 * Убирает содержимое комментариев из текста файла — `scanTokens` вызывает её
 * сам. Отдельно нужна тем, кто собирает механизмы сканера вручную.
 */
export const stripComments = stripCommentsImpl;

/**
 * Слияние наборов токенов без гонки специфичности — см. `mne.ts`.
 *
 * Переопределение вытесняет перекрытый токен из строки, а не побеждает его
 * повышенной специфичностью (`f24*2`): конфликта в CSS не возникает вовсе.
 * Модуль ничего не импортирует — рассчитан на вызов на каждый рендер.
 */
/**
 * Проверка опций публичного API (D-038): неизвестный ключ и некорректное
 * значение — ошибка с подсказкой. Общая для ядра, плагинов и CLI.
 */
export const checkOptions = checkOptionsImpl;
export const checkKnownValues = checkKnownValuesImpl;
export const describeValue = describeValueImpl;
export const oneOf = oneOfImpl;
export const optionsOf = optionsOfImpl;
export const isBoolean = isBooleanImpl;
export const isString = isStringImpl;
export const isFunction = isFunctionImpl;
export const isCount = isCountImpl;
export const isObject = isObjectImpl;
export const isBooleanOrString = isBooleanOrStringImpl;
export const isStringArray = isStringArrayImpl;
export const isFunctionArray = isFunctionArrayImpl;
export const CORE_OPTIONS_SCHEMA = CORE_OPTIONS_SCHEMA_IMPL;
export const mne = mneImpl;
export const mnClass = mnClassImpl;
export const mnKey = mnKeyImpl;
export const mnMap = mnMapImpl;
export type {
  ScanTokensOptions,
} from './extractTokens';
export type {
  ScannerOptions, Scanner,
} from './scanner';
export type {
  MnClassValue,
} from './mne';
export type {
  OptionCheck, OptionSchema,
} from './checkOptions';
export type {
  MnInstance,
} from './types';

/**
 * Типы системы предупреждений — нужны сборочным плагинам, которые пересылают
 * `warnings$` в собственный канал вывода.
 */
export type {
  MnWarning,
  MnWarningType,
  MnOptions,
  MnRaiseMode,
} from './core/types';
import {
  MnParseError as MnParseErrorImpl,
  MnWarningError as MnWarningErrorImpl,
  MnForbiddenTokenError as MnForbiddenTokenErrorImpl,
} from './core/types';
// Форма `export { X } from '...'` компилируется в геттер, которого не видит
// cjs-module-lexer — ровно то, о чём предупреждает шапка этого файла. Эти два
// символа оставались последними в старой форме (приведены 2026-09-25).
export const MnParseError = MnParseErrorImpl;
export const MnWarningError = MnWarningErrorImpl;
export const MnForbiddenTokenError = MnForbiddenTokenErrorImpl;

export const presetStandard = presetStandardDefault;
export const presetSynonyms = presetSynonymsDefault;
export const presetMedias = presetMediasDefault;
export const presetNormalize = presetNormalizeDefault;
export const presetMain = presetMainDefault;
export const presetPrefixes = presetPrefixesDefault;
/** Подсказки о классах, которых нет в нотации (`t0` → `st0`, `flex` → `dF`) — D-024. */
export const presetHints = presetHintsDefault;
