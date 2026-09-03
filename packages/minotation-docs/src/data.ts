/**
 * Живая компиляция примеров — как в старом `old/mn-docs/src/data.js`: не
 * храним ожидаемый CSS текстом, а реально прогоняем каждый токен через
 * `minotationProvider` с текущим набором пресетов прямо в браузере при
 * старте приложения. Если что-то в ядре сломается — сайт документации
 * покажет пустой CSS, а не устаревшую подпись.
 */
import {
  minotationProvider,
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
} from 'minotation';
import { ESSENCES, MnDocEntry } from './essences';

export interface CompiledExample {
  token: string;
  html: string;
  css: string;
}

export interface DocEntry extends MnDocEntry {
  compiled: CompiledExample[];
}

function compileToken(token: string): string {
  const mn = minotationProvider();
  mn.setPresets([presetStandard, presetSynonyms, presetMedias, presetNormalize, presetMain]);
  const compile = mn.getCompiler('class');
  compile(token);
  mn.compile();
  return mn.styles$.getValue()
    .map((s: { content: string }) => s.content)
    .join('\n');
}

export const DATA: DocEntry[] = ESSENCES.map((entry) => ({
  ...entry,
  compiled: entry.examples.map((token) => ({
    token,
    html: `<div className="${token}">...</div>`,
    css: compileToken(token) || '/* не даёт CSS */',
  })),
})).sort((a, b) => a.name.localeCompare(b.name));
