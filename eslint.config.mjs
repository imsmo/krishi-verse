// eslint.config.mjs · root flat config (ESLint 9). Workspaces inherit and may extend.
// Enforces the tenant-safety + import hygiene that the CLAUDE.md laws require.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/build/**', '**/node_modules/**', '**/coverage/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Law guardrails (kept as warnings to start; promote to error before launch):
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-var-requires': 'error',   // no inline require() in app code
      'no-restricted-syntax': ['warn', {
        selector: "CallExpression[callee.name='require']",
        message: 'Use ES imports, not require() (CLAUDE.md hygiene).',
      }],
    },
  },
);
