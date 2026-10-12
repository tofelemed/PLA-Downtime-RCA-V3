import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
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
    // the registry itself and the generated shadcn primitives may import lucide-react directly
    files: ["src/lib/icons.ts", "src/components/ui/**/*.{ts,tsx}"],
    rules: { "@typescript-eslint/no-restricted-imports": "off" },
  }
);
