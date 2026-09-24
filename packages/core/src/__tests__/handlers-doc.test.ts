/**
 * HANDLERS.md — документация соответствия «токен → CSS». Здесь она проверяется
 * против реальной компиляции: таблицы разбираются автоматически, поэтому новая
 * строка в документе сразу становится тестом, а расхождение документации
 * с поведением ядра — падением, а не молчаливым дрейфом.
 */
import {
  readFileSync, 
} from 'fs';
import {
  join, 
} from 'path';
import {
  minotationProvider, 
} from '../core/index';
import presetStandard from '../presets/standard';
import presetSynonyms from '../presets/synonyms';
import presetMedias from '../presets/medias';
import presetNormalize from '../presets/normalize';
import presetMain from '../presets/main';

/** Пара «токен → ожидаемые CSS-объявления» из таблиц HANDLERS.md. */
type DocPair = [token: string, declarations: string[]];

function parseDocPairs(): DocPair[] {
  const md = readFileSync(join(__dirname, '../../HANDLERS.md'), 'utf-8');
  const rows = md.match(/^\|\s*`[^`]+`\s*\|\s*`[^`]+`.*$/gm) || [];
  const pairs: DocPair[] = [];

  for (const row of rows) {
    const m = row.match(/^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`/);
    if (!m) {
      continue;
    }
    const [
      , token,
      css,
    ] = m;
    // строки-справочники вида «| `10em` | `10em` |» (таблица единиц) — не токены
    if (token === css || !css.includes(':')) {
      continue;
    }
    pairs.push([token, css.split(';').map((d) => d.trim()).filter(Boolean)]);
  }
  return pairs;
}

function compileAll(tokens: string[]): string {
  const mn = minotationProvider();
  mn.setPresets([
    presetStandard,
    presetSynonyms,
    presetMedias,
    presetNormalize,
    presetMain,
  ]);
  const compile = mn.getCompiler('class');
  for (let i = 0; i < tokens.length; i++) {
    compile(tokens[i]);
  }
  mn.compile();
  return mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
}

describe('HANDLERS.md — документированные токены компилируются как задокументировано', () => {
  const pairs = parseDocPairs();

  test('таблицы документации разобраны', () => {
    expect(pairs.length).toBeGreaterThan(100);
  });

  test.each(pairs)('%s', (token, declarations) => {
    const css = compileAll([token]);
    for (const declaration of declarations) {
      expect(css).toContain(declaration);
    }
  });
});
