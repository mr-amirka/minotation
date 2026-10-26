/**
 * Smoke-тест собранного `dist` — CommonJS (`dist/*.js`), ESM (`dist/esm/*.mjs`) и браузерная (`dist/browser/*.mjs`).
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

// ── Браузерная сборка (dist/browser, 2026-10-26) ─────────────────────────────
// Бандл для браузера через имя пакета (условие `browser` в `exports`) не содержит `typescript`:
// раньше общий чанк ESM-сборки импортировал его статически — 1 081 КБ gzip вместо 57 (письмо
// fundamentool). Сама сборка: те же экспорты, тот же вывод, сканер с `syntax: true` разбирает
// текстом и говорит почему.

const BROWSER_ENTRY = "import { minotationProvider, presetStandard } from 'minotation';\n"
  + 'const mn = minotationProvider();\n'
  + 'mn.setPresets([presetStandard]);\n'
  + "window.c = mn.getCompiler('class');\n";

/** Верхняя граница gzip-размера бандла выше: 45 КБ на 2026-10-26, запас — на рост пресетов. */
const BROWSER_GZIP_LIMIT = 80 * 1024;

async function checkBrowser() {
  const esbuild = require('esbuild');
  const zlib = require('zlib');
  const result = await esbuild.build({
    stdin: { contents: BROWSER_ENTRY, resolveDir: __dirname, loader: 'js' },
    bundle: true,
    minify: true,
    platform: 'browser',
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  const inputs = Object.keys(result.metafile.inputs);
  check('browser bundle via exports.browser', inputs.join(','), 'dist/browser/index.mjs');
  checkAbsent('browser bundle without typescript', inputs.join(','), 'typescript');
  const gzip = zlib.gzipSync(result.outputFiles[0].contents, { level: 9 }).length;
  check('browser bundle gzip <= ' + BROWSER_GZIP_LIMIT, String(gzip <= BROWSER_GZIP_LIMIT), 'true');

  const browser = await import('../dist/browser/index.mjs');
  const cjsKeys = Object.keys(cjs).filter((k) => k !== '__esModule').sort().join(',');
  check('browser exports = cjs exports', Object.keys(browser).sort().join(','), cjsKeys);
  checkBuild('browser', browser);
  const warnings = [];
  const scan = browser.createScanner({ attr: 'class', syntax: true, onWarning: (m) => warnings.push(m) });
  check('browser scanner by text', scan('<div class="p10"></div>', 'App.tsx').join(','), 'p10');
  check('browser scanner says why', warnings.join(''), 'runs in Node only');
}

// ── Разрешение `exports` (2026-10-26, письмо web-games) ──────────────────────
// jest в окружении jsdom ставит условие `browser` и грузит модули через `require`: ему нельзя
// отдать `.mjs`. Свой `require` Node 22+ грузит `.mjs` и этого не ловит, поэтому разрешаем
// `exports` по алгоритму Node сами: ключи по порядку, первый подходящий.

/**
 * Файл, который получит потребитель с данным набором условий.
 *
 * @param target — значение из `exports`
 * @param conditions — условия резолвера (`default` подходит всегда)
 */
function resolveExport(target, conditions) {
  if (typeof target === 'string') return target;
  for (const key of Object.keys(target)) {
    if (key === 'default' || conditions.includes(key)) {
      const found = resolveExport(target[key], conditions);
      if (found) return found;
    }
  }
  return null;
}

function checkExports() {
  const { exports } = require('../package.json');
  const fs = require('fs');
  const path = require('path');
  const cases = [
    ['require', ['require']],
    ['require+browser', ['require', 'browser']],
    ['import', ['import']],
    ['import+browser', ['import', 'browser']],
  ];
  for (const entry of Object.keys(exports)) {
    for (const [label, conditions] of cases) {
      const file = resolveExport(exports[entry], conditions);
      const name = 'exports ' + entry + ' ' + label;
      check(name + ' exists', String(Boolean(file) && fs.existsSync(path.join(__dirname, '..', file))), 'true');
      // CommonJS-потребитель получает CommonJS, ESM-потребитель — ESM.
      const isEsm = Boolean(file) && file.endsWith('.mjs');
      check(name + ' format', isEsm ? 'esm' : 'cjs', conditions[0] === 'import' ? 'esm' : 'cjs');
    }
  }
}

checkExports();

checkEsm().then(checkBrowser).then(() => {
  if (failed) {
    console.error('\nDist smoke-test FAILED.');
    process.exit(1);
  } else {
    console.log('\nDist smoke-test passed.');
  }
});
