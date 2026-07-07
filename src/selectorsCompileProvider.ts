/* eslint-disable */
import {
  escapeCss,
  escapeQuote,
  escapedHalfProvider,
  escapedSplitProvider,
  extend,
  filter,
  indexOf,
  joinComma,
  joinOnly,
  map,
  mapIn,
  push,
  pushArray,
  reduce,
  reduceIn,
  repeat,
  scopeSplit as scopeSplitFn,
  slice,
  unslash,
  variants,
} from 'fundamentool';
import {
  selectorNormalize,
} from './selectorNormalize';

type StrMap<T> = Record<string, T>;
type AltEntry = [number, string];
type AltMap = StrMap<AltEntry[]>;

function variantsBase(comboName: string): string[] {
  return variants(comboName)[0];
}

const escSplit = escapedSplitProvider as any;
const escHalf = escapedHalfProvider as any;
const splitParent = escSplit(/<|>\-/).base;
const splitChild = escSplit(/>|<\-/).base;
const splitMedia = escSplit('@').base;
const splitState = escSplit(':').base;
const splitComma = escSplit(',').base;
const splitSelector = escSplit(/[<>:\.\[\]#+~]/, /\\.|[\.+]\d/).base;
const extractSuffix = escHalf(/[<>:\.\[\]#+~@\!]/, /\\.|[\.+]\d/).base;
const REGEXP_DEPTH = /^(\d+)(.*)$/;
const REGEXP_MULTIPLIER = /^(.*)\*([0-9]+)$/;
const REGEXP_SCOPE_SUFFIX = /^([A-Za-z0-9-_$]+)(.*)$/;
const SCOPE_START = '[';
const SCOPE_END = ']';


function mediaFilterIteratee(mediaNames: string[]): string {
  const excludes: string[] = [];
  const mainMedia = mediaNames.shift() as string;
  mediaNames = filter(mediaNames, (mediaName: string): boolean => {
    return !!(mediaName && indexOf(excludes, mediaName) < 0
      && push(excludes, mediaName));
  });
  return mainMedia
    ? (map(splitComma(mainMedia), (m: string) => {
      return (pushArray([m], mediaNames) as string[]).join('&');
    }) as string[]).join(',')
    : mediaNames.join('&');
}

export function getCombinatorByDepth(depth: number): string {
  return depth < 1 ? '' : ('>' + repeat('*>', depth - 1));
}

export function getCombinator(name: string): [string, string] {
  const depthMatchs = REGEXP_DEPTH.exec(name);
  return depthMatchs
    ? [getCombinatorByDepth(parseInt(depthMatchs[1])), depthMatchs[2] || '']
    : [' ', name];
}

export function extractMedia(mediaNames: string[], partName: string): string {
  const separators: string[] = [];
  return partName
    ? joinOnly(reduce(
      splitSelector(partName, separators),
      (
        output: string[], selector: string, index: number,
      ) => {
        const mediaParts = splitMedia(selector);
        push(output, mediaParts[0] + (separators[index] || ''));
        mediaParts.length > 1 && push(mediaNames as any, unslash(mediaParts[1]));
        return output;
      },
      [],
    ))
    : '';
}

function suffixesReduce(suffixes: StrMap<StrMap<number>>,
  altComboName: string): StrMap<StrMap<number>> {
  const extract = extractSuffix(altComboName);
  const suffix = selectorNormalize(extract[1]);
  (suffixes[suffix] || (suffixes[suffix] = {} as StrMap<number>))[unslash(extract[0])] = 1;
  return suffixes;
}

function joinMapsWithFirstValue(
  prefixes: AltMap,
  suffixes: AltMap,
  separator?: string,
  end?: string,
): AltMap {
  const sep = separator || '';
  const e = end || '';
  const output: AltMap = {};
  let prefix: string;
  let suffix: string;
  let pv: AltEntry[];
  let p: string;
  let tmp: AltEntry[];
  for (prefix in prefixes) {
    pv = prefixes[prefix];
    p = prefix + sep;
    for (suffix in suffixes) {
      tmp = output[p + suffix + e] = slice(suffixes[suffix]);
      tmp[0] = pv[0] || tmp[0];
      pushArray(tmp as any, slice(pv, 1));
    }
  }
  return output;
}

function joinPrefixWithFirstValue(
  prefix: string,
  suffixes: AltMap,
  pv: any,
): AltMap {
  const output: AltMap = {};
  let suffix: string;
  let tmp: AltEntry[];
  for (suffix in suffixes) {
    tmp = output[prefix + suffix] = slice(suffixes[suffix]);
    tmp[0] = pv || tmp[0];
  }
  return output;
}


type ParseComboNameFn = (comboName: string, targetName?: string) => Array<[StrMap<number>, AltMap]>;

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
        return push(items, [essences, mapIn(reduce(childs, childsIteratee as any, first), mediaFilterIteratee as any)]);
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
    base(scopeSplitFn(
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
