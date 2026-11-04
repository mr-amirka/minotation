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
  getCombinator as getCombinatorImpl,
} from './selectorsCompileProvider';
import {
  selectorNormalize as selectorNormalizeImpl,
} from './selectorNormalize';
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
  readScanEntries as readScanEntriesImpl,
  SCAN_DEFAULTS as SCAN_DEFAULTS_IMPL,
} from './scanPlan';
import {
  addScopeClassText as addScopeClassTextImpl,
  createScopeClassWriter as createScopeClassWriterImpl,
} from './scopeClass';
export type {
  ScopeClassResult,
  ScopeClassWriter,
  ScopeClassWriterOptions,
} from './scopeClass';
import {
  CORE_OPTIONS as CORE_OPTIONS_IMPL,
  MN_WHERE as MN_WHERE_IMPL,
  RAISE_MODES as RAISE_MODES_IMPL,
  SCANNER_OPTIONS as SCANNER_OPTIONS_IMPL,
} from './options';
import {
  mne as mneImpl,
  mnClass as mnClassImpl,
  mnKey as mnKeyImpl,
  mnMap as mnMapImpl,
} from './mne';
import presetStandardDefault from './presets/standard';
import presetSynonymsDefault from './presets/synonyms';
import presetMediasDefault from './presets/medias';
import {
  presetNormalize3_0_3 as presetNormalize3_0_3Impl,
  presetNormalize4_2_0 as presetNormalize4_2_0Impl,
  presetNormalize5_0_0 as presetNormalize5_0_0Impl,
  presetNormalize6_0_0 as presetNormalize6_0_0Impl,
  presetNormalize7_0_0 as presetNormalize7_0_0Impl,
  presetNormalize8_0_1 as presetNormalize8_0_1Impl,
  presetModernNormalize1_1_0 as presetModernNormalize1_1_0Impl,
  presetModernNormalize2_0_0 as presetModernNormalize2_0_0Impl,
  presetModernNormalize3_0_1 as presetModernNormalize3_0_1Impl,
} from './presets/normalize';
import presetMainDefault from './presets/main';
import presetPrefixesDefault from './presets/prefixes';
import presetHintsDefault from './presets/hints';
import presetTw4Default from './presets/tw4';
import {
  TW4_THEME as TW4_THEME_IMPL,
  TW4_VERSION as TW4_VERSION_IMPL,
} from './presets/tw4/theme';
import {
  defineScale as defineScaleImpl,
} from './presets/shared/scale';
import {
  tw as twImpl,
  parseTwSuffix as parseTwSuffixImpl,
} from './presets/shared/tw';

/**
 * Создаёт экземпляр minotation: пресеты, опции, компиляторы атрибутов и поток готовых стилей.
 *
 * @param options — опции экземпляра (`notationMode`, `warningMode`, `presets` …); неизвестный ключ — ошибка с
 *   подсказкой
 * @returns экземпляр `mn`: `setPresets`, `getCompiler(attr)`, `compile()`, `styles$`
 * @example
 * const mn = minotationProvider({ presets: [presetStandard, presetMedias] });
 * mn.getCompiler('class')('p10 cF00@m');
 * mn.compile(); // .p10{padding:10px} @media (width < 992px){.cF00\@m{color:#f00}}
 */
export const minotationProvider = minotationProviderImpl;
export default coreDefault;
export const selectorsCompileProvider = selectorsCompileProviderImpl;
export const extractMedia = extractMediaImpl;
export const getCombinator = getCombinatorImpl;
export const selectorNormalize = selectorNormalizeImpl;
export const extractTokens = extractTokensImpl;

