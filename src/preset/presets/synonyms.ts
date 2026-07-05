import type {
  MnFn, 
} from '../MnInstance';

/**
 * Пресет синонимов состояний (из 1.x presets/synonyms.js).
 */
export function presetSynonyms(mn: MnFn): void {
  mn.setSynonyms({
    a: ':active',
    c: ':checked',
    d: ':disabled',
    f: ':focus',
    h: ':hover',
    even: ':nth-child(2n)',
    odd: ':nth-child(2n+1)',
    n: ':nth-child',
    first: ':first-child',
    last: ':last-child',
    only: ':only-child',
  });
}
