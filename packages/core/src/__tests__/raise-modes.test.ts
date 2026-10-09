/**
 * Режимы для токенов, перебивающих стили весом (D-039): `specificityMode` (`*N`) и
 * `importantMode` (`-i`) — `'warn' | 'silent' | 'strict'`, по умолчанию `'warn'`;
 * `warningMode` на них не влияет.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import {
  MnForbiddenTokenError,
} from '../core/types';
import type {
  MnOptions, MnWarning,
} from '../core/types';
import {
  selectorsCompileProvider,
} from '../selectorsCompileProvider';
import {
  childSelectorMessage, importantMessage, maxDepthMessage, specificityMessage,
} from '../selectorsCompileProvider/raiseMessages';

// Экземпляр ядра нетипизирован снаружи (`checkByAttrs`, `recompile`), как в core-api.test.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
const SPECIFICITY_WARN = specificityMessage('*2', false);
const SPECIFICITY_STRICT = specificityMessage('*2', true);
const IMPORTANT_WARN = importantMessage(false);
const IMPORTANT_STRICT = importantMessage(true);

/** Компилирует токены; возвращает CSS, предупреждения и брошенную ошибку. */
function run(tokens: string, options: MnOptions = {}) {
  const warnings: MnWarning[] = [];
  const mn: any = minotationProvider({
    onWarning: (w) => warnings.push(w),
    ...options,
  });
  mn.setPresets([presetStandard]);
  mn.checkByAttrs(tokens, 'class');
  let error: unknown;
  try {
    mn.compile();
  } catch (ex) {
    error = ex;
  }
  return {
    css: mn.styles$.getValue().map((s: { content: string }) => s.content).join(''),
    warnings,
    error,
    mn,
  };
}

let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
});

