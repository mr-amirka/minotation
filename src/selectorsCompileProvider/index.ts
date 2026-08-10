/**
 * Публичный barrel `selectorsCompileProvider/` — разбор MN-комбо-имён
 * (значений `class`/`id`/атрибутов) в карту CSS-селекторов с медиа-привязками.
 *
 * Основная точка входа — {@link selectorsCompileProvider}; остальное — утилиты,
 * переиспользуемые и вне провайдера (`getCombinator`, `extractMedia`). `joinMaps.ts`
 * (`joinMapsWithFirstValue`/`joinPrefixWithFirstValue`) и `scopeSplit2.ts` (порт
 * `mn-utils/scopeSplit2` из v1, см. его module-doc) сюда не реэкспортированы —
 * используются только внутри `selectorsCompileProvider.ts`.
 *
 * @module selectorsCompileProvider/index
 */
export {
  getCombinatorByDepth,
  getCombinator,
} from './getCombinator';
export {
  extractMedia,
  mediaFilterIteratee,
} from './extractMedia';
export {
  selectorsCompileProvider,
} from './selectorsCompileProvider';
export type {
  StrMap,
  AltEntry,
  AltMap,
  ParseComboNameFn,
} from './types';
