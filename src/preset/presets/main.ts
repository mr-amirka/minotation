import type {
  MnFn, 
} from '../MnInstance';

/**
 * Главный пресет: CSS-сброс (reset/normalize).
 *
 * Аналог old/minimalist-notation/presets/main.js.
 * Сложные селекторы — через mn.css(), простые — через mn.assign().
 */
export function presetMain(mn: MnFn): void {
  // Глобальные стили
  mn.css('html', {
    '-webkit-tap-highlight-color': 'rgba(0,0,0,0)',
  });

  // ================================================================
  // assign: простые селекторы на MN-токенах
  // ================================================================
  mn.assign({
    // Box-sizing для всего
    '*, *:before, *:after': 'bxzBorderBox',

    // Базовые сбросы
    html: 'lh1_15 tsa',
    body: 'm',
    a: 'bgTransparent',
    img: 'dBlock b0 bsNone',
    iframe: 'dBlock b0 bcTransparent',

    // Блочные элементы
    'aside, article, main, section, header, footer, nav, video, canvas, input, textarea':
      'dBlock',

    hr: 'bxzContentBox h0 ovVisible',

    // Моноширинный текст
    pre: 'ffMonospace f1em',

    // Аббревиатуры
    'abbr[title]': 'bb0 tdUnderline',

    // Жирный текст
    'b, strong': 'fwBolder',

    // Кодовые элементы
    'code, kbd, samp': 'ffMonospace f1em',

    // Малый текст
    small: 'f80p',

    // sub/sup
    'sub, sup': 'f75p lh0 posRelative vaBaseline',
    sub: 'sb-0_25em',
    sup: 'st-0_5em',

    // Формы
    'button, input, optgroup, select, textarea': 'ffInherit f100p lh1_15 m',
    'button, input': 'ovVisible',
    'button, select': 'ttNone',
    'button, [type=(button|reset|submit)]': 'apcButton',

    fieldset: 'pt0_35em ph0_75em pb0_625em',
    legend: 'bxzBorderBox cInherit wsNowrap',

    progress: 'vaBaseline',
    textarea: 'ovAuto',

    '[type=(checkbox|radio)]': 'bxzBorderBox p',
    '[type=search]': 'olo-2',

    // Интерактивные
    details: 'dBlock',
    summary: 'dListItem',

    // Скрытые
    template: 'dNone',
    '[hidden]': 'dNone',
  });

  // ================================================================
  // css: сложные селекторы (не поддерживаются assign-токенами)
  // ================================================================
  mn.css('[type=number]::-webkit-inner-spin-button', {
    height: 'auto', 
  });
  mn.css('[type=number]::-webkit-outer-spin-button', {
    height: 'auto', 
  });
  mn.css('::-webkit-file-upload-button', {
    appearance: 'button',
    font: 'inherit', 
  });
  mn.css('[type=search]::-webkit-search-decoration', {
    appearance: 'none', 
  });
  mn.css('input:-webkit-autofill', {
    display: 'none', 
  });
  mn.css('input::-ms-reveal', {
    display: 'none', 
  });
  mn.css('input::-ms-clear', {
    display: 'none', 
  });

  // Firefox-специфичные сбросы
  mn.css('::-moz-focus-inner', {
    borderStyle: 'none',
    padding: '0', 
  });
  mn.css(':-moz-focusring', {
    outline: '1px dotted ButtonText', 
  });

  // legend: display table + max-width
  mn.css('legend', {
    display: 'table',
    maxWidth: 'max-content', 
  });
}
