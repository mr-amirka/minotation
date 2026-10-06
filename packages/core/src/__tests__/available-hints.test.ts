/**
 * Подсказка с допустимыми записями в сообщении об ошибке (2026-10-06).
 *
 * Владелец: «было бы гораздо лучше, еслиб мне сразу тут же сообщалось, какие
 * аббревиатуры для этого обработчика вообще есть, чтобы я лишний раз не лез в
 * отдельный справочник». Поводом стал `aiSB` — у `align-items` нет `space-between`.
 */
import {
  minotationProvider,
} from '../index';
import presetStandard from '../presets/standard';
import presetSynonyms from '../presets/synonyms';
import presetMedias from '../presets/medias';
import type {
  MnWarning,
} from '../core/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function compile(token: string): { css: string;
  warnings: MnWarning[] } {
  const warnings: MnWarning[] = [];
  const mn: any = minotationProvider({
    onWarning: (w: MnWarning) => {
      warnings.push(w);
    },
  });
  mn.setPresets([
    presetStandard,
    presetSynonyms,
    presetMedias,
  ]);
  mn.getCompiler('class')(token);
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s: { content: string }) => s.content).join(''),
    warnings,
  };
}

/** Токены из хвоста `. Available: aiC (center), aiFE (flex-end)`. */
function suggestions(message: string): string[] {
  const at = message.indexOf('. Available: ');
  return at < 0 ? [] : message.slice(at + 13).split(', ').map((item) => item.split(' (')[0]);
}

describe('подсказка: какие записи у хендлера есть', () => {
  test('сокращения — с расшифровкой', () => {
    const message = compile('aiSB').warnings[0].message;
    expect(message).toContain('no such abbreviation');
    expect(message).toContain('Available: aiC (center)');
    expect(message).toContain('aiFE (flex-end)');
  });

  test('число у закрытого перечня — тоже со списком', () => {
    expect(compile('d10').warnings[0].message).toContain('Available: dB (block)');
  });

  test('перечисление — в записи нотации и без алиасов', () => {
    const message = compile('irQ').warnings[0].message;
    expect(message).toContain('Available: ');
    expect(suggestions(message)).toContain('irCrispEdges');
    // `optimizespeed` — алиас `optimizeSpeed`: в подсказке только каноническое.
    expect(suggestions(message)).not.toContain('irOptimizespeed');
    const unique = new Set(suggestions(message));
    expect(unique.size).toBe(suggestions(message).length);
  });

  test('сторож: каждый предложенный токен сам компилируется без предупреждений', () => {
    const mn: any = minotationProvider();
    mn.setPresets([
      presetStandard,
      presetSynonyms,
      presetMedias,
    ]);
    const bad: string[] = [];
    let suggested = 0;
    for (const name of Object.keys(mn.handlerMap)) {
      for (const probe of ['Qqz', '10']) {
        for (const warning of compile(name + probe).warnings) {
          for (const token of suggestions(warning.message)) {
            suggested++;
            const result = compile(token);
            (result.css && !result.warnings.length) || bad.push(token);
          }
        }
      }
    }
    expect(suggested).toBeGreaterThan(1000);
    expect(bad).toEqual([]);
  });
});
