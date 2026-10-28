import { glob } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, matchesGlob, resolve } from "node:path";
import { BATCH_GLOB, BATCH_SUFFIX, PRUNED_FOLDERS, TEMPLATE_SUFFIXES } from "../constants/code-connect.ts";
import type { SnapshotInstance, TemplateFile } from "../types/code-connect.ts";
import { readBatch } from "./batch-files.ts";
import { ConnectionIndex } from "./connection-index.ts";
import { type CodeConnectConfig, configOf, relativeGlob } from "./figma-config.ts";
import { KeptConnections } from "./kept-connections.ts";
import { readTemplate } from "./template-files.ts";

export { templateName } from "./names.ts";

/**
 * The project's Code Connect connections, as Figma finds them: of the files figma.config.json's include globs name
 * (else every *.figma.ts, *.figma.js, their .figma.template kin and *.figma.batch.json), minus its exclude globs and
 * dependency or build folders, the templates each with its comments read and the batch files row by row. Code that is
 * no template is passed over; what keeps a connection out (no url or key, a second one for the same component, a batch
 * file the include misses) is a problem, never a throw. The home folder and the disk's root are never searched: they
 * are no project.
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
  const kept = new KeptConnections(problems);
  const paths = await codeConnectPaths(root, config);

  for (const path of paths) {
    const read = path.endsWith(BATCH_SUFFIX)
      ? await readBatch(root, path, config, problems)
      : [await readTemplate(root, path, config, problems)];

    for (const connection of read) {
      if (connection !== null) {
        kept.add(connection);
      }
    }
  }

  problems.push(...(await skippedBatches(root, config, paths)));

  return {
    templates: kept.templates,
    problems,
  };
}

/** The paths, sorted and once each, of the files the config's globs find that end as a Code Connect file does. */
async function codeConnectPaths(root: string, config: CodeConnectConfig, patterns = config.include): Promise<string[]> {
  const paths: string[] = [];

  for await (const found of glob(patterns.map(relativeGlob), {
    cwd: root,
    exclude: (entry) => PRUNED_FOLDERS.has(basename(String(entry))),
  })) {
    const path = found.split("\\").join("/");

    if (
      [...TEMPLATE_SUFFIXES, BATCH_SUFFIX].some((suffix) => path.endsWith(suffix)) &&
      !config.exclude.some((pattern) => matchesGlob(path, relativeGlob(pattern)))
    ) {
      paths.push(path);
    }
  }

  return [...new Set(paths)].sort();
}

/** The batch files a custom include leaves out: Figma skips them too, so each is a problem. */
async function skippedBatches(root: string, config: CodeConnectConfig, found: readonly string[]): Promise<string[]> {
  if (!config.customInclude) {
    return [];
  }

  const taken = new Set(found);

  return (await codeConnectPaths(root, config, [BATCH_GLOB]))
    .filter((path) => !taken.has(path))
    .map((path) => `${path}: not in figma.config.json's include, so Figma skips it too: add ${BATCH_GLOB}.`);
}

/** The connection for an instance, by ConnectionIndex's rules: for a lookup alone (a read builds its index once). */
export function templateFor(instance: SnapshotInstance, templates: readonly TemplateFile[]): TemplateFile | null {
  return new ConnectionIndex(templates).match(instance)?.template ?? null;
}
