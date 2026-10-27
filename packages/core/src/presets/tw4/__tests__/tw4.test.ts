/**
 * `presetTw4` — клон Tailwind 4 (D-068): значения через переменные темы, как в Tailwind 4.
 * Тема сверяется с эталоном `reference/tailwindcss-4.3.3/theme.css` (D-068, фазы данных).
 */
import {
  createHash,
} from 'node:crypto';
import {
  readFileSync,
} from 'node:fs';
import {
  join,
} from 'node:path';
import minotationProvider from '../../../core';
import presetMedias from '../../medias';
import presetStandard from '../../standard';
import presetTw4 from '..';
import {
  TW4_THEME,
  TW4_THEME_SHA256,
  TW4_VERSION,
} from '../theme';
import type {
  MnOptions,
  MnWarning,
} from '../../../core/types';

/** Правило темы: `:root{--…}` или начальные значения `*,::before,::after,::backdrop{--tw-…}` — одним правилом (D-108 F2). */
const REGEXP_THEME_RULE = /(?::root|\*,::before,::after,::backdrop)\{--[^}]*\}/g;

function compile(tokens: string, options: MnOptions = {}) {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    notationMode: 'tw4-compatible',
    warningMode: 'silent',
    importantMode: 'silent',
    onWarning: (w) => warnings.push(w),
    ...options,
  });
  mn.setPresets([
    presetMedias,
    presetTw4,
  ]);
  mn.getCompiler('class')(tokens);
  mn.compile();
  const all = mn.styles$.getValue().map((s) => s.content).join('');
  // Переменные темы (`:root{…}`) и начальные значения помощников (`*{--tw-…}`) — отдельно.
  const theme = all.match(REGEXP_THEME_RULE) || [];
  return {
    css: all.replace(REGEXP_THEME_RULE, ''),
    root: theme.join(''),
    warnings: warnings.map((w) => w.type + ': ' + w.message),
  };
}

describe('тема', () => {
  test('блок темы — раньше утилит: приоритет −3000', () => {
    const mn = minotationProvider({
      notationMode: 'tw4-compatible',
    });
    mn.setPresets([
      presetMedias,
      presetTw4,
    ]);
    mn.getCompiler('class')('mt-4');
    mn.compile();
    expect(mn.styles$.getValue().map((s) => [
      s.priority,
      s.content,
    ])).toEqual([
      [
        -3000,
        ':root{--spacing:0.25rem}',
      ],
      [
        -2000,
        '.mt-4{margin-top:calc(var(--spacing) * 4)}',
      ],
    ]);
  });

  test('сверена с эталоном: версия и SHA-256 файла-источника', () => {
    const source = readFileSync(join(__dirname, '../../../../reference/tailwindcss-' + TW4_VERSION + '/theme.css'));
    expect(createHash('sha256').update(source).digest('hex')).toBe(TW4_THEME_SHA256);
  });

  test('покрытие: 26 палитр по 11 оттенков, чёрный и белый; шкалы на месте', () => {
    const names = Object.keys(TW4_THEME);
    expect(names.filter((name) => name.indexOf('--color-') === 0)).toHaveLength(288);
    expect(TW4_THEME['--spacing']).toBe('0.25rem');
    expect(TW4_THEME['--color-blue-500']).toBe('oklch(62.3% 0.214 259.815)');
    expect(names.filter((name) => name.indexOf('--breakpoint-') === 0)).toHaveLength(5);
    expect(names.filter((name) => /^--text-[a-z0-9]+$/.test(name))).toHaveLength(13);
    expect(names.some((name) => TW4_THEME[name].indexOf('--theme(') > -1)).toBe(false);
  });

  test('в :root — только использованные переменные (D-069)', () => {
    // Одним правилом в блоке темы (D-071): mn.css копит объявления одного селектора.
    expect(compile('mt-4 bg-blue-500').root).toBe(':root{--spacing:0.25rem;--color-blue-500:oklch(62.3% 0.214 259.815)}');
    expect(compile('block').root).toBe('');
  });

  test('переменная выводится один раз, сколько бы классов её ни использовало', () => {
    expect(compile('mt-4 mb-2 p-3').root).toBe(':root{--spacing:0.25rem}');
  });
});

