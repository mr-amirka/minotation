/**
 * Запись медиа (D-087, D-088): форма диапазона по умолчанию и `mediaSyntax: 'classic'` во всех режимах записи;
 * в записи minotation — `ширина/высота:контейнер`, единицы и точки в любом слоте, после `@` — только медиа.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import presetMedias from '../presets/medias';
import presetSynonyms from '../presets/synonyms';
import presetTw4 from '../presets/tw4';
import {
  extractMedia,
} from '../selectorsCompileProvider';
import {
  mediaCondition,
} from '../core/mediaCondition';
import type {
  MnOptions, MnWarning,
} from '../core/types';

function compile(
  tokens: string, options: MnOptions = {}, media?: Record<string, unknown>,
) {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    specificityMode: 'silent',
    onWarning: (w) => warnings.push(w),
    ...options,
  });
  mn.setPresets(options.notationMode === 'tw4-compatible' ? [presetMedias, presetTw4] : [
    presetStandard,
    presetSynonyms,
    presetMedias,
    (instance) => {
      Object.assign(instance.media, media);
    },
  ]);
  mn.getCompiler('class')(tokens);
  mn.compile();
  return {
    css: mn.styles$.getValue().filter((s) => s.priority > -3000).map((s) => s.content).join(''),
    warnings: warnings.map((w) => w.message),
  };
}

const CLASSIC = {
  mediaSyntax: 'classic' as const,
};

describe('mediaCondition', () => {
  test.each([
    [
      'width',
      '>=',
      '480px',
      false,
      '(width >= 480px)',
    ],
    [
      'width',
      '<',
      '480px',
      false,
      '(width < 480px)',
    ],
    [
      'width',
      '>=',
      '48rem',
      true,
      '(min-width: 48rem)',
    ],
    [
      'width',
      '<=',
      '768px',
      true,
      '(max-width: 768px)',
    ],
    [
      'width',
      '<',
      '480px',
      true,
      '(max-width: 479.98px)',
    ],
    [
      'width',
      '<',
      '48rem',
      true,
      '(max-width: 47.99875rem)',
    ],
    [
      'height',
      '>',
      '30em',
      true,
      '(min-height: 30.00125em)',
    ],
    [
      'width',
      '>',
      '1024px',
      true,
      '(min-width: 1024.02px)',
    ],
    [
      'width',
      '<',
      'calc(1px + 2px)',
      true,
      '(width < calc(1px + 2px))',
    ],
  ] as const)('%s %s %s classic=%s → %s', (
    side, operator, length, classic, expected,
  ) => {
    expect(mediaCondition(
      side, operator, length, classic,
    )).toBe(expected);
  });
});

describe('mediaSyntax: \'classic\' — во всех режимах (D-087)', () => {
  test.each([
    ['p10@m4', '@media (max-width: 479.98px){.p10\\@m4{padding:10px}}'],
    ['p10@m4-', '@media (min-width: 480px){.p10\\@m4-{padding:10px}}'],
    ['p10@768', '@media (max-width: 768px){.p10\\@768{padding:10px}}'],
    ['p10@m4-d', '@media (min-width: 480px) and (max-width: 991.98px){.p10\\@m4-d{padding:10px}}'],
    ['p10@m4:side', '@container side (width < 480px){.p10\\@m4\\:side{padding:10px}}'],
  ])('запись minotation: %s', (token, css) => {
    expect(compile(token, CLASSIC).css).toBe(css);
  });

  test.each([
    ['md:flex', '@media (min-width: 48rem){.md\\:flex{display:flex}}'],
    ['max-md:flex', '@media (max-width: 47.99875rem){.max-md\\:flex{display:flex}}'],
    ['min-[600px]:flex', '@media (min-width: 600px){.min-\\[600px\\]\\:flex{display:flex}}'],
    ['max-[var(--x)]:flex', '@media (width < var(--x)){.max-\\[var\\(--x\\)\\]\\:flex{display:flex}}'],
    ['@md:flex', '@container (width >= 28rem){.\\@md\\:flex{display:flex}}'],
  ])('запись Tailwind: %s', (token, css) => {
    expect(compile(token, {
      ...CLASSIC,
      notationMode: 'tw4-compatible',
    }).css).toBe(css);
  });

  test('значение опции проверяется', () => {
    expect(() => minotationProvider({
      mediaSyntax: 'legacy' as never,
    })).toThrow('option "mediaSyntax" expects "range" or "classic"');
  });
});

describe('запись minotation: диапазон, высота, контейнер (D-088)', () => {
  const media = {
    tall: {
      width: 300,
      height: 500,
    },
    low: {
      height: 400,
    },
  };

  test.each([
    ['w100@10em-30em', '@media (width >= 10em) and (width <= 30em){.w100\\@10em-30em{width:100px}}'],
    ['w100@m4/tall', '@media (width < 480px) and (height < 500px){.w100\\@m4\\/tall{width:100px}}'],
    ['w100@low', '@media (height < 400px){.w100\\@low{width:100px}}'],
    ['w100@:side', '@container side{.w100\\@\\:side{width:100px}}'],
    ['w100@/low-', '@media (height >= 400px){.w100\\@\\/low-{width:100px}}'],
    ['w100@(m4|d)', '@media (width < 992px){.w100\\@\\(m4\\|d\\){width:100px}}@media (width < 480px){.w100\\@\\(m4\\|d\\){width:100px}}'],
  ])('%s', (token, css) => {
    expect(compile(
      token, {}, media,
    ).css).toBe(css);
  });

  test.each([
    ['w100@m4/m2', 'uses the point "m2" for the height, but it has no "height"'],
    ['w100@:2col', 'names the container "2col", which is not a CSS identifier'],
    ['w100@/', 'is malformed'],
    ['w100@360x100', 'is malformed'],
  ])('%s — сообщение, CSS нет', (token, message) => {
    const {
      css, warnings,
    } = compile(token);
    expect(css).toBe('');
    expect(warnings.join(' ')).toContain(message);
  });

  test.each(['w100@10.5rem', 'w100@m4*2'])('%s — точка числа и множитель в конце — не селектор', (token) => {
    expect(compile(token).warnings.filter((w) => w.indexOf('after the media part') > -1)).toEqual([]);
  });

  test.each([
    ['w100@m4.x', '"@m4." — a selector'],
    ['w100@m4.', '"@m4." — a selector'],
    ['w100@m4::before', '"@m4::" — a state'],
    ['w100@m4:h', '"@m4:h" — a state'],
    ['w100@m4:', 'ends with ":"'],
  ])('%s — брак: %s', (token, message) => {
    expect(compile(token).warnings.join(' ')).toContain(message);
  });
});

test('`@&` — пустое имя медиа (проверка по развёрнутому варианту)', () => {
  expect(compile('p10@&dark').warnings.join(' ')).toContain('Empty media name');
});

test('экранированный символ в варианте группы — не пустое медиа', () => {
  expect(compile('p(1\\.5|2)@m4').warnings).toEqual([]);
});

describe('маркер контейнера: cn, ct (D-088)', () => {
  test.each([
    // Имена — как записаны, как и в запросе `@…:имя` (D-091).
    ['cnMainNav', '.cnMainNav{container-name:MainNav}'],
    ['cn_main-nav', '.cn_main-nav{container-name:main-nav}'],
    ['cn_side_main', '.cn_side_main{container-name:side main}'],
    ['ctIS', '.ctIS{container-type:inline-size}'],
    ['ctS', '.ctS{container-type:size}'],
    ['ctN', '.ctN{container-type:normal}'],
  ])('%s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test('пример владельца: контейнер только у активного родителя', () => {
    expect(compile('cn_sidebar.active w100@:sidebar').css).toBe('.cn_sidebar\\.active.active{container-name:sidebar}'
      + '@container sidebar{.w100\\@\\:sidebar{width:100px}}');
  });

  test.each(['cn10', 'cn1/2'])('%s — не имя контейнера: сообщение, CSS нет', (token) => {
    const {
      css, warnings,
    } = compile(token);
    expect(css).toBe('');
    expect(warnings.join(' ')).toContain('is not a container name');
  });

  test('переменная — законно', () => {
    expect(compile('cn--c').css).toBe('.cn--c{container-name:var(--c)}');
  });

  test('без значения — сообщение', () => {
    expect(compile('cn').warnings).toEqual(['"cn" produced no CSS: handler "cn" needs a value here']);
  });
});

describe('extractMedia — для синонимов', () => {
  test('пустая часть — пустая строка', () => {
    expect(extractMedia([], '')).toBe('');
  });
});