/**
 * Сбор токенов из текста по цели: атрибуты (`attrs`), переменные (`varNames`), аргументы вызовов (`fnNames`;
 * D-146, D-147).
 *
 * Плагины вызывают `createScanner`, а не собирают механизмы по отдельности —
 * иначе набор возможностей расходится от сборщика к сборщику (так и было
 * до 2026-09-25: переменные разбирались только в `minotation-vite`).
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
/**
 * Записи опции сканера парами «имя, цель» (D-146, D-147): `readScanEntries('attrs', 'className:class, m')` →
 * `[['className', 'class'], ['m', 'm']]`; `undefined` — умолчание. Сборке — чтобы узнать, какие атрибуты дают классы.
 */
export const readScanEntries = readScanEntriesImpl;
/** Умолчания `attrs`, `varNames`, `fnNames` (D-146, D-147). */
export const SCAN_DEFAULTS = SCAN_DEFAULTS_IMPL;
/** Писатель класса области в разметку (D-075, D-076): разбором для JS/TS, текстом для остального. */
export const createScopeClassWriter = createScopeClassWriterImpl;
/** Класс области в разметку текстом. */
export const addScopeClassText = addScopeClassTextImpl;

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
 * повышенной специфичностью (`f24**2`): конфликта в CSS не возникает вовсе.
 * Модуль ничего не импортирует — рассчитан на вызов на каждый рендер.
 */
/**
 * Схема опций ядра на `fundamentool/schema` (D-141): `CORE_OPTIONS().parse(options, where)`,
 * `.keys` — их ключи, `.shape` — для схемы шире (`object({ ...CORE_OPTIONS().shape, out: string() })`).
 * Ядро проверяет по ней только в разработке; сборка и CLI — всегда, своими схемами поверх этой.
 */
export const CORE_OPTIONS = CORE_OPTIONS_IMPL;
/** Схема опций `createScanner` (D-141) — сборка включает её поля в свои. */
export const SCANNER_OPTIONS = SCANNER_OPTIONS_IMPL;
/** Начало сообщения проверки: `MN_WHERE + 'mnVite'` → `[minotation] mnVite: …`. */
export const MN_WHERE = MN_WHERE_IMPL;
/** Режимы реакции на предупреждение: `warn`, `silent`, `strict`. */
export const RAISE_MODES = RAISE_MODES_IMPL;
export const mne = mneImpl;
export const mnClass = mnClassImpl;
export const mnKey = mnKeyImpl;
export const mnMap = mnMapImpl;
export type {
  ScanTokensOptions,
} from './extractTokens';
export type {
  ScannedTokens,
} from './scanPlan';
export type {
  ScannerOptions,
  Scanner,
} from './scanner';
export type {
  MnClassValue,
} from './mne';
export type {
  MnScaleOptions,
} from './presets/shared/scale';
export type {
  MnTwArgs,
  MnTwHandler,
} from './presets/shared/tw';
export type {
  MnCssDeclarations,
  MnCssEntry,
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
  MnMediaEntry,
  MnRaiseMode,
  MnPreset,
  MnPresetObject,
  MnNotationMode,
  MnParseSettings,
} from './core/types';
import {
  MnParseError as MnParseErrorImpl,
  MnWarningError as MnWarningErrorImpl,
  MnForbiddenTokenError as MnForbiddenTokenErrorImpl,
  parseSettingsKey as parseSettingsKeyImpl,
} from './core/types';
// Форма `export { X } from '...'` компилируется в геттер, которого не видит
// cjs-module-lexer — ровно то, о чём предупреждает шапка этого файла. Эти два
// символа оставались последними в старой форме (приведены 2026-09-25).
/**
 * Ошибка разбора токена: хендлер бракует значение, ядро превращает её в предупреждение с токеном и хендлером.
 * `instanceof` узнаёт ошибку из любой копии ядра (CJS и ESM в одном процессе).
 *
 * @example
 * mn('x', (p) => {
 *   const arg = p.suffix;
 *   throw new MnParseError('Value "' + arg + '" is invalid for "x"', { token: 'x' + arg, handler: 'x', arg });
 * });
 */
