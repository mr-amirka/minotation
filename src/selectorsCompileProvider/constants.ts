/**
 * Разделители и регэкспы грамматики MN-комбо-имён (общие для всего `selectorsCompileProvider/`).
 *
 * `escapedSplitProvider(sep, escaped?)` — фабрика сплиттера, уважающего экранирование:
 * фрагменты, подходящие под `escaped`, не считаются разделителем и возвращаются как есть
 * (после `unslash`). `escapedHalfProvider` — аналогично, но делит строку только на
 * `[prefix, suffix, value]` по ПЕРВОМУ вхождению разделителя.
 *
 * @module constants
 */
import {
  escapedHalfProvider,
  escapedSplitProvider,
} from 'fundamentool';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const escSplit = escapedSplitProvider as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const escHalf = escapedHalfProvider as any;

/** Разделяет по `<` — родительский комбинатор (`Child<Parent` → `['Child', 'Parent']`). */
export const splitParent = escSplit(/</).base;
/** Разделяет по `>` — комбинатор прямого потомка. */
export const splitChild = escSplit(/>/).base;
/** Разделяет по `@` — медиа-суффикс (`sel@mobile` → `['sel', 'mobile']`). */
export const splitMedia = escSplit('@').base;
/** Разделяет по `:` — состояния/псевдоклассы (`w50:hover` → `['w50', 'hover']`). */
export const splitState = escSplit(':').base;
/** Разделяет по `,` — списки альтернатив (`sm,md` → `['sm', 'md']`). */
export const splitComma = escSplit(',').base;
/**
 * Разделяет по любому из `< > : . [ ] # + ~` — границы селектора внутри одного combo-имени.
 * Исключение (2-й аргумент): `\.` (экранированная точка) и `.`/`+` перед цифрой
 * (десятичные/знаковые значения вроде `f1.5em`, `+3`) разделителем не считаются.
 *
 * Символьный класс — `[<>:.[\]#+~]`, с экранированной `]` (иначе она закрывает класс
 * раньше времени и `#+~` уходят из класса в буквальный литерал вне его — баг, внесённый
 * при конвертации v1 `.js`→`.ts` из `[<>:\.\[\]#+~]`, из-за которого класс почти никогда
 * не матчился; найден и исправлен 2026-08-10).
 */
export const splitSelector = escSplit(/[<>:.[\]#+~]/, /\\.|[.+]\d/).base;
/**
 * Делит имя на `[префикс, суффикс-с-разделителем, значение]` по ПЕРВОМУ вхождению
 * `< > : . [ ] # + ~ @ !`. Те же исключения на экранирование/десятичные значения, что
 * у {@link splitSelector}. Используется для отделения имени эссенции от хвоста селектора.
 * Та же экранировка `]`, что у {@link splitSelector} — см. её комментарий про баг миграции.
 */
export const extractSuffix = escHalf(/[<>:.[\]#+~@!]/, /\\.|[.+]\d/).base;

/** Ведущие цифры = глубина вложенности комбинатора, остаток — имя (`'2Parent'` → `['2Parent', '2', 'Parent']`). */
export const REGEXP_DEPTH = /^(\d+)(.*)$/;
/** Хвостовой множитель `*N` — повтор селектора N раз (`'myClass*3'` → `['...', 'myClass', '3']`). */
export const REGEXP_MULTIPLIER = /^(.*)\*([0-9]+)$/;
/** Имя состояния/scope + произвольный суффикс после него (используется в `getSynonyms`). */
export const REGEXP_SCOPE_SUFFIX = /^([A-Za-z0-9-_$]+)(.*)$/;
/** Открывающая граница вложенного scope в значении синонима, см. `scopeSplit` в `getSynonyms`. */
export const SCOPE_START = '[';
/** Закрывающая граница вложенного scope в значении синонима, см. `scopeSplit` в `getSynonyms`. */
export const SCOPE_END = ']';
