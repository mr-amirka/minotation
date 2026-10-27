/**
 * Реестр имён по доменам (D-063): ключ — первые строчные буквы, записи `[префикс, функция]`,
 * самый длинный префикс первым; статика — тоже функция. Отчёт `suspect-class` (D-065, D-066).
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import {
  __normalize,
} from '../core/utils';
import type {
  MnOptions,
  MnWarning,
} from '../core/types';
import type {
  MnInstance,
} from '../types';

function compile(
  tokens: string, setup: (mn: MnInstance) => void, options: MnOptions = {},
) {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    onWarning: (w) => warnings.push(w),
    ...options,
  });
  mn.setPresets([setup]);
  mn.getCompiler('class')(tokens);
  let error: unknown;
  try {
    mn.compile();
  } catch (ex) {
    error = ex;
  }
  return {
    css: mn.styles$.getValue().map((s) => s.content).join(''),
    warnings: warnings.map((w) => w.type + ': ' + w.message),
    error,
    mn,
  };
}

/** Пример владельца: `min-w` — хендлер, `min-w-full` — статика. */
function minWidth(mn: MnInstance) {
  mn(
    'min-w', (p) => (/^-\d+$/.test(p.suffix) ? {
      style: {
        minWidth: Number(p.suffix.slice(1)) * 4 + 'px',
      },
    } : undefined), '', 1,
  );
  mn('min-w-full', {
    style: {
      minWidth: '100%',
    },
  });
}

describe('устройство доменов', () => {
  test('ключ — первые строчные буквы, длинный префикс первым', () => {
    const {
      mn,
    } = compile('', (instance) => {
      minWidth(instance);
      instance('mA', {
        style: {
          margin: 'auto',
        },
      });
    });
    const domains = (mn as unknown as { domains: Record<string, Array<[string, unknown]>> }).domains;
    expect(domains.min.map((entry) => entry[0])).toEqual([
      '-w-full',
      '-w',
    ]);
    expect(domains.m.map((entry) => entry[0])).toEqual(['A']);
    expect(typeof domains.min[0][1]).toBe('function');
  });

  test('повторная регистрация заменяет запись с тем же префиксом', () => {
    expect(compile('x1', (mn) => {
      mn(
        'x', () => ({
          style: {
            color: 'red',
          },
        }), '', 1,
      );
      mn(
        'x', () => ({
          style: {
            color: 'blue',
          },
        }), '', 1,
      );
    }).css).toBe('.x1{color:blue}');
  });
});

describe('поиск (D-063)', () => {
  test.each([
    [
      'min-w-full',
      '.min-w-full{min-width:100%}',
    ],
    [
      'min-w-4',
      '.min-w-4{min-width:16px}',
    ],
  ])('%s → %s', (token, css) => {
    expect(compile(token, minWidth).css).toBe(css);
  });

  test('min-w-hm — запись -w нашлась, хендлер не разобрал: «нужно значение» (ответ 1)', () => {
    expect(compile('min-w-hm', minWidth).warnings).toEqual(['parse-error: "min-w-hm" produced no CSS: handler "min-w" needs a value here']);
  });

  test('min-w-fullx — статика с хвостом уступает хендлеру (ответ 2)', () => {
    expect(compile('min-w-fullx', minWidth).warnings).toEqual(['parse-error: "min-w-fullx" produced no CSS: handler "min-w" needs a value here']);
  });

  test('min-wide — префикс на букве не режет слово; записи "" нет — молча (ответ 3)', () => {
    expect(compile('min-wide', minWidth)).toMatchObject({
      css: '',
      warnings: [],
    });
  });

  test('префикс на заглавной букве тоже не режет слово: `bxC` не подходит к `bxCenter`', () => {
    expect(compile('bxC bxCenter', (mn) => {
      mn('bxC', {
        style: {
          boxSizing: 'content-box',
        },
      });
    })).toMatchObject({
      css: '.bxC{box-sizing:content-box}',
      warnings: [],
    });
  });

  test('префикс на дефисе подходит к слову (уточнение правила 3)', () => {
    expect(compile('text-muted text-x', (mn) => {
      mn(
        'text-', (p) => ({
          style: {
            content: '"' + p.suffix + '"',
          },
        }), '', 1,
      );
    }).css).toBe('.text-muted{content:"muted"}.text-x{content:"x"}');
  });

  test('статика не берёт минус Tailwind: -min-w-full уступает хендлеру -w, тот минус не принял — молча', () => {
    expect(compile(
      '-min-w-full', minWidth, {
        notationMode: 'tw4-compatible',
      },
    )).toMatchObject({
      css: '',
      warnings: [],
    });
  });

  test('__normalize: пустой вход — пустой выход (контракт экспортируемого помощника)', () => {
    expect(__normalize(undefined)).toBeUndefined();
    expect(__normalize(0)).toBe(0);
  });

  test('статика с !important — своя версия', () => {
    expect(compile('min-w-full-i', minWidth).css).toBe('.min-w-full-i{min-width:100%!important}');
  });
});

describe('suspect-class (D-065, D-066)', () => {
  // Пресет-объект подходит туда же, куда функция-пресет.
  const STANDARD = presetStandard as never;

  test("'warn' по умолчанию: CSS нет, warningMode 'error' сборку не роняет", () => {
    const {
      css, warnings, error,
    } = compile(
      'fw-bold fw7', STANDARD, {
        warningMode: 'error',
      },
    );
    expect(css).toBe('.fw7{font-weight:700}');
    expect(warnings).toEqual([
      'suspect-class: "fw-bold": "-bold" is not a value of "fw" — this looks like a class of another CSS'
        + ' framework, it gives no CSS. To hide this warning: suspectClassMode: \'silent\'; to forbid such'
        + ' classes: suspectClassMode: \'strict\'.',
    ]);
    expect(error).toBeUndefined();
  });

  test("'silent' — молча", () => {
    expect(compile(
      'sr-only', STANDARD, {
        suspectClassMode: 'silent',
      },
    )).toMatchObject({
      css: '',
      warnings: [],
    });
  });

  test("'strict' — брак сборки", () => {
    const {
      error,
    } = compile(
      'z-n1', STANDARD, {
        suspectClassMode: 'strict',
      },
    );
    expect((error as Error).name).toBe('MnForbiddenTokenError');
    expect((error as Error).message).toContain('(suspectClassMode: \'strict\')');
  });

  test('форма-карта mn({ … }) тоже под проверкой: d-flex', () => {
    expect(compile('d-flex', STANDARD).warnings[0]).toContain('suspect-class: "d-flex"');
  });

  test('настоящая ошибка в токене — parse-error, как раньше', () => {
    expect(compile('w10zz', STANDARD).warnings).toEqual(['parse-error: Unit "zz" is invalid']);
  });

  test('неверное значение опции — ошибка', () => {
    expect(() => minotationProvider({
      suspectClassMode: 'warning' as never,
    })).toThrow('suspectClassMode');
  });
});

describe('& в селекторе эссенции — сам элемент (D-069)', () => {
  test(':where(&>…) — элемент внутри :where, нулевая специфичность', () => {
    expect(compile('sx1', (mn) => {
      mn(
        'sx', () => ({
          selectors: [
            ':where\\(&>:not\\(:last-child\\)\\)',
            '>b',
          ],
          style: {
            color: 'red',
          },
        }), '', 1,
      );
    }).css).toBe(':where(.sx1>:not(:last-child)),.sx1>b{color:red}');
  });
});
