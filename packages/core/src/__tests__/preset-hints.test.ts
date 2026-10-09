/**
 * Пресет подсказок `presetHints` (D-024): опечатки и классы других систем дают
 * предупреждение `'hint'` с эквивалентом вместо молчания.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import presetSynonyms from '../presets/synonyms';
import presetMedias from '../presets/medias';
import presetMain from '../presets/main';
import presetHints, {
  HINTS,
} from '../presets/hints';
import type {
  MnOptions, MnWarning,
} from '../core/types';
import type {
  MnInstance,
} from '../types';

const STANDARD = [
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetMain,
];

/** Компилирует токены; возвращает собственные правила токенов и предупреждения. */
function run(
  tokens: string, presets = [presetHints, ...STANDARD], options: MnOptions = {},
) {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    onWarning: (w) => warnings.push(w),
    ...options,
  });
  mn.setPresets(presets);
  mn.getCompiler('class')(tokens);
  let error: unknown;
  try {
    mn.compile();
  } catch (ex) {
    error = ex;
  }
  return {
    css: mn.styles$.getValue().map((s) => s.content).join(''),
    warnings,
    error,
  };
}

/** Есть ли в CSS собственное правило токена (а не только базовые стили пресетов). */
function hasOwnRule(css: string, token: string): boolean {
  return css.indexOf('.' + token + '{') > -1 || css.indexOf(',.' + token + '{') > -1;
}

describe('presetHints — подсказки', () => {
  test('опечатка t0 → st0, l10 → sl10; CSS нет', () => {
    const {
      css, warnings, 
    } = run('t0 l10');
    expect(hasOwnRule(css, 't0')).toBe(false);
    expect(warnings).toEqual([expect.objectContaining({
      type: 'hint',
      token: 't0',
      message: 'presetHints: "t0" gives no CSS — did you mean "st0"?',
    }), expect.objectContaining({
      type: 'hint',
      token: 'l10',
      message: 'presetHints: "l10" gives no CSS — did you mean "sl10"?',
    })]);
  });

  test('класс другой системы — эквивалент в нотации, kebab тоже', () => {
    const {
      warnings, 
    } = run('flex text-center justify-content-between');
    expect(warnings.map((w) => w.message)).toEqual([
      'presetHints: "flex" gives no CSS — in minotation it is "dF"',
      'presetHints: "text-center" gives no CSS — in minotation it is "taC"',
      'presetHints: "justify-content-between" gives no CSS — in minotation it is "jcSB"',
    ]);
  });

  test('класс без известного эквивалента — общая подсказка', () => {
    const {
      warnings, 
    } = run('text-muted');
    expect(warnings.map((w) => w.message)).toEqual(['presetHints: "text-muted" gives no CSS — it looks like a class of another CSS framework,'
        + ' and minotation has no such token']);
  });

  test('без пресета — по-прежнему молча', () => {
    const {
      warnings, 
    } = run('t0 flex text-center', STANDARD);
    expect(warnings).toEqual([]);
  });

  test('пресет ниже, зарегистрировавший то же имя, перекрывает подсказку', () => {
    const own = (mn: MnInstance) => mn('flex', () => ({
      style: {
        display: 'flex',
      },
    }));
    const {
      css, warnings, 
    } = run('flex', [
      presetHints,
      ...STANDARD,
      own,
    ]);
    expect(warnings).toEqual([]);
    expect(hasOwnRule(css, 'flex')).toBe(true);
  });

  test('kebab-суффикс у обычного хендлера по-прежнему пропускается молча', () => {
    const {
      warnings, 
    } = run('mt-auto sr-only');
    expect(warnings).toEqual([]);
  });

  test('подсказка подчиняется warningMode: error роняет сборку', () => {
    const {
      error, 
    } = run(
      't0', [presetHints, ...STANDARD], {
        warningMode: 'error',
      },
    );
    expect((error as Error).name).toBe('MnWarningError');
    expect((error as Error).message).toContain('presetHints: "t0" gives no CSS');
  });
});

describe('presetHints — таблицы', () => {
  const names = Object.keys(HINTS.equivalents).concat(Object.keys(HINTS.typos));

  test.each(names)('имя "%s" не занято стандартными пресетами', (name) => {
    // Иначе пресет подсказок перекрыл бы его или был бы перекрыт — подсказка мертва.
    const {
      css, 
    } = run(name, STANDARD);
    expect(hasOwnRule(css, name)).toBe(false);
  });

  const equivalents: Array<[string, string]> = [];
  let name: string;
  let suffix: string;
  for (name in HINTS.equivalents) { // eslint-disable-line
    for (suffix in HINTS.equivalents[name]) { // eslint-disable-line
      equivalents.push([name + suffix, HINTS.equivalents[name][suffix]]);
    }
  }

  test.each(equivalents)('"%s" → "%s": эквивалент компилируется', (_, equivalent) => {
    const {
      css, warnings, 
    } = run(equivalent);
    expect(warnings).toEqual([]);
    for (const token of equivalent.split(' ')) {
      expect(hasOwnRule(css, token)).toBe(true);
    }
  });

  test.each(Object.keys(HINTS.typos))('опечатка "%s": исправление компилируется', (typo) => {
    const {
      css, 
    } = run(HINTS.typos[typo] + '0');
    expect(hasOwnRule(css, HINTS.typos[typo] + '0')).toBe(true);
  });
});
