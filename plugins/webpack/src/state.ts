/**
 * Shared state между loader и plugin.
 * Использует WeakMap по compiler-у для изоляции параллельных сборок.
 */
import type { Compiler } from 'webpack';
import type { MnInstance } from 'minotation';

/** Изолированный стейт одной webpack-сборки. */
export interface MnState {
  /** Все MN-токены, собранные лоадером из исходников. Не очищается между инкрементальными пересборками. */
  tokens: Set<string>;
  /** Динамические пресеты из *.mn.ts файлов, собранные preset-loader'ом. */
  dynamicPresets: Map<string, (mn: MnInstance) => void>;
}

const stateMap = new WeakMap<Compiler, MnState>();

/**
 * Возвращает стейт для данного компилятора. При первом вызове создаёт и сохраняет новый стейт.
 *
 * @param compiler - экземпляр webpack Compiler (ключ WeakMap)
 * @returns стейт с накопленными токенами
 */
export function getState(compiler: Compiler): MnState {
  let state = stateMap.get(compiler);
  if (!state) {
    state = { tokens: new Set(), dynamicPresets: new Map() };
    stateMap.set(compiler, state);
  }
  return state;
}
