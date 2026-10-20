/**
 * @overview Minotation preset "default medias"
 * @author Amir Absaliamov <amir.absolutely@gmail.com>
 */

import {
  MnInstance,
} from '../../types';
import type {
  MnPresetObject,
} from '../../core/types';
import {
  TW4_THEME,
} from '../tw4/theme';

export default {
  name: 'presetMedias',
  // Точки работают и в записи Tailwind (`d:` — от точки, D-060), признаки — везде (D-067).
  ecosystems: [
    'minotation',
    'tw4',
  ],
  setup: (mn: MnInstance) => {
    const {
      media,
      utils,
    } = mn;
    const {
      forEach,
      forIn,
    } = utils;
    /*
  forEach([
    [ 'sm', '(max-width: 991px)' ],
    [ 'sm-md', '(min-width: 768px) and (max-width: 991px)' ],
    [ 'xs', '(max-width: 767px)' ],
    [ 'xs-sm', '(min-width: 480px) and (max-width: 767px)' ],
    [ 'xv', '(max-width: 639px)' ],
    [ 'xm', '(max-width: 479px)' ],
    [ 'xm-xs', '(min-width: 360px) and (max-width: 479px)' ],
    [ 'mm', '(max-width: 359px)' ],
    [ 'md', '(min-width: 992px)' ],
    [ 'md-lg', '(min-width: 992px) and (max-width: 1199px)' ],
    [ 'lg', '(min-width: 1200px)' ],
    [ 'lg-ll', '(min-width: 1200px) and (max-width: 1559px)' ],
    [ 'll', '(min-width: 1600px)' ],
  ], (v, i) => media[v[0]] = {query: v[1], priority: i});
  */

    // Точки по ширине (D-054): запрос строится по записи — `@m4` до точки
    // (`max-width: 479.98px`), `@d-` от точки (`min-width: 992px`), `@m4-d` между точками.
    // Готовые диапазоны (`m4-`, `-d2`) убраны: пишутся синтаксисом (`@m4-m`, `@d-d2`).
    // `m` и `d` — одна точка 992px под двумя именами: `@m` = `@d` = `max-width: 991.98px`.
    // Брейкпоинты и шкала контейнеров Tailwind 4 (D-090) — общие для всех записей: `md:` и `@md` / `@md-`,
    // `@md:` (контейнер, 28rem). Имя из опции `media` ядро сохраняет само (D-092).
    forIn(TW4_THEME, (value: string, name: string) => {
      name.indexOf('--breakpoint-') === 0 && (media[name.slice(13)] = {
        width: value,
      });
      name.indexOf('--container-') === 0 && (mn.containers[name.slice(12)] = value);
    });

    forIn({
      m: 992,
      m2: 768,
      m3: 640,
      m4: 480,
      m5: 360,
      m6: 320,
      m7: 312, // Apple Watch 312 × 390
      m8: 272, // Apple Watch 272 × 340
      d: 992,
      d2: 1200,
      d3: 1600,
      d4: 1920,
      d5: 2300,
      d6: 2560,
    }, (width: number, name: string) => {
      media[name] = {
        width,
      };
    });

    // Признаки устройства и предпочтения (D-057): имена — как у вариантов Tailwind.
    forEach([
      [
        'mouse',
        '(pointer: fine) and (hover: hover)',
      ],
      // Основное устройство умеет наводить — для `:h` (D-069): на тачскринах hover не «залипает».
      [
        'hover',
        '(hover: hover)',
      ],
      [
        'dark',
        '(prefers-color-scheme: dark)',
      ],
      [
        'light',
        '(prefers-color-scheme: light)',
      ],
      [
        'print',
        'print',
      ],
      [
        'screen',
        'screen',
      ],
      [
        'portrait',
        '(orientation: portrait)',
      ],
      [
        'landscape',
        '(orientation: landscape)',
      ],
      [
        'motion-safe',
        '(prefers-reduced-motion: no-preference)',
      ],
      [
        'motion-reduce',
        '(prefers-reduced-motion: reduce)',
      ],
      [
        'contrast-more',
        '(prefers-contrast: more)',
      ],
      [
        'contrast-less',
        '(prefers-contrast: less)',
      ],
      [
        'forced-colors',
        '(forced-colors: active)',
      ],
      [
        'inverted-colors',
        '(inverted-colors: inverted)',
      ],
      [
        'pointer-fine',
        '(pointer: fine)',
      ],
      [
        'pointer-coarse',
        '(pointer: coarse)',
      ],
      [
        'any-pointer-fine',
        '(any-pointer: fine)',
      ],
      [
        'any-pointer-coarse',
        '(any-pointer: coarse)',
      ],
      [
        'noscript',
        '(scripting: none)',
      ],
    ], (v: string[], i: number) => {
      media[v[0]] = {
        query: v[1],
        priority: i,
      };
    });

    forEach([
      'iframe',
      'linux',
      'mozilla',
      'firefox',
      'opera',
      'trident',
      'edge',
      'touch',
      'multitouch',
      'orientation',
      'chrome',
      'ubuntu',
      'chromium',
      'safari',
      'msie',
      'webkit',
      'applewebkit',
      'mobile',
      'ie',
      'webtv',
      'konqueror',
      'blackberry',
      'android',
      'iron',
      'iphone',
      'ios',
      'ipod',
      'ipad',
      'mac',
      'darwin',
      'windows',
      'freebsd',
    ], (name) => {
      media[name] = {
        selector: '.' + name,
      };
    });
  },
} as MnPresetObject;
