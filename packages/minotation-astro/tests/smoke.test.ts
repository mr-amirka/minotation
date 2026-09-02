/**
 * Smoke-тесты для minotation-astro.
 */
import { jest } from '@jest/globals';
import { mnAstro } from '../src/index';

describe('minotation-astro — smoke', () => {
  test('mnAstro — функция', () => {
    expect(typeof mnAstro).toBe('function');
  });

  test('mnAstro() — возвращает интеграцию с name=minotation', () => {
    const integration = mnAstro();
    expect(integration.name).toBe('minotation');
  });

  test('mnAstro() — имеет хук astro:config:setup', () => {
    const integration = mnAstro();
    expect(typeof integration.hooks?.['astro:config:setup']).toBe('function');
  });

  test('astro:config:setup — вызывает updateConfig с vite.plugins', () => {
    const integration = mnAstro({ attr: 'class' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateConfig = jest.fn<(cfg: any) => void>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (integration.hooks?.['astro:config:setup'] as any)?.({ updateConfig });
    expect(updateConfig).toHaveBeenCalledTimes(1);
    const arg = updateConfig.mock.calls[0][0];
    expect(arg.vite.plugins).toHaveLength(1);
    expect(arg.vite.plugins[0].name).toBe('minotation');
  });
});
