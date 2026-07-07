import {
  pushArray,
  slice,
} from 'fundamentool';
import type {
  AltEntry,
  AltMap,
} from './types';

export function joinMapsWithFirstValue(
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pushArray(tmp as any, slice(pv, 1));
    }
  }
  return output;
}

export function joinPrefixWithFirstValue(
  prefix: string,
  suffixes: AltMap,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
