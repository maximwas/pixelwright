import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FIGMA_CONFIG_FILE, TEMPLATE_GLOBS } from "../constants/code-connect.ts";
import { FigmaConfigSchema } from "../schemas/code-connect.ts";
import { errorMessage } from "../utils/error-message.ts";

/** What figma.config.json says of the Code Connect files: their globs, its url substitutions, whether include is its own. */
export interface CodeConnectConfig {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly substitutions: Readonly<Record<string, string>>;
  /** The config names its own include globs, which may leave batch files out. */
  readonly customInclude: boolean;
}

const DEFAULTS: CodeConnectConfig = {
  include: TEMPLATE_GLOBS,
  exclude: [],
  substitutions: {},
  customInclude: false,
};

/** The project's figma.config.json (its codeConnect block, else its top level); the defaults without one. */
export async function configOf(root: string, problems: string[]): Promise<CodeConnectConfig> {
  let text: string;

  try {
    text = await readFile(join(root, FIGMA_CONFIG_FILE), "utf8");
  } catch {
    return DEFAULTS;
  }

  try {
    const config = FigmaConfigSchema.parse(JSON.parse(text));
    const include = config.codeConnect?.include ?? config.include;

    return {
      include: include ?? TEMPLATE_GLOBS,
      exclude: config.codeConnect?.exclude ?? config.exclude ?? [],
      substitutions: config.codeConnect?.documentUrlSubstitutions ?? config.documentUrlSubstitutions ?? {},
      customInclude: include !== undefined,
    };
  } catch (error) {
    problems.push(`${FIGMA_CONFIG_FILE}: ${errorMessage(error)}; looking for *.figma.ts and *.figma.js instead.`);

    return DEFAULTS;
  }
}

/** A url with the config's substitutions made. */
export function substituted(url: string, config: CodeConnectConfig): string {
  return Object.entries(config.substitutions).reduce(
    (current, [placeholder, value]) => current.replaceAll(placeholder, value),
    url,
  );
}

/** A glob as fs.glob and matchesGlob read it: "./src/**" is "src/**". */
export function relativeGlob(pattern: string): string {
  return pattern.replace(/^(\.\/)+/, "");
}
