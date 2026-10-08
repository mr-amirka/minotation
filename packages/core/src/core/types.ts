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
  // Не опционально: `__compileProvider` зовёт `clear()` сразу при создании,
  // а тот и заводит кеш. Пока поле было необязательным, строгий режим требовал
  // проверки на каждом обращении — защиты от состояния, которого не бывает.
  cache: Record<string, number>;
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

/**
 * Параметры, передаваемые в хендлер.
 *
 * Именованные поля — то, что кладёт ядро всегда или по общему разбору
 * значения (`REGEXP_MATCH_VALUE`). Остальное зависит от паттерна, с которым
 * хендлер зарегистрирован: `mn(name, handler, pattern)` разбирает суффикс по
 * своим правилам и кладёт в тот же объект поля с произвольными именами —
 * `p.x`, `p.angle`, `p.dir` у трансформаций, `p.vv`, `p.addu` у значений с
 * подстановкой.
 *
 * Перечислить их в типе нельзя: имена задаёт автор пресета, а пресет —
 * публичная точка расширения. Отсюда индексная сигнатура, а не `any` на
 * параметре хендлера (решение владельца, Р-2): поля с известными именами
 * остаются типизированными, неизвестные читаются без приведения типа.
 *
 * `number` в типе значения нужен, потому что разбор кладёт туда не только
 * строки — например счётчики повторов.
 */
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
  [key: string]: string | number | undefined;
}

/**
 * Результат хендлера — форма ПОСЛЕ `__normalize`.
 *
 * Кортеж (§2 coding.md — горячий путь компиляции: `updateEssence`/
 * `compileMixedEssence`/`initEssence` читают и мержат это на каждый уникальный
 * essence-токен). Индексы — именованные константы `MN_ESSENCE_*` (`core/utils.ts`),
 * доступ по числу без табличного поиска по строковому ключу.
 *
 * До нормализации `exts`/`selectors` — «сырое» значение от автора пресета
 * (`string | string[]`, см. `MnEntity`/`MnHandlerResult` в `src/types.ts`,
 * `MnEssenceRaw` ниже — остаётся ОБЪЕКТОМ, холодный путь регистрации пресета,
 * §3 coding.md). `__normalize` строит НОВЫЙ кортеж из объекта-аргумента —
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
 * Форма эссенции ДО `__normalize` — «сырое» значение от автора пресета.
 * Остаётся объектом с именованными полями (холодный путь регистрации,
 * §3 coding.md) — только итоговый нормализованный `MnEssenceResult` кортеж.
 *
 * `selectors`/`exts` — произвольная сырая форма (строка/массив/объект) до
 * `normalizeSelectors`/`normalizeComboNames`; `childs`/`media` — вложенные
 * ТОЖЕ сырые объекты (не кортежи) — `__normalize` разворачивает их
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
 * этом цикле компиляции.md`.
 */
/**
 * Метка {@link MnParseError}, общая для всех копий ядра в процессе.
 *
 * Ядро публикуется в двух форматах (CJS и ESM), и в одном процессе бывают обе
 * копии: `minotation-vite` (ESM) берёт пресеты из ESM-копии, а накопитель
 * `minotation-build` (CJS) создаёт инстанс из CJS-копии. Без общей метки
 * `instanceof` не узнал бы ошибку из чужой копии — и ошибка разбора стала бы
 * обычным исключением вместо предупреждения.
 */
const MN_PARSE_ERROR_BRAND = Symbol.for('minotation.MnParseError');

export class MnParseError extends Error {
  /** `instanceof` по метке, а не по прототипу — см. {@link MN_PARSE_ERROR_BRAND}. */
  static [Symbol.hasInstance](value: unknown): boolean {
    return !!value && (value as Record<symbol, unknown>)[MN_PARSE_ERROR_BRAND] === true;
  }

