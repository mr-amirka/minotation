/**
 * Внутренние типы ядра Minotation.
 *
 * @module core/types
 */

import type {
  MnInstance,
} from '../types';

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
 * Кортеж (§2 coding.md — горячий путь компиляции: `updateEssence`/
 * `compileMixedEssence`/`initEssence` читают и мержат это на каждый уникальный
 * essence-токен). Индексы — именованные константы `MN_ESSENCE_*` (`core/utils.ts`),
 * доступ по числу без табличного поиска по строковому ключу.
 *
 * До нормализации `exts`/`selectors` — «сырое» значение от автора пресета
 * (`string | string[]`, см. `MnEntity`/`MnHandlerResult` в `src/types.ts`,
 * `MnEssenceRaw` ниже — остаётся ОБЪЕКТОМ, холодный путь регистрации пресета,
 * §3 coding.md). `__normalize()` строит НОВЫЙ кортеж из объекта-аргумента —
 * не мутирует его на месте, в отличие от дообъектной версии.
 */
export type MnEssenceResult = [
  style?: Record<string, string | string[]>,
  priority?: number,
  important?: number,
  exts?: Record<string, number>,
  selectors?: Record<string, number>,
  childs?: Record<string, MnEssenceResult>,
  media?: Record<string, MnEssenceResult>,
  include?: string[],
  cssText?: string,
  inited?: number,
];

/**
 * Форма эссенции ДО `__normalize()` — «сырое» значение от автора пресета.
 * Остаётся объектом с именованными полями (холодный путь регистрации,
 * §3 coding.md) — только итоговый нормализованный `MnEssenceResult` кортеж.
 *
 * `selectors`/`exts` — произвольная сырая форма (строка/массив/объект) до
 * `normalizeSelectors`/`normalizeComboNames`; `childs`/`media` — вложенные
 * ТОЖЕ сырые объекты (не кортежи) — `__normalize()` разворачивает их
 * рекурсивно в `Record<string, MnEssenceResult>`.
 */
export interface MnEssenceRaw {
  style?: Record<string, string | string[]>;
  priority?: number;
  important?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- «сырое» значение от автора пресета до normalizeSelectors/normalizeComboNames, форма произвольная.
  selectors?: string | string[] | Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- см. selectors выше.
  exts?: string | string[] | Record<string, any>;
  childs?: Record<string, MnEssenceRaw>;
  media?: Record<string, MnEssenceRaw>;
  include?: string | string[];
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
  css: [Record<string, { css: Record<string, string[]>;
    content?: string }>, number];
}

/**
 * Ошибка разбора аргумента/токена — бросается точечно (утилитой или движком),
 * ловится централизованно в `withCatchParseComboNameDecorate`/`__initEssence`
 * (`core/index.ts`) и конвертируется в {@link MnWarning}, а не пробрасывается
 * пользователю: токен, вызвавший `MnParseError`, просто не даёт CSS-правила в
 * этом цикле компиляции. См. `AGENT_DRAFT/SPEC/10-error-warnings.md`.
 */
export class MnParseError extends Error {
  constructor(
    message: string,
    public readonly context: {
      token: string;
      handler: string;
      arg: string;
      utility?: string;
    },
  ) {
    super(message);
    this.name = 'MnParseError';
  }
}

/** Тип предупреждения — что именно не удалось обработать. */
export type MnWarningType = 'parse-error' | 'unknown-handler' | 'max-depth-exceeded';

/** Предупреждение, собранное при компиляции (`mn.warnings$`). */
export interface MnWarning {
  type: MnWarningType;
  token: string;
  handler?: string;
  arg?: string;
  utility?: string;
  message: string;
  error?: MnParseError;
}

/** Опции провайдера */
export interface MnOptions {
  presets?: Array<(mn: MnInstance) => void>;
  media?: Record<string, MnMediaEntry>;
  onError?: (e: Error) => void;
  /**
   * Реакция на {@link MnWarning} (парсинг-ошибки в утилитах, неизвестный
   * хендлер, превышение `maxDepth` в режиме `'warn'`). @default 'console'
   */
  onWarning?: 'silent' | 'console' | ((warning: MnWarning) => void);
  /**
   * Мягкий лимит глубины контекстных `<`/`>`-селекторов (`2Parent`, `3Child` и т.п.).
   * Не задан по умолчанию — действует только жёсткий потолок (см.
   * `MN_MAX_DEPTH_HARD_LIMIT` в `getCombinator.ts`, всегда 30, не настраивается).
   */
  maxDepth?: number;
  /**
   * Поведение при превышении {@link MnOptions.maxDepth}:
   * `'warn'` (по умолчанию) — предупреждение, токен всё равно компилируется
   * (глубина при этом всё равно не может превысить жёсткий потолок 30);
   * `'block'` — токен не даёт CSS-правила вообще (как `MnParseError`).
   */
  maxDepthMode?: 'warn' | 'block';
  selectorPrefix?: string;
  altColor?: string;
}
