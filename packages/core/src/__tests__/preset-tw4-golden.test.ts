/**
 * `presetTw4` против настоящего Tailwind 4.3.3 (D-068): для каждого класса — объявления утилиты
 * у Tailwind (`compile()` из devDependency `tailwindcss@4.3.3`) и у пресета должны совпасть.
 * Пробелы нормализуются; порядок объявлений не важен.
 */
import {
  readFileSync,
} from 'node:fs';
import minotationProvider from '../core/index';
import presetMedias from '../presets/medias';
import presetTw4 from '../presets/tw4';

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
  const re = /\n {2}\.([^\n{]+?) \{\n([\s\S]*?)\n {2}\}/g;
  let rule: RegExpExecArray | null;
  while ((rule = re.exec(body))) {
    if (rule[1].replace(/\\/g, '') === candidate) {
      return declarationsOf(rule[2]);
    }
  }
  return [];
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
];

describe('presetTw4 = Tailwind 4.3.3', () => {
  test.each(GOLDEN_EXISTING)('%s', (candidate) => {
    expect(mnDeclarations(candidate)).toEqual(twDeclarations(candidate));
  });
});
