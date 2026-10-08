// ESLint only enforces the layout Biome cannot: blank lines between statements, class members and object literals.
// Everything else (lint rules, formatting, braces) is Biome's job. The parser uses the TypeScript 6 API
// (the root `typescript` alias), because typescript-eslint does not support TypeScript 7 yet.
import stylistic from "@stylistic/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const DECLARATIONS = ["const", "let", "var"];
const BLOCKS = ["if", "for", "while", "do", "switch", "try"];

export default [
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "research/**",
      "docs/**",
      ".claude/**",
      ".superpowers/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: ["return", "throw"] },
        { blankLine: "always", prev: "*", next: DECLARATIONS },
        { blankLine: "always", prev: DECLARATIONS, next: "*" },
        { blankLine: "any", prev: DECLARATIONS, next: DECLARATIONS },
        { blankLine: "always", prev: "*", next: BLOCKS },
        { blankLine: "always", prev: BLOCKS, next: "*" },
      ],
      "@stylistic/lines-between-class-members": [
        "error",
        {
          enforce: [
            { blankLine: "always", prev: "*", next: "method" },
            { blankLine: "always", prev: "method", next: "*" },
          ],
        },
      ],
      "@stylistic/object-curly-newline": [
        "error",
        { ObjectExpression: { minProperties: 2, multiline: true, consistent: true } },
      ],
    },
  },
];
