// @ts-nocheck
/* eslint-disable */
/**
 * @overview MinimalistNotation preset "synonyms"
 * @author Amir Absaliamov <mr.amirka@ya.ru>
 */

export default (mn) => {
  // synonyms
  mn.synonyms({
    a: ':active',
    c: ':checked',
    d: ':disabled',
    f: ':focus',
    h: ':hover@mouse',
    i: ':(:-webkit-input-|:-moz-|-ms-input-|:)placeholder',
    even: ':nth-child\\(2n\\)',
    odd: ':nth-child\\(2n+1\\)',
    n: ':nth-child',
    first: ':first-child',
    last: ':last-child',
    only: ':only-child',
  });
};
