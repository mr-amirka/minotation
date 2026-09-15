/**
 * ESM-режим (не CJS-пресет, как у остальных плагинов minotation) — сам пакет
 * ("type": "module") и его прямая зависимость minotation-vite оба реальный
 * ESM без CJS-фолбэка; Jest по умолчанию не резолвит такое через require().
 * Запускается с `node --experimental-vm-modules` (см. package.json's test-скрипт).
 */
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 99,
      functions: 99,
      lines: 99,
      statements: 99,
    },
  },
};
