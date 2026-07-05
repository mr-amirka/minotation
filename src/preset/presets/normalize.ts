import type {
  MnFn, 
} from '../MnInstance';

/**
 * Пресет нормализации — лёгкий сброс (без presetStandard).
 *
 * Регистрирует хендлеры с конкретными значениями (bxzBB, m0, p0).
 * Теги соответствуют тому, что выдаёт splitStem:
 *   bxzBB → tag=bxz, arg=BB → camelVal('BB') → 'bb'
 * Поэтому используется camelCase: bxzBorderBox.
 */
export function presetNormalize(mn: MnFn): void {
  mn.css('html', {
    '-webkit-tap-highlight-color': 'rgba(0,0,0,0)',
  });

  mn.assign({
    '*, *:before, *:after': 'bxzBorderBox',
    'body': 'm0',
    'img': 'dBlock wmax100p hAuto',
    'a': 'bgTransparent',
  });
}