describe('кадры анимаций темы', () => {
  test('по требованию, как у Tailwind: только использованные, по разу на имя', () => {
    const css = compile('animate-spin hover:animate-spin animate-bounce animate-none animate-[x_1s]').css;
    expect(css.match(/@keyframes [a-z]+/g)).toEqual([
      '@keyframes spin',
      '@keyframes bounce',
    ]);
    expect(css).toContain('@keyframes spin{to{transform:rotate(360deg)}}');
    expect(compile('animate-none transition').css).not.toContain('@keyframes');
  });
});

describe('контейнерные запросы (D-086) — как у Tailwind 4.3.3', () => {
  test.each([
    [
      '@md:flex',
      '@container (width >= 28rem){.\\@md\\:flex{display:flex}}',
    ],
    [
      '@min-md:flex',
      '@container (width >= 28rem){.\\@min-md\\:flex{display:flex}}',
    ],
    [
      '@max-md:flex',
      '@container (width < 28rem){.\\@max-md\\:flex{display:flex}}',
    ],
    [
      '@3xs:flex',
      '@container (width >= 16rem){.\\@3xs\\:flex{display:flex}}',
    ],
    [
      '@sm/main:flex',
      '@container main (width >= 24rem){.\\@sm\\/main\\:flex{display:flex}}',
    ],
    [
      '@max-sm/main:flex',
      '@container main (width < 24rem){.\\@max-sm\\/main\\:flex{display:flex}}',
    ],
    [
      '@min-[400px]/main:flex',
      '@container main (width >= 400px){.\\@min-\\[400px\\]\\/main\\:flex{display:flex}}',
    ],
  ])('%s — шкала контейнеров, не брейкпоинты', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test('брейкпоинт окна — по-прежнему своя шкала: md: — 48rem', () => {
    expect(compile('md:flex').css).toBe('@media (width >= 48rem){.md\\:flex{display:flex}}');
  });

  test.each([
    '@foo',
    '@md',
    '@container-x',
    '-@container',
  ])('%s — не контейнер: сообщение вместо тишины', (token) => {
    expect(compile(token).warnings).toEqual([
      'parse-error: "' + token + '": in tw4-compatible mode a class starting with "@" '
      + 'is a container — @container, @container/name, @container-normal, @container-size; a container variant needs ":" '
      + '(@md:flex). The class gives no CSS.',
    ]);
  });
});

describe('отступы', () => {
  test.each([
    [
      'mt-4',
      '.mt-4{margin-top:calc(var(--spacing) * 4)}',
    ],
    [
      '-mt-4',
      '.-mt-4{margin-top:calc(var(--spacing) * -4)}',
    ],
    [
      'mx-auto',
      '.mx-auto{margin-inline:auto}',
    ],
    [
      'm-px',
      '.m-px{margin:1px}',
    ],
    [
      '-m-px',
      '.-m-px{margin:-1px}',
    ],
    [
      '-mt-[3px]',
      '.-mt-\\[3px\\]{margin-top:calc(3px * -1)}',
    ],
    [
      'p-2.5',
      '.p-2\\.5{padding:calc(var(--spacing) * 2.5)}',
    ],
    [
      'px-[3px]',
      '.px-\\[3px\\]{padding-inline:3px}',
    ],
    [
      'gap-x-2',
      '.gap-x-2{column-gap:calc(var(--spacing) * 2)}',
    ],
    [
      'space-x-4',
      ':where(.space-x-4>:not(:last-child)){--tw-space-x-reverse:0;margin-inline-start:calc('
      + 'calc(var(--spacing) * 4) * var(--tw-space-x-reverse));margin-inline-end:calc(calc(var(--spacing) * 4)'
      + ' * calc(1 - var(--tw-space-x-reverse)))}',
    ],
    [
      'space-y-reverse',
      ':where(.space-y-reverse>:not(:last-child)){--tw-space-y-reverse:1}',
    ],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test.each([
    '-p-4',
    '-mx-auto',
  ])('%s — отрицания нет: CSS нет, молча (D-064)', (token) => {
    expect(compile(token)).toMatchObject({
      css: '',
      warnings: [],
    });
  });
});

describe('размеры и раскладка', () => {
  test.each([
    [
      'w-1/2',
      '.w-1\\/2{width:calc(1 / 2 * 100%)}',
    ],
    [
      'w-full',
      '.w-full{width:100%}',
    ],
    [
      'w-md',
      '.w-md{width:var(--container-md)}',
    ],
    [
      'h-screen',
      '.h-screen{height:100vh}',
    ],
    [
      'size-8',
      '.size-8{width:calc(var(--spacing) * 8);height:calc(var(--spacing) * 8)}',
    ],
    [
      'max-w-prose',
      '.max-w-prose{max-width:65ch}',
    ],
    [
      'max-w-[40rem]',
      '.max-w-\\[40rem\\]{max-width:40rem}',
    ],
    [
      'inline-block',
      '.inline-block{display:inline-block}',
    ],
    [
      'hidden',
      '.hidden{display:none}',
    ],
    [
      'absolute',
      '.absolute{position:absolute}',
    ],
    [
      '-top-2',
      '.-top-2{top:calc(var(--spacing) * -2)}',
    ],
    [
      'inset-x-1/2',
      '.inset-x-1\\/2{inset-inline:calc(1 / 2 * 100%)}',
    ],
    [
      'z-10',
      '.z-10{z-index:10}',
    ],
    [
      '-z-10',
      '.-z-10{z-index:calc(10 * -1)}',
    ],
    [
      'z-auto',
      '.z-auto{z-index:auto}',
    ],
    [
      'order-first',
      '.order-first{order:-9999}',
    ],
    [
      'flex',
      '.flex{display:flex}',
    ],
    [
      'flex-1',
      '.flex-1{flex:1}',
    ],
    [
      'flex-col',
      '.flex-col{flex-direction:column}',
    ],
    [
      'grow',
      '.grow{flex-grow:1}',
    ],
    [
      'shrink-0',
      '.shrink-0{flex-shrink:0}',
    ],
    [
      'basis-1/3',
      '.basis-1\\/3{flex-basis:calc(1 / 3 * 100%)}',
    ],
    [
      'items-center',
      '.items-center{align-items:center}',
    ],
    [
      'justify-between',
      '.justify-between{justify-content:space-between}',
    ],
    [
      'grid-cols-3',
      '.grid-cols-3{grid-template-columns:repeat(3, minmax(0, 1fr))}',
    ],
    [
      'col-span-2',
      '.col-span-2{grid-column:span 2 / span 2}',
    ],
    [
      'col-span-full',
      '.col-span-full{grid-column:1 / -1}',
    ],
    [
      'row-start-2',
      '.row-start-2{grid-row-start:2}',
    ],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });
});

describe('типографика и цвета', () => {
  test.each([
    [
      'text-sm',
      '.text-sm{font-size:var(--text-sm);line-height:var(--tw-leading, var(--text-sm--line-height))}',
    ],
    [
      'text-sm/6',
      '.text-sm\\/6{font-size:var(--text-sm);line-height:calc(var(--spacing) * 6)}',
    ],
    [
      'text-[14px]',
      '.text-\\[14px\\]{font-size:14px}',
    ],
    [
      'text-center',
      '.text-center{text-align:center}',
    ],
    [
      'text-blue-500',
      '.text-blue-500{color:var(--color-blue-500)}',
    ],
    // Как у Tailwind 4: запасной `srgb` с литералом темы и `@supports` со смесью в `oklab`.
    [
      'text-blue-500/50',
      '.text-blue-500\\/50{color:color-mix(in srgb, oklch(62.3% 0.214 259.815) 50%, transparent)}'
      + '@supports (color: color-mix(in lab, red, red)){.text-blue-500\\/50{color:color-mix(in oklab, var(--color-blue-500) 50%, transparent)}}',
    ],
    [
      'text-[#f00]',
      '.text-\\[\\#f00\\]{color:#f00}',
    ],
    [
      'text-[color:var(--x)]',
      '.text-\\[color\\:var\\(--x\\)\\]{color:var(--x)}',
    ],
    [
      'font-bold',
      '.font-bold{--tw-font-weight:var(--font-weight-bold);font-weight:var(--font-weight-bold)}',
    ],
    [
      'font-mono',
      '.font-mono{font-family:var(--font-mono)}',
    ],
    [
      'leading-tight',
      '.leading-tight{--tw-leading:var(--leading-tight);line-height:var(--leading-tight)}',
    ],
    [
      'leading-6',
      '.leading-6{--tw-leading:calc(var(--spacing) * 6);line-height:calc(var(--spacing) * 6)}',
    ],
    [
      'tracking-wide',
      '.tracking-wide{--tw-tracking:var(--tracking-wide);letter-spacing:var(--tracking-wide)}',
    ],
    [
      'truncate',
      '.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    ],
    [
      'bg-white',
      '.bg-white{background-color:var(--color-white)}',
    ],
    [
      'bg-transparent',
      '.bg-transparent{background-color:transparent}',
    ],
    [
      'bg-blue-500/75',
      '.bg-blue-500\\/75{background-color:color-mix(in srgb, oklch(62.3% 0.214 259.815) 75%, transparent)}'
      + '@supports (color: color-mix(in lab, red, red)){.bg-blue-500\\/75{background-color:color-mix(in oklab, var(--color-blue-500) 75%, transparent)}}',
    ],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });
});

describe('рамки и скругления', () => {
  // `border` берёт стиль из переменной: `border border-dashed` — пунктир при любом порядке (D-069).
  test.each([
    'border border-dashed',
    'border-dashed border',
  ])('%s — пунктир при любом порядке правил', (tokens) => {
    const {
      css, root,
    } = compile(tokens);
    expect(css).toContain('.border{border-style:var(--tw-border-style);border-width:1px}');
    expect(css).toContain('.border-dashed{--tw-border-style:dashed;border-style:dashed}');
    // Начальное значение — на всех элементах, с нулевой специфичностью: `.border-dashed` его перебивает.
    expect(root).toBe('*,::before,::after,::backdrop{--tw-border-style:solid}');
  });

  test.each([
    [
      'border',
      '.border{border-style:var(--tw-border-style);border-width:1px}',
    ],
    [
      'border-2',
      '.border-2{border-style:var(--tw-border-style);border-width:2px}',
    ],
    [
      'border-t-4',
      '.border-t-4{border-top-style:var(--tw-border-style);border-top-width:4px}',
    ],
    [
      'border-red-500',
      '.border-red-500{border-color:var(--color-red-500)}',
    ],
    [
      'border-dashed',
      '.border-dashed{--tw-border-style:dashed;border-style:dashed}',
    ],
    [
      'rounded',
      '.rounded{border-radius:0.25rem}',
    ],
    [
      'rounded-lg',
      '.rounded-lg{border-radius:var(--radius-lg)}',
    ],
    [
      'rounded-t-lg',
      '.rounded-t-lg{border-top-left-radius:var(--radius-lg);border-top-right-radius:var(--radius-lg)}',
    ],
    [
      'rounded-full',
      '.rounded-full{border-radius:calc(infinity * 1px)}',
    ],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });
});

describe('варианты', () => {
  test.each([
    [
      'hover:bg-blue-600',
      '@media (hover: hover){.hover\\:bg-blue-600:hover{background-color:var(--color-blue-600)}}',
    ],
    [
      'first:mt-0',
      '.first\\:mt-0:first-child{margin-top:0px}',
    ],
    [
      'odd:bg-white',
      '.odd\\:bg-white:nth-child(odd){background-color:var(--color-white)}',
    ],
    [
      'open:block',
      '.open\\:block[open],.open\\:block:popover-open{display:block}',
    ],
    [
      'before:block',
      '.before\\:block::before{display:block}',
    ],
    [
      'group-hover:underline',
      '@media (hover: hover){.group:hover .group-hover\\:underline{text-decoration-line:underline}}',
    ],
    [
      'md:flex',
      '@media (width >= 48rem){.md\\:flex{display:flex}}',
    ],
    [
      'max-md:hidden',
      '@media (width < 48rem){.max-md\\:hidden{display:none}}',
    ],
    [
      'md:hover:underline',
      '@media (width >= 48rem) and (hover: hover){.md\\:hover\\:underline:hover{'
      + 'text-decoration-line:underline}}',
    ],
    [
      'dark:bg-black',
      '@media (prefers-color-scheme: dark){.dark\\:bg-black{background-color:var(--color-black)}}',
    ],
    [
      'mt-2!',
      '.mt-2\\!{margin-top:calc(var(--spacing) * 2)!important}',
    ],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });
});

describe('крайние случаи: произвольные значения, модификаторы, минус, неразобранное', () => {
  // Таблица сверена с поведением Tailwind 4 вручную (2026-10-13). Третий столбец — есть ли
  // предупреждение «нужно значение» (запись нашлась, значение не разобрано, D-063).
  test.each([
    [
      '-inset-x-1/2',
      '.-inset-x-1\\/2{inset-inline:calc(calc(1 / 2 * 100%) * -1)}',
      false,
    ],
    [
      '-top-full',
      '.-top-full{top:-100%}',
      false,
    ],
    [
      '-tracking-[var(--t)]',
      '.-tracking-\\[var\\(--t\\)\\]{--tw-tracking:calc(var(--t) * -1);letter-spacing:calc(var(--t) * -1)}',
      false,
    ],
    [
      'mt-x-[3px]',
      '',
      true,
    ],
    [
      'w-[3px]/2',
      '',
      true,
    ],
    [
      'w-1-2',
      '',
      true,
    ],
    [
      'w-1/x',
      '',
      true,
    ],
    [
      '-bg-red-500',
      '',
      false,
    ],
    [
      'bg-red-[#f00]',
      '',
      true,
    ],
    [
      'bg-[length:3px]',
      '',
      true,
    ],
    [
      'bg-red-500/x',
      '',
      true,
    ],
    [
      'space-x-foo',
      '',
      true,
    ],
    [
      'z-[5]',
      '.z-\\[5\\]{z-index:5}',
      false,
    ],
    [
      'z-foo',
      '',
      true,
    ],
    [
      '-z-auto',
      '',
      false,
    ],
    [
      'z-1/2',
      '',
      true,
    ],
    [
      'flex-[2_2_0%]',
      '.flex-\\[2_2_0\\%\\]{flex:2 2 0%}',
      false,
    ],
    [
      'flex-x',
      '',
      true,
    ],
    [
      'grow-[2]',
      '.grow-\\[2\\]{flex-grow:2}',
      false,
    ],
    [
      'grow-x',
      '',
      true,
    ],
    [
      'grid-cols-[200px_1fr]',
      '.grid-cols-\\[200px_1fr\\]{grid-template-columns:200px 1fr}',
      false,
    ],
    [
      'grid-cols-1-2',
      '',
      true,
    ],
    [
      'grid-cols-none',
      '.grid-cols-none{grid-template-columns:none}',
      false,
    ],
    [
      'grid-cols-subgrid',
      '.grid-cols-subgrid{grid-template-columns:subgrid}',
      false,
    ],
    [
      'grid-cols-x',
      '',
      true,
    ],
    [
      'col-span-[3]',
      '.col-span-\\[3\\]{grid-column:span 3 / span 3}',
      false,
    ],
    [
      'col-span-1-2',
      '',
      true,
    ],
    [
      'col-span-x',
      '',
      true,
    ],
    [
      'text-sm/x',
      '',
      true,
    ],
    [
      '-text-sm',
      '',
      false,
    ],
    [
      'text-[14px]/6',
      '.text-\\[14px\\]\\/6{font-size:14px;line-height:calc(var(--spacing) * 6)}',
      false,
    ],
    [
      '-font-bold',
      '',
      false,
    ],
    [
      'font-bold/2',
      '',
      true,
    ],
    [
      'font-[600]',
      '.font-\\[600\\]{--tw-font-weight:600;font-weight:600}',
      false,
    ],
    [
      'font-[weight:var(--w)]',
      '.font-\\[weight\\:var\\(--w\\)\\]{--tw-font-weight:var(--w);font-weight:var(--w)}',
      false,
    ],
    [
      'font-[Inter]',
      '.font-\\[Inter\\]{font-family:Inter}',
      false,
    ],
    [
      'font-foo',
      '',
      true,
    ],
    [
      '-leading-6',
      '',
      false,
    ],
    [
      'leading-[1.3]',
      '.leading-\\[1\\.3\\]{--tw-leading:1.3;line-height:1.3}',
      false,
    ],
    [
      'leading-none',
      '.leading-none{--tw-leading:1;line-height:1}',
      false,
    ],
    [
      'leading-foo',
      '',
      true,
    ],
    [
      'tracking-wide/2',
      '',
      true,
    ],
    [
      'tracking-[.1em]',
      '.tracking-\\[\\.1em\\]{--tw-tracking:.1em;letter-spacing:.1em}',
      false,
    ],
    [
      '-tracking-wide',
      '.-tracking-wide{--tw-tracking:calc(var(--tracking-wide) * -1);letter-spacing:calc(var(--tracking-wide) * -1)}',
      false,
    ],
    [
      'tracking-foo',
      '',
      true,
    ],
    [
      'border-[3px]',
      '.border-\\[3px\\]{border-style:var(--tw-border-style);border-width:3px}',
      false,
    ],
    [
      'border-[length:var(--b)]',
      '.border-\\[length\\:var\\(--b\\)\\]{border-style:var(--tw-border-style);border-width:var(--b)}',
      false,
    ],
    [
      'border-x-[3px]',
      '.border-x-\\[3px\\]{border-inline-style:var(--tw-border-style);border-inline-width:3px}',
      false,
    ],
    [
      'border-[#f00]',
      '.border-\\[\\#f00\\]{border-color:#f00}',
      false,
    ],
    [
      'border-t-2-3',
      '',
      true,
    ],
    [
      '-border-2',
      '',
      false,
    ],
    [
      'border-2/3',
      '',
      true,
    ],
    [
      'border-t-red-500',
      '.border-t-red-500{border-top-color:var(--color-red-500)}',
      false,
    ],
    [
      '-rounded-lg',
      '',
      false,
    ],
    [
      'rounded-lg/2',
      '',
      true,
    ],
    [
      'rounded-[3px]',
      '.rounded-\\[3px\\]{border-radius:3px}',
      false,
    ],
    [
      'rounded-t-[3px]',
      '.rounded-t-\\[3px\\]{border-top-left-radius:3px;border-top-right-radius:3px}',
      false,
    ],
    [
      'rounded-none',
      '.rounded-none{border-radius:0}',
      false,
    ],
    [
      'rounded-t-lg-[3px]',
      '',
      true,
    ],
    [
      'space-x-reverse-2',
      '',
      true,
    ],
    [
      'space-x-reverse-[1]',
      '',
      true,
    ],
    [
      'space-x-reverse/2',
      '',
      true,
    ],
    [
      '-space-x-reverse',
      '',
      false,
    ],
    [
      'rounded-foo',
      '',
      true,
    ],
    [
      'bg-foo',
      '',
      true,
    ],
    [
      'grow-0',
      '.grow-0{flex-grow:0}',
      false,
    ],
    [
      'shrink',
      '.shrink{flex-shrink:1}',
      false,
    ],
  ])('%s → %s', (
    token, css, warned,
  ) => {
    const result = compile(token);
    expect(result.css).toBe(css);
    expect(result.warnings.length > 0).toBe(warned);
  });
});

describe('класс не разобран', () => {
  test.each([
    [
      'text-foo',
      'parse-error: "text-foo" produced no CSS: handler "text" needs a value here',
    ],
    [
      'w-foo',
      'parse-error: "w-foo" produced no CSS: handler "w" needs a value here',
    ],
  ])('%s — запись есть, значение не разобрано: предупреждение (D-063)', (token, message) => {
    expect(compile(token).warnings).toEqual([message]);
  });

  test('класса, которого нет в подмножестве, — нет и записи: молча', () => {
    // Не класс Tailwind вовсе: пресет со временем покроет все классы эталона.
    expect(compile('qq-2')).toMatchObject({
      css: '',
      warnings: [],
    });
  });
});

describe('экосистема (D-067, D-068)', () => {
  test('presetStandard рядом — preset-conflict и конфликты имён', () => {
    // Предупреждения о конфликтах печатаются всегда (warningMode на них не влияет) — глушим вывод.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const warnings: string[] = [];
    const mn = minotationProvider({
      warningMode: 'silent',
      onWarning: (w) => warnings.push(w.type),
    });
    mn.setPresets([
      presetStandard,
      presetMedias,
      presetTw4,
    ]);
    expect(warnings[0]).toBe('preset-conflict');
    expect(warnings).toContain('handler-conflict');
    warn.mockRestore();
  });

  test('presetMedias совместим (minotation и tw4): без предупреждений', () => {
    expect(compile('mt-4').warnings).toEqual([]);
  });
});

describe('space-* — как у Tailwind 4.3.3 (сверено scripts/tw4-conformance.mjs)', () => {
  test.each([
    [
      'space-x-0',
      'margin-inline-start:0;margin-inline-end:0',
    ],
    [
      '-space-x-px',
      'margin-inline-start:calc(-1px * var(--tw-space-x-reverse))',
    ],
    [
      'space-y-4',
      'margin-block-start:calc(calc(var(--spacing) * 4) * var(--tw-space-y-reverse))',
    ],
  ])('%s', (token, part) => {
    expect(compile(token).css).toContain(part);
  });
});
