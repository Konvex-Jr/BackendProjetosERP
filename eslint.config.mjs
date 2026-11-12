// Lint do backend: regras recomendadas do ESLint e do typescript-eslint.
// A formatação fica com o Prettier (eslint-config-prettier desliga as regras de estilo).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
    { ignores: ["dist/", "node_modules/", "uploads/", "coverage/"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: { globals: { ...globals.node, ...globals.jest } },
        rules: {
            // As rotas recebem o corpo cru do Express; tipar o callback está na dívida técnica (docs/sistema/05).
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }],
        },
    },
    {
        files: ["**/*.js", "**/*.mjs"],
        rules: { "@typescript-eslint/no-require-imports": "off" },
    },
    prettier,
);
