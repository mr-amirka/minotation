/**
 * `presetTw4` против настоящего Tailwind 4.3.3 (D-068): для каждого класса — объявления утилиты
 * у Tailwind (`compile()` из devDependency `tailwindcss@4.3.3`) и у пресета должны совпасть.
 * Пробелы нормализуются; порядок объявлений не важен.
 */
import {
  readFileSync,
} from 'node:fs';
import minotationProvider from '../../../core';
import presetMedias from '../../medias';
import presetTw4 from '..';

/** Компилятор Tailwind: типы пакет отдаёт только через `exports`, которых `tsconfig` ядра не читает. */
type TwCompile = (css: string, options: {
  base: string;
  loadStylesheet: (id: string, base: string) => Promise<{ path: string;
    base: string;
    content: string }>;
}) => Promise<{ build(candidates: string[]): string }>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const twCompile = (require('tailwindcss') as { compile: TwCompile }).compile;

let tw: { build(candidates: string[]): string };

beforeAll(async () => {
  tw = await twCompile('@import "tailwindcss/theme.css" layer(theme); @import "tailwindcss/utilities.css" layer(utilities);', {
    base: __dirname,
    loadStylesheet: async (id: string, base: string) => {
      const path = require.resolve(id);
      return {
        path,
        base,
        content: readFileSync(path, 'utf8'),
      };
    },
  });
});

/** Нормализация значения: одинарные пробелы, без пробелов у запятых и скобок. */
function normalize(declaration: string): string {
  return declaration.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
}

/**
 * Объявления утилиты у Tailwind. Вложенный `@supports (…) { … }` — с пометкой условия:
 * `@supports (cond)|prop:value`.
 */
function twDeclarations(candidate: string): string[] {
  const css = tw.build([candidate]);
  const start = css.indexOf('@layer utilities {');
  const body = start < 0 ? '' : css.slice(start);
  // `build` накапливает классы между вызовами — правило ищется по своему селектору.
  const re = /\n {2}(?:\.|(?=:where\(\.))([^\n{]+?) \{\n([\s\S]*?)\n {2}\}/g;
  let rule: RegExpExecArray | null;
  while ((rule = re.exec(body))) {
    if (ownSelector(rule[1].replace(/\\/g, ''), candidate)) {
      return declarationsOf(rule[2]);
    }
  }
  return [];
}

/** Селектор — правило класса: `.c`, `.c::placeholder`, `:where(.c > …)` (дети). */
function ownSelector(selector: string, candidate: string): boolean {
  return selector === candidate || selector.startsWith(candidate + '::') || selector.startsWith(':where(.' + candidate + ' ');
}

/** Строки тела правила Tailwind → объявления, вложенные `@supports` — с пометкой. */
function declarationsOf(text: string): string[] {
  const out: string[] = [];
  let condition = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('@supports')) {
      condition = '@supports ' + normalize(line.slice(9, -1)) + '|';
    } else if (line === '}') {
      condition = '';
    } else if (line) {
      out.push(condition + normalize(line.replace(/;$/, '').replace(/:\s*/, ':')));
    }
  }
  return out.sort();
}

/** Объявления того же класса у `presetTw4`; блок `@supports (…){…}` — с той же пометкой. */
function mnDeclarations(candidate: string): string[] {
  const mn = minotationProvider({
    notationMode: 'tw4-compatible',
    warningMode: 'silent',
  });
  mn.setPresets([presetMedias, presetTw4]);
  mn.getCompiler('class')(candidate);
  mn.compile();
  const out: string[] = [];
  let condition: string;
  let match: RegExpExecArray | null;
  for (const style of mn.styles$.getValue().filter((s) => s.priority > -3000)) {
    condition = style.content.startsWith('@supports') ? '@supports ' + normalize(style.content.slice(9, style.content.indexOf('{'))) + '|' : '';
    const re = /\{([^{}]*)\}/g;
    while ((match = re.exec(style.content))) {
      out.push(...match[1].split(';').filter(Boolean).map((line) => condition + normalize(line.replace(/:\s*/, ':'))));
    }
  }
  return out.sort();
}

