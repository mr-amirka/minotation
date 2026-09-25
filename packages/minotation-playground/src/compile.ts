/**
 * Живая компиляция превью: извлекает MN-токены из введённого HTML и
 * компилирует их в CSS свежим `minotationProvider`-инстансом — на каждое
 * изменение ввода, не по расписанию/дебаунсу ядра (дебаунс — в `App.tsx`,
 * на стороне ввода).
 */
import {
  minotationProvider,
  scanTokens,
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
} from 'minotation';
import type { MnInstance } from 'minotation';

export interface PresetOption {
  id: string;
  label: string;
  preset: (mn: MnInstance) => void;
}

export const PRESET_OPTIONS: PresetOption[] = [
  { id: 'standard', label: 'standard', preset: presetStandard },
  { id: 'synonyms', label: 'synonyms', preset: presetSynonyms },
  { id: 'medias', label: 'medias', preset: presetMedias },
  { id: 'normalize', label: 'normalize', preset: presetNormalize },
  { id: 'main', label: 'main', preset: presetMain },
];

export const DEFAULT_PRESET_IDS = ['standard', 'synonyms', 'medias'];

/**
 * @param html — содержимое левой панели (произвольный HTML с `class="..."`)
 * @param presetIds — id из {@link PRESET_OPTIONS}, выбранные пользователем
 * @returns CSS, скомпилированный из всех найденных в `html` токенов
 */
export function compilePreviewCss(html: string, presetIds: string[]): string {
  const tokens = scanTokens(html, { attr: 'class' });
  if (tokens.length === 0) return '';

  const mn = minotationProvider();
  const presets = PRESET_OPTIONS.filter((p) => presetIds.indexOf(p.id) !== -1).map((p) => p.preset);
  mn.setPresets(presets);

  const compile = mn.getCompiler('class');
  for (const token of tokens) compile(token);
  mn.compile();

  return mn.styles$.getValue()
    .map((s: { content: string }) => s.content)
    .join('\n');
}
