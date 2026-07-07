/* eslint-disable */
import {
  escapeCss,
  escapeQuote,
  extend,
  mapIn,
  push,
  reduce,
  reduceIn,
  repeat,
  scopeSplit,
  unslash,
  variants,
} from 'fundamentool';
import {
  selectorNormalize,
} from '../selectorNormalize';
import type {
  AltMap,
  ParseComboNameFn,
  StrMap,
} from './types';
import {
  extractSuffix,
  REGEXP_MULTIPLIER,
  REGEXP_SCOPE_SUFFIX,
  SCOPE_END,
  SCOPE_START,
  splitChild,
  splitParent,
  splitState,
} from './constants';
import {
  extractMedia,
} from './extractMedia';
import {
  getCombinator,
} from './getCombinator';
import {
  joinMapsWithFirstValue,
  joinPrefixWithFirstValue,
} from './joinMaps';

function variantsBase(comboName: string): string[] {
  return variants(comboName)[0];
}

function suffixesReduce(suffixes: StrMap<StrMap<number>>,
  altComboName: string): StrMap<StrMap<number>> {
  const extract = extractSuffix(altComboName);
  const suffix = selectorNormalize(extract[1]);
  (suffixes[suffix] || (suffixes[suffix] = {} as StrMap<number>))[unslash(extract[0])] = 1;
  return suffixes;
}

export function selectorsCompileProvider(instance?: ParseComboNameFn) {
  let $$states: StrMap<string[]>;
  let $$synonyms: StrMap<AltMap>;

  const $$parsers: StrMap<ParseComboNameFn> = {
    'id': parseId,
    'class': parseClass,
  };

  function parseComboNameProvider(attrName: string): ParseComboNameFn {
    return $$parsers[attrName]
      || ($$parsers[attrName] = parseAttrProvider(attrName));
  }

  function parseId(comboName: string): ReturnType<ParseComboNameFn> {
    return parseComboName(comboName, '#' + escapeCss(comboName));
  }

  function parseClass(comboName: string): ReturnType<ParseComboNameFn> {
    return parseComboName(comboName, '.' + escapeCss(comboName));
  }

  function parseAttrProvider(attrName: string): ParseComboNameFn {
    const prefix = '[' + attrName + '~="';
    return (comboName: string) => parseComboName(comboName,
      prefix + escapeQuote(comboName) + '"]');
  }

  function childsIteratee(alts: AltMap, childName: string): AltMap {
    const part = getCombinator(childName);
    return joinMapsWithFirstValue(
      alts,
      getParents(
        part[1], 0 as any, '*',
      ),
      part[0],
    );
  }

  function parseComboName(comboName: string,
    targetName: string): Array<[StrMap<number>, AltMap]> {
    $$states = (instance as any).states || {};
    $$synonyms = (instance as any)._synonyms || {};

    let multiplierMatch: RegExpExecArray | null;
    let name = comboName;
    let tgt = targetName;
    let multiplier: number;

    multiplierMatch = REGEXP_MULTIPLIER.exec(name);
    if (multiplierMatch) {
      name = multiplierMatch[1];
      multiplier = parseInt(multiplierMatch[2]);
      if (multiplier > 1) {
        tgt = repeat(tgt, multiplier);
      }
    }

    const suffixes = reduceIn(
        variantsBase(name), suffixesReduce, {} as StrMap<StrMap<number>>,
      );
    return (reduceIn as any)(
      suffixes,
      (items: Array<[StrMap<number>, AltMap]>, essences: StrMap<number>, suffix: string) => {
        const childs = splitChild(suffix as any as string);
        const first = getParents(
          childs.shift(), tgt, '',
        );
        return push(items, [essences, mapIn(reduce(childs, childsIteratee as any, first), extractMedia as any)]);
      },
      [],
    );
  }

  function getParents(
    name: string,
    targetName: string,
    alt: string,
  ): AltMap {
    const parts = splitParent(name);
    const l = parts.length;
    let i = 1;
    let mediaNames: string[] = [];
    let essence = getEssence(extractMedia(mediaNames, parts[0]));
    let alts = joinPrefixWithFirstValue(
      ((targetName || '') + essence[0]) || alt,
      essence[1],
      mediaNames[0],
    );
    let part: [string, string];

    for (; i < l; i++) {
      mediaNames = [];
      part = getCombinator(extractMedia(mediaNames, parts[i]));
      essence = getEssence(part[1]);
      alts = joinMapsWithFirstValue(
        joinPrefixWithFirstValue(
          essence[0] || '*',
          essence[1],
          mediaNames[0],
        ),
        alts,
        part[0],
      );
    }
    return alts;
  }

  function getSynonyms(value: string): AltMap {
    let alts: AltMap = {
      '': [], 
    };
    base(scopeSplit(
      value, SCOPE_START, SCOPE_END,
    ), 1);
    return alts;

    function base(scopes: any, hasTop: number): void {
      const scopesL = scopes.length;
      let scopesI = 0;
      let scope: any;
      let state: string;
      let _state: string;
      let states: string[];
      let childs: any;
      let ns: string[];
      let si: number;
      let statesL: number;
      let statesI: number;
      let head: string;
      let matches: RegExpExecArray | null;
      let suffix: string;
      let synonyms: AltMap;

      for (; scopesI < scopesL; scopesI++) {
        scope = scopes[scopesI];
        states = splitState(scope[0]);
        head = states.shift();
        if (head) {
          _pushSuffix(head);
        }
        statesL = states.length;
        statesI = 0;

        for (; statesI < statesL; statesI++) {
          _state = state = unslash(states[statesI]);
          matches = REGEXP_SCOPE_SUFFIX.exec(_state);
          if (matches) {
            state = matches[1];
            suffix = matches[2];
          } else {
            suffix = '';
          }

          synonyms = $$synonyms[state];
          if (synonyms) {
            alts = joinMapsWithFirstValue(
              alts, synonyms, 0 as any, suffix,
            );
          } else {
            ns = $$states[state];
            if (ns && (si = ns.length)) {
              synonyms = {};
              for (; si--;) {
                synonyms[ns[si] + suffix] = [];
              }
              alts = joinMapsWithFirstValue(alts, synonyms);
            } else {
              _pushSuffix(':' + _state);
            }
          }
        }

        childs = scope[1];
        if (childs) {
          _pushSuffix(hasTop ? '(' : '[');
          base(childs, 0);
          _pushSuffix(hasTop ? ')' : ']');
        }
      }
    }

    function _pushSuffix(suffix: string): void {
      const prefixes = alts;
      let prefix: string;
      alts = {};
      for (prefix in prefixes) {
        alts[prefix + suffix] = prefixes[prefix];
      }
    }
  }

  function getEssence(name: string): [string, AltMap] {
    const i = name.indexOf(':');
    return i < 0
      ? [name, {
        '': [], 
      }]
      : [unslash(name.substr(0, i)), getSynonyms(name.substr(i))];
  }

  return extend(instance || (instance = parseComboName as ParseComboNameFn),
    {
      states: {} as StrMap<string[]>,
      parseComboName,
      parseComboNameProvider,
      parseId,
      parseClass,
    });
}
