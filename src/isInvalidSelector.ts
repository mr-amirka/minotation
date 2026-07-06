// @ts-nocheck
/* eslint-disable */
const regexpInvalid = /\.[[\]#.*^$()><+~=|:,"'`\s@%\!\/0-9]/g;
const regexpInQuotesAndEscaped = /("[^"]*"|'[^']*'|\\.)/g;

function isInvalidSelector(selector) {
  return regexpInvalid.test(selector.replace(regexpInQuotesAndEscaped, ''));
}

export {
  isInvalidSelector,
};
