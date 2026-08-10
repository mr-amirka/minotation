module.exports = {
  env: {
    node: true,
    browser: true,
    commonjs: true,
    es6: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
    '@stylistic',
  ],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/ban-ts-comment': 'off',

    // §6.7 — каждый элемент на своей строке
    indent: ['error', 2, { SwitchCase: 1 }],
    semi: ['error', 'always'],
    '@stylistic/object-curly-newline': ['error', {
      ObjectExpression:  { minProperties: 1 },
      ObjectPattern:     { minProperties: 1 },
      ImportDeclaration: { minProperties: 1 },
      ExportDeclaration: { minProperties: 1 },
    }],
    '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: false }],
    '@stylistic/function-paren-newline':  ['error', { minItems: 3 }],
    '@stylistic/array-bracket-newline':   ['error', { minItems: 3 }],
    '@stylistic/array-element-newline':   ['error', { minItems: 3 }],
    '@stylistic/comma-dangle': ['error', 'always-multiline'],

    // §6.7 — одна операция на строку
    'max-statements-per-line': ['error', { max: 1 }],

    // §6.8 — if/else/for/while всегда с блоком {}
    curly: ['error', 'all'],
    '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    'coverage/',
    'scripts/',
  ],
  overrides: [
    {
      // CSS-селекторы как ключи объекта — требуют смешанного quote-props
      files: [
        'src/presets/main.ts',
        'src/presets/normalize.ts',
      ],
      rules: {
        'quote-props': ['error', 'as-needed'],
      },
    },
    {
      // Плотный v1-стиль на все ~50 динамически генерируемых хендлеров: значение
      // читается и проверяется в одном выражении (`(x = y.z) ? ... : ...`), несколько
      // присваиваний через запятую вместо блока `{}`. Переписать без риска для поведения
      // означало бы переписать управляющий поток всего файла — не входит в задачу
      // типизации (см. PLAN.md minotation). `p`/флаговые параметры хендлеров (`nosign`,
      // `one`, `positive`) осознанно `any` — тот же контракт, что у публичного `MnHandler`.
      files: [
        'src/presets/standard.ts',
      ],
      rules: {
        'no-cond-assign': 'off',
        'max-statements-per-line': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
