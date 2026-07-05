/**
 * Core types for Minimalist Notation.
 * See GLOSSARY.md and SPEC for term definitions.
 */

/** Подстрока до контекста: в `cF00<.p:h` стем — `cF00`. EN: stem. */
export interface Stem {
  /** Полная строка стема (`cF00`) */
  raw: string;
  /** Тег — начало стема, по которому выбирается обработчик (`c`) */
  tag: string;
  /**
   * Аргумент — продолжение стема после тега, без -i и без self-class суффиксов.
   * `cF.38` → `"F.38"`, `cF.active` → `"F"`, `cF.38.active` → `"F.38"`.
   */
  arg: string;
  /** Флаг !important (из аргумента -i до контекста) */
  important: boolean;
}

/** Медиа-выражение из контекстного сегмента */
export interface MediaSegment {
  /** Имя медиа */
  name: string;
}

/** Родительский сегмент: `<.parent` или `<1.parent` */
export interface ParentSegment {
  kind: 'parent';
  /** Числовой depth (0 = без числа), -1 для невалидных */
  depth: number;
  /** Тело CSS-селектора (`.parent`) */
  selector: string;
}

/** Дочерний сегмент: `>.child` или `>1.child` */
export interface ChildSegment {
  kind: 'child';
  depth: number;
  selector: string;
}

/** Сегмент состояния: `:hover`, `:nth-child[2]` */
export interface StateSegment {
  kind: 'state';
  /** Имя состояния (`hover`, `h` для синонимов) */
  name: string;
  /** Аргументы в квадратных скобках (`2` для `nth-child[2]`) */
  args: string | null;
}

/** Тип контекстного сегмента */
export type ContextSegment =
  | ParentSegment
  | ChildSegment
  | StateSegment;

/** Разобранная лексема */
export interface ParsedLexeme {
  /** Исходная строка лексемы */
  raw: string;
  /** Стем */
  stem: Stem;
  /**
   * Self-class условия — CSS-классы, которые элемент должен иметь одновременно
   * с токен-классом для применения правила. Это CSS-селекторный концерн, не аргумент обработчика.
   *
   * `cF.active`       → `[".active"]`    → `.cF\.active.active { color: #FFF }`
   * `cF.38.active`    → `[".active"]`    → `.cF\.38\.active.active { ... }`
   * `cF.active.hover` → `[".active", ".hover"]` → `.cF\.active\.hover.active.hover { ... }`
   * `cF+active`       → `["+active"]`    → `.cF\+active+active { ... }` (adjacent sibling)
   */
  selfClasses: string[];
  /** Медиа-имя из стема (до контекста) */
  stemMedia: string | null;
  /** Контекстные сегменты в порядке следования */
  context: ContextSegment[];
  /** Приоритетный множитель (`*2`), null если нет */
  multiplier: number | null;
}
