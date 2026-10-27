// @ts-nocheck
/* eslint-disable */
/**
 * Смоук-тесты presetMain и полной связки с presetNormalize8_0_1 (D-108).
 *
 * mn.assign в пресетах ссылается на эссенции (lh115%, bxzBB, bgTransparent
 * и т.п.), зарегистрированные presetStandard, а presetMain — ещё и на медиа `@mouse`
 * из presetMedias. До D-045 без них правила молча не рендерились; теперь пресеты
 * объявляют `requires`, и неподключённая зависимость — ошибка.
 */

const mnProvider = require('../../..').default || require('../../..').minotationProvider;
const presetStandard = require('../../standard').default || require('../../standard');
const presetSynonyms = require('../../synonyms').default || require('../../synonyms');
const presetMedias = require('../../medias').default || require('../../medias');
const { presetNormalize8_0_1: presetNormalize } = require('../../normalize');
const presetMain = require('..').default || require('..');

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

describe('presetMain', () => {
  test('без presetMedias — ошибка о зависимости (D-045): иначе a{cursor:pointer}@mouse пропадал молча', () => {
    expect(() => compile([presetStandard, presetMain]))
      .toThrow('[minotation] presetMain requires "presetMedias", which is not connected.');
  });

  test('компилируется без ошибок вместе с presetStandard', () => {
    const { errors } = compile([presetStandard, presetMedias, presetMain]);
    expect(errors).toEqual([]);
  });

  test('html{-webkit-tap-highlight-color:#000}', () => {
    const { css } = compile([presetStandard, presetMedias, presetMain]);
    expect(css).toContain('-webkit-tap-highlight-color:#000');
  });

  test('*, *:before, *:after{box-sizing:border-box}', () => {
    const { css } = compile([presetStandard, presetMedias, presetMain]);
    expect(css).toContain('box-sizing:border-box');
  });
});

describe('Полная связка (как в реальном использовании)', () => {
  test('presetStandard + presetSynonyms + presetMedias + presetNormalize8_0_1 + presetMain — без ошибок', () => {
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
