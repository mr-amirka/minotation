/**
 * Соответствие `presetTw4` настоящему Tailwind 4.3.3 (D-068) по всему списку классов Tailwind: для
 * каждого класса — объявления у Tailwind и у пресета (пробелы нормализуются, порядок не важен,
 * `@supports` — с пометкой условия). Печатает итог и самые частые расхождения по корню утилиты.
 *
 * Запуск: `node scripts/tw4-conformance.mjs [отчёт.json]` (из `packages/core`, после `pnpm build`).
 * Отчёт — полный список несовпадений: класс, Tailwind, пресет.
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
  minotationProvider, presetMedias, presetTw4,
} from '../dist/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
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
const classes = design.getClassList().map((item) => item[0]);

const normalize = (text) => text.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').replace(/\(\s+/g, '(')
  .replace(/\s+\)/g, ')').replace(/\s*:\s*/, ':').trim();
const unescape = (selector) => selector.replace(/\\(.)/g, '$1');

/** CSS → класс → объявления (вложенные блоки и `@supports` — с пометкой). Разбор по скобкам. */
function parse(css) {
  const out = {};
  const stack = [];
  let text = '';
  let i = 0;
  let ch;
  let head;
  let selectors;
  let classOf;
  let tags;
  for (; i < css.length; i++) {
    ch = css[i];
    if (ch === '{') {
      stack.push(text.trim());
      text = '';
    } else if (ch === '}') {
      flush(text, stack);
      stack.pop();
      text = '';
    } else if (ch === ';') {
      flush(text, stack);
      text = '';
    } else {
      text += ch;
    }
  }
  function flush(declaration, frames) {
    if (!declaration.trim() || declaration.indexOf(':') < 0) {
      return;
    }
    // Первый кадр с классом — его селекторы; остальное (`@supports`, `&:hover`, `:where(…)`) — пометки.
    head = frames.findIndex((frame) => frame[0] === '.' || frame.startsWith(':where(.'));
    if (head < 0) {
      return;
    }
    selectors = frames[head].split(/,(?![^(]*\))/).map((part) => part.trim());
    tags = frames.slice(head + 1).concat(frames.slice(0, head).filter((frame) => frame.startsWith('@supports')))
      .map((frame) => normalize(frame) + '|').join('');
    for (const selector of selectors) {
      classOf = /^(?::where\()?\.((?:\\.|[^\s.:>)\\[])+)/.exec(selector);
      classOf && (out[unescape(classOf[1])] || (out[unescape(classOf[1])] = [])).push(tags + normalize(declaration));
    }
  }
  return out;
}

const tw = await compile(INPUT, options);
const twCss = tw.build(classes);
const expected = parse(twCss.slice(twCss.indexOf('@layer utilities')));

const mn = minotationProvider({
  notationMode: 'tw4-compatible',
  warningMode: 'silent',
  importantMode: 'silent',
  childSelectorMode: 'silent',
  suspectClassMode: 'silent',
  unknownMediaMode: 'silent',
});
mn.setPresets([presetMedias, presetTw4]);
mn.getCompiler('class')(classes.join(' '));
mn.compile();
const actual = parse(mn.styles$.getValue().filter((style) => style.priority > -3000).map((style) => style.content).join('\n'));

let same = 0;
const missing = [];
const differ = [];
for (const name of classes) {
  const want = (expected[name] || []).slice().sort().join(';');
  const got = (actual[name] || []).slice().sort().join(';');
  if (!want) {
    continue;
  }
  want === got ? same++ : got ? differ.push([name, want, got]) : missing.push(name);
}
const total = same + missing.length + differ.length;
const byRoot = {};
for (const name of missing.concat(differ.map((item) => item[0]))) {
  const key = name.replace(/^-/, '').split('-')[0];
  byRoot[key] = (byRoot[key] || 0) + 1;
}
console.log('tw4-conformance: ' + same + ' / ' + total + ' classes match (' + (100 * same / total).toFixed(1) + '%), '
  + missing.length + ' missing, ' + differ.length + ' differ');
console.log('top roots: ' + Object.entries(byRoot).sort((a, b) => b[1] - a[1]).slice(0, 40)
  .map((item) => item[0] + ' ' + item[1]).join(', '));
process.argv[2] && writeFileSync(process.argv[2], JSON.stringify({
  same,
  missing,
  differ,
}, null, 1));
