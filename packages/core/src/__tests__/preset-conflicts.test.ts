/**
 * `handlerConflictMode` и `presetConflictMode` (D-067): одно имя от двух пресетов и пресеты
 * несовместимых экосистем.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import presetMedias from '../presets/medias';
import presetHints from '../presets/hints';
import type {
  MnOptions, MnPreset, MnPresetObject, MnWarning,
} from '../core/types';
import type {
  MnInstance,
} from '../types';

function connect(presets: MnPreset[], options: MnOptions = {}) {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    onWarning: (w) => warnings.push(w),
    ...options,
  });
  mn.setPresets(presets);
  return warnings.map((w) => w.type + ': ' + w.message);
}

const tailwindish: MnPresetObject = {
  name: 'presetTailwindish',
  ecosystems: ['tw4'],
  setup(mn: MnInstance) {
    mn(
      'mt', () => ({
        style: {
          marginTop: '1rem',
        },
      }), '', 1,
    );
  },
};

describe('handlerConflictMode', () => {
  test("'warn' — имя от двух пресетов: кто и кто победил", () => {
    expect(connect([presetStandard, {
      ...tailwindish,
      ecosystems: undefined,
    }])).toEqual(['handler-conflict: "mt" is registered by presetStandard and presetTailwindish — presetTailwindish wins.'
        + ' To hide this warning: handlerConflictMode: \'silent\'.']);
  });

  test('статика тоже: одно имя статики от двух пресетов', () => {
    const a = (mn: MnInstance) => mn('box', {
      style: {
        color: 'red',
      },
    });
    const b = (mn: MnInstance) => mn('box', {
      style: {
        color: 'blue',
      },
    });
    expect(connect([a, b])).toEqual(['handler-conflict: "box" is registered by a and b — b wins. To hide this warning: handlerConflictMode: \'silent\'.']);
  });

  test('безымянная функция-пресет — в сообщении «an unnamed preset»', () => {
    expect(connect([presetStandard, (mn: MnInstance) => mn(
      'mt', () => undefined, '', 1,
    )])[0])
      .toContain('presetStandard and an unnamed preset');
  });

  test("'silent' — молча; 'strict' — ошибка setPresets", () => {
    const presets = [presetStandard, {
      ...tailwindish,
      ecosystems: undefined,
    }];
    expect(connect(presets, {
      handlerConflictMode: 'silent',
    })).toEqual([]);
    expect(() => connect(presets, {
      handlerConflictMode: 'strict',
    })).toThrow('"mt" is registered by presetStandard and presetTailwindish — presetTailwindish wins'
      + ' (handlerConflictMode: \'strict\')');
  });

  test('имя из кода приложения (вне пресета) не сравнивается', () => {
    const warnings: MnWarning[] = [];
    const mn = minotationProvider({
      onWarning: (w) => warnings.push(w),
    });
    mn.setPresets([presetStandard]);
    mn(
      'mt', () => undefined, '', 1,
    );
    expect(warnings).toEqual([]);
  });

  test('тот же пресет переопределяет своё имя — не конфликт', () => {
    expect(connect([(mn: MnInstance) => {
      mn(
        'x', () => undefined, '', 1,
      );
      mn(
        'x', () => undefined, '', 1,
      );
    }])).toEqual([]);
  });

  test('presetHints и presetStandard не пересекаются', () => {
    expect(connect([
      presetHints,
      presetStandard,
      presetMedias,
    ])).toEqual([]);
  });
});

describe('presetConflictMode — маркеры экосистем', () => {
  test("'warn' — presetStandard (minotation) и клон (tw4)", () => {
    expect(connect([presetStandard, tailwindish], {
      handlerConflictMode: 'silent',
    })).toEqual(['preset-conflict: presetStandard (minotation) and presetTailwindish (tw4) belong to different'
        + ' preset ecosystems. To hide this warning: presetConflictMode: \'silent\'.']);
  });

  test('пресет с несколькими экосистемами совместим с каждой: presetMedias и клон', () => {
    expect(connect([presetMedias, tailwindish])).toEqual([]);
  });

  test('пресет без маркера нейтрален', () => {
    expect(connect([tailwindish, presetHints])).toEqual([]);
  });

  test("'strict' — ошибка setPresets", () => {
    expect(() => connect([presetStandard, tailwindish], {
      handlerConflictMode: 'silent',
      presetConflictMode: 'strict',
    })).toThrow('belong to different preset ecosystems (presetConflictMode: \'strict\')');
  });

  test('ecosystems проверяется: не массив строк — ошибка', () => {
    expect(() => connect([{
      ...tailwindish,
      ecosystems: 'tailwind' as never,
    }])).toThrow('option "ecosystems" expects an array of strings');
  });
});
