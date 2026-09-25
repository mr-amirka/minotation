/**
 * Типы для Minotation.
 *
 * @module types
 */

import type {
  MnOptions,
  MnMediaEntry,
} from './core/types';
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
  toFixed,
  IStringifyCss,
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
  // Переопределены в createMn: `alt`-аргумент зафиксирован через $$altColor
  color: (v: string) => string[];
  colorGetBackground: (v: string) => string[];
  spaceNormalize: typeof spaceNormalize;
  routeParseProvider: typeof routeParseProvider;
  indexOf: typeof indexOf;
  toFixed: typeof toFixed;
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

/**
 * Функция-хендлер токена.
 *
 * `params` — намеренно `any`: набор полей зависит от `pattern`, с которым
 * хендлер зарегистрирован (`mn(name, handler, pattern)`), и достраивается
 * парсером во время выполнения — у `p10` это `num`/`unit`, у `cF00` —
 * `color`/`camel`, у произвольного пресета — что угодно своё. Статически
 * это объединение не выражается: {@link MnEssenceParams} описывает лишь
 * общую часть, а хендлеры читают и поля сверх неё.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- см. комментарий выше
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
  /**
   * `pattern` — маршрут(ы) для `routeParseProvider` (см. `handlerWrap` в `core/utils.ts`);
   * `string[]` — несколько альтернативных маршрутов разбора суффикса для одного хендлера.
   */
  (name: string, handler: MnHandler, pattern: string | string[]): void;
  /**
   * `skip` — не приоритет: 0/1-флаг, при `1` пропускает авто-парсинг значения
   * из суффикса токена (`REGEXP_MATCH_VALUE` в `core/index.ts`) — используется,
   * когда хендлер сам разбирает суффикс через свой `pattern`.
   */
  (name: string, handler: MnHandler, pattern: string | string[], skip: number): void;
  (name: string, entity: MnEntity | string): void;
  (map: Record<string, MnHandler | MnEntity | string>): void;

  // Методы
  assign(map: MnAssignMap): void;
  assign(selectors: string, comboNames: string | string[], defaultMediaName?: string): void;
  synonyms(map: MnSynonymsMap): void;
  // selectors: произвольная вложенная форма, см. baseSetSynonyms/normalizeSelectors в core/index.ts.
  synonyms(synonym: string, selectors: string | Record<string, any>): void; // eslint-disable-line @typescript-eslint/no-explicit-any
  /**
   * Переконфигурирует инстанс после создания — слияние с текущими опциями
   * (частичное обновление, не замена целиком). Единственный поддерживаемый
   * способ поменять `onError`/`onWarning`/`selectorPrefix`/`altColor`/`strict`
   * на уже созданном `mn`: эти поля читаются из замыкания один раз при
   * создании и на каждый вызов `setOptions`, не на каждой компиляции.
   * Прямая мутация `mn.options` эффекта не имеет — это только снимок для
   * чтения/отладки. Введено 2026-09-23.
   *
   * @example
   * mn.setOptions({ selectorPrefix: '.app' });
   * mn.recompile;
   */
  setOptions(partialOptions: Partial<MnOptions>): void;

  // Сервисы (опционально — не все пресеты используют)
  utils?: MnUtils;
  setKeyframes?: (
    name: string, body: string | Record<string, string | Record<string, string | number>>,
    ifEmpty?: number,
  ) => MnInstance;
  propertiesStringify?: IStringifyCss;
  media?: Record<string, MnMediaEntry>;
}
