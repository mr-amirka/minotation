/**
 * Генератор статических утилит `presetTw4` (D-068): берёт у Tailwind 4.3.3 (devDependency
 * `tailwindcss`) список статических утилит, компилирует каждую и пишет `src/presets/tw4/statics.ts` —
 * класс → объявления, и начальные значения помощников `--tw-*` из `@property`.
 *
 * Запуск: `node src/presets/tw4/scripts/tw4-statics.mjs` (из `packages/core`). Файл результата не правится руками.
 *
 * Берутся только плоские утилиты — одно правило с объявлениями. Отрицательные (`-inset-full`) — своей
 * таблицей по имени без минуса: статика на хендлере отвечает и за минус. Утилиты с вложенными блоками
 * (`@supports`, `:where(& > …)`) остаются хендлерам пресета — их имена перечислены отдельно.
 */
import {
  compile, __unstable__loadDesignSystem as loadDesignSystem,
} from 'tailwindcss';
import {
  readFileSync, writeFileSync,
} from 'node:fs';
import {
  dirname, join,
} from 'node:path';
import {
  createRequire,
} from 'node:module';
import {
  fileURLToPath,
} from 'node:url';
import {
  execFileSync,
} from 'node:child_process';
import {
  repeatedConstants,
} from './repeated-constants.mjs';

const PARENT_DIR = '..';
const NEWLINE = '\n';
const INDENT = '  ';
const LIST_SEPARATOR = ', ';

const root = join(dirname(fileURLToPath(import.meta.url)), PARENT_DIR, PARENT_DIR, PARENT_DIR, PARENT_DIR);
const target = join(root, 'src', 'presets', 'tw4', 'statics.ts');
const require = createRequire(join(root, 'package.json'));
const VERSION = require('tailwindcss/package.json').version;
const INPUT = '@import "tailwindcss/theme.css" layer(theme); @import "tailwindcss/utilities.css" layer(utilities);';
const options = {
  base: root,
  loadStylesheet: async (id, base) => {
    const path = require.resolve(id);
    return {
      path,
      base,
      content: readFileSync(path, 'utf8'),
    };
  },
};

const design = await loadDesignSystem(INPUT, options);
const names = design.utilities.keys('static').sort();
const statics = {};
const negatives = {};
const nested = [];
const properties = {};

for (const name of names) {
  // Свежий компилятор на класс: `build` накапливает классы между вызовами.
  const tw = await compile(INPUT, options);
  const css = tw.build([name]);
  const rule = ruleOf(css, name);
  if (!rule) {
    nested.push(name);
    continue;
  }
  name[0] === '-' ? negatives[name.slice(1)] = rule : statics[name] = rule;
  collectProperties(css);
}

// Начальные значения помощников `--tw-*` — со всего списка классов: их задают и параметрические
// утилиты (`border` — `--tw-border-style`), не только статические.
collectProperties((await compile(INPUT, options)).build(design.getClassList().map((item) => item[0])));

/** Объявления правила класса — или `undefined`, если правило не плоское. */
function ruleOf(css, name) {
  const start = css.indexOf('@layer utilities {');
  const body = start < 0 ? '' : css.slice(start + 18, css.indexOf('\n}', start));
  const blocks = body.trim().split(/\n {2}\}\n?/).filter(Boolean);
  if (blocks.length !== 1) {
    return undefined;
  }
  const lines = blocks[0].split(NEWLINE).map((line) => line.trim()).filter(Boolean);
  const head = lines.shift();
  if (head.replace(/\\/g, '') !== '.' + name + ' {' || lines.some((line) => /[{}]/.test(line))) {
    return undefined;
  }
  return lines.map((line) => {
    const at = line.indexOf(':');
    return [line.slice(0, at).trim(), line.slice(at + 1).replace(/;$/, '').trim()];
  });
}

/** `@property --tw-x { … initial-value: v; }` → начальное значение помощника. */
function collectProperties(css) {
  const re = /@property (--[\w-]+) \{([^}]*)\}/g;
  let match;
  let initial;
  while ((match = re.exec(css))) {
    initial = /initial-value:\s*([^;]+);/.exec(match[2]);
    initial && (properties[match[1]] = initial[1].trim());
  }
}

const quote = (text) => JSON.stringify(text);

// A value written 3+ times in the tables is a constant (lab/no-repeated-string, lab D-017.3): counted over every value
// the file writes — the declarations' properties and values, the helpers' initial values, the nested list. Class names
// are the tables' keys: names, written as they are.
const written = [];
for (const table of [statics, negatives]) {
  for (const name of Object.keys(table)) {
    for (const pair of table[name]) {
      written.push(pair[0], pair[1]);
    }
  }
}
Object.keys(properties).forEach((name) => written.push(properties[name]));
written.push(...nested);
const {
  value,
  body: constantsBody,
} = repeatedConstants(written, ['TW4_STATICS_VERSION', 'TW4_STATICS', 'TW4_NEGATIVE_STATICS', 'TW4_PROPERTIES', 'TW4_NESTED_STATICS']);

const staticsBody = Object.keys(statics).map((name) => INDENT + quote(name) + ': [' + statics[name]
  .map((pair) => '[' + value(pair[0]) + LIST_SEPARATOR + value(pair[1]) + ']').join(LIST_SEPARATOR) + '],').join(NEWLINE);
const negativesBody = Object.keys(negatives).map((name) => INDENT + quote(name) + ': [' + negatives[name]
  .map((pair) => '[' + value(pair[0]) + LIST_SEPARATOR + value(pair[1]) + ']').join(LIST_SEPARATOR) + '],').join(NEWLINE);
const propertiesBody = Object.keys(properties).sort().map((name) => INDENT + quote(name) + ': ' + value(properties[name]) + ',')
  .join(NEWLINE);

writeFileSync(target, `/**
 * Tailwind ${VERSION} static utilities for \`presetTw4\` (D-068). Generated by \`scripts/tw4-statics.mjs\` from
 * \`tailwindcss@${VERSION}\` (MIT, (c) Tailwind Labs) — do not edit by hand.
 */

/** Tailwind version the table was taken from. */
export const TW4_STATICS_VERSION = '${VERSION}';

/** The values the tables write 3+ times. */
${constantsBody}

/** Flat static utilities: class → [property, value] declarations, as Tailwind emits them. */
export const TW4_STATICS: Record<string, Array<[string, string]>> = {
${staticsBody}
};

/** Negative static utilities, keyed by the name without the minus: \`translate-full\` → \`-translate-full\`. */
export const TW4_NEGATIVE_STATICS: Record<string, Array<[string, string]>> = {
${negativesBody}
};

/** Initial values of Tailwind helper properties (\`@property … initial-value\`). */
export const TW4_PROPERTIES: Record<string, string> = {
${propertiesBody}
};

/** Static utilities with nested blocks — implemented by preset handlers, not by this table. */
export const TW4_NESTED_STATICS: string[] = [${nested.map(value).join(LIST_SEPARATOR)}];
`);
// Стиль проекта — тем же линтером, что и весь код: файл генерируется, но проверяется как остальные.
execFileSync('npx', ['eslint', '--fix', target], {
  cwd: root,
  stdio: 'inherit',
});
console.log('tw4-statics: ' + Object.keys(statics).length + ' flat, ' + Object.keys(negatives).length + ' negative, '
  + nested.length + ' nested, '
  + Object.keys(properties).length + ' properties → ' + target);
