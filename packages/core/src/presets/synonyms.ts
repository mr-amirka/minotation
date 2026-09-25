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
  });
};
