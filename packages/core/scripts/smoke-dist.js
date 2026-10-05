/**
 * Smoke-тест собранного `dist` — CommonJS (`dist/*.js`) и ESM (`dist/esm/*.mjs`).
 * Запускается через: pnpm test:dist
 * Ловит расхождение между исходниками (ts-jest) и тем, что реально грузит Node.
 *
 * Переписан 2026-10-05: прежняя версия звала `createMn`, `register` и `check`
 * давно удалённого API и падала на первой строке — то есть не проверяла ничего.
 */

'use strict';

const cjs = require('../dist/index.js');

let failed = false;

function check(label, actual, expected) {
  if (!actual.includes(expected)) {
    console.error(`FAIL [${label}]: expected to contain:\n  ${expected}\ngot:\n  ${actual}\n`);
    failed = true;
  } else {
    console.log(`ok   [${label}]`);
  }
}

function checkAbsent(label, actual, absent) {
  if (actual.includes(absent)) {
    console.error(`FAIL [${label}]: expected NOT to contain:\n  ${absent}\ngot:\n  ${actual}\n`);
    failed = true;
  } else {
    console.log(`ok   [${label}]`);
  }
}

/** Компилирует токены инстансом `core` с пресетами `presets` (по умолчанию — те же). */
function compile(core, tokens, presets) {
  const warnings = [];
  const mn = core.minotationProvider({ onWarning: (w) => warnings.push(w.type + ' ' + w.token) });
  mn.setPresets(presets || [core.presetStandard, core.presetSynonyms]);
  mn.getCompiler('class')(tokens);
  mn.compile();
  return {
    css: mn.styles$.getValue().map((b) => b.content).join(''),
    warnings: warnings.join(','),
  };
}

/** Одни и те же проверки для обеих сборок. */
function checkBuild(name, core) {
  const { css } = compile(core, 'cF.active cF.38 bgF.12.active mt15.active cF+active cF-i.active p10:h cF');
  // Правила с одинаковым телом группируются: `.cF\.active.active,.cF\+active+active,.cF{…}`.
  check(name + ' self-class + sibling + plain', css, '.cF\\.active.active,.cF\\+active+active,.cF{color:#fff}');
  checkAbsent(name + ' self-class no plain', css, '.cF\\.active{');
  check(name + ' opacity', css, '.cF\\.38{color:rgba(255,255,255,.38)}');
  check(name + ' opacity + self-class', css, '.bgF\\.12\\.active.active{');
  check(name + ' mt + self-class', css, '.mt15\\.active.active{margin-top:15px}');
  check(name + ' important', css, '.cF-i\\.active.active{color:#fff!important}');
  check(name + ' state', css, '.p10\\:h:hover{padding:10px}');
}

checkBuild('cjs', cjs);

// ── ESM-сборка (dist/esm, 2026-10-05) ────────────────────────────────────────
// Node грузит её сам, без бандлера; набор экспортов совпадает с CJS; ошибка
// разбора из пресета ESM-копии ловится инстансом CJS-копии (метка MnParseError).

async function checkEsm() {
  const esm = await import('../dist/esm/index.mjs');
  const mne = await import('../dist/esm/mne.mjs');
  const syntax = await import('../dist/esm/syntaxScan.mjs');
  const cjsKeys = Object.keys(cjs).filter((k) => k !== '__esModule').sort().join(',');
  check('esm exports = cjs exports', Object.keys(esm).sort().join(','), cjsKeys);
  check('esm mne', Object.keys(mne).sort().join(','), 'mnClass,mnKey,mnMap,mne');
  check('esm syntax', Object.keys(syntax).sort().join(','), 'scanTokensSyntax');
  checkBuild('esm', esm);
  const mixed = compile(cjs, 'p10 fx', [esm.presetStandard]);
  check('cjs instance + esm preset', mixed.css, '.p10{padding:10px}');
  check('cross-copy parse-error', mixed.warnings, 'parse-error fx');
}

checkEsm().then(() => {
  if (failed) {
    console.error('\nDist smoke-test FAILED.');
    process.exit(1);
  } else {
    console.log('\nDist smoke-test passed.');
  }
});
