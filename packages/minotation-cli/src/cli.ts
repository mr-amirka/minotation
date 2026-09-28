#!/usr/bin/env node
/**
 * Точка входа `mn`.
 *
 * Здесь только связь с процессом: аргументы, вывод, код возврата. Вся работа —
 * в `main.ts`, чтобы её можно было прогнать тестом, не запуская процесс и не
 * перехватывая `process.exit`.
 *
 * @module cli
 */
import {
  main,
} from './main';

const report = {
  log: (message: string) => console.log(message),
  error: (message: string) => console.error(message),
};

try {
  process.exitCode = main(process.argv.slice(2), report);
} catch (ex) {
  report.error((ex as Error).message);
  process.exitCode = 1;
}
