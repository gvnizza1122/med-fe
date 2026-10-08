import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] } },
  { settings: { 'react-hooks': { additionalEffectHooks: '(useDeferredEffect)' } } },
  // These maintenance scripts run in Node's CommonJS runtime.
  { files: ['scripts/**/*.js', 'scratch-replace.js'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
