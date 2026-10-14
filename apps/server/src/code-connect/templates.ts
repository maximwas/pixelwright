import { glob, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, matchesGlob, resolve } from "node:path";
import { FIGMA_CONFIG_FILE, PRUNED_FOLDERS, TEMPLATE_GLOBS, TEMPLATE_SUFFIXES } from "../constants/code-connect.ts";
import { FigmaConfigSchema } from "../schemas/code-connect.ts";
import type { SnapshotInstance, TemplateFile } from "../types/code-connect.ts";
import { errorMessage } from "../utils/error-message.ts";

interface Config {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly substitutions: Readonly<Record<string, string>>;
}

/**
 * The project's Code Connect templates, as Figma finds them: of the files figma.config.json's include globs name (else
 * every *.figma.ts, *.figma.js and their .figma.template kin), minus its exclude globs and dependency or build folders,
 * the ones with a template's ending, each with its comments read. Code that is no template is passed over; what keeps
 * a template out (no url, a second template for the same component) is a problem, never a throw. The home folder and
 * the disk's root are never searched: they are no project.
 */
export async function findTemplates(root: string): Promise<{ templates: TemplateFile[]; problems: string[] }> {
  if ([homedir(), "/"].includes(resolve(root))) {
    return {
      templates: [],
      problems: [
        `${root} is no project folder, so no Code Connect templates are looked for: start the MCP client in the project, or set CLAUDE_PROJECT_DIR.`,
      ],
    };
  }

  const problems: string[] = [];
  const config = await configOf(root, problems);
  const kept = new KeptTemplates(problems);

  for (const path of await templatePaths(root, config)) {
    const template = await read(root, path, config, problems);

    if (template !== null) {
      kept.add(template);
    }
  }

  return {
    templates: kept.templates,
    problems,
  };
}

/** The paths, sorted and once each, of the files the config's globs find that end as a template does. */
async function templatePaths(root: string, config: Config): Promise<string[]> {
  const paths: string[] = [];

  for await (const found of glob(config.include.map(relative), {
    cwd: root,
    exclude: (entry) => PRUNED_FOLDERS.has(basename(String(entry))),
  })) {
    const path = found.split("\\").join("/");

    if (
      TEMPLATE_SUFFIXES.some((suffix) => path.endsWith(suffix)) &&
      !config.exclude.some((pattern) => matchesGlob(path, relative(pattern)))
    ) {
      paths.push(path);
    }
  }

  return [...new Set(paths)].sort();
}

/**
 * The templates in use, as they are read: the first for each Figma component, a later one a problem. Two named alike
 * both stay, the second a problem too: a library's component, matched by name, gets the first.
 */
class KeptTemplates {
  readonly templates: TemplateFile[] = [];
  readonly #problems: string[];
  readonly #byNode = new Map<string, string>();
  readonly #byName = new Map<string, string>();

  constructor(problems: string[]) {
    this.#problems = problems;
  }

  add(template: TemplateFile): void {
    const node = `${template.fileKey ?? ""} ${template.nodeId ?? ""}`;
    const first = this.#byNode.get(node);

    if (first !== undefined) {
      this.#problems.push(`${template.path}: connects the same Figma component as ${first}, which is the one used.`);

      return;
    }

    this.#byNode.set(node, template.path);

    const name = templateName(template);
    const named = this.#byName.get(comparable(name));

    if (named === undefined) {
      this.#byName.set(comparable(name), template.path);
    } else {
      this.#problems.push(
        `${template.path}: also named ${name}, as ${named}: a library's ${name}, matched by name, gets ${named}.`,
      );
    }

    this.templates.push(template);
  }
}

/**
 * The template for an instance: one whose node-id is the instance's main component or set (when that lives in this
 * file) and whose name is its name; else one by name (a library's component, whose id here is not the library's); else
 * one by id alone (a component renamed since). Names are compared as code names: the template's is its `component`
 * comment (the code component's name, as Figma has it) or its file's name, the instance's the last part of its
 * component's or set's name; case, spaces and punctuation aside.
 */
export function templateFor(instance: SnapshotInstance, templates: readonly TemplateFile[]): TemplateFile | null {
  const name = comparable(instance.setName ?? instance.componentName);
  const byId = (template: TemplateFile) =>
    !instance.remote &&
    template.nodeId !== undefined &&
    (template.nodeId === instance.componentId || template.nodeId === instance.setId);
  const byName = (template: TemplateFile) => comparable(templateName(template)) === name;

  return (
    templates.find((template) => byId(template) && byName(template)) ??
    templates.find(byName) ??
    templates.find(byId) ??
    null
  );
}

/** The code component a template is for: its `component` comment, else its file's name before `.figma.`. */
export function templateName(template: TemplateFile): string {
  return template.component ?? basename(template.path).split(".figma.")[0] ?? template.path;
}

