/**
 * Полный аудит кратких записей (D-113).
 *
 * ## Зачем
 *
 * Аудит D-094 (RESEARCH/18) пробовал у хендлеров шесть слов-образцов (`None`, `Auto`, `Solid`, `Hidden`, `Center`,
 * `Block`), поэтому полные записи остальных слов проходили годами: `mAuto` рядом с `mA`, `bsSolid` рядом с `bsS`,
 * `tfo_left` рядом с `tfoL`, `posAbsolute`, `fwBold`, `anNone`. Здесь пробуется **каждое** ключевое слово, которое
 * грамматика CSS (`css-tree` с `mdn-data`) даёт свойству хендлера, — в обеих записях (`hEaseOut`, `h_ease-out`) и
 * не только первой частью (`h1_EaseOut`, `h_1_ease-out`).
 *
 * ## Правило
 *
 * Слово CSS в нотации пишется буквой; полная запись слова, которая даёт CSS, — дефект: либо вторая запись того же
 * значения (буква есть), либо слово без буквы. Не сокращаются имена, функции и числа (D-113, п. 4). Слова, буква
 * которых ждёт решения владельца (совпадение букв, имена вместо слов), перечислены в {@link PENDING} со ссылкой на
 * вопрос; запись из этого списка, которая больше не проходит, — тоже ошибка: список не отстаёт от кода.
 *
 * `css-tree` — devDependency, в рантайм ядра не попадает.
 */
import {
  minotationProvider,
} from '../../../core';
import presetStandard from '..';
import {
  lexer,
} from 'css-tree';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Имена всех эссенций пресета — собираются с него же, а не списком. */
function collectHandlerNames(): string[] {
  const mn: any = minotationProvider();
  const names: string[] = [];
  const spy = new Proxy(mn, {
    apply(
      target, thisArg, args: any[],
    ) {
      if (typeof args[0] === 'string') {
        names.push(args[0]);
      } else if (args[0] && typeof args[0] === 'object') {
        names.push(...Object.keys(args[0]));
      }
      return Reflect.apply(
        target as any, thisArg, args,
      );
    },
  });
  presetStandard.setup(spy as any);
  return Array.from(new Set(names));
}

/** Компилирует токены одним инстансом: токен → объявления его правила (`prop:value;…`). */
function compileAll(tokens: string[]): Record<string, string> {
  const mn: any = minotationProvider({
    warningMode: 'silent',
  });
  mn.setPresets([presetStandard]);
  const compile = mn.getCompiler('class');
  for (const token of tokens) {
    compile(token);
  }
  mn.compile();
  const css = mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
  const out: Record<string, string> = {};
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    for (const selector of m[1].split(',')) {
      const s = selector.trim();
      if (s[0] !== '.') {
        continue;
      }
      const cls = s.slice(1).replace(/\\(.)/g, '$1');
      out[cls] = (out[cls] ? out[cls] + ';' : '') + m[2];
    }
  }
  return out;
}

/** Значения свойства `prop` в объявлениях `decls`. */
function valuesOf(decls: string | undefined, prop: string): string[] {
  const out: string[] = [];
  for (const decl of (decls || '').split(';')) {
    const at = decl.indexOf(':');
    at > 0 && decl.slice(0, at).trim() === prop && out.push(decl.slice(at + 1).trim());
  }
  return out;
}

/** Есть ли слово `word` среди слов значений свойства. */
function hasWord(
  decls: string | undefined, prop: string, word: string,
): boolean {
  return valuesOf(decls, prop).some((v) => v.split(/[\s,/]+/).includes(word));
}

/**
 * Пробы для поиска свойств хендлера. `Inherit` и `_inherit` подходят любому свойству — иначе хендлер, которому не
 * подошла ни одна буква (`ts`, `gaf`), выпадал бы из аудита.
 */
const PROBES = [
  '',
  'N',
  'A',
  'S',
  'B',
  'C',
  'H',
  'L',
  'R',
  'T',
  'F',
  'I',
  'D',
  'P',
  'M',
  'E',
  '1',
  '0',
  '10',
  'Inherit',
  '_inherit',
  'Unset',
];

/** CSS-свойства хендлера; свойство с одним и тем же значением при разных пробах — побочное (`display:flex`). */
function propsOf(names: string[]): Record<string, string[]> {
  const tokens: string[] = [];
  for (const name of names) {
    for (const probe of PROBES) {
      tokens.push(name + probe);
    }
  }
  const res = compileAll(tokens);
  const props: Record<string, string[]> = {};
  for (const name of names) {
    const seen: Record<string, Set<string>> = {};
    const count: Record<string, number> = {};
    for (const probe of PROBES) {
      for (const decl of (res[name + probe] || '').split(';')) {
        const at = decl.indexOf(':');
        const prop = decl.slice(0, at).trim();
        if (at > 0 && prop) {
          (seen[prop] = seen[prop] || new Set()).add(decl.slice(at + 1).trim());
          count[prop] = (count[prop] || 0) + 1;
        }
      }
    }
    props[name] = Object.keys(seen).filter((prop) => count[prop] < 2 || seen[prop].size > 1);
  }
  return props;
}

