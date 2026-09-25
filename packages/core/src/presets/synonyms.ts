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
    // Просто `:hover`, без обёртки в `@mouse`. 2026-09-17 сюда был скопирован
    // v1-вариант `:hover@mouse` (hover только на устройствах с указателем) —
    // владелец указал 2026-09-25, что в v1 это было сделано осознанно ПРОСТО
    // как `hover`, а современные устройства отрабатывают его корректно сами.
    // Кому нужна привязка к указателю — media-контекст `mouse` никуда не делся
    // (`presetMedias`), и токен пишется явно: `bgF00:h@mouse`.
    h: ':hover',
    i: ':(:-webkit-input-|:-moz-|-ms-input-|:)placeholder',
    even: ':nth-child\\(2n\\)',
    odd: ':nth-child\\(2n+1\\)',
    n: ':nth-child',
    first: ':first-child',
    last: ':last-child',
    only: ':only-child',

    // Добавлено 2026-09-25. Повод: неизвестное имя состояния уходит в CSS как
    // есть (осознанно — псевдокласс может быть специфичен для окружения или
    // ещё не быть в стандарте), но теперь сопровождается предупреждением
    // `unregistered-state`. Чтобы предупреждение указывало на реальные
    // опечатки, а не на штатные псевдоклассы, ходовые заведены здесь.
    //
    // Ключи — строчные, как у `even`/`odd`/`first`: это пространство имён
    // состояний, отдельное от тегов хендлеров, коллизий с ними нет.

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
    // Ключ совпадает с именем: владелец 2026-09-25 — «`:invalid` и `:valid`
    // лучше оставить как есть, так они явно лучше читаемы». Сокращения `inv`
    // и `vld` были заметно менее очевидны, чем сами слова.
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

    // Функциональные псевдоклассы — ключ совпадает с именем намеренно:
    // это штатный синтаксис нотации (`p10:not[.a]`), и предупреждать о нём
    // не о чем. Занимать `not` чем-то другим НЕЛЬЗЯ — сломается разбор.
    not: ':not',
    is: ':is',
    where: ':where',
    has: ':has',
  });
};
