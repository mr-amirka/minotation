/**
 * Smoke-тесты для minotation-esbuild.
 */
import { mnEsbuild } from '../src/index';

describe('minotation-esbuild — smoke', () => {
  test('mnEsbuild — функция', () => {
    expect(typeof mnEsbuild).toBe('function');
  });

  test('mnEsbuild() — возвращает объект с name=minotation', () => {
    const plugin = mnEsbuild();
    expect(plugin.name).toBe('minotation');
  });

  test('mnEsbuild() — имеет функцию setup', () => {
    const plugin = mnEsbuild();
    expect(typeof plugin.setup).toBe('function');
  });

  test('setup(build) — регистрирует onStart/onLoad(x2: пресет-файлы + файлы приложения)/onEnd', () => {
    const plugin = mnEsbuild({ attr: 'className' });
    const onStart = jest.fn();
    const onLoad = jest.fn();
    const onEnd = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugin.setup({ onStart, onLoad, onEnd, initialOptions: {} } as any);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledTimes(2);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
