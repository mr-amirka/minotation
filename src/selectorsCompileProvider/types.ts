/* eslint-disable */
export type StrMap<T> = Record<string, T>;
export type AltEntry = [number, string];
export type AltMap = StrMap<AltEntry[]>;
export type ParseComboNameFn = (comboName: string, targetName?: string) => Array<[StrMap<number>, AltMap]>;
