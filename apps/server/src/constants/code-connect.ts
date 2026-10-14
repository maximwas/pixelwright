/** Figma's Code Connect template files, where figma.config.json names no others. */
export const TEMPLATE_GLOBS = ["**/*.figma.ts", "**/*.figma.js", "**/*.figma.template.ts", "**/*.figma.template.js"];

/** The endings Figma takes a template by, whatever the include globs found. */
export const TEMPLATE_SUFFIXES = [".figma.ts", ".figma.js", ".figma.template.ts", ".figma.template.js"];

/** Folders a template search never walks into: installed packages and build output. */
export const PRUNED_FOLDERS = new Set(["node_modules", "dist", "build", "coverage"]);

/** The project's Code Connect config, at its root. */
export const FIGMA_CONFIG_FILE = "figma.config.json";

/** How long one instance's template, nested templates included, may run. */
export const TEMPLATE_TIMEOUT_MS = 1_000;

/** How long all the templates of one read may take together; past it, instances are read as layers. */
export const CODE_CONNECT_BUDGET_MS = 5_000;

/**
 * How much sooner each nested template's run is stopped than the one around it, so the innermost is the one blamed:
 * V8's watchdog fires late on a busy machine, and 5 ms let the outer one go first now and then.
 */
export const NESTED_TIMEOUT_MARGIN_MS = 50;

/** The console a template and its helpers get: it says nothing. */
export const QUIET_CONSOLE = Object.fromEntries(
  ["log", "info", "warn", "error", "debug"].map((name) => [name, () => {}]),
);

/** The files a relative import may name, tried in order after the name as written. */
export const HELPER_EXTENSIONS = [".ts", ".js", ".mts", ".mjs", "/index.ts", "/index.js"];

/** The share of design_read's maxChars its connected instances' code may take; the XML gets what the code leaves. */
export const CODE_CONNECT_SHARE = 0.4;