describe('specificityMode — множитель *N', () => {
  test('по умолчанию warn: CSS есть, предупреждение с подсказкой — в консоль и onWarning', () => {
    const {
      css, warnings, error, 
    } = run('f10*2');
    expect(error).toBeUndefined();
    expect(css).toContain('.f10\\*2.f10\\*2{');
    expect(warnings).toEqual([{
      type: 'raised-specificity',
      token: 'f10*2',
      message: SPECIFICITY_WARN,
    }]);
    expect(warn).toHaveBeenCalledWith('[minotation] f10*2: ' + SPECIFICITY_WARN);
  });

  test('*1 — не накрутка: молчим', () => {
    const {
      warnings, 
    } = run('f10*1');
    expect(warnings).toEqual([]);
  });

  test('silent: CSS есть, ни слова', () => {
    const {
      css, warnings, 
    } = run('f10*2', {
      specificityMode: 'silent',
    });
    expect(css).toContain('.f10\\*2.f10\\*2{');
    expect(warnings).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  test('strict: токен не даёт CSS, compile бросает ошибку с инструкцией; остальное собрано', () => {
    const {
      css, warnings, error, mn, 
    } = run('f10*2 p10', {
      specificityMode: 'strict',
    });
    expect(error).toBeInstanceOf(MnForbiddenTokenError);
    expect((error as Error).message).toBe('MN: 1 forbidden token(s):\n  f10*2: ' + SPECIFICITY_STRICT);
    expect((error as MnForbiddenTokenError).tokens.map((t) => t.token)).toEqual(['f10*2']);
    expect(css).not.toContain('f10');
    expect(css).toContain('padding:10px');
    expect(warnings).toEqual([]);
    // Повторный разбор того же токена не дублирует его в ошибке.
    expect(() => mn.recompile()).toThrow('MN: 1 forbidden token(s)');
  });
});

describe('importantMode — -i', () => {
  test('по умолчанию warn', () => {
    const {
      css, warnings, 
    } = run('f10-i');
    expect(css).toContain('!important');
    expect(warnings).toEqual([{
      type: 'important',
      token: 'f10-i',
      message: IMPORTANT_WARN,
    }]);
  });

  test('-i внутри группы вариантов тоже виден', () => {
    const {
      warnings, 
    } = run('(p|m)10-i');
    expect(warnings.map((w) => w.type)).toEqual(['important']);
  });

  test('silent', () => {
    const {
      warnings, 
    } = run('f10-i', {
      importantMode: 'silent',
    });
    expect(warnings).toEqual([]);
  });

  test('strict', () => {
    const {
      css, error, 
    } = run('f10-i', {
      importantMode: 'strict',
    });
    expect((error as Error).message).toBe('MN: 1 forbidden token(s):\n  f10-i: ' + IMPORTANT_STRICT);
    expect(css).not.toContain('!important');
  });

  test('*N и -i в одном токене — два независимых сообщения', () => {
    const {
      warnings, 
    } = run('f10-i*2');
    expect(warnings.map((w) => w.type)).toEqual(['raised-specificity', 'important']);
  });
});

describe('warningMode на эти режимы не влияет', () => {
  test('warningMode: silent не глушит предупреждение', () => {
    const {
      warnings, 
    } = run('f10*2', {
      warningMode: 'silent',
    });
    expect(warnings.map((w) => w.type)).toEqual(['raised-specificity']);
    expect(warn).toHaveBeenCalledWith('[minotation] f10*2: ' + SPECIFICITY_WARN);
  });

  test('warningMode: error не роняет сборку из-за warn-режимов', () => {
    const {
      error, warnings, 
    } = run('f10*2 f12-i p10<5.a', {
      warningMode: 'error',
      maxDepth: 2,
    });
    expect(error).toBeUndefined();
    expect(warnings.map((w) => w.type).sort())
      .toEqual([
        'important',
        'max-depth-exceeded',
        'raised-specificity',
      ]);
  });

  test('warningMode: error по-прежнему роняет на обычных предупреждениях', () => {
    const {
      error, 
    } = run('f10*2 p10px10', {
      warningMode: 'error',
    });
    expect((error as Error).name).toBe('MnWarningError');
    expect((error as Error).message).not.toContain('f10*2');
  });

  test('maxDepthMode: silent', () => {
    const {
      warnings, css, 
    } = run('p10<5.a', {
      maxDepth: 2,
      maxDepthMode: 'silent',
    });
    expect(warnings).toEqual([]);
    expect(css).toContain('padding:10px');
  });
});

describe('selectorsCompileProvider без ядра', () => {
  test('*N, -i и превышение глубины ни на что не влияют', () => {
    const instance: any = Object.assign(() => undefined, {
      options: {
        maxDepth: 1,
      },
    });
    const scp: any = selectorsCompileProvider(instance);
    expect(scp.parseClass('f10-i*2<3.a').length).toBeGreaterThan(0);
  });
});

describe('childSelectorMode — дочерний селектор > (D-041)', () => {
  const CHILD_WARN = childSelectorMessage('>1', false);
  const CHILD_STRICT = childSelectorMessage('>.child', true);

  test('по умолчанию warn: CSS есть, предупреждение с подсказкой', () => {
    const {
      css, warnings, 
    } = run('cF00>1');
    expect(css).toContain('color:#f00');
    expect(warnings).toEqual([{
      type: 'child-selector',
      token: 'cF00>1',
      message: CHILD_WARN,
    }]);
  });

  test('silent', () => {
    const {
      warnings, 
    } = run('cF00>1', {
      childSelectorMode: 'silent',
    });
    expect(warnings).toEqual([]);
  });

  test('strict: токен не даёт CSS, compile бросает ошибку с инструкцией', () => {
    const {
      css, error, 
    } = run('cF00>.child p10', {
      childSelectorMode: 'strict',
    });
    expect((error as Error).message).toBe('MN: 1 forbidden token(s):\n  cF00>.child: ' + CHILD_STRICT);
    expect(css).not.toContain('color:#f00');
    expect(css).toContain('padding:10px');
  });

  test('контекст предков < не затрагивается', () => {
    const {
      warnings, 
    } = run('cF00<.parent');
    expect(warnings).toEqual([]);
  });

  test('warningMode: error из-за дочернего селектора не падает', () => {
    const {
      error, 
    } = run('cF00>1', {
      warningMode: 'error',
    });
    expect(error).toBeUndefined();
  });
});

describe('тексты сообщений — нейтральный тон (замечание владельца 2026-10-09)', () => {
  test.each([
    [specificityMessage('*2', false), 'Specificity is raised ("*2") — this may mean that component styles override'
      + ' each other. To hide this warning: specificityMode: \'silent\'; to forbid such tokens: specificityMode: \'strict\'.'],
    [specificityMessage('*2', true), 'Raising specificity ("*2") is forbidden (specificityMode: \'strict\'), the token'
      + ' gives no CSS. To allow it: specificityMode: \'warn\'.'],
    [importantMessage(false), '"!important" is used ("-i") — this may mean that component styles override each other.'
      + ' To hide this warning: importantMode: \'silent\'; to forbid such tokens: importantMode: \'strict\'.'],
    [importantMessage(true), '"!important" ("-i") is forbidden (importantMode: \'strict\'), the token gives no CSS.'
      + ' To allow it: importantMode: \'warn\'.'],
    [maxDepthMessage(
      5, 2, false,
    ), 'Context selector depth 5 exceeds maxDepth 2 — styles depend on a long chain of'
      + ' ancestors, which may make the markup harder to change. To allow such depth: raise maxDepth;'
      + ' to hide this warning: maxDepthMode: \'silent\'; to forbid such tokens: maxDepthMode: \'strict\'.'],
    [maxDepthMessage(
      5, 3, true,
    ), 'Context selector depth 5 exceeds maxDepth 3 (maxDepthMode: \'strict\'), the token'
      + ' gives no CSS. To allow such tokens: raise maxDepth or set maxDepthMode: \'warn\'.'],
    [childSelectorMessage('>h2', false), 'Styles are applied to child elements (">h2") — this may indicate that the'
      + ' design architecture could be improved. To hide this warning: childSelectorMode: \'silent\';'
      + ' to forbid such tokens: childSelectorMode: \'strict\'.'],
    [childSelectorMessage('>h2', true), 'Styles for child elements (">h2") are forbidden (childSelectorMode: \'strict\'),'
      + ' the token gives no CSS. To allow them: childSelectorMode: \'warn\'.'],
  ])('%s', (actual, expected) => {
    expect(actual).toBe(expected);
  });
});