  declare readonly [MN_PARSE_ERROR_BRAND]: true;

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
      /**
       * Токен запрещён режимом `'strict'` и уже учтён для {@link MnForbiddenTokenError}
       * (D-039): ловящая сторона только обрывает разбор, в `warnings$` не кладёт.
       */
      forbidden?: boolean;
    }) {
    super(message);
    this.name = 'MnParseError';
    Object.defineProperty(
      this, MN_PARSE_ERROR_BRAND, {
        value: true,
      },
    );
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
/**
 * `'unregistered-state'` — имя состояния, которого нет ни в синонимах, ни в
 * `mn.states`, уходит в CSS КАК ЕСТЬ: псевдокласс может быть специфичен для
 * окружения или ещё не попасть в стандарт, поэтому браковать его нельзя.
 * Молчать тоже нельзя — `p10:fv` иначе даёт мёртвое правило `.p10\:fv:fv{…}`
 * без единого признака ошибки. Предупреждение не блокирует компиляцию, а
 * подсказывает завести синоним и писать одну каноническую форму.
 */
/**
 * `'raised-specificity'` (`*N`) и `'important'` (`-i`) — токен перебивает чужие стили
 * весом, а не составом: признак того, что компоненты дизайн-системы воюют между собой
 * (D-039). Управляются своими опциями ({@link MnOptions.specificityMode},
 * {@link MnOptions.importantMode}), `warningMode` на них не влияет.
 */
export type MnWarningType = 'parse-error' | 'max-depth-exceeded' | 'invalid-css-value'
  | 'unregistered-state' | 'raised-specificity' | 'important';

/** Что делать с токеном `*N` или `-i` (D-039). */
export type MnRaiseMode = 'warn' | 'silent' | 'strict';

/**
 * Бросается из {@link MnInstance.compile}, когда `warningMode: 'error'` и за цикл
 * компиляции накоплен хотя бы один {@link MnWarning}. Бросок происходит ПОСЛЕ основной
 * работы `compile` (генерация CSS уже завершена, вне try/catch парсинга токенов);
 * колбэк `onWarning` к этому моменту уже вызван для каждого предупреждения.
 */
export class MnWarningError extends Error {
  constructor(public readonly warnings: MnWarning[]) {
    super('MN: ' + warnings.length + ' warning(s) during compile (warningMode: \'error\'):\n'
      + warnings.map((w) => '  ' + w.token + ': ' + w.message).join('\n'));
    this.name = 'MnWarningError';
  }
}

/**
 * Бросается из {@link MnInstance.compile}, когда в режиме `'strict'`
 * ({@link MnOptions.specificityMode}, {@link MnOptions.importantMode}) встретился
 * запрещённый токен (D-039). Как и {@link MnWarningError} — после основной работы:
 * CSS собран, запрещённые токены в него не попали.
 */
export class MnForbiddenTokenError extends Error {
  constructor(public readonly tokens: MnWarning[]) {
    super('MN: ' + tokens.length + ' forbidden token(s):\n'
      + tokens.map((w) => '  ' + w.token + ': ' + w.message).join('\n'));
    this.name = 'MnForbiddenTokenError';
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
   * Что делать с предупреждением компиляции ({@link MnWarning}: ошибка разбора
   * токена, превышение `maxDepth` в режиме `'warn'`, битое CSS-значение) (D-035):
   * - `'log'` — печатать (`console.warn`; плагины сборщиков — в лог сборки);
   * - `'silent'` — молчать;
   * - `'error'` — после компиляции бросить {@link MnWarningError}: сборка падает.
   *
   * По умолчанию `'log'`: токены пользовательского кода часто пересекаются с
   * обычными CSS-классами, и `'error'` в общем случае ломал бы сборку на ложных
   * срабатываниях — включать там, где состав токенов контролируется.
   * @default 'log'
   */
  warningMode?: 'log' | 'silent' | 'error';
  /**
   * Колбэк на каждое предупреждение — дополнительно к `warningMode`: для своей
   * обработки (метрики, отчёт), не вместо режима.
   */
  onWarning?: (warning: MnWarning) => void;
  /**
   * Мягкий лимит глубины контекстных `<`/`>`-селекторов (`2Parent`, `3Child` и т.п.).
   * Не задан по умолчанию — действует только жёсткий потолок (см.
   * `MN_MAX_DEPTH_HARD_LIMIT` в `getCombinator.ts`, всегда 30, не настраивается).
   */
  maxDepth?: number;
  /**
   * Что делать при превышении {@link MnOptions.maxDepth} (D-039):
   * - `'warn'` — предупреждение с подсказкой, токен компилируется (глубина всё равно
   *   не превысит жёсткий потолок 30);
   * - `'silent'` — молчать;
   * - `'strict'` — токен не даёт CSS, `compile` бросает {@link MnForbiddenTokenError}.
   *
   * `warningMode` на этот случай не влияет.
   * @default 'warn'
   */
  maxDepthMode?: MnRaiseMode;
  /**
   * Токены с множителем `*N` (`f10*2` → `.f10\*2.f10\*2`) — накрутка специфичности
   * (D-039). Перебивать стили компонента весом селектора — признак того, что
   * компоненты дизайн-системы воюют между собой; переопределять токены компонента
   * надёжнее через `mne`/`mnClass`.
   * - `'warn'` — предупреждение с подсказкой (в консоль и в `onWarning`);
   * - `'silent'` — молчать;
   * - `'strict'` — токен не даёт CSS, `compile` бросает {@link MnForbiddenTokenError}.
   *
   * `warningMode` на этот случай не влияет.
   * @default 'warn'
   */
  specificityMode?: MnRaiseMode;
  /**
   * Токены с `-i` (`f10-i` → `!important`) — то же, что {@link specificityMode}, но
   * грубее: `!important` перебивает всё, включая то, чем управляет сам компонент.
   * Режимы те же. `warningMode` на этот случай не влияет.
   * @default 'warn'
   */
  importantMode?: MnRaiseMode;
  selectorPrefix?: string;
  /**
   * `true` — рядом с `rgba`-значением выводить запасное непрозрачное
   * объявление на случай браузера без поддержки `rgba`:
   * `color:#000;color:rgba(0,0,0,0)`.
   *
   * @default false. Раньше было включено, и каждый цвет с альфа-каналом давал ДВА
   * объявления вместо одного — лишний байт в выводе и неожиданный `#000`
   * там, где просили прозрачность. Запас нужен только для браузеров без
   * `rgba` (IE8 и старше), включать его сегодня осмысленно разве что
   * точечно.
   */
  altColor?: boolean;
}
