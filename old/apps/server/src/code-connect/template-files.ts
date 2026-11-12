import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { TemplateFile } from "../types/code-connect.ts";
import { errorMessage } from "../utils/error-message.ts";
import { type CodeConnectConfig, substituted } from "./figma-config.ts";
import { figmaLink, given, topComments, unlinked } from "./top-comments.ts";

/**
 * A template file with the `// key=value` comments at its top read (keys in any case, the config's url substitutions
 * made): a template has a url, a key (Pixelwright's), or both. Null for a file that is no template, and a problem with
 * it when it looks like one gone wrong.
 */
export async function readTemplate(
  root: string,
  path: string,
  config: CodeConnectConfig,
  problems: string[],
): Promise<TemplateFile | null> {
  const source = await sourceOf(root, path, problems);

  if (source === null) {
    return null;
  }

  const comments = topComments(source);
  const written = comments.get("url");
  const key = given(comments.get("key"));

  if (written === undefined && key === undefined) {
    problems.push(...unlinked(path, source));

    return null;
  }

  const link = written === undefined ? {} : linkOf(path, written, config, problems);

  if (link === null) {
    return null;
  }

  if (written === undefined) {
    problems.push(`${path}: no url: Pixelwright matches it by key; Figma's CLI needs // url= to publish it.`);
  }

  const component = given(comments.get("component"));
  const codeSource = given(comments.get("source"));

  return {
    path,
    file: join(root, path),
    source,
    ...link,
    ...(key === undefined ? {} : { key }),
    ...(component === undefined ? {} : { component }),
    ...(codeSource === undefined ? {} : { codeSource }),
  };
}

/** A url with the config's substitutions made, and the node it links to; null, with a problem, for no Figma link. */
export function linkOf(
  name: string,
  written: string,
  config: CodeConnectConfig,
  problems: string[],
): { url: string; nodeId: string; fileKey: string } | null {
  const url = substituted(written, config);
  const link = figmaLink(url);

  if (link === null) {
    problems.push(`${name}: its url= is not a Figma link to a node (…figma.com/design/<file>/…?node-id=1-2).`);

    return null;
  }

  return {
    url,
    ...link,
  };
}

/** A file's text; null for a folder named like a template, and for a file that cannot be read, with a problem. */
export async function sourceOf(root: string, path: string, problems: string[]): Promise<string | null> {
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
