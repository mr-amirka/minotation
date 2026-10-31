import {
  minotationProvider,
} from '../../core/index';
import presetStandard from '../../presets/standard';
import type {
  MnWarning,
} from '../../core/types';

/**
 * Компилирует токены одним экземпляром с `presetStandard`.
 *
 * @param tokens — токены, как их пишут в разметке
 * @returns CSS всех правил и предупреждения компиляции
 */
export function compile(tokens: string[]): { css: string;
  warnings: MnWarning[] } {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    onWarning: (w: MnWarning) => warnings.push(w),
  });
  mn.setPresets([presetStandard]);
  const c = mn.getCompiler('class');
  const tokensLength = tokens.length;
  for (let i = 0; i < tokensLength; i++) {
    c(tokens[i]);
  }
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n'),
    warnings,
  };
}
