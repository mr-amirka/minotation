#!/usr/bin/env node
/**
 * Быстрая проверка: во что компилируется токен нотации.
 *
 * Зачем: единственный надёжный способ ответить на вопрос «умеет ли minotation такое» —
 * скомпилировать и посмотреть. Ответ по памяти или по беглому чтению `HANDLERS.md`
 * регулярно оказывался неверным: возможность была, просто называлась иначе или требовала
 * экранирования (см. `RESEARCH/04_v1-v2-parity-audit`).
 *
 * Использование:
 *   pnpm try 'gtc1fr_auto'
 *   pnpm try 'cr' 'r0_10_10_0' 'gtc1fr@-760'
 *   pnpm try 'gtcRepeat\(auto-fit,minmax\(240px,1fr\)\)'
 *
 * Скобки в значении нужно экранировать — иначе парсер считает их границей группы
 * вариантов `(a|b)` и вырезает. Кавычки в shell обязательны: `\` и `(` иначе съест сам shell.
 */
import { minotationProvider, presetStandard, presetSynonyms, presetMedias, presetPrefixes } from '../dist/index.js';

const tokens = process.argv.slice(2);

if (tokens.length === 0) {
  console.error('Укажите хотя бы один токен. Пример: pnpm try \'gtc1fr_auto\'');
  process.exit(1);
}

const withPrefixes = process.env.MN_PREFIXES === '1';

for (const token of tokens) {
  const warnings = [];
  const mn = minotationProvider({ onWarning: (w) => warnings.push(w) });
  mn.setPresets([
    presetStandard,
    presetSynonyms,
    presetMedias,
    ...(withPrefixes ? [presetPrefixes] : []),
  ]);
  mn.getCompiler('class')(token);
  mn.compile();

  const css = mn.styles$.getValue().map((s) => s.content).join('');

  console.log('\n' + token);
  if (css) {
    console.log('  → ' + css);
  } else {
    console.log('  → ничего не скомпилировалось');
  }
  for (const w of warnings) {
    console.log(`  ⚠️  ${w.type}: ${w.message}`);
  }
}

if (!withPrefixes) {
  console.log('\n(вендорные префиксы выключены; MN_PREFIXES=1 — включить presetPrefixes)');
}
