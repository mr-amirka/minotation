/**
 * Типы для Minotation.
 *
 * @module types
 */

import type {
  forEach,
  flags,
  extend,
  isDefined,
  map,
  mapIn,
  filter,
  forIn,
  upperFirst,
  lowerFirst,
  toUpper,
  camelToKebabCase,
  isArray,
  reduce,
  size,
  intval,
  floatval,
  routeParseProvider,
  indexOf,
} from 'fundamentool';
import type {
  spaceNormalize,
} from './core/utils';

/**
 * Утилиты, доступные пресетам через `mn.utils`.
 *
 * Реальный объект собирается в `baseUtils` (`core/utils.ts`) и содержит
 * больше методов из fundamentool — здесь перечислены только те, что
 * реально деструктурируются в пресетах (`presets/*.ts`).
 */
export interface MnUtils {
  forEach: typeof forEach;
  flags: typeof flags;
  extend: typeof extend;
  isDefined: typeof isDefined;
  map: typeof map;
  mapIn: typeof mapIn;
  filter: typeof filter;
  forIn: typeof forIn;
  upperFirst: typeof upperFirst;
  lowerFirst: typeof lowerFirst;
  toUpper: typeof toUpper;
  camelToKebabCase: typeof camelToKebabCase;
  isArray: typeof isArray;
  reduce: typeof reduce;
  size: typeof size;
  intval: typeof intval;
  floatval: typeof floatval;
  // Переопределены в createMn(): `alt`-аргумент зафиксирован через $$altColor
  color: (v: string) => string[];
  colorGetBackground: (v: string) => string[];
  spaceNormalize: typeof spaceNormalize;
  routeParseProvider: typeof routeParseProvider;
  indexOf: typeof indexOf;
}

/** Значение токена MN — строка или массив строк (множественные значения) */
export type MnTokenValue = string | string[];

/** Результат хендлера — стили или ссылка на сущность */
export interface MnHandlerResult {
  style?: Record<string, MnTokenValue>;
  priority?: number;
  exts?: string[];
  selectors?: string[];
  childs?: Record<string, MnHandlerResult>;
}

/** Функция-хендлер токена */
export type MnHandler = (params: any) => MnHandlerResult | void | 0;

/** Сущность MN (статическая) */
export interface MnEntity {
  exts?: string[];
  style?: Record<string, MnTokenValue>;
  selectors?: string[];
  childs?: Record<string, MnEntity>;
}

/** Запись в mn.assign() */
export type MnAssignMap = Record<string, string>;

/** Запись в mn.css() — значение: объект CSS-свойств или строка (`'margin:0'`) */
export type MnCssMap = Record<string, Record<string, string> | string>;

/** Запись в mn.synonyms() — строковые значения, не объекты */
export type MnSynonymsMap = Record<string, string>;

/**
 * Экземпляр Minotation, передаваемый в пресеты.
 *
 * Используется как функция `mn(name, handler)` и как объект с методами.
 */
export interface MnInstance {
  // Вызов как функция: регистрация хендлера
  (name: string, handler: MnHandler): void;
  (name: string, handler: MnHandler, pattern: string): void;
  /**
   * `skip` — не приоритет: 0/1-флаг, при `1` пропускает авто-парсинг значения
   * из суффикса токена (`REGEXP_MATCH_VALUE` в `core/index.ts`) — используется,
   * когда хендлер сам разбирает суффикс через свой `pattern`.
   */
  (name: string, handler: MnHandler, pattern: string, skip: number): void;
  (name: string, entity: MnEntity | string): void;
  (map: Record<string, MnHandler | MnEntity | string>): void;

  // Методы
  assign(map: MnAssignMap): void;
  assign(selectors: string, comboNames: string | string[], defaultMediaName?: string): void;
  css(map: MnCssMap): void;
  css(selector: string, css: Record<string, string> | string): void;
  synonyms(map: MnSynonymsMap): void;
  // selectors: произвольная вложенная форма, см. baseSetSynonyms/normalizeSelectors в core/index.ts.
  synonyms(synonym: string, selectors: string | Record<string, any>): void; // eslint-disable-line @typescript-eslint/no-explicit-any

  // Сервисы (опционально — не все пресеты используют)
  utils?: MnUtils;
  setKeyframes?: any;
  propertiesStringify?: any;
  media?: any;
}
