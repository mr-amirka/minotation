// The lab's rules come from eslint-config-lab (LAB D-013, D-014); only what is minotation's own is here.
const lab = require('eslint-config-lab');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'scripts/**',
      'src/presets/*/scripts/**',
      'eslint.config.js',
    ],
  },
  ...lab({
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
    ],
    globals: {
      ...globals.node,
      ...globals.browser,
      ...globals.commonjs,
      ...globals.es2017,
    },
    // The compiler is a hot path throughout (coding.md §6 "Scope"): a loop's variables are declared before the loop.
    hotPaths: ['src/**'],
  }),
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  {
    // The package's entry points and presets are default exports — published API (`import standard from
    // 'minotation/presets/standard'`); renaming them is a breaking release, not a lint fix. minotation-gulp shares this
    // config: its entry is the gulp plugin, default-exported the same way.
    files: [
      'src/index.ts',
      'src/core/index.ts',
      'src/presets/*/index.ts',
    ],
    rules: {
      'no-restricted-exports': 'off',
    },
  },
  {
    // coding.md §6 "Scope": tests and benchmarks are a cold path — readability over saving on an iteration.
    files: [
      'src/**/__tests__/**',
      'src/__benchmarks__/**',
    ],
    rules: {
      'lab/declare-before-loop': 'off',
    },
  },
  {
    // CSS selectors as object keys need mixed quote-props.
    files: [
      'src/presets/main/index.ts',
      'src/presets/normalize/index.ts',
    ],
    rules: {
      'quote-props': [
        'error',
        'as-needed',
      ],
    },
  },
  {
    // The dense v1 style of the ~50 generated handlers: a value is read and checked in one expression
    // (`(x = y.z) ? … : …`), several assignments joined by commas instead of a block. Rewriting it safely means
    // rewriting the control flow of the whole file — outside the typing task (minotation PLAN.md). The handlers' `p` /
    // flag parameters (`nosign`, `one`, `positive`) are `any` on purpose — the same contract as the public `MnHandler`.
    files: ['src/presets/standard/index.ts'],
    rules: {
      'no-cond-assign': 'off',
      '@stylistic/max-statements-per-line': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
