/**
 * Публичный API пакета: то же, что делает `mn`, но из кода.
 *
 * Нужен, когда компиляция встроена в собственный скрипт сборки, а не
 * запускается командой.
 *
 * @module minotation-cli
 */
export {
  compile, collectFiles,
} from './compile';
export type {
  CompileSettings, CompileResult,
} from './compile';
export {
  parseArgs, HELP,
} from './args';
export type {
  CliArgs,
} from './args';
export {
  build, loadConfig, mergeSettings, startWatch, DEFAULT_CONFIG,
} from './run';
export type {
  RunSettings,
} from './run';
export {
  main,
} from './main';
export type {
  Reporter,
} from './run';
