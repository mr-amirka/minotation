/**
 * Типы `selectorsCompileProvider/` — разбор MN-комбо-имён в карту CSS-селекторов.
 *
 * @module types
 */

/** Обобщённая строковая карта — сокращение для `Record<string, T>`. */
export type StrMap<T> = Record<string, T>;

/**
 * Одна медиа-привязка альтернативного селектора: `[приоритет, имя медиа]`.
 * Приоритет — числовой ранг для сортировки при генерации CSS (`0`/`undefined`, если не задан).
 */
export type AltEntry = [number, string];

/** Карта CSS-селектор → список его медиа-альтернатив (`AltEntry[]`). */
export type AltMap = StrMap<AltEntry[]>;

/**
 * Функция разбора одного MN-комбо-имени (значения `class`/`id`/произвольного атрибута).
 *
 * @param comboName — исходное имя (например `w50:hover`)
 * @param targetName — готовый CSS-селектор-цель (`.w50`, `#id`, `[attr~="..."]`);
 *   не задан внутри рекурсивного разбора `childs`/`parents`
 * @returns массив пар `[карта имён эссенций → 1, карта селектор → медиа-альтернативы]` —
 *   по одной паре на каждый уникальный набор суффиксов (`variants()` разворачивает `(a|b)`)
 */
export type ParseComboNameFn = (comboName: string, targetName?: string) => Array<[StrMap<number>, AltMap]>;
