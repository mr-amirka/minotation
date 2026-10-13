/**
 * `defineScale` — общая шкала отступов и размеров для пресетов-клонов (D-059): все
 * сочетания «свойство × сторона», слова статикой, ведущий `-` для отрицательных.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import {
  defineScale,
} from '../presets/scale';
import type {
  MnScaleOptions,
} from '../presets/scale';
import type {
  MnNotationMode, MnWarning,
} from '../core/types';
import type {
  MnInstance,
} from '../types';

const TAILWIND: MnScaleOptions = {
  properties: {
    m: 'margin',
  },
  sides: {
    '': [''],
    t: ['top'],
    x: ['left', 'right'],
  },
  scale: (step) => step * 0.25 + 'rem',
  keywords: {
    auto: 'auto',
    px: '1px',
  },
  negative: true,
  arbitrary: true,
};

function compile(
  tokens: string, options: MnScaleOptions, notationMode?: MnNotationMode,
) {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    notationMode,
    onWarning: (w) => warnings.push(w),
  });
  mn.setPresets([(instance: MnInstance) => {
    defineScale(instance, options);
  }]);
  mn.getCompiler('class')(tokens);
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s) => s.content).join(''),
    warnings: warnings.map((w) => w.message),
  };
}

describe('шкала-функция (Tailwind)', () => {
  test.each([
    ['mt-4', '.mt-4{margin-top:1rem}'],
    ['m-1', '.m-1{margin:0.25rem}'],
    ['mx-2.5', '.mx-2\\.5{margin-left:0.625rem;margin-right:0.625rem}'],
    ['mx-auto', '.mx-auto{margin-left:auto;margin-right:auto}'],
    ['mt-px', '.mt-px{margin-top:1px}'],
    ['-mt-4', '.-mt-4{margin-top:-1rem}'],
    ['-mx-2', '.-mx-2{margin-left:-0.5rem;margin-right:-0.5rem}'],
    ['-mt-px', '.-mt-px{margin-top:-1px}'],
    ['-mt-0', '.-mt-0{margin-top:-0rem}'],
  ])('%s → %s', (token, css) => {
    // Ведущий минус — запись Tailwind (D-064), поэтому режим `'tw4-compatible'`.
    expect(compile(
      token, TAILWIND, 'tw4-compatible',
    ).css).toBe(css);
    expect(compile(
      token, TAILWIND, 'tw4-compatible',
    ).warnings).toEqual([]);
  });

  test('в записи minotation -mt-4 — не токен: молча', () => {
    expect(compile('-mt-4', TAILWIND)).toEqual({
      css: '',
      warnings: [],
    });
  });

  test.each([
    ['mt-[37px]', '.mt-\\[37px\\]{margin-top:37px}'],
    ['mx-[calc(1rem_+_2px)]', '.mx-\\[calc\\(1rem_\\+_2px\\)\\]{margin-left:calc(1rem + 2px);margin-right:calc(1rem + 2px)}'],
    ['-mt-[var(--gap)]', '.-mt-\\[var\\(--gap\\)\\]{margin-top:calc(var(--gap) * -1)}'],
    ['mt-[a\\_b]', '.mt-\\[a\\\\_b\\]{margin-top:a_b}'],
  ])("произвольное значение в 'tw4-compatible': %s", (token, css) => {
    expect(compile(
      token, TAILWIND, 'tw4-compatible',
    ).css).toBe(css);
  });

  test.each([
    ['mt-', '"mt-": expects a step of the scale'],
    ['mt-4x', '"mt-4x": step "4x" is not a number'],
    ['mt-[]', '"mt-[]": step "[]" is not a number'],
  ])('%s — предупреждение', (token, message) => {
    const result = compile(
      token, TAILWIND, 'tw4-compatible',
    );
    expect(result.css).toBe('');
    expect(result.warnings).toEqual([message]);
  });

  test('-mx-auto — у слова нет отрицания: предупреждение', () => {
    expect(compile(
      '-mx-auto', TAILWIND, 'tw4-compatible',
    )).toEqual({
      css: '',
      warnings: ['"mx-auto": "auto" has no negative value'],
    });
  });
});

describe('шкала-карта (Bootstrap) и разделитель', () => {
  const BOOTSTRAP: MnScaleOptions = {
    properties: {
      p: 'padding',
    },
    sides: {
      t: ['top'],
    },
    scale: {
      0: '0',
      1: '.25rem',
      3: '1rem',
      v: 'var(--gap)',
    },
  };

  test.each([
    ['pt-3', '.pt-3{padding-top:1rem}'],
    ['pt-0', '.pt-0{padding-top:0}'],
    ['pt-v', '.pt-v{padding-top:var(--gap)}'],
  ])('%s → %s', (token, css) => {
    expect(compile(token, BOOTSTRAP).css).toBe(css);
  });

  test('шаг карты с !important — через хендлер (статика без -i)', () => {
    expect(compile(
      'pt-3!', BOOTSTRAP, 'tw4-compatible',
    ).css).toBe('.pt-3\\!{padding-top:1rem!important}');
    expect(compile(
      'mt-4!', TAILWIND, 'tw4-compatible',
    ).css).toBe('.mt-4\\!{margin-top:1rem!important}');
  });

  test('шаг вне карты — предупреждение со списком шагов', () => {
    expect(compile('pt-7', BOOTSTRAP).warnings).toEqual(['"pt-7": step "7" is not in the scale (0, 1, 3, v)']);
  });

  test('без negative ведущий - — CSS нет, молча (D-064)', () => {
    expect(compile(
      '-pt-3', BOOTSTRAP, 'tw4-compatible',
    )).toEqual({
      css: '',
      warnings: [],
    });
  });

  test('отрицание не числа — calc', () => {
    expect(compile(
      '-pt-v', {
        ...BOOTSTRAP,
        negative: true,
      }, 'tw4-compatible',
    ).css).toBe('.-pt-v{padding-top:calc(var(--gap) * -1)}');
    expect(compile(
      '-pt-0', {
        ...BOOTSTRAP,
        negative: true,
      }, 'tw4-compatible',
    ).css).toBe('.-pt-0{padding-top:0}');
  });

  test("separator: '' (Basscss mt2) и стороны по умолчанию", () => {
    expect(compile('p2', {
      properties: {
        p: 'padding',
      },
      separator: '',
      scale: (step) => step * 8 + 'px',
    }).css).toBe('.p2{padding:16px}');
  });
});

describe('ведущий - у обычных хендлеров не меняет поведение', () => {
  test('-p10 со стандартным пресетом — чужой класс, молча', () => {
    const warnings: MnWarning[] = [];
    const mn = minotationProvider({
      onWarning: (w) => warnings.push(w),
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')('-p10');
    mn.compile();
    expect(mn.styles$.getValue().map((s) => s.content).join('')).not.toContain('padding');
    expect(warnings).toEqual([]);
  });
});

describe('проверка опций (D-038)', () => {
  test.each([
    [{
      ...TAILWIND,
      negativ: true,
    }, 'unknown option "negativ". Did you mean "negative"?'],
    [{
      ...TAILWIND,
      scale: 4,
    }, 'option "scale" expects a function (step) => value or an object of strings, got number 4'],
    [{
      ...TAILWIND,
      scale: {
        1: 4,
      },
    }, 'option "scale" expects a function (step) => value or an object of strings'],
    [{
      ...TAILWIND,
      properties: {
        m: 1,
      },
    }, 'option "properties" expects an object of strings'],
    [{
      ...TAILWIND,
      sides: {
        t: 'top',
      },
    }, 'option "sides" expects an object of non-empty string arrays'],
    [{
      ...TAILWIND,
      sides: {
        t: [],
      },
    }, 'option "sides" expects an object of non-empty string arrays'],
    [{
      scale: TAILWIND.scale,
    }, 'option "properties" is required'],
    [{
      properties: TAILWIND.properties,
    }, 'option "scale" is required'],
  ])('%j — ошибка', (options, message) => {
    const mn = minotationProvider();
    expect(() => defineScale(mn, options as never)).toThrow(message);
  });

  test('без опций — ошибка', () => {
    expect(() => defineScale(minotationProvider(), undefined as never)).toThrow('option "properties" is required');
  });
});
