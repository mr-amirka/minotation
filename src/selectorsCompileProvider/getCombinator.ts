import {
  repeat,
} from 'fundamentool';
import {
  REGEXP_DEPTH,
} from './constants';

export function getCombinatorByDepth(depth: number): string {
  return depth < 1 ? '' : ('>' + repeat('*>', depth - 1));
}

export function getCombinator(name: string): [string, string] {
  const depthMatchs = REGEXP_DEPTH.exec(name);
  return depthMatchs
    ? [getCombinatorByDepth(parseInt(depthMatchs[1])), depthMatchs[2] || '']
    : [' ', name];
}
