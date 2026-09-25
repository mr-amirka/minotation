const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');
const stylistic = require('@stylistic/eslint-plugin');
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'scripts/**',
      'eslint.config.js',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: false, 
    },
  },
  js.configs.recommended,
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
    ],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.commonjs,
        ...globals.es2017,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      '@stylistic': stylistic,
    },
    rules: {
      ...tseslint.configs.recommended.rules,

      'no-undef': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',
      'no-useless-assignment': 'off',

      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_', 
      }],
      '@typescript-eslint/ban-ts-comment': 'off',

      // §6.7 — каждый элемент на своей строке
      '@stylistic/indent': [
        'error',
        2,
        {
          SwitchCase: 1, 
        },
      ],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/object-curly-newline': ['error', {
        ObjectExpression:  {
          minProperties: 1, 
        },
        ObjectPattern:     {
          minProperties: 1, 
        },
        ImportDeclaration: {
          minProperties: 1, 
        },
        ExportDeclaration: {
          minProperties: 1, 
        },
      }],
      '@stylistic/object-property-newline': ['error', {
        allowAllPropertiesOnSameLine: false, 
      }],
      '@stylistic/function-paren-newline':  ['error', {
        minItems: 3, 
      }],
      '@stylistic/array-bracket-newline':   ['error', {
        minItems: 3, 
      }],
      '@stylistic/array-element-newline':   ['error', {
        minItems: 3, 
      }],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],

      // §6.7 — одна операция на строку
      'max-statements-per-line': ['error', {
        max: 1, 
      }],

      // §18.2 — механически проверяемая часть §6.2/§6.3.
      // Тесты и бенчмарки исключены ниже: это холодный путь, где §6 применяется
      // «по ситуации» (см. §6 «Область»), а читаемость важнее.
      'no-restricted-syntax': [
        'error',
        {
          selector: ':matches(ForStatement, WhileStatement, DoWhileStatement) > BinaryExpression > MemberExpression[property.name=/^(length|size)$/]',
          message: '§6.3: граница цикла (.length/.size) читается на каждой итерации — вынесите в переменную до цикла.',
        },
        {
          selector: ':matches(ForStatement, WhileStatement, DoWhileStatement, ForOfStatement, ForInStatement) > BlockStatement > VariableDeclaration',
          message: '§6.2: переменная, переприсваиваемая каждую итерацию, объявляется один раз до цикла. Для тела функции-коллбека правило не действует (§6.3.1).',
        },
      ],

      // §6.8 — if/else/for/while всегда с блоком {}
      curly: ['error', 'all'],
      '@stylistic/brace-style': [
        'error',
        '1tbs',
        {
          allowSingleLine: false, 
        },
      ],
    },
  },
  {
    // §6 «Область»: микрооптимизации обязательны на горячих путях; тесты и
    // бенчмарки — холодный путь, там читаемость важнее экономии на итерации.
    files: [
      'src/__tests__/**',
      'src/__benchmarks__/**',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    // CSS-селекторы как ключи объекта — требуют смешанного quote-props
    files: ['src/presets/main.ts', 'src/presets/normalize.ts'],
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
    files: ['src/presets/standard.ts'],
    rules: {
      'no-cond-assign': 'off',
      'max-statements-per-line': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
