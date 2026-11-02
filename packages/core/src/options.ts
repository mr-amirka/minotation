/**
 * Схемы опций ядра на `fundamentool/schema` (D-141): по ним проверяются опции, отсюда же их ключи.
 *
 * Ядро проверяет только в разработке (lab D-023): оно встраивается и в браузерный рантайм, где
 * проверки и схемы в продакшен-сборке не нужны. Схемы строятся при первой проверке (`lazy`), так что
 * сборщик выбрасывает их вместе с проверкой. Сборка и CLI работают в Node и проверяют всегда — своими
 * схемами, в которые входят эти (`object({ ...CORE_OPTIONS().shape, … })`).
 *
 * Сообщения — схемы: `[minotation] <где>: "bareMathMode" expects one of warn, silent, strict, got
 * string "strickt". Did you mean "strict"?`.
 *
 * Холодный путь: проверка — один раз при создании (провайдер, пресет, плагин).
 */
import {
  isPlainObject,
} from 'fundamentool';
import {
  array,
  boolean,
  custom,
  func,
  lazy,
  number,
  object,
  oneOf,
  string,
  union,
} from 'fundamentool/schema';
import {
  MN_MAX_SPECIFICITY,
} from './core/types';
import type {
  MnMediaEntry,
  MnPreset,
} from './core/types';

/** Начало каждого сообщения проверки: `[minotation] mnVite: …`. */
export const MN_WHERE = '[minotation] ';

const MODE_WARN = 'warn' as const;
const MODE_STRICT = 'strict' as const;

/** Режим реакции на предупреждение: предупредить, молчать, ошибка ({@link MnRaiseMode}). */
export const RAISE_MODES = [
  MODE_WARN,
  'silent',
  MODE_STRICT,
] as const;

/** Режимы синтаксиса классов ({@link MnNotationMode}). */
export const NOTATION_MODES = [
  'context-qualified',
  'tw4-compatible',
  'breakpoint-prefixed',
  'property-value',
] as const;

/** Имя класса CSS без экранирования: `_l`, `mn-scope`. */
const REGEXP_CLASS_NAME = /^-?[_a-zA-Z][\w-]*$/;

/**
 * Пресет: функция `(mn) => void` или пресет-объект (его поля проверяет `setPresets`, D-045).
 *
 * @returns схема одного пресета
 * @example array(presetSchema()) // опция `presets`
 */
export function presetSchema() {
  return custom<MnPreset>((value) => typeof value === 'function' || isPlainObject(value),
    'a preset (a function or a preset object)');
}

/**
 * Опции {@link minotationProvider} и `mn.setOptions` ({@link MnOptions}). Тип опций описан в
 * `MnOptions`; тест сверяет его с этой схемой.
 *
 * @example
 * CORE_OPTIONS().parse({ bareMathMode: 'strickt' }, MN_WHERE + 'minotationProvider');
 * // TypeError: [minotation] minotationProvider: "bareMathMode" expects one of warn, silent, strict, got
 * //   string "strickt". Did you mean "strict"?
 */
export const CORE_OPTIONS = /*#__PURE__*/ lazy(() => {
  const raise = oneOf(RAISE_MODES).optional();
  const flag = boolean().optional();
  const handler = func().optional();
  const choice = <const T extends string>(values: readonly T[]) => oneOf(values).optional();
  return object({
    presets: array(presetSchema()).optional(),
    media: custom<Record<string, MnMediaEntry>>(isPlainObject, 'an object').optional(),
    onError: handler,
    warningMode: choice([
      'log',
      'silent',
      'error',
    ]),
    onWarning: handler,
    maxDepth: number().int().min(0).optional(),
    maxDepthMode: raise,
    maxSpecificity: number().int().min(1).max(MN_MAX_SPECIFICITY).optional(),
    maxSpecificityMode: choice([
      MODE_WARN,
      MODE_STRICT,
    ]),
    specificityMode: raise,
    importantMode: raise,
    childSelectorMode: raise,
    unknownMediaMode: raise,
    suspectClassMode: raise,
    handlerConflictMode: raise,
    mediaConflictMode: raise,
    presetConflictMode: raise,
    groupSuspectMode: raise,
    bareMathMode: raise,
    groupMode: choice([
      'groups',
      'css',
    ]),
    mediaNesting: flag,
    mediaSyntax: choice([
      'range',
      'classic',
    ]),
    axisMode: choice([
      'logical',
      'physical',
    ]),
    overflowWrapMode: choice([
      'standard',
      'legacy',
      'both',
    ]),
    notationMode: choice(NOTATION_MODES),
    contextWhere: flag,
    isolateMode: choice([
      'none',
      'class',
      'where',
    ]),
    isolateClass: custom<string>((value) => typeof value === 'string' && REGEXP_CLASS_NAME.test(value),
      'a class name without a dot (e.g. "_l")').optional(),
    altColor: flag,
  });
});

/** Имя атрибута или шаблон `*ClassName`: звёздочка — только в начале и не одна (D-131). */
const REGEXP_ATTR_NAME = /^\*?[^*\s]+$/;

/**
 * Опции `createScanner` ({@link ScannerOptions}).
 *
 * @example
 * SCANNER_OPTIONS().parse({ attr: 'class*' }, MN_WHERE + 'createScanner');
 * // TypeError: [minotation] createScanner: "attr" expects names or patterns "*Suffix" (as "*ClassName"), each
 * //   without spaces
 */
export const SCANNER_OPTIONS = /*#__PURE__*/ lazy(() => {
  const names = array(string()).optional();
  return object({
    attr: union([
      string(),
      array(string()),
    ]).refine((value) => (typeof value === 'string' ? [value] : value).every((name) => REGEXP_ATTR_NAME.test(name)),
      'expects names or patterns "*Suffix" (as "*ClassName"), each without spaces').optional(),
    classVarSuffixes: names,
    mergeFnNames: names,
    comments: boolean().optional(),
    syntax: boolean().optional(),
    onWarning: func().optional(),
  });
});
