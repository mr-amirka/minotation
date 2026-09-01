// @ts-nocheck
/* eslint-disable */
/**
 * Смоук-тесты presetNormalize и presetMain.
 *
 * mn.assign() в этих пресетах ссылается на эссенции (lh115%, bxzBB, bgTransparent
 * и т.п.), зарегистрированные presetStandard — поэтому presetStandard обязателен
 * в комбинации, иначе правила молча не срендерятся (essence lookup вернёт пусто).
 */

const mnProvider = require('../index').default || require('../index').minotationProvider;
const presetStandard = require('../presets/standard').default || require('../presets/standard');
const presetSynonyms = require('../presets/synonyms').default || require('../presets/synonyms');
const presetMedias = require('../presets/medias').default || require('../presets/medias');
const presetNormalize = require('../presets/normalize').default || require('../presets/normalize');
const presetMain = require('../presets/main').default || require('../presets/main');

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

describe('presetMain', () => {
  test('компилируется без ошибок вместе с presetStandard', () => {
    const { errors } = compile([presetStandard, presetMain]);
    expect(errors).toEqual([]);
  });

  test('html{-webkit-tap-highlight-color:#000}', () => {
    const { css } = compile([presetStandard, presetMain]);
    expect(css).toContain('-webkit-tap-highlight-color:#000');
  });

  test('*, *:before, *:after{box-sizing:border-box}', () => {
    const { css } = compile([presetStandard, presetMain]);
    expect(css).toContain('box-sizing:border-box');
  });
});

describe('Полная связка (как в реальном использовании)', () => {
  test('presetStandard + presetSynonyms + presetMedias + presetNormalize + presetMain — без ошибок', () => {
    const { errors, css } = compile([
      presetStandard,
      presetSynonyms,
      presetMedias,
      presetNormalize,
      presetMain,
    ]);
    expect(errors).toEqual([]);
    expect(css.length).toBeGreaterThan(0);
  });
});
