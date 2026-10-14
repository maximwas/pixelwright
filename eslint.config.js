// ESLint only enforces the layout Biome cannot: blank lines between statements, class members and object literals.
// Everything else (lint rules, formatting, braces) is Biome's job. The parser uses the TypeScript 6 API
// (the root `typescript` alias), because typescript-eslint does not support TypeScript 7 yet.
import stylistic from "@stylistic/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const DECLARATIONS = ["const", "let", "var"];
const BLOCKS = ["if", "for", "while", "do", "switch", "try"];

// The folders the rewrite has rebuilt (docs/superpowers/specs/2026-10-14-pixelwright-rewrite-design.md): there the
// limits below are errors; everywhere else they warn, so the remaining debt stays visible. Keep the same list in
// biome.json's last override (cognitive complexity).
const REWRITTEN = [
  "packages/core/src/kernel/**",
  "packages/core/src/tokens/**",
  "packages/core/src/css-mapping/**",
  "packages/core/src/design/**",
  "packages/core/src/apply/**",
  "apps/server/src/features/**",
  "apps/server/src/plugin/**",
  "apps/server/src/logging/**",
  "apps/plugin/src/operations/**",
  "apps/plugin/src/services/**",
  "apps/plugin/src/main.ts",
  "apps/plugin/src/figma/tokens/**",
  "apps/plugin/src/figma/assign.ts",
  "apps/plugin/src/figma/capabilities.ts",
  "apps/plugin/src/figma/paints.ts",
  "apps/plugin/src/figma/effects.ts",
  "apps/plugin/src/figma/component-index.ts",
  "apps/plugin/src/figma/variants.ts",
  "apps/plugin/src/figma/nodes.ts",
  "apps/plugin/src/figma/fonts.ts",
];

const BANNED_SYNTAX = [
  {
    selector: "TSAsExpression[expression.type='TSAsExpression'][expression.typeAnnotation.type='TSUnknownKeyword']",
    message: "No `as unknown as`: type the value where it comes from, or narrow it with a guard.",
  },
  {
    selector: "BinaryExpression[operator='==='][right.raw='true']",
    message: "No `=== true`: test the boolean itself.",
  },
  {
    selector: "BinaryExpression[operator='!=='][right.raw='false']",
    message: "No `!== false`: test the boolean itself.",
  },
  {
    selector:
      "Program > VariableDeclaration[kind='let'], Program > ExportNamedDeclaration > VariableDeclaration[kind='let']",
    message: "No module-level mutable state: keep it in an instance of a class the composition root creates.",
  },
];

/** The principles' size limits: a function fits on a screen, a file is one cohesive module. */
const limits = (level) => ({
  "max-lines-per-function": [level, { max: 50, skipBlankLines: true, skipComments: true }],
  "max-lines": [level, { max: 300, skipBlankLines: true, skipComments: true }],
  "max-params": [level, 4],
  "no-restricted-syntax": [level, ...BANNED_SYNTAX],
});

/** An import of a sibling folder (`../other/…`): one feature never reaches into another's internals. */
const SIBLING_FOLDER = { regex: "^\\.\\./[^./]", message: "A feature never imports another feature's internals." };

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
  {
    files: ["**/src/**/*.ts"],
    rules: limits("warn"),
  },
  {
    files: REWRITTEN,
    rules: limits("error"),
  },
  // Dependency rules: core's kernel depends on nothing; css-mapping/ never imports what is built on it; design/ never
  // imports the features that compare against it; server features never import mcp/ or each other; plugin operations
  // never import each other, and the plugin's figma/ adapters and services never import an operation.
  {
    files: ["packages/core/src/kernel/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ regex: "^\\.\\./", message: "The kernel depends on nothing." }] },
      ],
    },
  },
  {
    files: ["packages/core/src/kernel/*/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ regex: "^\\.\\./\\.\\./", message: "The kernel depends on nothing." }] },
      ],
    },
  },
  {
    files: ["packages/core/src/css-mapping/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(\\.\\./)+(apply|design|tokens)/",
              message: "css-mapping/ is the vocabulary apply, design and tokens stand on: it never imports them.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/core/src/design/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(\\.\\./)+(apply|diff|inspect|checks|tokens)/",
              message:
                "design/ is the read that apply, diff, inspect, checks and tokens stand on: it never imports them.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/server/src/features/*/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            SIBLING_FOLDER,
            { regex: "(^|/)mcp/", message: "Features never import mcp/: mcp/ registers features." },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/plugin/src/operations/*/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [SIBLING_FOLDER] }],
    },
  },
  {
    files: ["apps/plugin/src/operations/apply/writers/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^\\.\\./(?!\\.\\./)",
              message: "Writers write one layer: they import each other and figma/ adapters, never the apply run.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/plugin/src/figma/**/*.ts", "apps/plugin/src/services/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "(^|/)operations/",
              message: "figma/ and services/ are what operations stand on: they never import an operation.",
            },
          ],
        },
      ],
    },
  },
];
