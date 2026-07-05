/**
 * Извлечение MN-токенов из исходного кода.
 * Используется всеми интеграциями: Vite, Webpack, CLI.
 */

// Не зависит от attr — один экземпляр на модуль
const _INTERP_RE = /\$\{[^}]*\}/g;

// Кеш регексов по attr: каждый уникальный attr компилируется ровно один раз
const _reCache = new Map<string, readonly [RegExp, RegExp, RegExp]>();

function _getRegexes(attr: string): readonly [RegExp, RegExp, RegExp] {
  let regs = _reCache.get(attr);
  if (!regs) {
    regs = [
      // attr="..." | attr='...'  (JSX-атрибут)
      new RegExp(`${attr}="([^"]*)"|${attr}='([^']*)'`, 'g'),
      // attr={`...`}  (template literal, берём только статические части)
      new RegExp(`${attr}=\\{\\s*\`([^\`]*)\`\\s*\\}`, 'g'),
      // attr: '...' | attr: "..."  (объектный литерал, например slotProps MUI)
      new RegExp(`${attr}:\\s*"([^"]*)"|${attr}:\\s*'([^']*)'`, 'g'),
    ];
    _reCache.set(attr, regs);
  }
  return regs;
}

/**
 * Извлекает MN-токены из строки исходного кода.
 *
 * Обрабатывает три паттерна:
 * - `attr="..."` / `attr='...'` — JSX-атрибуты
 * - `` attr={`...`} `` — template literals (статические части между `${...}`)
 * - `attr: '...'` / `attr: "..."` — объектные литералы (MUI `slotProps`, и т.п.)
 *
 * Регулярные выражения кешируются по значению `attr` — строятся один раз
 * на уникальный атрибут за весь жизненный цикл процесса.
 *
 * @param source - исходный код файла (TSX, JSX, HTML, Vue, Svelte, …)
 * @param attr - имя атрибута (`'class'`, `'className'`, `'mn'`, …)
 * @returns массив токенов (дубли возможны — дедупликацию делает вызывающий код)
 *
 * @example
 * extractTokens('<div className="p10 cF00">…</div>', 'className')
 * // → ['p10', 'cF00']
 *
 * extractTokens('slotProps={{ paper: { className: "w320 ov" } }}', 'className')
 * // → ['w320', 'ov']
 */
export function extractTokens(source: string, attr: string): string[] {
  const tokens: string[] = [];
  const [
    attrRe,
    tmplRe,
    objRe,
  ] = _getRegexes(attr);

  for (const m of source.matchAll(attrRe)) {
    const val = m[1] || m[2];
    if (val) {
      for (const t of val.split(/\s+/)) {
        if (t) {
          tokens.push(t);
        }
      }
    }
  }

  for (const m of source.matchAll(tmplRe)) {
    const val = m[1];
    if (!val) {
      continue;
    }
    for (const part of val.split(_INTERP_RE)) {
      for (const t of part.split(/\s+/)) {
        if (t) {
          tokens.push(t);
        }
      }
    }
  }

  for (const m of source.matchAll(objRe)) {
    const val = m[1] || m[2];
    if (val) {
      for (const t of val.split(/\s+/)) {
        if (t) {
          tokens.push(t);
        }
      }
    }
  }

  return tokens;
}
