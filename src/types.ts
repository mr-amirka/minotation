/**
 * Типы для Minotation.
 *
 * @module types
 */

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

/** Запись в mn.css() */
export type MnCssMap = Record<string, Record<string, string>>;

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
  (name: string, handler: MnHandler, pattern: string, priority: number): void;
  (name: string, entity: MnEntity | string): void;
  (map: Record<string, MnHandler | MnEntity | string>): void;

  // Методы
  assign: (map: MnAssignMap) => void;
  css: (map: MnCssMap) => void;
  synonyms: (map: MnSynonymsMap) => void;

  // Сервисы (опционально — не все пресеты используют)
  utils?: any;
  setKeyframes?: any;
  propertiesStringify?: any;
  media?: any;
}
