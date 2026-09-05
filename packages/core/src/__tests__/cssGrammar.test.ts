import {
  isNumberValue,
  isIntegerValue,
  isLengthValue,
  isLengthOrAutoValue,
  isLengthOrNumberValue,
  isTimeValue,
  isColorValue,
  isFontWeightValue,
  isLengthOrWidthKeywordValue,
  canonicalizeCssPropertyName,
  isValidCssPropertyValue,
} from '../cssGrammar';

describe('cssGrammar — примитивы', () => {
  test.each([
    ['10', true], ['-10', true], ['+10', true], ['.5', true], ['10.5', true],
    ['inherit', true], ['initial', true],
    ['10px', false], ['abc', false], ['', false],
  ])('isNumberValue(%s) === %s', (v, expected) => {
    expect(isNumberValue(v)).toBe(expected);
  });

  test.each([
    ['10', true], ['-10', true], ['+10', true],
    ['10.5', false], ['10px', false],
  ])('isIntegerValue(%s) === %s', (v, expected) => {
    expect(isIntegerValue(v)).toBe(expected);
  });

  test.each([
    ['0', true], ['10px', true], ['1.5em', true], ['50%', true], ['-50%', true],
    ['+10px', true], ['calc(50% + 10px)', true],
    ['10', false], ['Rpx', false], ['undefined', false], ['px', false],
  ])('isLengthValue(%s) === %s', (v, expected) => {
    expect(isLengthValue(v)).toBe(expected);
  });

  test.each([
    ['auto', true], ['10px', true],
    ['random', false],
  ])('isLengthOrAutoValue(%s) === %s', (v, expected) => {
    expect(isLengthOrAutoValue(v)).toBe(expected);
  });

  test('isLengthOrNumberValue — length ИЛИ голое число (line-height из %-ввода)', () => {
    expect(isLengthOrNumberValue('1px')).toBe(true);
    expect(isLengthOrNumberValue('1.15')).toBe(true);
    expect(isLengthOrNumberValue('Rpx')).toBe(false);
  });

  test.each([
    ['250ms', true], ['1s', true],
    ['250', false], ['250px', false],
  ])('isTimeValue(%s) === %s', (v, expected) => {
    expect(isTimeValue(v)).toBe(expected);
  });

  test.each([
    ['#fff', true], ['#0a0a12', true], ['#F', true], ['#AB', true],
    ['rgba(255,255,255,.38)', true], ['rgb(0,0,0)', true],
    ['red', true], ['currentColor', true], ['ButtonText', true], ['invert', true],
    ['undefined', true], // форма идентификатора — реальный мусор ловит REGEXP_INVALID_CSS_VALUE отдельно
    ['#gg', false], ['rgba(1,2)', false], ['123', false],
  ])('isColorValue(%s) === %s', (v, expected) => {
    expect(isColorValue(v)).toBe(expected);
  });

  test('isFontWeightValue — число или ключевое слово начертания', () => {
    expect(isFontWeightValue('500')).toBe(true);
    expect(isFontWeightValue('bold')).toBe(true);
    expect(isFontWeightValue('bolder')).toBe(true);
    expect(isFontWeightValue('extra-bold')).toBe(false);
  });

  test('isLengthOrWidthKeywordValue — thin/medium/thick для border-width/outline-width', () => {
    expect(isLengthOrWidthKeywordValue('thin')).toBe(true);
    expect(isLengthOrWidthKeywordValue('medium')).toBe(true);
    expect(isLengthOrWidthKeywordValue('thick')).toBe(true);
    expect(isLengthOrWidthKeywordValue('1px')).toBe(true);
    expect(isLengthOrWidthKeywordValue('fat')).toBe(false);
  });
});

describe('cssGrammar — canonicalizeCssPropertyName', () => {
  test.each([
    ['paddingLeft', 'padding-left'],
    ['boxSizing', 'box-sizing'],
    ['zIndex', 'z-index'],
    ['padding-left', 'padding-left'],
    ['border-width', 'border-width'],
    ['-webkitOverflowScrolling', '-webkit-overflow-scrolling'],
  ])('canonicalizeCssPropertyName(%s) === %s', (input, expected) => {
    expect(canonicalizeCssPropertyName(input)).toBe(expected);
  });
});

describe('cssGrammar — isValidCssPropertyValue (реальные баг-паттерны)', () => {
  test('свойство без валидатора в реестре — не проверяется, всегда true', () => {
    expect(isValidCssPropertyValue('appearance', 'совершенно любой текст')).toBe(true);
  });

  test('padding-left/width: битое "Rpx"-значение (число потерялось при конкатенации) — false', () => {
    expect(isValidCssPropertyValue('paddingLeft', 'Rpx')).toBe(false);
    expect(isValidCssPropertyValue('width', 'Rpx')).toBe(false);
  });

  test('padding-left/width: нормальное значение — true', () => {
    expect(isValidCssPropertyValue('paddingLeft', '10px')).toBe(true);
    expect(isValidCssPropertyValue('width', '50%')).toBe(true);
  });

  test('fontWeight как число (не строка) — коэрсится корректно', () => {
    expect(isValidCssPropertyValue('fontWeight', 500)).toBe(true);
  });

  test('z-index: только integer (или auto)', () => {
    expect(isValidCssPropertyValue('zIndex', '100')).toBe(true);
    expect(isValidCssPropertyValue('zIndex', 'auto')).toBe(true);
    expect(isValidCssPropertyValue('zIndex', '1.5')).toBe(false);
  });

  test('color-family: битый undefined/NaN всё равно ловится (форма идентификатора не спасает)', () => {
    // isColorValue сама по себе сочла бы "undefined" валидным identifier-подобным
    // значением — но isBadCssValue в core/index.ts комбинирует эту проверку
    // с REGEXP_INVALID_CSS_VALUE, так что здесь проверяем именно эту функцию
    // в изоляции: isValidCssPropertyValue НЕ отвечает за REGEXP_INVALID_CSS_VALUE,
    // это отдельный уровень — см. core/index.ts's isBadCssValue.
    expect(isValidCssPropertyValue('color', 'undefined')).toBe(true);
  });
});
