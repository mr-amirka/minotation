/**
 * Публичные типы движка Minimalist Notation.
 */

/**
 * Обработчик стиля: принимает разобранный стем и возвращает CSS-правила.
 *
 * @example
 * const handler: StyleHandler = (c) => ({
 *   style: { padding: c.arg + 'px' },
 * });
 */
export type StyleHandler = (stem: {
  /** Тег лексемы (`p`, `bg`, `fx`) */
  tag: string;
  /** Аргумент после тега (`10`, `F00`, `Center`) */
  arg: string;
  /** Полная строка стема (`p10`, `bgF00`) */
  raw: string;
}) => StyleResult;

/**
 * Результат, возвращаемый обработчиком стиля.
 */
export interface StyleResult {
  /** CSS-свойства в camelCase */
  style: Record<string, string>;
  /**
   * Расширение: теги других эссенций, чьи стили добавляются отдельными
   * CSS-блоками с тем же селектором (аналог `@extend`).
   *
   * @example
   * return { style: { color: '#F00' }, exts: 'bold italic' };
   */
  exts?: string;
  /**
   * Примесь: теги других эссенций, чьи стили сливаются в текущий блок
   * (аналог `@include` / `@mixin`).
   */
  include?: string;
  /**
   * Дополнительные статические CSS-селекторы, для которых генерируются
   * те же стили, что и для основного класса.
   * @example
   * return { style: { position: 'relative' }, selectors: ['.rlv'] };
   * // Генерирует .myClass{position:relative} и .rlv{position:relative}
   */
  selectors?: string[];
  /**
   * Связанные дочерние эссенции, генерируемые в контексте данной.
   * При использовании родительской эссенции — автоматически генерируется
   * CSS для дочерних эссенций с соответствующими селекторами.
   * @example
   * mn('tbl', () => ({ style: { display: 'table' }, childs: ['tbl.cell'] }))
   */
  childs?: string[];
  /** Приоритет блока в итоговом CSS (меньше = раньше). */
  priority?: number;
}

/**
 * Определение медиа-контекста.
 * Либо `query` (CSS @media), либо `selector` (например, `.safari`).
 */
export interface MediaDef {
  /** CSS media-query, например `'(max-width: 991px)'` */
  query?: string;
  /** CSS-селектор-обёртка вместо @media (для UA-detect) */
  selector?: string;
  /** Приоритет группы в итоговом CSS (меньше = раньше) */
  priority?: number;
}

/**
 * Скомпилированный CSS-блок, возвращаемый через `styles$`.
 */
export interface StyleBlock {
  /** Ключ блока: `'media.all'`, `'media.m'`, `'keyframes.fadeIn'`, … */
  name: string;
  /** Приоритет сортировки (меньше = раньше в итоговом файле) */
  priority: number;
  /** Сырой CSS-текст блока */
  content: string;
  /** Монотонно возрастающий счётчик компиляций */
  revision: number;
}

/**
 * Опции конструктора `MnInstance` / фабрики `createMn`.
 */
export interface MnOptions {
  /**
   * Глобальный CSS-префикс для всех генерируемых селекторов.
   * @example selectorPrefix: '.scope' → `.scope .p10 { … }`
   */
  selectorPrefix?: string;
  /**
   * Карта именованных медиа-контекстов.
   * @example media: { m: { query: '(max-width: 991px)', priority: 0 } }
   */
  media?: Record<string, MediaDef>;
  /**
   * CSS-свойства (camelCase), для которых нужны вендорные префиксы.
   * @example prefixedAttrs: { transform: 1, userSelect: 1 }
   */
  prefixedAttrs?: Record<string, number>;
  /**
   * Вендорные префиксы для `prefixedAttrs`.
   * @example prefixes: { '-webkit-': 1, '-moz-': 1 }
   */
  prefixes?: Record<string, number>;
  /** Вызывается при ошибке парсинга/компиляции токена (вместо throw). */
  onError?: (err: Error) => void;
}
