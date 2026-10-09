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
      message: 'presetHints[typos]: "t0" gives no CSS — did you mean "st0"?',
    }), expect.objectContaining({
      type: 'hint',
      token: 'l10',
      message: 'presetHints[typos]: "l10" gives no CSS — did you mean "sl10"?',
    })]);
  });

  test('класс другой системы — эквивалент в нотации, kebab тоже', () => {
    const {
      warnings, 
    } = run('flex text-center justify-content-between');
    expect(warnings.map((w) => w.message)).toEqual([
      'presetHints[tailwind]: "flex" gives no CSS — in minotation it is "dF"',
      'presetHints[bootstrap, tailwind]: "text-center" gives no CSS — in minotation it is "taC"',
      'presetHints[bootstrap]: "justify-content-between" gives no CSS — in minotation it is "jcSB"',
    ]);
  });

  test('класс без известного эквивалента — общая подсказка', () => {
    const {
      warnings, 
    } = run('text-muted');
    expect(warnings.map((w) => w.message)).toEqual(['presetHints[bootstrap, tailwind]: "text-muted" gives no CSS — it looks like a class of another CSS framework,'
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
    expect((error as Error).message).toContain('presetHints[typos]: "t0" gives no CSS');
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
      equivalents.push([name + suffix, HINTS.equivalents[name][suffix][0]]);
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

describe('presetHints — фабрика: исключения групп и обработчиков (D-042)', () => {
  test('excludeGroups: подсказка молчит, если исключена хоть одна её группа', () => {
    const {
      warnings, css, 
    } = run('text-center flex justify-content-between t0', [presetHints({
      excludeGroups: ['bootstrap'],
    }), ...STANDARD]);
    // text-center — и Bootstrap, и Tailwind: Bootstrap подключён, значит класс работает.
    expect(warnings.map((w) => w.token)).toEqual(['flex', 't0']);
    expect(hasOwnRule(css, 'text-center')).toBe(false);
  });

  test('excludeGroups: typos — ловушки опечаток не регистрируются', () => {
    const {
      warnings, 
    } = run('t0 l0 flex', [presetHints({
      excludeGroups: ['typos'],
    }), ...STANDARD]);
    expect(warnings.map((w) => w.token)).toEqual(['flex']);
  });

  test('excludeHandlers: обработчик не регистрируется', () => {
    const {
      warnings, 
    } = run('flex text-center t0', [presetHints({
      excludeHandlers: ['text', 't'],
    }), ...STANDARD]);
    expect(warnings.map((w) => w.token)).toEqual(['flex']);
  });

  test('фабрика без опций — как пресет', () => {
    const {
      warnings, 
    } = run('flex', [presetHints({}), ...STANDARD]);
    expect(warnings.map((w) => w.token)).toEqual(['flex']);
  });

  test('неизвестная группа — ошибка с ближайшей и перечнем', () => {
    expect(() => presetHints({
      excludeGroups: ['bootsrap' as never],
    })).toThrow('[minotation] presetHints: unknown value "bootsrap" in "excludeGroups". Did you mean "bootstrap"?'
      + ' Known groups: typos, tailwind, bootstrap');
  });

  test('неизвестный обработчик без похожих — перечень', () => {
    expect(() => presetHints({
      excludeHandlers: ['container'],
    })).toThrow('[minotation] presetHints: unknown value "container" in "excludeHandlers". Known handlers: '
      + HINTS.handlers.join(', '));
  });

  test('неизвестная опция и не тот тип — ошибка проверки опций', () => {
    expect(() => presetHints({
      exclude: ['bootstrap'],
    } as never)).toThrow('[minotation] presetHints: unknown option "exclude".');
    expect(() => presetHints({
      excludeGroups: 'bootstrap',
    } as never)).toThrow('option "excludeGroups" expects an array of strings, got string "bootstrap"');
  });
});
