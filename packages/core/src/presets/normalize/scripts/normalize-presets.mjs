/**
 * Генератор пресетов normalize (D-108): берёт эталоны из npm (devDependencies `normalize.css-X.Y.Z`,
 * `modern-normalize-X.Y.Z` — псевдонимы pnpm) и пишет на каждый `src/presets/normalize/<имя>.ts` — правила эталона
 * записями списка `mn.css` в его порядке, с его комментариями.
 *
 * Запуск: `node src/presets/normalize/scripts/normalize-presets.mjs` (из `packages/core`). Файлы результата не
 * правятся руками. Новая версия эталона — новый пресет: строка в {@link PRESETS}, devDependency, экспорт в `index.ts`.
 *
 * Шапка результата — на английском: текст шаблона — строковый литерал, а литералы исходников — только английские
 * (D-022); комментарии эталонов — тоже английские.
 *
 * Разбор — под синтаксис эталонов, не общий CSS: комментарии, правила, объявления. Всё, чего там быть не должно
 * (`@`-правило, вложенные скобки, повтор свойства не подряд — массив сменил бы порядок объявлений), — ошибка.
 */
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
} from '../../shared/scripts/repeated-constants.mjs';

const PARENT_DIR = '..';
const NEWLINE = '\n';
const COMMENT_OPEN = '/*';
const COMMENT_CLOSE = '*/';
const BANNER_OPEN = '/*!';
const NORMALIZE = 'normalize.css';
const MODERN = 'modern-normalize';
const MODERN_FILE = 'modern-normalize.css';
const NORMALIZE_8_PLUS = 'Chrome (last two), Edge (last two), Firefox (last two), Firefox ESR, Internet Explorer 8+, ';

/**
 * Пресеты: имя, пакет-эталон (псевдоним devDependency), файл в нём, браузеры эталона (из его README).
 *
 * @type {[name: string, alias: string, file: string, browsers: string][]}
 */
const PRESETS = [
  [
    'presetNormalize3_0_3', NORMALIZE + '-3.0.3', NORMALIZE,
    'Chrome (latest), Firefox (latest), Firefox ESR, Opera (latest), Safari 6+, Internet Explorer 8+',
  ],
  [
    'presetNormalize4_2_0', NORMALIZE + '-4.2.0', NORMALIZE, NORMALIZE_8_PLUS + 'Opera (last two), Safari 6+',
  ],
  [
    'presetNormalize5_0_0', NORMALIZE + '-5.0.0', NORMALIZE, NORMALIZE_8_PLUS + 'Opera (last two), Safari 6+',
  ],
  [
    'presetNormalize6_0_0', NORMALIZE + '-6.0.0', NORMALIZE,
    NORMALIZE_8_PLUS + 'iOS Safari (last two), Opera (last two), Safari 6+',
  ],
  [
    'presetNormalize7_0_0', NORMALIZE + '-7.0.0', NORMALIZE,
    NORMALIZE_8_PLUS + 'iOS Safari (last two), Opera (last two), Safari 6+',
  ],
  [
    'presetNormalize8_0_1', NORMALIZE + '-8.0.1', NORMALIZE,
    'Chrome, Edge, Firefox ESR+, Internet Explorer 10+, Safari 8+, Opera',
  ],
  [
    'presetModernNormalize1_1_0', MODERN + '-1.1.0', MODERN_FILE, 'the latest Chrome, Firefox, Safari',
  ],
  [
    'presetModernNormalize2_0_0', MODERN + '-2.0.0', MODERN_FILE, 'the latest Chrome, Firefox, Safari',
  ],
  [
    'presetModernNormalize3_0_1', MODERN + '-3.0.1', MODERN_FILE, 'the latest Chrome, Firefox, Safari',
  ],
];

const root = join(dirname(fileURLToPath(import.meta.url)), PARENT_DIR, PARENT_DIR, PARENT_DIR, PARENT_DIR);
const require = createRequire(join(root, 'package.json'));

/**
 * Разбор эталона: баннер `/*! … *\/`, а дальше по порядку — комментарии и правила.
 *
 * @param {string} css текст эталона
 * @param {string} where имя для сообщения об ошибке
 * @returns {{ banner: string, items: Array<{ comment: string } | { selector: string, lead: string[],
 *   decls: Array<{ prop: string, value: string, notes: string[] }> }> }} разобранный эталон
 */
function parse(css, where) {
  const fail = (message) => {
    throw new Error(where + ': ' + message);
  };
  const items = [];
  const n = css.length;
  let banner = '';
  let i = 0;
  while (i < n) {
    while (i < n && /\s/.test(css[i])) {
      i++;
    }
    if (i >= n) {
      break;
    }
    if (css.startsWith(COMMENT_OPEN, i)) {
      const end = css.indexOf(COMMENT_CLOSE, i) + COMMENT_CLOSE.length;
      const text = css.slice(i, end);
      i = end;
      text.startsWith(BANNER_OPEN) ? banner = text : items.push({
        comment: text,
      });
      continue;
    }
    css[i] === '@' && fail('an at-rule');
    const open = css.indexOf('{', i);
    const close = css.indexOf('}', open);
    const selector = css.slice(i, open).replace(/\s+/g, ' ').trim();
    const body = css.slice(open + 1, close);
    body.indexOf('{') > -1 && fail('nested braces in ' + selector);
    i = close + 1;
    const decls = [];
    const lead = [];
    let j = 0;
    while (j < body.length) {
      while (j < body.length && /\s/.test(body[j])) {
        j++;
      }
      if (j >= body.length) {
        break;
      }
      if (body.startsWith(COMMENT_OPEN, j)) {
        const end = body.indexOf(COMMENT_CLOSE, j);
        const text = body.slice(j + COMMENT_OPEN.length, end).trim();
        j = end + COMMENT_CLOSE.length;
        // Пометка `/* 1 */` — к объявлению перед ней; до первого объявления — к правилу.
        (decls.length ? decls[decls.length - 1].notes : lead).push(text);
        continue;
      }
      const semicolon = body.indexOf(';', j);
      const stop = semicolon < 0 ? body.length : semicolon;
      const decl = body.slice(j, stop);
      const colon = decl.indexOf(':');
      j = stop + 1;
      colon < 0 && fail('no colon in "' + decl + '"');
      decls.push({
        prop: decl.slice(0, colon).trim(),
        value: decl.slice(colon + 1).replace(/\s+/g, ' ').trim(),
        notes: [],
      });
    }
    items.push({
      selector, lead, decls,
    });
  }
  banner || fail('no banner');
  return {
    banner, items,
  };
}

