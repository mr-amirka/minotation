/**
 * Smoke-тесты для minotation-next.
 *
 * Проверяют, что withMn() экспортируется, возвращает валидный конфиг Next.js.
 */

import { presetHints, presetStandard, presetSynonyms, presetMedias, presetMain } from 'minotation';
import { withMn } from '../src/index';

/** Набор, который раньше подключался по умолчанию; теперь пресеты — только явно (D-110). */
const PRESETS = [presetHints, presetStandard, presetSynonyms, presetMedias, presetMain];

describe('minotation-next — smoke', () => {
  test('withMn — функция', () => {
    expect(typeof withMn).toBe('function');
  });

  test('withMn({}) — возвращает конфиг с webpack', () => {
    const config = withMn({}, { presets: PRESETS });
    expect(config).toHaveProperty('webpack');
    expect(typeof config.webpack).toBe('function');
  });

  test('withMn — с кастомными опциями', () => {
    const config = withMn(
      { reactStrictMode: true },
      { fileName: 'custom/mn.css', altColor: true, presets: PRESETS },
    );
    expect(config).toHaveProperty('webpack');
    expect(config.reactStrictMode).toBe(true);
  });

  test('withMn — enabled: false пропускает webpack', () => {
    const config = withMn({}, { enabled: false, presets: PRESETS });
    // Когда enabled=false, webpack НЕ добавляется
    expect(config).not.toHaveProperty('webpack');
  });
});

describe('withMn — проверка опций (D-038)', () => {
  test('enabled — boolean; опечатка — подсказка', () => {
    expect(() => withMn({}, { enabled: 'yes' } as never))
      .toThrow('[minotation] withMn: option "enabled" expects a boolean, got string "yes"');
    expect(() => withMn({}, { enabeld: false } as never))
      .toThrow('[minotation] withMn: unknown option "enabeld". Did you mean "enabled"?');
  });

  test('без presets — ошибка: набора по умолчанию нет (D-110)', () => {
    expect(() => withMn({})).toThrow('[minotation] withMn: "presets" is required — no preset is connected by default');
  });
});
