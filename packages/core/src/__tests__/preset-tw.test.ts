/**
 * `tw()` — декоратор хендлера для имён Tailwind из нескольких частей (D-061) и имена с
 * дефисом в `defineScale` (`min-w`, `gap-x`).
 */
import minotationProvider from '../core/index';
import {
  parseTwSuffix, tw,
} from '../presets/tw';
import type {
  MnTwArgs,
} from '../presets/tw';
import {
  defineScale,
} from '../presets/scale';
import type {
  MnWarning,
} from '../core/types';
import type {
  MnInstance,
} from '../types';

function compile(tokens: string, setup: (mn: MnInstance) => void) {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    notationMode: 'tailwind-compatible',
    onWarning: (w) => warnings.push(w),
  });
  mn.setPresets([setup]);
  mn.getCompiler('class')(tokens);
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s) => s.content).join(''),
    warnings: warnings.map((w) => w.message),
  };
}

describe('parseTwSuffix', () => {
  test.each([
    [
      '',
      false,
      {
        parts: [],
        negative: false,
      },
    ],
    [
      '-x-2',
      false,
      {
        parts: ['x', '2'],
        negative: false,
      },
    ],
    [
      '-blue-500/50',
      false,
      {
        parts: ['blue', '500'],
        modifier: '50',
        negative: false,
      },
    ],
    [
      '-1/2',
      false,
      {
        parts: ['1'],
        modifier: '2',
        negative: false,
      },
    ],
    [
      '-[37px]',
      true,
      {
        parts: [],
        arbitrary: '37px',
        negative: true,
      },
    ],
    [
      '-x-[1px_2px]',
      false,
      {
        parts: ['x'],
        arbitrary: '1px 2px',
        negative: false,
      },
    ],
    [
      '-[a\\_b]',
      false,
      {
        parts: [],
        arbitrary: 'a_b',
        negative: false,
      },
    ],
    [
      '-[length:1rem]',
      false,
      {
        parts: [],
        type: 'length',
        arbitrary: '1rem',
        negative: false,
      },
    ],
    [
      '-(--brand)',
      false,
      {
        parts: [],
        arbitrary: 'var(--brand)',
        negative: false,
      },
    ],
    [
      '-[#f00]/50',
      false,
      {
        parts: [],
        arbitrary: '#f00',
        modifier: '50',
        negative: false,
      },
    ],
    [
      '-[calc(1px_+_2px)]',
      false,
      {
        parts: [],
        arbitrary: 'calc(1px + 2px)',
        negative: false,
      },
    ],
  ])('%j', (
    suffix, negative, args,
  ) => {
    expect(parseTwSuffix(suffix, negative)).toEqual(args);
  });

  test.each([
    'x',
    '-',
    '-x-',
    '-x--2',
    '-[37px',
    '-[]',
    '-()',
    '-a/',
    '-[1px]x',
    '-x--[1px]',
  ])('%j — не форма Tailwind', (suffix) => {
    expect(parseTwSuffix(suffix, false)).toBeUndefined();
  });
});

describe('tw()', () => {
  function gap(mn: MnInstance) {
    mn(
      'gap', tw(({
        parts, arbitrary,
      }: MnTwArgs) => {
        const property = parts[0] === 'x' ? 'columnGap' : parts[0] === 'y' ? 'rowGap' : 'gap';
        const step = property === 'gap' ? parts[0] : parts[1];
        const value = arbitrary || step && /^\d+$/.test(step) && Number(step) * 0.25 + 'rem';
        return value ? {
          style: {
            [property]: value,
          },
        } : undefined;
      }) as never, '', 1,
    );
  }

  test.each([
    ['gap-2', '.gap-2{gap:0.5rem}'],
    ['gap-x-4', '.gap-x-4{column-gap:1rem}'],
    ['gap-y-[3px]', '.gap-y-\\[3px\\]{row-gap:3px}'],
  ])('%s → %s', (token, css) => {
    expect(compile(token, gap).css).toBe(css);
  });

  test.each([
    'gap-foo',
    'gap-x-',
    'gap',
    '-gap-2',
  ])('%s — чужой класс, молча', (token) => {
    expect(compile(token, gap)).toEqual({
      css: '',
      warnings: [],
    });
  });

  test('negative: true — ведущий - доходит до хендлера', () => {
    expect(compile('-translate-x-2', (mn) => {
      mn(
        'translate', tw(({
          parts, negative,
        }) => ({
          style: {
            translate: (negative ? '-' : '') + Number(parts[1]) * 0.25 + 'rem 0',
          },
        }), {
          negative: true,
        }) as never, '', 1,
      );
    }).css).toBe('.-translate-x-2{translate:-0.5rem 0}');
  });

  test('ошибка из хендлера — предупреждение, как у любого хендлера', () => {
    expect(compile('bad-x', (mn) => {
      mn(
        'bad', tw(() => {
          throw new Error('broken');
        }) as never, '', 1,
      );
    }).css).toBe('');
  });
});

describe('defineScale: имена с дефисом (D-061)', () => {
  function sizes(mn: MnInstance) {
    defineScale(mn, {
      properties: {
        w: 'width',
        'min-w': 'min-width',
        'max-w': 'max-width',
      },
      scale: (step) => step * 0.25 + 'rem',
      keywords: {
        full: '100%',
      },
      arbitrary: true,
    });
    defineScale(mn, {
      properties: {
        gap: 'gap',
      },
      scale: (step) => step * 0.25 + 'rem',
    });
    defineScale(mn, {
      properties: {
        'gap-x': 'column-gap',
        'translate-x': 'translate',
      },
      scale: (step) => step * 0.25 + 'rem',
      negative: true,
    });
  }

  test.each([
    ['w-4', '.w-4{width:1rem}'],
    ['min-w-4', '.min-w-4{min-width:1rem}'],
    ['max-w-[37px]', '.max-w-\\[37px\\]{max-width:37px}'],
    ['min-w-full', '.min-w-full{min-width:100%}'],
    ['gap-2', '.gap-2{gap:0.5rem}'],
    ['gap-x-4', '.gap-x-4{column-gap:1rem}'],
    ['-gap-x-4', '.-gap-x-4{column-gap:-1rem}'],
    ['-translate-x-2', '.-translate-x-2{translate:-0.5rem}'],
  ])('%s → %s', (token, css) => {
    expect(compile(token, sizes).css).toBe(css);
  });

  test.each([
    'min-foo-4',
    'min-w-foo',
    'gap-foo',
    '-gap-2',
    '-min-w-4',
    'min-4',
  ])('%s — чужой класс, молча', (token) => {
    expect(compile(token, sizes)).toEqual({
      css: '',
      warnings: [],
    });
  });

  test('кривое число — предупреждение', () => {
    expect(compile('min-w-4x', sizes).warnings).toEqual(['"min-w-4x": step "4x" is not a number']);
  });

  test('простое имя раньше диспетчера — становится его запасным хендлером', () => {
    expect(compile('gap-2 gap-x-1', (mn) => {
      defineScale(mn, {
        properties: {
          'gap-x': 'column-gap',
        },
        scale: (step) => step + 'px',
      });
      defineScale(mn, {
        properties: {
          gap: 'gap',
        },
        scale: (step) => step + 'px',
      });
    }).css).toBe('.gap-2{gap:2px}.gap-x-1{column-gap:1px}');
  });
});
