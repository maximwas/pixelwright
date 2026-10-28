// ESLint holds only what Biome lacks (K-architecture 11.1): blank-line layout, size limits, banned syntax, the figma
// global, zod/mini, the Figma plugin rules, and the shape of folders and files. Its parser runs on the TypeScript 6 API
// (`typescript` is the @typescript/typescript6 alias), because typescript-eslint does not support TypeScript 7 yet.
import figmaPlugins from "@figma/eslint-plugin-figma-plugins";
import stylistic from "@stylistic/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import {
  createFileComposition,
  createFolderStructure,
  projectStructureParser,
  projectStructurePlugin,
} from "eslint-plugin-project-structure";

const CODE = ["src/**/*.ts", "scripts/**/*.ts"];
const TESTS = ["**/*.test.ts"];
const NODE_FREE = ["src/shared/**/*.ts", "src/core/**/*.ts", "src/plugin/**/*.ts", "src/plugin-ui/**/*.ts"];
const DECLARATIONS = ["const", "let", "var"];
const BLOCKS = ["if", "for", "while", "do", "switch", "try"];

const NO_CSS_ASYNC = {
  selector: "Identifier[name='getCSSAsync']",
  message: "No getCSSAsync: it hung up to 123 s and froze the plugin's turns (D-20). Pixelwright maps CSS itself.",
};

const BY_ID_OUTSIDE_LOOKUP = {
  selector: "Identifier[name=/^get[A-Za-z]*ByIdAsync$/]",
  message: "By-id lookups live only in src/plugin/adapters/figma/lookup/: offline each one waits 10 s (P-070, FX-015).",
};

const BANNED_SYNTAX = [
  {
    selector: "TSAsExpression[expression.type='TSAsExpression'][expression.typeAnnotation.type='TSUnknownKeyword']",
    message: "No `as unknown as`: type the value where it comes from, or narrow it with a guard.",
  },
  {
    selector: "BinaryExpression[operator='==='][right.raw='true']",
    message: "No `=== true`: test the boolean itself, or write `(value ?? false)`.",
  },
  {
    selector: "BinaryExpression[operator='!=='][right.raw='false']",
    message: "No `!== false`: write `(value ?? true)`.",
  },
  {
    selector:
      "Program > VariableDeclaration[kind='let'], Program > ExportNamedDeclaration > VariableDeclaration[kind='let']",
    message: "No module-level mutable state: keep it in an instance of a class the composition root creates.",
  },
  NO_CSS_ASYNC,
];

/** A function fits on a screen, a file is one cohesive module, more than four parameters go in an options object. */
const LIMITS = {
  "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
  "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
  "max-params": ["error", 4],
  "no-restricted-syntax": ["error", ...BANNED_SYNTAX, BY_ID_OUTSIDE_LOOKUP],
  "no-restricted-globals": [
    "error",
    { name: "figma", message: "The figma global is used only in src/plugin/adapters/ and src/plugin/main/." },
  ],
};

/** File names of K-architecture 9.1: `x.ts`, `x.<suffix>.ts`, tests beside them, `index.ts`, `data/*.json`. */
const FILES = [
  { name: "index.ts" },
  { name: "{kebab-case}(.{suffix})?(.test)?.ts" },
  { name: "{kebab-case}.(html|md)" },
  { name: "data", children: [{ name: "{kebab-case}.json" }] },
];

const FOLDER_STRUCTURE = createFolderStructure({
  regexParameters: { suffix: "(types|constants|schema|port|manifest|tool|operation|catalog|contract|main)" },
  structure: [
    { name: "src", children: [{ name: "(cli|plugin-ui)", ruleId: "entryRoot" }, { ruleId: "folder" }] },
    { name: "scripts", children: [...FILES, { ruleId: "folder" }] },
  ],
  rules: {
    folder: { name: "{kebab-case}", children: [...FILES, { ruleId: "folder" }] },
    // A root holds its entry points only; everything else lives in folders under it.
    entryRoot: {
      children: [
        { name: "(bin|{kebab-case}.main).ts" },
        { name: "{kebab-case}.html" },
        { name: "index.ts" },
        { ruleId: "folder" },
      ],
    },
  },
});

const FILE_COMPOSITION = createFileComposition({
  filesRules: [
    // Tests keep their helpers beside the cases.
    { filePattern: TESTS },
    { filePattern: CODE, rootSelectorsLimits: [{ selector: ["function", "arrowFunction", "class"], limit: 1 }] },
  ],
});

export default [
  {
    ignores: [
      "old/**",
      "dist/**",
      "graphify-out/**",
      "research/**",
      "docs/**",
      ".claude/**",
      ".superpowers/**",
      "test/golden/fixtures/**",
      "**/__golden__/**",
      "test/guards/samples/**",
    ],
  },
  {
    files: ["src/**", "scripts/**"],
    languageOptions: { parser: projectStructureParser },
    plugins: { "project-structure": projectStructurePlugin },
    // The plugin keeps its error cache in an existing folder; node_modules keeps it out of the tree.
    settings: { "project-structure/cache-location": `${import.meta.dirname}/node_modules` },
    rules: { "project-structure/folder-structure": ["error", FOLDER_STRUCTURE] },
  },
  {
    files: ["**/*.ts"],
    languageOptions: { parser: tsParser },
    plugins: { "@stylistic": stylistic, "project-structure": projectStructurePlugin },
    rules: {
      "no-restricted-syntax": ["error", NO_CSS_ASYNC],
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
    files: CODE,
    rules: { ...LIMITS, "project-structure/file-composition": ["error", FILE_COMPOSITION] },
  },
  {
    files: TESTS,
    rules: { "max-lines-per-function": "off" },
  },
  {
    files: ["src/plugin/adapters/figma/lookup/**/*.ts"],
    rules: { "no-restricted-syntax": ["error", ...BANNED_SYNTAX] },
  },
  {
    files: ["src/plugin/adapters/**/*.ts", "src/plugin/main/**/*.ts"],
    rules: { "no-restricted-globals": "off" },
  },
  {
    files: NODE_FREE,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^zod(/v[34])?$",
              message: "Import zod as `zod/mini` here: classic zod adds 454 KB to the plugin bundle.",
            },
          ],
        },
      ],
    },
  },
  // Sync Figma APIs that throw under documentAccess "dynamic-page" (FX-007); these rules need type information.
  {
    ...figmaPlugins.flatConfigs["recommended-problems-only"],
    files: ["src/plugin/**/*.ts"],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  },
];
