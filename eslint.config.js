import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Each npm project owns its lint config; worktrees and runtime evidence are not source.
  { ignores: ["dist", "server/**", ".claude/**", ".codex/**", "test-results/**", ".playwright-mcp/**"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // warn until the per-area tracks have cleaned up (about 150 dead icon imports in v1 pages)
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
      // icon registry (docs/UI_GUIDELINES.md "Icons"): one icon per meaning, imported from @/lib/icons
      "@typescript-eslint/no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "lucide-react",
              message: "Import icons from '@/lib/icons' (ActionIcon / StatusIcon / EntityIcon / UiIcon); add a meaning there if it is missing.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    // size and complexity limits (plans/ENGINEERING_STANDARDS.md "Code quality", CLAUDE.md): warnings, so
    // the pre-existing oversized files do not break CI; `npm run lint:changed` shows them for touched files
    files: ["**/*.{ts,tsx}"],
    rules: {
      "max-lines": ["warn", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 40, skipBlankLines: true, skipComments: true, IIFEs: true }],
      complexity: ["warn", { max: 10 }],
      "max-params": ["warn", { max: 4 }],
      "max-depth": ["warn", { max: 3 }],
    },
  },
  {
    // React components may run to 150 lines (CLAUDE.md "Size limits")
    files: ["**/*.tsx"],
    rules: { "max-lines-per-function": ["warn", { max: 150, skipBlankLines: true, skipComments: true }] },
  },
  {
    // generated primitives, generated API types and test suites (long describe blocks) are exempt
    files: ["src/components/ui/**/*.{ts,tsx}", "src/api/v2/schema.d.ts", "**/*.test.{ts,tsx}", "e2e/**/*.ts"],
    rules: { "max-lines": "off", "max-lines-per-function": "off", complexity: "off" },
  },
  {
    // the registry itself and the generated shadcn primitives may import lucide-react directly
    files: ["src/lib/icons.ts", "src/components/ui/**/*.{ts,tsx}"],
    rules: { "@typescript-eslint/no-restricted-imports": "off" },
  },
  {
    // Generated shadcn prop interfaces intentionally extend one React interface.
    // Keep generated files untouched and retain the stricter rule for owned code.
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: { "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }] },
  }
);
