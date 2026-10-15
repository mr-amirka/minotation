// @ts-nocheck
/* eslint-disable */
/**
 * Смоук-тесты presetNormalize.
 *
 * mn.assign пресета ссылается на эссенции (lh115%, bxzBB, bgTransparent
 * и т.п.), зарегистрированные presetStandard. До D-045 без них правила молча не
 * рендерились; теперь пресеты объявляют `requires`, и неподключённая зависимость — ошибка.
 */

const mnProvider = require('../../..').default || require('../../..').minotationProvider;
const presetStandard = require('../../standard').default || require('../../standard');
const presetNormalize = require('..').default || require('..');

function compile(presets) {
  const errors = [];
  const mn = mnProvider({
    presets,
    onError: (e) => errors.push(e),
  });
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s) => s.content).join(''),
    errors,
  };
}

describe('presetNormalize', () => {
  test('компилируется без ошибок вместе с presetStandard', () => {
    const { errors } = compile([presetStandard, presetNormalize]);
    expect(errors).toEqual([]);
  });

  test('body{margin:0} (объединён с другими селекторами)', () => {
    const { css } = compile([presetStandard, presetNormalize]);
    expect(css).toMatch(/\bbody\b[^{]*\{[^}]*margin:0/);
  });

  test('a — регресс: background:transparent рендерится (раньше colorGetBackground падал на именованных синонимах)', () => {
    const { css, errors } = compile([presetStandard, presetNormalize]);
    expect(errors).toEqual([]);
    expect(css).toContain('a{');
    expect(css).toMatch(/a\{[^}]*background:transparent/);
  });

  test('abbr[title] — регресс: атрибутный селектор не терялся (flags() корёжил "." и "[...]" как путь)', () => {
    const { css } = compile([presetStandard, presetNormalize]);
    expect(css).toContain('abbr[title]{text-decoration:underline}');
  });

  test('button, [type=(button|reset|submit)] — регресс: группа-альтернатива в атрибутном селекторе не терялась', () => {
    const { css } = compile([presetStandard, presetNormalize]);
    expect(css).toContain('button,[type=button],[type=reset],[type=submit]{appearance:button}');
  });
});
