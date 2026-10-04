/**
 * D-021: хендлер найден, но стиля не дал — предупреждение, а не тишина.
 *
 * Найдено на `affiliate` (TariffRow): `fx>1` собирался зелёным, а стиля не было —
 * у `fx` нет значения по умолчанию. Тем же молчанием страдали ещё 52 хендлера
 * (`ta`, `op`, `ff`, `fxd`…), поэтому проверка общая, в ядре, а не в каждом.
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

describe('хендлер без стиля — предупреждение (D-021)', () => {
  test.each([
    ['fx', 'fx'],
    ['fx>1', 'fx'],
    ['ta', 'ta'],
  ])('%s → parse-error', (token, handler) => {
    const {
      css, warnings,
    } = compile(token);
    expect(css).toBe('');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('parse-error');
    expect(warnings[0].handler).toBe(handler);
    expect(warnings[0].message).toMatch(/produced no CSS/);
  });

  test.each([
    ['fx1>1', '.fx1\\>1>*{flex:1}'],
    ['w', '.w{width:100%}'],
    ['p', '.p{padding:0}'],
  ])('%s — значение по умолчанию есть, предупреждения нет', (token, expected) => {
    const {
      css, warnings,
    } = compile(token);
    expect(css).toContain(expected);
    expect(warnings).toEqual([]);
  });

  test('чужой класс без хендлера по-прежнему молчит', () => {
    expect(compile('container')).toEqual({
      css: '',
      warnings: [],
    });
  });

  test('сторож: ни один хендлер без значения не пропадает молча', () => {
    const mn: any = minotationProvider();
    mn.setPresets([
      presetStandard,
      presetSynonyms,
      presetMedias,
    ]);
    const silent = Object.keys(mn.handlerMap).filter((name) => {
      if (!/^[a-z]/.test(name)) {
        return false;
      }
      const result = compile(name);
      return !result.css && !result.warnings.length;
    });
    expect(silent).toEqual([]);
  });
});
