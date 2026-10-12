import { glob, readFile } from "node:fs/promises";
import { basename, join, matchesGlob } from "node:path";
import { FIGMA_CONFIG_FILE, TEMPLATE_GLOBS } from "../constants/code-connect.ts";
import { FigmaConfigSchema } from "../schemas/code-connect.ts";
import type { SnapshotInstance, TemplateFile } from "../types/code-connect.ts";
import { errorMessage } from "../utils/error-message.ts";

/**
 * The project's Code Connect templates, as Figma documents them: the files figma.config.json's include globs name
 * (else every *.figma.ts and *.figma.js), minus its exclude globs and node_modules, each with its comments read. What
 * keeps a file out (no url, a second template for the same component) is a problem, never a throw.
 */
export async function findTemplates(root: string): Promise<{ templates: TemplateFile[]; problems: string[] }> {
  const problems: string[] = [];
  const { include, exclude } = await configOf(root, problems);
  const paths: string[] = [];

  // node_modules is never walked into; the exclude globs are matched against what the include globs found.
  for await (const found of glob(include, {
    cwd: root,
    exclude: (entry) => basename(String(entry)) === "node_modules",
  })) {
    const path = found.split("\\").join("/");

    if (!exclude.some((pattern) => matchesGlob(path, pattern))) {
      paths.push(path);
    }
  }

  const templates: TemplateFile[] = [];
  const byNode = new Map<string, string>();
  const byName = new Map<string, string>();

  for (const path of [...new Set(paths)].sort()) {
    const template = await read(root, path, problems);

    if (template === null) {
      continue;
    }

    const node = `${template.fileKey ?? ""} ${template.nodeId ?? ""}`;
    const first = byNode.get(node);

    if (first !== undefined) {
      problems.push(`${path}: connects the same Figma component as ${first}, which is the one used.`);

      continue;
    }

    byNode.set(node, path);

    const name = nameOf(template);
    const named = byName.get(name);

    if (named === undefined) {
      byName.set(name, path);
    } else {
      problems.push(`${path}: also named ${name}, as ${named}: a library's ${name}, matched by name, gets ${named}.`);
    }

    templates.push(template);
  }

  return {
    templates,
    problems,
  };
}

/**
 * The template for an instance: one whose node-id is the instance's main component or set (when that lives in this
 * file) and whose name is its name; else one by name (a library's component, whose id here is not the library's); else
 * one by id alone (a component renamed since). The name is the `component` comment, else the file's base name.
 */
export function templateFor(instance: SnapshotInstance, templates: readonly TemplateFile[]): TemplateFile | null {
  const name = instance.setName ?? instance.componentName;
  const byId = (template: TemplateFile) =>
    !instance.remote &&
    template.nodeId !== undefined &&
    (template.nodeId === instance.componentId || template.nodeId === instance.setId);
  const byName = (template: TemplateFile) => nameOf(template) === name;

  return (
    templates.find((template) => byId(template) && byName(template)) ??
    templates.find(byName) ??
    templates.find(byId) ??
    null
  );
}

/** The Figma component a template names: its `component` comment, else its file's name before `.figma.`. */
function nameOf(template: TemplateFile): string {
  return template.component ?? basename(template.path).split(".figma.")[0] ?? template.path;
}

async function configOf(root: string, problems: string[]): Promise<{ include: string[]; exclude: string[] }> {
  let text: string;

  try {
    text = await readFile(join(root, FIGMA_CONFIG_FILE), "utf8");
  } catch {
    return {
      include: TEMPLATE_GLOBS,
      exclude: [],
    };
  }

  try {
    const config = FigmaConfigSchema.parse(JSON.parse(text));

    return {
      include: config.codeConnect?.include ?? config.include ?? TEMPLATE_GLOBS,
      exclude: config.codeConnect?.exclude ?? config.exclude ?? [],
    };
  } catch (error) {
    problems.push(`${FIGMA_CONFIG_FILE}: ${errorMessage(error)}; looking for *.figma.ts and *.figma.js instead.`);

    return {
      include: TEMPLATE_GLOBS,
      exclude: [],
    };
  }
}

/** A template file with the `// key=value` comments at its top read; null (and a problem) without a Figma url. */
async function read(root: string, path: string, problems: string[]): Promise<TemplateFile | null> {
  const source = await readFile(join(root, path), "utf8");
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
      comments.set(comment[1] ?? "", (comment[2] ?? "").trim());
    }
  }

  const url = comments.get("url");

  if (url === undefined) {
    problems.push(`${path}: no // url= comment at the top: Figma needs the component's link there.`);

    return null;
  }

  const link = figmaLink(url);

  if (link === null) {
    problems.push(`${path}: its url= is not a Figma link to a node (…figma.com/design/<file>/…?node-id=1-2).`);

    return null;
  }

  const component = comments.get("component");
  const codeSource = comments.get("source");

  return {
    path,
    source,
    url,
    ...link,
    ...(component === undefined || component === "" ? {} : { component }),
    ...(codeSource === undefined || codeSource === "" ? {} : { codeSource }),
  };
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
