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