/** Ключевые слова свойства по грамматике; аргументы функций (`srgb`, `ltr`) — не слова свойства. */
function keywordsOf(prop: string): string[] {
  const out = new Set<string>();
  const seen = new Set<string>();
  function walk(node: any): void {
    if (!node) {
      return;
    }
    switch (node.type) {
      case 'Keyword':
        out.add(node.name);
        break;
      case 'Group':
        node.terms.forEach(walk);
        break;
      case 'Multiplier':
        walk(node.term);
        break;
      case 'Type': {
        if (node.name.endsWith('()') || seen.has('t:' + node.name)) {
          return;
        }
        seen.add('t:' + node.name);
        const type: any = lexer.getType(node.name);
        type && type.syntax && walk(type.syntax);
        break;
      }
      case 'Property': {
        if (seen.has('p:' + node.name)) {
          return;
        }
        seen.add('p:' + node.name);
        const p: any = lexer.getProperty(node.name);
        p && p.syntax && walk(p.syntax);
        break;
      }
      default:
        break;
    }
  }
  const p: any = lexer.getProperty(prop);
  p && p.syntax && walk(p.syntax);
  return Array.from(out);
}

const GLOBAL = new Set([
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);

/** Слово CSS в записи нотации: `ease-out` → `EaseOut`. */
function camel(word: string): string {
  return word.replace(/^-/, '').split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

/** Первые части значения, после которых слово пробуется не первым (`m1_Auto`, `bsN_Solid`). */
const LEADS = [
  '1',
  '0',
  '10',
  '1_1',
  '1s',
  'N',
  'A',
  'S',
];

/**
 * Полные записи, буква которых ждёт решения владельца. Ключ — вопрос в
 * `PROJECTS_CONTEXT/minotation/AGENT_DRAFT/RESEARCH/22_abbreviation-sweep-2026-10-27.md`; значение — хендлеры и слова.
 */
const PENDING: Record<string, [string[], string[]]> = {
  // `MC` у обоих слов.
  'Q1 min-content/max-content': [
    [
      'sq',
      'sqmin',
      'sqmax',
      'w',
      'wmin',
      'wmax',
      'h',
      'hmin',
      'hmax',
      'iz',
      'izmin',
      'izmax',
      'bz',
      'bzmin',
      'bzmax',
      'fx',
      'fxb',
      'g',
      'gt',
      'gtc',
      'gtr',
      'gac',
      'gar',
    ],
    [
      'min-content',
      'max-content',
    ],
  ],
  // Первая часть `an` — всегда имя (D-111): `anAlternate` — анимация с именем `alternate`; `none` не первой частью
  // (`an1_None`) — это `animation-fill-mode`.
  'Q2 animation keywords': [
    ['an'],
    [
      'alternate',
      'alternate-reverse',
      'auto',
      'backwards',
      'both',
      'forwards',
      'infinite',
      'normal',
      'paused',
      'reverse',
      'running',
      'none',
    ],
  ],
  'Q3 appearance T/M': [
    ['ap'],
    [
      'textarea',
      'textfield',
      'menulist',
      'meter',
    ],
  ],
  // `A` у цвета — hex.
  'Q4 color auto': [
    [
      'acc',
      'cc',
    ],
    ['auto'],
  ],
  // Значение — имя: `cnN` — контейнер с именем `n`.
  'Q5 none among names': [
    [
      'cn',
      'coi',
      'cor',
    ],
    ['none'],
  ],
  'Q6 generic font families': [
    ['ff'],
    [
      'cursive',
      'fangsong',
      'fantasy',
      'kai',
      'math',
      'monospace',
      'nastaliq',
      'sans-serif',
      'serif',
      'system-ui',
      'ui-monospace',
      'ui-rounded',
      'ui-sans-serif',
      'ui-serif',
      'BlinkMacSystemFont',
    ],
  ],
  // `N` — `none`.
  'Q7 normal next to none': [
    [
      'tn',
      'cnt',
    ],
    ['normal'],
  ],
  'Q7 allow-discrete': [
    ['tn'],
    ['allow-discrete'],
  ],
};

/** Пробы для поиска двойников: без CSS-wide (они у всех одинаковы), с частыми двухбуквенными. */
const TWIN_PROBES = [
  '',
  'N',
  'A',
  'S',
  'B',
  'C',
  'H',
  'L',
  'R',
  'T',
  'F',
  'I',
  'D',
  'P',
  'M',
  'E',
  'SK',
  'ST',
  'CT',
  'CV',
  'DB',
  'DT',
  'DS',
  'SB',
  'FS',
  'FE',
  '1',
  '0',
  '10',
];

/**
 * Двойники, которые ждут решения владельца (RESEARCH/22, Q8): у `position` рядом с буквами `pos` есть хендлеры-слова.
 */
const TWINS_PENDING = [
  'pos = rlv',
  'posA = abs',
  'posF = fixed',
  'posS = static',
  'posSK = sticky',
];

describe('Аудит кратких записей (D-113)', () => {
  const names = collectHandlerNames();
  const props = propsOf(names);
  const rows: Array<{ name: string;
    prop: string;
    word: string }> = [];
  for (const name of names) {
    for (const prop of props[name]) {
      for (const word of keywordsOf(prop)) {
        // Слово из одной буквы и есть буква (`sstX`).
        GLOBAL.has(word) || word.length < 2 || rows.push({
          name,
          prop,
          word,
        });
      }
    }
  }
  // Первая часть, которую хендлер не принимает, не принимается и перед словом — такие пары не пробуются.
  const leadTokens: string[] = [];
  for (const name of names) {
    for (const lead of LEADS) {
      leadTokens.push(name + lead, name + '_' + lead);
    }
  }
  const leads = compileAll(leadTokens);
  const tokens: string[] = [];
  for (const {
    name, word,
  } of rows) {
    tokens.push(name + camel(word), name + '_' + word);
    for (const lead of LEADS) {
      leads[name + lead] && tokens.push(name + lead + '_' + camel(word));
      leads[name + '_' + lead] && tokens.push(name + '_' + lead + '_' + word);
    }
  }
  const res = compileAll(tokens);
  const pending = new Set<string>();
  for (const [
    handlers,
    words,
  ] of Object.values(PENDING)) {
    for (const name of handlers) {
      for (const word of words) {
        pending.add(name + ' ' + word);
      }
    }
  }
  const accepted = new Map<string, string>();
  for (const {
    name, prop, word,
  } of rows) {
    const key = name + ' ' + word;
    if (accepted.has(key)) {
      continue;
    }
    const written = [
      name + camel(word),
      name + '_' + word,
    ];
    for (const lead of LEADS) {
      // Слово уже в первой части — вторая ничего не доказывает (`mA_Auto` при `mA` → `auto`).
      hasWord(
        leads[name + lead], prop, word,
      ) || written.push(name + lead + '_' + camel(word));
      hasWord(
        leads[name + '_' + lead], prop, word,
      ) || written.push(name + '_' + lead + '_' + word);
    }
    const token = written.find((t) => hasWord(
      res[t], prop, word,
    ));
    token && accepted.set(key, token + ' → ' + prop + ': ' + valuesOf(res[token], prop).join(', '));
  }

  test('аудит видит пресет целиком', () => {
    expect(names.length).toBeGreaterThan(400);
    // Хендлер без свойства — переименованный (`e`, `apc`), дочерний (`tbl.cell`) или из одних функций (`ft`:
    // `ftBlur4`), а у функций слов нет.
    expect(names.filter((name) => !props[name].length).sort()).toEqual([
      'apc',
      'contrast',
      'e',
      'ft',
      'ftb',
      'jt',
      'lt',
      'rt',
      'tbl.cell',
      'ww',
    ]);
    expect(rows.length).toBeGreaterThan(10000);
  });

  test('полная запись слова не даёт CSS — только буква', () => {
    const unexpected = Array.from(accepted.entries())
      .filter(([key]) => !pending.has(key))
      .map(([, sample]) => sample);
    expect(unexpected).toEqual([]);
  });

  test('два хендлера не дают одного правила', () => {
    // `fxaCenter` и `fxaC` были двумя хендлерами с одним правилом: аудит выше пробует слова после имени, а здесь
    // длинное слово было частью самого имени. Правило сравнивается вместе с дочерними (`cfx` — это `posS` плюс
    // `:before`/`:after`, не двойник).
    const tokens: Array<[string, string]> = [];
    for (const name of names) {
      for (const probe of TWIN_PROBES) {
        tokens.push([
          name,
          name + probe,
        ]);
      }
    }
    const res = compileAll(tokens.map(([, token]) => token));
    const children: Record<string, string[]> = {};
    for (const cls of Object.keys(res)) {
      const at = cls.search(/[:\s>]/);
      at > 0 && (children[cls.slice(0, at)] = children[cls.slice(0, at)] || []).push(cls.slice(at) + res[cls]);
    }
    const byRule = new Map<string, Map<string, string>>();
    for (const [
      name,
      token,
    ] of tokens) {
      if (!res[token]) {
        continue;
      }
      const rule = res[token] + '|' + (children[token] || []).sort().join('|');
      const group = byRule.get(rule) || new Map<string, string>();
      byRule.set(rule, group);
      group.has(name) || group.set(name, token);
    }
    const twins = Array.from(byRule.values()).filter((group) => group.size > 1)
      .map((group) => Array.from(group.values()).join(' = '))
      .sort();
    expect(twins).toEqual(TWINS_PENDING);
  });

  test('список ожидающих решения не отстаёт от кода', () => {
    const stale = Array.from(pending).filter((key) => !accepted.has(key)
      // Хендлер или слово, которых нет в аудите, — тоже устаревшая запись.
      && rows.some((row) => row.name + ' ' + row.word === key));
    const unknown = Array.from(pending).filter((key) => !rows.some((row) => row.name + ' ' + row.word === key));
    expect(stale).toEqual([]);
    expect(unknown).toEqual([]);
  });
});
