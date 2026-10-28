// ESLint holds only what Biome lacks (K-architecture 11.1): blank-line layout, size limits, banned syntax, the figma
// global, zod/mini, the Figma plugin rules, and the shape of folders and files. Its parser runs on the TypeScript 6 API
// (`typescript` is the @typescript/typescript6 alias), because typescript-eslint does not support TypeScript 7 yet.
import figmaPlugins from "@figma/eslint-plugin-figma-plugins";
import stylistic from "@stylistic/eslint-plugin";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import createNoRestrictedSyntax from "eslint-no-restricted/syntax";
import antfu from "eslint-plugin-antfu";
import noRelativeImportPaths from "eslint-plugin-no-relative-import-paths";
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

/** Every module in src/ is a class: a function travels only as a method of one. */
const CLASS_MODULES = [
  {
    selector: "ExportNamedDeclaration > FunctionDeclaration, ExportDefaultDeclaration > :function",
    message: "Export a class, not a function: every module in src/ is a class.",
  },
  {
    selector: "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > :function.init",
    message: "Export a class, not a function in a const: every module in src/ is a class.",
  },
];

/** needle-di: dependencies come in as constructor defaults, and only by token. */
const INJECTION = [
  {
    selector:
      "CallExpression[callee.name='inject']:not(MethodDefinition[kind='constructor'] > FunctionExpression > AssignmentPattern > CallExpression)",
    message: "inject() only as a constructor default parameter: a class never looks its services up itself.",
  },
  {
    selector: "CallExpression[callee.name='inject'] > Identifier.arguments:first-child:not([name=/^[A-Z][A-Z0-9_]*$/])",
    message: "inject() takes an InjectionToken constant: a child container builds a second instance of a class (#110).",
  },
];

/**
 * Where a string literal names code instead of holding a value: module specifiers and import attributes, property keys
 * (`"~standard"`, `x["~standard"]`, `in`), typeof checks, and an InjectionToken's description (a debug name needle-di
 * prints when a provider is missing; it never leaves the process). The empty string holds no text, as 0 holds no
 * number. A literal type is left to shape/no-string-type, so it is reported once.
 */
const NOT_VALUES = [
  "ImportDeclaration > Literal.source",
  "ExportNamedDeclaration > Literal.source",
  "ExportAllDeclaration > Literal.source",
  "ImportExpression > Literal.source",
  "ImportAttribute > Literal.value",
  "TSImportType Literal",
  "Property > Literal.key",
  "PropertyDefinition > Literal.key",
  "TSPropertySignature > Literal.key",
  "MemberExpression[computed=true] > Literal.property",
  "BinaryExpression[operator='in'] > Literal.left",
  "BinaryExpression[left.operator='typeof'] > Literal.right",
  "NewExpression[callee.name='InjectionToken'] > Literal.arguments",
  "Literal[value='']",
  "TSLiteralType > Literal",
];

/** Where a string type names a property: an indexed access (`X["reason"]`) and the keys of Pick and Omit. */
const TYPE_KEYS = [
  "TSImportType Literal",
  "TSIndexedAccessType > TSLiteralType.indexType > Literal",
  "TSTypeReference[typeName.name=/^(Pick|Omit)$/] > TSTypeParameterInstantiation > :nth-child(2) Literal",
];

/**
 * No string in code: every text lives in an `as const` object of a .constants.ts. One named rule per kind
 * (eslint-no-restricted), so they compose apart from no-restricted-syntax and each has its own severity.
 */
const SHAPE = createNoRestrictedSyntax(
  "shape",
  {
    name: "no-string-literal",
    selector: `Literal[raw=/^['"]/]:not(${NOT_VALUES.join(", ")})`,
    message: "No string in code: take it from an `as const` object in the class's or topic's .constants.ts.",
  },
  {
    name: "no-string-type",
    selector: `TSLiteralType > Literal[raw=/^['"]/]:not(${TYPE_KEYS.join(", ")})`,
    message: "No hand-written string type: infer it from the schema, or write (typeof X)[keyof typeof X].",
  },
  {
    name: "no-text-template",
    selector: "TemplateLiteral:has(> TemplateElement[value.raw!=''])",
    message: "Text with values is a constant arrow in a .constants.ts object: portTaken: (port: number) => `...`.",
  },
);

/** no-relative-import-paths sees `import … from` only; a dynamic import() and `export … from` take `@/` here. */
const IMPORTS = createNoRestrictedSyntax("imports", {
  name: "no-relative-path",
  selector:
    "ImportExpression[source.value=/^\\./], ExportNamedDeclaration[source.value=/^\\./], ExportAllDeclaration[source.value=/^\\./]",
  message: "Every import of src goes through @/ (the src root), dynamic import() and export … from too.",
});

/**
 * @stylistic's function-paren-newline for signatures only: declarations, methods and constructors, and functions not
 * passed as an argument. As it is, it would also break every call of two arguments and every callback.
 */
const PAREN_NEWLINE = stylistic.rules["function-paren-newline"];
const SIGNATURES = "FunctionDeclaration, FunctionExpression:not(.arguments), ArrowFunctionExpression:not(.arguments)";
const LAYOUT = {
  rules: {
    "signature-paren-newline": {
      meta: PAREN_NEWLINE.meta,
      create(context) {
        const [check] = Object.values(PAREN_NEWLINE.create(context));

        return { [SIGNATURES]: check };
      },
    },
  },
};

