/**
 * Пресеты normalize — эталон один в один (D-108): каждое правило, его селектор, объявления и порядок — как в CSS из
 * npm (devDependencies-псевдонимы `normalize.css-X.Y.Z`, `modern-normalize-X.Y.Z`). Сравнение структурное
 * (css-tree): пробелы, кавычки в `[type="button"]` и запись `0.25em`/`.25em` не в счёт, остальное — в счёт.
 */
import {
  readFileSync,
} from 'fs';
import {
  generate,
  parse,
  walk,
} from 'css-tree';
import minotationProvider from '../../../core/index';
import presetHints from '../../hints';
import presetStandard from '../../standard';
import presetSynonyms from '../../synonyms';
import presetMedias from '../../medias';
import presetPrefixes from '../../prefixes';
import * as normalizePresets from '../index';
import type {
  MnPreset,
  MnPresetObject,
} from '../../../core/types';

const NORMALIZE = 'normalize.css';
const MODERN = 'modern-normalize';

/** Пресет → его эталон: пакет-псевдоним и файл в нём. */
const CASES: [name: string, preset: MnPresetObject, reference: string][] = [
  [
    'presetNormalize3_0_3',
    normalizePresets.presetNormalize3_0_3,
    NORMALIZE + '-3.0.3/' + NORMALIZE,
  ],
  [
    'presetNormalize4_2_0',
    normalizePresets.presetNormalize4_2_0,
    NORMALIZE + '-4.2.0/' + NORMALIZE,
  ],
  [
    'presetNormalize5_0_0',
    normalizePresets.presetNormalize5_0_0,
    NORMALIZE + '-5.0.0/' + NORMALIZE,
  ],
  [
    'presetNormalize6_0_0',
    normalizePresets.presetNormalize6_0_0,
    NORMALIZE + '-6.0.0/' + NORMALIZE,
  ],
  [
    'presetNormalize7_0_0',
    normalizePresets.presetNormalize7_0_0,
    NORMALIZE + '-7.0.0/' + NORMALIZE,
  ],
  [
    'presetNormalize8_0_1',
    normalizePresets.presetNormalize8_0_1,
    NORMALIZE + '-8.0.1/' + NORMALIZE,
  ],
  [
    'presetModernNormalize1_1_0',
    normalizePresets.presetModernNormalize1_1_0,
    MODERN + '-1.1.0/' + MODERN + '.css',
  ],
  [
    'presetModernNormalize2_0_0',
    normalizePresets.presetModernNormalize2_0_0,
    MODERN + '-2.0.0/' + MODERN + '.css',
  ],
  [
    'presetModernNormalize3_0_1',
    normalizePresets.presetModernNormalize3_0_1,
    MODERN + '-3.0.1/' + MODERN + '.css',
  ],
];

/** Правила CSS строками `селектор{свойство:значение;…}` — в порядке текста. */
function rules(css: string): string[] {
  const out: string[] = [];
  walk(parse(css), {
    visit: 'Rule',
    enter(node) {
      const declarations: string[] = [];
      node.block.children.forEach((d) => {
        d.type === 'Declaration' && declarations.push(d.property + ':' + generate(d.value).trim());
      });
      out.push(generate(node.prelude) + '{' + declarations.join(';') + '}');
    },
  });
  return out;
}

function compile(presets: MnPreset[]): string {
  const mn = minotationProvider({
    presets,
  });
  mn.compile();
  return mn.styles$.getValue().map((s) => s.content).join('');
}

describe('normalize presets reproduce their references exactly (D-108)', () => {
  test('nine presets, each named by its export', () => {
    expect(Object.keys(normalizePresets).sort()).toEqual(CASES.map((c) => c[0]).sort());
    CASES.forEach(([
      name,
      preset,
    ]) => {
      expect(preset.name).toBe(name);
      // Сырой `mn.css` — хендлеры не нужны: пресет работает один.
      expect(preset.requires).toBeUndefined();
    });
  });

  test.each(CASES)('%s', (
    _name, preset, reference,
  ) => {
    const expected = rules(readFileSync(require.resolve(reference), 'utf8'));
    expect(expected.length).toBeGreaterThan(10);
    expect(rules(compile([preset]))).toEqual(expected);
    // В обычном наборе — то же: хендлеры, синонимы, медиа и префиксы правил эталона не трогают.
    expect(rules(compile([
      presetHints,
      presetStandard,
      presetSynonyms,
      presetMedias,
      presetPrefixes,
      preset,
    ]))).toEqual(expected);
  });
});
