/* eslint-disable */
const REGEXP_INVALID = /\.[[\]#.*^$()><+~=|:,"'`\s@%\!\/0-9]/g;
const REGEXP_IN_QUOTES_AND_ESCAPED = /("[^"]*"|'[^']*'|\\.)/g;

export function isInvalidSelector(selector: string): boolean {
  return REGEXP_INVALID.test(selector.replace(REGEXP_IN_QUOTES_AND_ESCAPED, ''));
}