export const MnParseError = MnParseErrorImpl;
/** Ключ набора настроек разбора (`getCompiler(attr, settings)`, D-081). */
export const parseSettingsKey = parseSettingsKeyImpl;
export const MnWarningError = MnWarningErrorImpl;
export const MnForbiddenTokenError = MnForbiddenTokenErrorImpl;

/**
 * Стандартный пресет: все CSS-токены нотации (`p10`, `cF00`, `dF`, `bgF00-00F` …) — справочник `HANDLERS.md`.
 *
 * @example
 * minotationProvider({ presets: [presetStandard] }); // p10 → padding:10px
 */
export const presetStandard = presetStandardDefault;
/**
 * Синонимы состояний и контекстов: короткие имена псевдоклассов (`:h` — `:hover`, `:f` — `:focus`, `:n(2n)` —
 * `:nth-child(2n)`).
 *
 * @example
 * minotationProvider({ presets: [presetStandard, presetSynonyms] });
 * // cF00:h → @media (hover: hover){.cF00\:h:hover{color:#f00}} — наведение только у устройств с ним (D-069)
 */
export const presetSynonyms = presetSynonymsDefault;
/**
 * Точки медиа по ширине (`@m4` — до 480px, `@d-` — от 992px) и медиа-признаки (`dark`, `print`, `motion-safe` …),
 * D-054, D-057.
 *
 * @example
 * minotationProvider({ presets: [presetStandard, presetMedias] }); // dN@m → @media (width < 992px){…}
 */
export const presetMedias = presetMediasDefault;
/**
 * Пресеты normalize (D-108): версия эталона — в имени, эталон воспроизводится один в один. Наборов по умолчанию нет
 * (D-110) — приложение перечисляет нужный: normalize.css 3.0.3 (IE 8+), 4.2.0–7.0.0, 8.0.1 (IE 10+, Safari 8+),
 * modern-normalize 1.1.0, 2.0.0, 3.0.1 (последние Chrome, Firefox, Safari).
 */
export const presetNormalize3_0_3 = presetNormalize3_0_3Impl;
export const presetNormalize4_2_0 = presetNormalize4_2_0Impl;
export const presetNormalize5_0_0 = presetNormalize5_0_0Impl;
export const presetNormalize6_0_0 = presetNormalize6_0_0Impl;
export const presetNormalize7_0_0 = presetNormalize7_0_0Impl;
/**
 * normalize.css 8.0.1 (IE 10+, Safari 8+) один в один — последняя версия normalize.css (D-108).
 *
 * @example
 * minotationProvider({ presets: [presetNormalize8_0_1, presetStandard] }); // html{line-height:1.15;…} …
 */
export const presetNormalize8_0_1 = presetNormalize8_0_1Impl;
export const presetModernNormalize1_1_0 = presetModernNormalize1_1_0Impl;
export const presetModernNormalize2_0_0 = presetModernNormalize2_0_0Impl;
export const presetModernNormalize3_0_1 = presetModernNormalize3_0_1Impl;
/**
 * Базовые стили страницы поверх `presetStandard` и `presetMedias` (их он требует): `box-sizing:border-box` у всех
 * элементов, сброс полей и т. п.
 *
 * @example
 * minotationProvider({ presets: [presetStandard, presetMedias, presetMain] });
 */
export const presetMain = presetMainDefault;
export const presetPrefixes = presetPrefixesDefault;
/** Подсказки о классах, которых нет в нотации (`t0` → `st0`, `flex` → `dF`) — D-024. */
export const presetHints = presetHintsDefault;
/** Клон Tailwind 4 (D-068): вместо `presetStandard`, запись `'tw4-compatible'`. */
export const presetTw4 = presetTw4Default;
/** Тема Tailwind 4, с которой работает `presetTw4`, и её версия. */
export const TW4_THEME = TW4_THEME_IMPL;
export const TW4_VERSION = TW4_VERSION_IMPL;
export const defineScale = defineScaleImpl;
export const tw = twImpl;
export const parseTwSuffix = parseTwSuffixImpl;