/** consistent-list-newline for parameters only: other lists keep Biome's layout. */
const PARAMETER_LISTS = Object.fromEntries(
  Object.keys(antfu.rules["consistent-list-newline"].meta.schema[0].properties).map((kind) => [
    kind,
    ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(kind),
  ]),
);

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

/**
 * File names of K-architecture 9.1: `x.ts`, `x.<suffix>.ts`, tests beside them, `index.ts`, `data/*.json`. src/: one
 * folder per topic. A topic folder holds its class files loose, each with its token and types (config/config-reader.ts,
 * config-reader.schema.ts, config-reader.test.ts), one constants file named after the folder, a layer's catalog, a
 * composition root; a tool or an operation keeps a folder of its own.
 */
const FILES = [
  { name: "index.ts" },
  { name: "{kebab-case}(.{suffix})?(.test)?.ts" },
  { name: "{kebab-case}.(html|md)" },
  { name: "data", children: [{ name: "{kebab-case}.json" }] },
];

const FOLDER_STRUCTURE = createFolderStructure({
  regexParameters: { suffix: "(types|constants|schema|port|manifest|tool|operation|catalog|contract|main|tokens)" },
  structure: [
    { name: "src", children: [{ name: "(cli|plugin-ui)", ruleId: "entryRoot" }, { ruleId: "folder" }] },
    { name: "scripts", children: [...FILES, { ruleId: "folder" }] },
  ],
  rules: {
    folder: { name: "{kebab-case}", children: [...FILES, { ruleId: "folder" }] },
    // A root holds its entry points only, and a root's composition test; everything else lives in folders under it.
    entryRoot: {
      children: [
        { name: "(bin|{kebab-case}.main)(.test)?.ts" },
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
    plugins: { "@stylistic": stylistic, "project-structure": projectStructurePlugin, antfu, layout: LAYOUT },
    rules: {
      "no-restricted-syntax": ["error", NO_CSS_ASYNC],
      // Three or more parameters: each on its own line; one or two stay on one line. Biome formats first and would
      // put them back on one line, so ESLint fixes after it, re-indents what it moved, and checks it in pnpm lint.
      "layout/signature-paren-newline": ["error", { minItems: 3 }],
      "antfu/consistent-list-newline": ["error", PARAMETER_LISTS],
      "@stylistic/indent": ["error", 2, { SwitchCase: 1 }],
      "@stylistic/no-trailing-spaces": "error",
      "@stylistic/comma-dangle": [
        "error",
        {
          arrays: "ignore",
          objects: "ignore",
          imports: "ignore",
          exports: "ignore",
          functions: "always-multiline",
          enums: "ignore",
          generics: "ignore",
          tuples: "ignore",
        },
      ],
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
      "@stylistic/object-curly-newline": ["error", { ObjectExpression: { multiline: true, consistent: true } }],
    },
  },
  {
    files: CODE,
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...LIMITS,
      "project-structure/file-composition": ["error", FILE_COMPOSITION],
      // A class of static members is a free function in disguise; statics live only beside instance members.
      "@typescript-eslint/no-extraneous-class": ["error", { allowStaticOnly: false, allowWithDecorator: false }],
    },
  },
  {
    files: ["src/**/*.ts"],
    ignores: TESTS,
    rules: {
      "no-restricted-syntax": ["error", ...BANNED_SYNTAX, BY_ID_OUTSIDE_LOOKUP, ...CLASS_MODULES, ...INJECTION],
    },
  },
  // Names say what a value is: no `e`, `i`, `c` or `cfg`; x and y stay for coordinates.
  {
    files: ["src/**/*.ts", "scripts/**/*.ts", "test/**/*.ts"],
    rules: { "id-length": ["error", { min: 2, properties: "never", exceptions: ["x", "y"] }] },
  },
  { files: TESTS, rules: { "max-lines-per-function": "off" } },
  {
    files: ["src/plugin/adapters/figma/lookup/**/*.ts"],
    ignores: TESTS,
    rules: { "no-restricted-syntax": ["error", ...BANNED_SYNTAX, ...CLASS_MODULES, ...INJECTION] },
  },
  { files: ["src/plugin/adapters/**/*.ts", "src/plugin/main/**/*.ts"], rules: { "no-restricted-globals": "off" } },
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
  // Texts live in .constants.ts; tests keep their names and the wire bytes they expect.
  {
    files: ["src/**/*.ts"],
    ignores: [...TESTS, "**/*.constants.ts"],
    plugins: { shape: SHAPE },
    // Every shape rule as an error.
    rules: SHAPE.configs.recommended.rules,
  },
  // Every import of src goes through `@/` (the src root), the class's own satellites and subfolders too; only a path
  // out of src (package.json) has no alias and stays relative. `eslint --fix` rewrites the rest.
  {
    files: ["src/**/*.ts"],
    plugins: { "no-relative-import-paths": noRelativeImportPaths, imports: IMPORTS },
    rules: {
      "no-relative-import-paths/no-relative-import-paths": [
        "error",
        { rootDir: "src", prefix: "@", allowSameFolder: false },
      ],
      ...IMPORTS.configs.recommended.rules,
    },
  },
  // The plugin judges only files inside its rootDir, so test/ and scripts/ take the plain ban, fixed by hand. A script
  // that imports src runs under tsx, which reads the tsconfig paths; raw node does not.
  {
    files: ["test/**/*.ts", "scripts/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ regex: "^(\\.\\./)+src/", message: "Import src through @/, as src does." }] },
      ],
    },
  },
];
