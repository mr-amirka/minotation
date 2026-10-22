/**
 * The constants of a generated table (lab/no-repeated-string, lab D-017.3): a value the table writes 3+ times becomes
 * `const NAME = "value";`, written once above the table; the table writes `NAME`. Shared by `tw4-statics.mjs` and
 * `tw4-theme.mjs`.
 */

/** How many times a value may be written before it is a constant (the rule's threshold). */
const THRESHOLD = 3;

/**
 * A constant's name for a value: its words in UPPER_SNAKE — `var(--tw-shadow)` → `VAR_TW_SHADOW`, `#0000` → `HEX_0000`,
 * `-100%` → `MINUS_100_PERCENT`, `0.5` → `V_0_5`.
 *
 * @param {string} text the value
 * @returns {string} the name
 */
export function constantName(text) {
  const name = text
    .replace(/^#/, 'hex ')
    .replace(/^-(?=[\d.])/, 'minus ')
    .replace(/%/g, ' percent')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .split(/[^A-Za-z\d]+/)
    .filter(Boolean)
    .map((word) => word.toUpperCase())
    .join('_') || 'SYMBOL';
  return /^\d/.test(name) ? 'V_' + name : name;
}

/**
 * The constants for the values a table writes.
 *
 * @param {string[]} values every value the table writes, as many times as it writes it
 * @param {string[]} taken names the file declares already
 * @returns {{ value: (text: string) => string, body: string }} `value` — how the table writes a value (a constant's
 * name, or the quoted value); `body` — the declarations
 * @example
 * const { value, body } = repeatedConstants(['0', '0', '0', '1'], ['TW4_THEME']);
 * value('0'); // => 'V_0'
 * value('1'); // => '"1"'
 * body;       // => 'const V_0 = "0";'
 */
export function repeatedConstants(values, taken) {
  const counts = new Map();
  for (const text of values) {
    counts.set(text, (counts.get(text) || 0) + 1);
  }
  const names = new Map();
  const used = new Set(taken);
  for (const [text, times] of [...counts].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    if (times < THRESHOLD || text === '') {
      continue;
    }
    let name = constantName(text);
    while (used.has(name)) {
      name += '_';
    }
    used.add(name);
    names.set(text, name);
  }
  return {
    value: (text) => names.get(text) || JSON.stringify(text),
    body: [...names].map(([text, name]) => 'const ' + name + ' = ' + JSON.stringify(text) + ';').join('\n'),
  };
}