/** A name as names are compared: its last / part, lower case, letters and digits only ("Buttons/Primary Button" → primarybutton). */
function comparable(name: string): string {
  return (name.split("/").pop() ?? name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** A glob as fs.glob and matchesGlob read it: "./src/**" is "src/**". */
function relative(pattern: string): string {
  return pattern.replace(/^(\.\/)+/, "");
}

async function configOf(root: string, problems: string[]): Promise<Config> {
  const defaults: Config = {
    include: TEMPLATE_GLOBS,
    exclude: [],
    substitutions: {},
  };
  let text: string;

  try {
    text = await readFile(join(root, FIGMA_CONFIG_FILE), "utf8");
  } catch {
    return defaults;
  }

  try {
    const config = FigmaConfigSchema.parse(JSON.parse(text));

    return {
      include: config.codeConnect?.include ?? config.include ?? TEMPLATE_GLOBS,
      exclude: config.codeConnect?.exclude ?? config.exclude ?? [],
      substitutions: config.codeConnect?.documentUrlSubstitutions ?? config.documentUrlSubstitutions ?? {},
    };
  } catch (error) {
    problems.push(`${FIGMA_CONFIG_FILE}: ${errorMessage(error)}; looking for *.figma.ts and *.figma.js instead.`);

    return defaults;
  }
}

/**
 * A template file with the `// key=value` comments at its top read (keys in any case, the config's url substitutions
 * made); null for a file that is no template, and a problem with it when it looks like one gone wrong.
 */
async function read(root: string, path: string, config: Config, problems: string[]): Promise<TemplateFile | null> {
  const source = await sourceOf(root, path, problems);

  if (source === null) {
    return null;
  }

  const comments = topComments(source);
  const written = comments.get("url");

  if (written === undefined) {
    problems.push(...unlinked(path, source));

    return null;
  }

  const url = Object.entries(config.substitutions).reduce(
    (current, [placeholder, value]) => current.replaceAll(placeholder, value),
    written,
  );
  const link = figmaLink(url);

  if (link === null) {
    problems.push(`${path}: its url= is not a Figma link to a node (…figma.com/design/<file>/…?node-id=1-2).`);

    return null;
  }

  const component = comments.get("component");
  const codeSource = comments.get("source");

  return {
    path,
    file: join(root, path),
    source,
    url,
    ...link,
    ...(component === undefined || component === "" ? {} : { component }),
    ...(codeSource === undefined || codeSource === "" ? {} : { codeSource }),
  };
}

/** A file's text; null for a folder named like a template, and for a file that cannot be read, with a problem. */
async function sourceOf(root: string, path: string, problems: string[]): Promise<string | null> {
  try {
    return await readFile(join(root, path), "utf8");
  } catch (error) {
    // A folder named like a template is none; a file that cannot be read is worth saying.
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "EISDIR")) {
      problems.push(`${path}: cannot be read (${errorMessage(error)}).`);
    }

    return null;
  }
}

/** The `// key=value` comments before a file's first code, by key in lower case. */
function topComments(source: string): Map<string, string> {
  const comments = new Map<string, string>();

  for (const line of source.split("\n")) {
    const trimmed = line.trim();

    if (trimmed === "") {
      continue;
    }

    if (!trimmed.startsWith("//")) {
      break;
    }

    const comment = /^\/\/\s*([a-zA-Z]+)\s*=\s*(.*)$/.exec(trimmed);

    if (comment !== null) {
      comments.set((comment[1] ?? "").toLowerCase(), (comment[2] ?? "").trim());
    }
  }

  return comments;
}

/** What a file without a url= comment says of itself: an old figma.connect file, or a template missing its link. */
function unlinked(path: string, source: string): string[] {
  if (/\bfigma\.connect\s*\(/.test(source)) {
    return [
      `${path}: a figma.connect file, which Pixelwright does not run: npx figma connect migrate turns it into a template.`,
    ];
  }

  return /from\s+["']figma["']|require\(\s*["']figma["']\s*\)/.test(source)
    ? [`${path}: no // url= comment at the top: Figma needs the component's link there.`]
    : [];
}

/** A Figma link's file key and node id: /design/<key>/ or /file/<key>/, node-id 1-2 or 1:2 → 1:2. */
function figmaLink(url: string): { nodeId: string; fileKey: string } | null {
  try {
    const parsed = new URL(url);
    const fileKey = /^\/(?:design|file|proto)\/([^/]+)/.exec(parsed.pathname)?.[1];
    const node = parsed.searchParams.get("node-id");

    if (fileKey === undefined || node === null || !/^\d+[-:]\d+$/.test(node)) {
      return null;
    }

    return {
      nodeId: node.replace("-", ":"),
      fileKey,
    };
  } catch {
    return null;
  }
}
