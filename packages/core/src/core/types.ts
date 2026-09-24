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

/**
 * Компилятор атрибутов.
 *
 * `node` — намеренно `any`: ядро работает и в браузере, и вне его, конкретный
 * тип узла задаёт потребитель (DOM `Element`, узел виртуального дерева,
 * объект-заглушка в тестах). Сузить до `Element` нельзя — это привязало бы
 * ядро к DOM; `unknown` потребовал бы каста у каждого вызывающего, ничего не
 * давая взамен, потому что ядро читает у узла только атрибуты и детей.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- см. комментарий выше про node */
export interface MnCompiler {
  cache?: Record<string, number>;
  clear: () => void;
  getNext(node?: any): string[];
  checkNode: (node: any) => void;
  recursiveCheck: (node: any) => void;
  (v: string): void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
}

/**
 * Ошибка разбора аргумента/токена — бросается точечно (утилитой или движком),
 * ловится централизованно в `withCatchParseComboNameDecorate`/`__initEssence`
 * (`core/index.ts`) и конвертируется в {@link MnWarning}, а не пробрасывается
 * пользователю: токен, вызвавший `MnParseError`, просто не даёт CSS-правила в
 * этом цикле компиляции. См. `AGENT_DRAFT/SPEC/10-error-warnings.md`.
 */
export class MnParseError extends Error {
  constructor(message: string,
    public readonly context: {
      token: string;
      handler: string;
      arg: string;
      utility?: string;
      /**
       * Во что превратить эту ошибку в {@link MnInstance.warnings$}. Задаётся
       * явно там, где тип не `'parse-error'` — например превышение `maxDepth`.
       * Без него ловящая сторона считает ошибку обычной ошибкой разбора.
       */
      warningType?: MnWarningType;
    }) {
    super(message);
    this.name = 'MnParseError';
  }
}

/** Тип предупреждения — что именно не удалось обработать. */
/**
 * `'unknown-handler'` убран 2026-09-24: незнакомое имя — это чужой CSS-класс,
 * а не ошибка. Предупреждения остаются только там, где автор явно писал
 * MN-токен: хендлер найден, но аргумент не разобрался (`parse-error`),
 * превышена глубина контекста (`max-depth-exceeded`), хендлер вернул битое
 * CSS-значение (`invalid-css-value`).
 */
export type MnWarningType = 'parse-error' | 'max-depth-exceeded' | 'invalid-css-value';

/**
 * Бросается из {@link MnInstance.compile}, когда `MnOptions.strict: true` и за цикл
 * компиляции накоплен хотя бы один {@link MnWarning}. Бросок происходит ПОСЛЕ основной
 * работы `compile()` (генерация CSS уже завершена, вне try/catch парсинга токенов) —
 * не подменяет и не отменяет обычный `onWarning`, только добавляет жёсткий отказ поверх.
 */
export class MnStrictError extends Error {
  constructor(public readonly warnings: MnWarning[]) {
    super('MN strict: ' + warnings.length + ' warning(s) during compile:\n'
      + warnings.map((w) => '  ' + w.token + ': ' + w.message).join('\n'));
    this.name = 'MnStrictError';
  }
}

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
  /**
   * `true` — рядом с `rgba()`-значением выводить запасное непрозрачное
   * объявление на случай браузера без поддержки `rgba()`:
   * `color:#000;color:rgba(0,0,0,0)`.
   *
   * @default false — выключено с 2026-09-24 (решение владельца: «пусть он
   * будет отключен по умолчанию, чтоб другие так же не ловили траблы»).
   * Раньше было включено, и каждый цвет с альфа-каналом молча давал ДВА
   * объявления вместо одного — лишний байт в выводе и неожиданный `#000`
   * там, где просили прозрачность. Запас нужен только для браузеров без
   * `rgba()` (IE8 и старше), включать его сегодня осмысленно разве что
   * точечно.
   */
  altColor?: boolean;
  /**
   * `true` — накопленные за цикл {@link MnInstance.compile} предупреждения (см.
   * {@link MnWarning}) приводят к броску {@link MnStrictError} вместо тихого
   * `warn-and-continue`. `onWarning` при этом всё равно вызывается как обычно —
   * `strict` не заменяет его, а добавляет отказ поверх.
   *
   * @default false — по умолчанию выключено: токены пользовательского кода часто
   * пересекаются с обычными CSS-классами и прочей разметкой, случайно попадающей
   * под парсер минотации, и `strict: true` в общем случае может ломать сборку
   * на ложных срабатываниях. Включать точечно, в конкретных сборках, где состав
   * токенов контролируется.
   */
  strict?: boolean;
}
