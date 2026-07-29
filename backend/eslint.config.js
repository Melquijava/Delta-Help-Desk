import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['prisma/seed.ts', 'tests/*.test.ts']
        },
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    ignores: ['dist', 'node_modules']
  }
);
