/**
 * Внутренние типы ядра Minotation.
 *
 * @module core/types
 */

// ============================================================================
//  Стили и компиляция
// ============================================================================

/** Запись в $$stylesMap */
export interface MnStyleEntry {
  name: string;
  priority: number;
  content: string;
  revision: number;
}

/** Компилятор атрибутов */
export interface MnCompiler {
  cache?: Record<string, number>;
  clear: () => void;
  getNext(node?: any): string[];
  checkNode: (node: any) => void;
  recursiveCheck: (node: any) => void;
  (v: string): void;
}

// ============================================================================
//  Сущности (essences)
// ============================================================================

/** Параметры, передаваемые в хендлер */
export interface MnEssenceParams {
  name: string;
  suffix: string;
  ni: string;
  value?: string;
  camel?: string;
  num?: string;
  negative?: string;
  unit?: string;
  other?: string;
}

/**
 * Результат хендлера — форма ПОСЛЕ `__normalize()`.
 *
 * До нормализации `exts`/`selectors` — «сырое» значение от автора пресета
 * (`string | string[]`, см. `MnEntity`/`MnHandlerResult` в `src/types.ts`),
 * мутируется на месте в `Record<string, number>` внутри `__normalize()`.
 * Этот интерфейс описывает уже нормализованный (сохранённый) объект —
 * входной параметр `__normalize()` типизирован отдельно и шире.
 */
export interface MnEssenceResult {
  style?: Record<string, string | string[]>;
  priority?: number;
  important?: number;
  exts?: Record<string, number>;
  selectors?: Record<string, number>;
  childs?: Record<string, MnEssenceResult>;
  media?: Record<string, MnEssenceResult>;
  include?: string[];
  cssText?: string;
  inited?: number;
}

/** Контекст сущности в $$root (кортеж из 6 элементов) */
export type MnContextEssence = [
  selectorsMap: Record<string, Record<string, number>>,  // 0: MAP
  originalSelectors: Record<string, number>,               // 1: SELECTORS
  priority: number,                                         // 2: PRIORITY
  cssText: string,                                          // 3: CSS_TEXT
  updated: number,                                          // 4: UPDATED
  content: Record<string, string>,                          // 5: CONTENT
];

// ============================================================================
//  Медиа
// ============================================================================

export interface MnMediaEntry {
  query?: string;
  selector?: string;
  priority?: number;
}

/** Кортеж медиа-выражения: [name, priority, query, selector] */
export type MnMediaTuple = [string, number, string, string];

// ============================================================================
//  Внутреннее состояние
// ============================================================================

export interface MnStatics {
  essences: Record<string, MnEssenceResult>;
  assigned: Record<string, Record<string, Record<string, number>>>;
}

export interface MnData {
  compilers: Record<string, MnCompiler>;
  stylesMap: Record<string, MnStyleEntry>;
  assigned: Record<string, Record<string, Record<string, number>>>;
  essences: Record<string, MnEssenceResult>;
  root: Record<string, Record<string, MnContextEssence>>;
  statics: MnStatics;
  keyframes: [Record<string, string>, number];
  css: [Record<string, { css: Record<string, string>; content?: string }>, number];
}

/** Опции провайдера */
export interface MnOptions {
  presets?: Array<(mn: any) => void>;
  media?: Record<string, MnMediaEntry>;
  onError?: (e: Error) => void;
  selectorPrefix?: string;
  altColor?: string;
}