export const GOLDEN_EXISTING = [
  'mt-4',
  'p-2',
  'px-3',
  '-mt-4',
  'w-1/2',
  'w-full',
  'h-screen',
  'size-8',
  'max-w-md',
  'min-h-0',
  'flex',
  'flex-1',
  'flex-col',
  'items-center',
  'justify-between',
  'gap-4',
  'grid',
  'grid-cols-3',
  'col-span-2',
  'block',
  'hidden',
  'absolute',
  'inset-0',
  'top-2',
  'z-10',
  'text-sm',
  'text-red-500',
  'font-bold',
  'leading-tight',
  'tracking-wide',
  'text-center',
  'underline',
  'uppercase',
  'bg-blue-500',
  'bg-blue-500/50',
  'bg-white',
  'border',
  'border-2',
  'border-t-4',
  'border-red-500',
  'border-dashed',
  'rounded',
  'rounded-lg',
  'rounded-full',
  'inset-x-1/2',
  'basis-1/3',
  'leading-6',
  '-inset-x-1/2',
  '-tracking-[var(--t)]',
  'font-[600]',
  'font-[weight:var(--w)]',
  'leading-[1.3]',
  'leading-none',
  'tracking-[.1em]',
  '-tracking-wide',
  'border-x-[3px]',
  'border-t-red-500',
  'text-sm/6',
  'border-x-2',
  'mt-0',
  'p-0',
  'gap-0',
  'size-0',
  'top-0',
  'basis-0',
  '-top-1/2',
  'bg-blue-500/[33%]',
  'bg-current/50',
  'bg-[#f00]/50',
  'bg-[var(--x)]/50',
  'bg-black/50',
  'text-red-500/25',
  'border-red-500/50',
  'bg-blue-500/x',
  '-mt-0',
  '-mt-1',
  'mt-1',
  'leading-0',
  '-z-10',
  'order-first',
  'order-last',
  '-order-2',
  'sr-only',
  'truncate',
  'isolate',
  '-translate-full',
  'translate-full',
  'tabular-nums',
  '-mt-[3px]',
  '-mt-[0px]',
  // Цвета-утилиты и толщины (группа 1).
  'decoration-red-500',
  'decoration-red-500/50',
  'decoration-2',
  'decoration-[3px]',
  'decoration-[#f00]',
  'underline-offset-2',
  '-underline-offset-2',
  'underline-offset-[3px]',
  'outline',
  'outline-2',
  'outline-[3px]',
  'outline-red-500',
  'outline-offset-2',
  '-outline-offset-[3px]',
  'fill-red-500',
  'stroke-red-500',
  'stroke-2',
  'stroke-[3px]',
  'stroke-1.5',
  'accent-red-500',
  'caret-red-500/50',
  'placeholder-red-500',
  'divide-x',
  'divide-y-2',
  'divide-x-[3px]',
  'divide-red-500',
  'ring',
  'ring-2',
  'ring-[3px]',
  'ring-red-500',
  'ring-offset-2',
  'ring-offset-[3px]',
  'ring-offset-red-500',
  'inset-ring',
  'inset-ring-2',
  'inset-ring-red-500',
  'scrollbar-thumb-red-500',
  'scrollbar-track-red-500/50',
  // Тени (группа 2).
  'shadow',
  'shadow-md',
  'shadow-md/50',
  'shadow-inner',
  'shadow-none',
  'shadow-[0_0_2px_red]',
  'shadow-red-500',
  'shadow-red-500/50',
  'shadow-[#f00]',
  'shadow-[#f00]/50',
  'shadow-inherit',
  'shadow-current',
  'shadow-transparent',
  'inset-shadow-sm',
  'inset-shadow-sm/50',
  'inset-shadow-none',
  'inset-shadow-[0_0_2px_red]',
  'inset-shadow-red-500',
  'text-shadow-sm',
  'text-shadow-lg/50',
  'text-shadow-none',
  'text-shadow-[0_0_2px_red]',
  'text-shadow-red-500/50',
  'drop-shadow',
  'drop-shadow-xl',
  'drop-shadow-sm/50',
  'drop-shadow-none',
  'drop-shadow-[0_0_2px_red]',
  'drop-shadow-red-500',
  // Не классы Tailwind — ни у кого нет CSS.
  'shadow-md/x',
  '-shadow-md',
  'ring-red-500/x',
  'shadow-none/50',
  'shadow-inherit/50',
  '-shadow-red-500',
  'stroke-2/5',
  '-decoration-2',
  'decoration-2/5',
  // Края групп 1–2: неверные значения, произвольный цвет там, где ждут длину, цвет в начале тени.
  'underline-offset-foo-[3px]',
  'fill-[3px]',
  'divide-x/5',
  '-divide-x',
  'divide-x-[#f00]',
  'divide-x-foo',
  'underline-offset-foo',
  'outline-[#f00]',
  'outline-offset-foo',
  '-stroke-2',
  'divide-[3px]',
  'ring-[#f00]',
  'ring-offset-[#f00]',
  'inset-ring-[#f00]',
  'shadow-[red_0_0_2px]',
  'shadow-red-500/x',
  '-decoration-[3px]',
  'divide-x-foo-[3px]',
  // Группа 4: преобразования.
  'translate-4',
  '-translate-4',
  'translate-x-1/2',
  '-translate-x-1/2',
  'translate-x-4/50',
  'translate-[3px]',
  '-translate-x-[3px]',
  'translate-x-(--x)',
  'translate-z-4',
  'translate-z-1/2',
  'translate-y-0',
  'scale-50',
  '-scale-50',
  'scale-x-50',
  'scale-z-50',
  'scale-[1.5]',
  '-scale-[1.5]',
  'scale-x-[1.5]',
  'scale-(--x)',
  'scale-1.5',
  'scale-50/50',
  'scale-x-1/2',
  'rotate-45',
  '-rotate-45',
  'rotate-[3deg]',
  'rotate-1.5',
  'rotate-45/50',
  'rotate-x-45',
  '-rotate-y-[3deg]',
  'rotate-z-(--x)',
  'rotate-x-foo-[3deg]',
  'skew-3',
  '-skew-[3deg]',
  'skew-x-3',
  'skew-y-(--x)',
  'origin-top-left',
  'origin-[33%_75%]',
  'origin-(--x)',
  'origin-foo',
  '-origin-top',
  'origin-top/50',
  'origin-foo-[1px]',
  'perspective-near',
  'perspective-none',
  'perspective-[100px]',
  '-perspective-near',
  'perspective-origin-bottom-left',
  'perspective-origin-[10%_20%]',
  'transform',
  'transform-[scale(2)]',
  // Группа 3: градиенты.
  'bg-linear-to-r',
  'bg-linear-to-tl',
  'bg-linear-45',
  '-bg-linear-45',
  'bg-linear-1.5',
  'bg-linear-to-r/oklch',
  'bg-linear-to-r/longer',
  'bg-linear-to-r/[in_hsl]',
  'bg-linear-to-x',
  'bg-linear-to-rx',
  'bg-linear-to-rtl',
  '-bg-linear-to-r',
  'bg-linear-foo',
  'bg-linear-[25deg,red_5%,blue_60%]',
  'bg-linear-(--x)',
  'bg-linear-[to_right]/srgb',
  '-bg-linear-[to_right]',
  'bg-linear-foo-[to_right]',
  'bg-radial',
  'bg-radial/oklch',
  '-bg-radial',
  'bg-radial-45',
  'bg-radial-[at_25%_25%]',
  'bg-conic',
  'bg-conic-180',
  '-bg-conic-180',
  'bg-conic-45/srgb',
  'bg-conic/longer',
  'bg-conic-foo',
  'bg-conic-[from_10deg]',
  'from-red-500',
  'from-red-500/50',
  'from-[#f00]/50',
  'from-current',
  'from-(--x)',
  'from-[color:var(--x)]',
  'from-10%',
  'from-10.5%',
  'from-10%/50',
  '-from-10%',
  'from-[10px]',
  'from-[length:var(--x)]',
  'from-foo-[10px]',
  'via-red-500',
  'via-20%',
  'via-[10px]',
  'to-red-500/50',
  'to-90%',
  // Голое имя с модификатором: у Tailwind — только градиенты и тени.
  'bg-radial/[in_hsl]',
  'shadow/50',
  'shadow/[33%]',
  'drop-shadow/50',
  'text-shadow/50',
  'inset-shadow/50',
  'border/50',
  'ring/50',
  'outline/50',
  'rounded/50',
  'divide-x/50',
  'grow/50',
  'transform/50',
  'flex/50',
  'shadow/50/50',
  'grow-2/3',
  'grow-[2]/50',
  'shrink-2/3',
  'flex-1/2',
  'flex-[2]/50',
  'flex-1/x',
  // Группа 5: фильтры.
  'blur',
  'blur-sm',
  'blur-none',
  'blur-[3px]',
  'blur-(--x)',
  'blur-3',
  'blur-foo',
  '-blur-sm',
  'blur-sm/50',
  'blur-none/50',
  '-blur-none',
  'brightness-50',
  'brightness-7',
  'brightness-1.5',
  'brightness-[1.7]',
  'brightness-(--x)',
  'brightness',
  '-brightness-50',
  'brightness-50/50',
  'brightness-foo-[1]',
  'grayscale',
  'grayscale-50',
  'grayscale-[0.5]',
  '-grayscale-50',
  'hue-rotate-15',
  '-hue-rotate-15',
  'hue-rotate-[3deg]',
  'hue-rotate-1.5',
  'invert',
  'sepia-50',
  'saturate-150',
  'contrast-125',
  'filter',
  'filter-[url(#x)]',
  'filter-none',
  '-filter',
  'filter-foo',
  'filter/50',
  'backdrop-blur',
  'backdrop-blur-sm',
  'backdrop-blur-none',
  'backdrop-blur-[3px]',
  'backdrop-brightness-50',
  'backdrop-grayscale',
  '-backdrop-hue-rotate-15',
  'backdrop-opacity-50',
  'backdrop-opacity-[0.3]',
  'backdrop-opacity',
  'backdrop-filter',
  'backdrop-filter-[url(#x)]',
  'backdrop-filter-none',
  // Группа 6: переходы и анимации.
  'transition',
  'transition-colors',
  'transition-all',
  'transition-none',
  'transition-[height]',
  'transition-(--x)',
  'transition-foo',
  '-transition',
  'transition-colors/50',
  'transition-foo-[height]',
  'duration-150',
  'duration-7',
  'duration-1.5',
  'duration-[3s]',
  '-duration-150',
  'duration-150/50',
  'duration-foo-[3s]',
  'delay-150',
  'delay-[3s]',
  'delay-foo',
  'ease-in',
  'ease-in-out',
  'ease-linear',
  'ease-initial',
  'ease-[steps(4)]',
  'ease-foo',
  '-ease-in',
  'ease-in/50',
  'ease',
  'animate-spin',
  'animate-none',
  'animate-[x_1s]',
  'animate-foo',
  '-animate-spin',
  'animate-spin/50',
  'animate',
  'filter-none/50',
  'filter-foo-[url(#x)]',
];

describe('presetTw4 = Tailwind 4.3.3', () => {
  test.each(GOLDEN_EXISTING)('%s', (candidate) => {
    expect(mnDeclarations(candidate)).toEqual(twDeclarations(candidate));
  });
});
