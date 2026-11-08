import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "data", "migrations", "playwright-report", "test-results"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Generated shadcn/ui primitives follow upstream style.
    files: ["client/src/components/ui/**", "client/src/hooks/use-toast.ts"],
    rules: {
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Tests read loosely shaped JSON responses; `any` keeps them readable.
    files: ["**/*.test.ts", "e2e/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
