/**
 * Smoke-тест dist/index.js — проверяет реальный скомпилированный вывод.
 * Запускается через: npm run test:dist
 * Ловит расхождение между исходниками (ts-jest) и dist (node).
 */

'use strict';

const { createMn } = require('../dist/index.js');

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

function css(tokens, presetsFn) {
  const mn = createMn();
  if (presetsFn) presetsFn(mn);
  mn.check(tokens);
  mn.compile();
  return mn.styles$.getValue().map(s => s.content).join('');
}

// ── self-class условия (.WORD) ────────────────────────────────────────────────

{
  const mn = createMn();
  mn.register('c', ctx => ({ style: { color: ctx.arg } }));
  mn.register('bgc', ctx => ({ style: { backgroundColor: ctx.arg } }));
  mn.register('mt', ctx => ({ style: { marginTop: ctx.arg + 'px' } }));
  mn.check('cF.active cF.38 cF.38.active bgcF.12.active mt15.active cF.active.paused cF');
  mn.compile();
  const out = mn.styles$.getValue().map(s => s.content).join('');

  // Селектор содержит self-class суффикс
  check('cF.active selector', out, '.cF\\.active.active');
  // НЕ простой класс без суффикса
  checkAbsent('cF.active no plain', out, '.cF\\.active{');

  // .38 — opacity в arg, нет self-class
  check('cF.38 plain selector', out, '.cF\\.38{');

  // opacity + self-class
  check('cF.38.active selector', out, '.cF\\.38\\.active.active');

  // bgc + opacity + self-class
  check('bgcF.12.active selector', out, '.bgcF\\.12\\.active.active');

  // mt + self-class
  check('mt15.active selector', out, '.mt15\\.active.active');

  // два self-class условия
  check('cF.active.paused selector', out, '.cF\\.active\\.paused.active.paused');

  // без self-class
  check('cF plain selector', out, '.cF{');

  // handler получает чистый arg (без .active)
  let receivedArg;
  const mn2 = createMn();
  mn2.register('c', ctx => { receivedArg = ctx.arg; return { style: { color: ctx.arg } }; });
  mn2.check('cF.active');
  mn2.compile();
  if (receivedArg !== 'F') {
    console.error(`FAIL [handler arg for cF.active]: expected "F", got "${receivedArg}"`);
    failed = true;
  } else {
    console.log('ok   [handler arg for cF.active]');
  }

  // handler с opacity: arg должен быть F.38
  mn2.check('cF.38.active');
  mn2.compile();
  if (receivedArg !== 'F.38') {
    console.error(`FAIL [handler arg for cF.38.active]: expected "F.38", got "${receivedArg}"`);
    failed = true;
  } else {
    console.log('ok   [handler arg for cF.38.active]');
  }
}

// ── self-class условия (+WORD) ────────────────────────────────────────────────

{
  const mn = createMn();
  mn.register('c', ctx => ({ style: { color: ctx.arg } }));
  mn.register('bgc', ctx => ({ style: { backgroundColor: ctx.arg } }));
  mn.check('cF+active bgcF+12+active cF+38 cF.38+active');
  mn.compile();
  const out = mn.styles$.getValue().map(s => s.content).join('');

  check('cF+active selector', out, '.cF\\+active+active');
  checkAbsent('cF+active no plain', out, '.cF\\+active{');

  check('bgcF+12+active selector', out, '.bgcF\\+12\\+active+active');

  // +38 → числовой, нет adjacent sibling
  check('cF+38 plain selector', out, '.cF\\+38{');
  checkAbsent('cF+38 no adjacent', out, '.cF\\+38+');

  check('cF.38+active selector', out, '.cF\\.38\\+active+active');
}

// ── important ────────────────────────────────────────────────────────────────

{
  const mn = createMn();
  mn.register('c', ctx => ({ style: { color: ctx.arg } }));
  // Правильная форма: -i ДО self-class
  mn.check('cF-i.active cF-i+active cF.active-i cF+active-i');
  mn.compile();
  const out = mn.styles$.getValue().map(s => s.content).join('');
  // cF-i.active → important, selector .cF-i\.active.active
  check('cF-i.active selector', out, '.cF-i\\.active.active');
  check('cF-i.active !important', out, '!important');
  // cF-i+active → important, adjacent sibling
  check('cF-i+active selector', out, '.cF-i\\+active+active');
  // cF.active-i → -i часть имени класса, НЕ important; selector .cF\.active-i.active-i
  check('cF.active-i selector', out, '.cF\\.active-i.active-i');
  checkAbsent('cF.active-i no important', out, '.cF\\.active-i.active-i{color:undefined!important');
  // cF+active-i → аналогично; selector .cF\+active-i+active-i
  check('cF+active-i selector', out, '.cF\\+active-i+active-i');
}

// ── сводка ───────────────────────────────────────────────────────────────────

if (failed) {
  console.error('\nDist smoke-test FAILED.');
  process.exit(1);
} else {
  console.log('\nDist smoke-test passed.');
}
