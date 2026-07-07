/* eslint-disable */
import {
  escapedHalfProvider,
  escapedSplitProvider,
} from 'fundamentool';

const escSplit = escapedSplitProvider as any;
const escHalf = escapedHalfProvider as any;

export const splitParent = escSplit(/<|>\-/).base;
export const splitChild = escSplit(/>|<\-/).base;
export const splitMedia = escSplit('@').base;
export const splitState = escSplit(':').base;
export const splitComma = escSplit(',').base;
export const splitSelector = escSplit(/[<>:\.\[\]#+~]/, /\\.|[\.+]\d/).base;
export const extractSuffix = escHalf(/[<>:\.\[\]#+~@\!]/, /\\.|[\.+]\d/).base;

export const REGEXP_DEPTH = /^(\d+)(.*)$/;
export const REGEXP_MULTIPLIER = /^(.*)\*([0-9]+)$/;
export const REGEXP_SCOPE_SUFFIX = /^([A-Za-z0-9-_$]+)(.*)$/;
export const SCOPE_START = '[';
export const SCOPE_END = ']';