/**
 * Комментарий эталона с отступом таблицы.
 *
 * @param {string} text комментарий целиком
 * @returns {string} строки комментария
 */
function comment(text) {
  return text.split(NEWLINE).map((line, i) => {
    const trimmed = line.trim();
    return i === 0 ? '  ' + trimmed : '  ' + (trimmed[0] === '*' ? ' ' : '   ') + trimmed;
  }).join(NEWLINE);
}

/**
 * Свойства правила: повтор подряд — массивом (D-108 F1), повтор не подряд — ошибка.
 *
 * @param {{ selector: string, decls: Array<{ prop: string, value: string, notes: string[] }> }} rule правило
 * @param {string} where имя для сообщения об ошибке
 * @returns {Array<[prop: string, values: string[], notes: string[]]>} свойства в порядке эталона
 */
function properties(rule, where) {
  const out = [];
  let last;
  for (const d of rule.decls) {
    if (last && last[0] === d.prop) {
      last[1].push(d.value);
      last[2].push(...d.notes);
      continue;
    }
    out.some((p) => p[0] === d.prop) && (() => {
      throw new Error(where + ': a non-adjacent repeat of ' + d.prop + ' in ' + rule.selector);
    })();
    out.push(last = [d.prop, [d.value], d.notes.slice()]);
  }
  return out;
}

for (const [name, alias, file, browsers] of PRESETS) {
  const source = require.resolve(alias + '/' + file);
  const version = require(alias + '/package.json').version;
  const title = (alias.startsWith(MODERN) ? MODERN : NORMALIZE) + ' ' + version;
  const {
    banner, items,
  } = parse(readFileSync(source, 'utf8'), alias);
  const rules = items.filter((item) => !item.comment).map((rule) => [rule, properties(rule, alias)]);
  const {
    value, body,
  } = repeatedConstants(rules.flatMap(([rule, props]) => [rule.selector, ...props.flatMap((p) => [p[0], ...p[1]])]), [
    'rules',
  ]);
  const lines = [];
  let r = 0;
  for (const item of items) {
    if (item.comment) {
      lines.push(comment(item.comment));
      continue;
    }
    const [rule, props] = rules[r++];
    lines.push('  [', '    ' + value(rule.selector) + ',', '    {');
    for (const note of rule.lead) {
      lines.push('      // ' + note);
    }
    for (const [prop, values, notes] of props) {
      const written = values.length > 1 ? '[' + values.map(value).join(', ') + ']' : value(values[0]);
      const key = value(prop);
      // Константа — вычисляемым ключом, строка — как есть.
      lines.push('      ' + (key[0] === '"' ? key : '[' + key + ']') + ': ' + written + ','
        + (notes.length ? ' // ' + [...new Set(notes)].join(', ') : ''));
    }
    lines.push('    },', '  ],');
  }
  const target = join(root, 'src', 'presets', 'normalize', name + '.ts');
  writeFileSync(target, `${banner}
/**
 * @overview The preset "${title}" reproduces its reference exactly (D-108): the same selectors, declarations and
 * order. Reference browsers: ${browsers}.
 *
 * Rules are entries of the \`mn.css\` list (D-108 F3): a rule never merges with an earlier one of the same selector;
 * a repeated property is an array (F1). Comments are the reference's. Checked against npm by
 * \`__tests__/exact.test.ts\`. Generated by \`scripts/normalize-presets.mjs\` from \`${alias}\`; don't edit by hand.
 */
import type {
  MnCssEntry,
  MnInstance,
} from '../../types';
import type {
  MnPresetObject,
} from '../../core/types';

${body}

/**
 * The reference's rules in its order: ${rules.length}. A function, not a module-level table: the keys are computed
 * (\`[BORDER]\`), and a bundler keeps such a table even when the preset isn't imported (D-110).
 */
function rules(): MnCssEntry[] {
  return [
${lines.join(NEWLINE).split(NEWLINE).map((line) => (line ? '  ' + line : line)).join(NEWLINE)}
  ];
}

/** ${title} — ${browsers}. */
export const ${name}: MnPresetObject = {
  name: '${name}',
  setup: (mn: MnInstance) => {
    mn.css(rules());
  },
};
`);
  // Стиль проекта — тем же линтером, что и весь код.
  execFileSync('npx', ['eslint', '--fix', target], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log('normalize-presets: ' + name + ' — ' + rules.length + ' rules → ' + target);
}
