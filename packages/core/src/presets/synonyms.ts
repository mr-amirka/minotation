import {
  MnInstance,
} from '../types';

/**
 * @overview MinimalistNotation preset "synonyms"
 * @author Amir Absaliamov <amir.absolutely@gmail.com>
 */

export default (mn: MnInstance) => {
  // synonyms
  mn.synonyms({
    a: ':active',
    c: ':checked',
    d: ':disabled',
    f: ':focus',
    // Обычный `:hover`, без привязки к типу указателя: современные устройства
    // обрабатывают его корректно. Кому нужно ограничить hover устройствами
    // с указателем — media-контекст `mouse` есть в `presetMedias`, и это
    // пишется явно: `bgF00:h@mouse`.
    h: ':hover',
    i: ':(:-webkit-input-|:-moz-|-ms-input-|:)placeholder',
    even: ':nth-child\\(2n\\)',
    odd: ':nth-child\\(2n+1\\)',
    n: ':nth-child',
    first: ':first-child',
    last: ':last-child',
    only: ':only-child',

    // Имя состояния, которого здесь нет, всё равно попадёт в CSS — но с
    // предупреждением `unregistered-state`: псевдокласс может быть специфичен
    // для окружения или ещё не быть в стандарте, поэтому браковать его нельзя.
    // Ходовые заведены ниже, чтобы предупреждение указывало на опечатки,
    // а не на штатную запись.
    //
    // Ключи — строчные, как `even`/`odd`/`first`: пространство имён состояний
    // отдельно от тегов хендлеров, коллизий с ними нет.

    // фокус
    fv: ':focus-visible',
    fw: ':focus-within',

    // ссылки и навигация
    v: ':visited',
    link: ':link',
    al: ':any-link',
    t: ':target',

    // содержимое и корень
    e: ':empty',
    root: ':root',

    // формы
    r: ':required',
    opt: ':optional',
    ro: ':read-only',
    rw: ':read-write',
    // Полными словами: они читаются лучше любого сокращения.
    invalid: ':invalid',
    valid: ':valid',
    ir: ':in-range',
    oor: ':out-of-range',
    ps: ':placeholder-shown',
    ind: ':indeterminate',
    def: ':default',
    af: ':autofill',

    // структурные
    fot: ':first-of-type',
    lot: ':last-of-type',
    oot: ':only-of-type',
    nt: ':nth-of-type',
    nl: ':nth-last-child',
    nlt: ':nth-last-of-type',

    // Функциональные псевдоклассы: ключ намеренно совпадает с именем — это
    // штатный синтаксис нотации (`p10:not[.a]`), предупреждать о нём не о чем.
    // `not` НЕЛЬЗЯ занимать другим значением: сломается разбор `:not[…]`.
    not: ':not',
    is: ':is',
    where: ':where',
    has: ':has',
  });
};
