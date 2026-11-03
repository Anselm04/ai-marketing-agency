import js from '@eslint/js';
import globals from 'globals';

// Preserve the legacy lint rules while supporting ESLint 10 flat configuration.
export default [
  { ignores: ['coverage/**', 'node_modules/**'] },
  {
    files: ['src/**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.jest, ...globals.es2022 },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
];
