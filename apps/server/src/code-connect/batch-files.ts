import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { BATCH_TEMPLATE_SUFFIXES } from "../constants/code-connect.ts";
import type { SharedTemplate, TemplateFile } from "../types/code-connect.ts";
import { errorMessage } from "../utils/error-message.ts";
import type { CodeConnectConfig } from "./figma-config.ts";
import { linkOf, sourceOf } from "./template-files.ts";
import { given } from "./top-comments.ts";

/** Why a group's rows are left out, as Figma's CLI would refuse the whole file for it. */
const REJECTED = "its rows are left out (Figma's CLI rejects the whole file)";

/**
 * A batch file's rows as connections, in Figma's format (CLI 1.4.9 batch_templates.js): one group
 * `{templateFile, components}` or an array of them; the template resolved against the batch file's folder, ending in
 * .figma.batch.ts or .js; each row with a url (Figma's rule) or a key (Pixelwright's). A row is `<file>#<n>`, n
 * counting its rows from 1 across the groups. What Figma's CLI would refuse the whole file for leaves out only that
 * group or row here, with a problem saying so.
 */
export async function readBatch(
  root: string,
  path: string,
  config: CodeConnectConfig,
  problems: string[],
): Promise<TemplateFile[]> {
  const text = await sourceOf(root, path, problems);

  if (text === null) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    problems.push(`${path}: not JSON (${errorMessage(error)}).`);

    return [];
  }

  const rows = new BatchRows({
    root,
    path,
    config,
    problems,
  });

  for (const [index, group] of (Array.isArray(parsed) ? parsed : [parsed]).entries()) {
    await rows.addGroup(group, index + 1);
  }

  return rows.finish();
}

interface BatchSource {
  readonly root: string;
  readonly path: string;
  readonly config: CodeConnectConfig;
  readonly problems: string[];
}

/** One batch file's rows as they are read: numbered across its groups, the ones without a url noted together. */
class BatchRows {
  readonly #source: BatchSource;
  readonly #connections: TemplateFile[] = [];
  readonly #keyOnly: string[] = [];
  /** The shared templates read, by absolute path: every row of the file running one shares its object. */
  readonly #shared = new Map<string, SharedTemplate>();
  #count = 0;

  constructor(source: BatchSource) {
    this.#source = source;
  }

  async addGroup(group: unknown, number: number): Promise<void> {
    const record = recordOf(group);
    const rows = Array.isArray(record.components) ? (record.components as unknown[]) : [];
    const first = this.#count + 1;

    this.#count += rows.length;

    const template = await this.#template(record.templateFile, rows, number);

    if (template !== null) {
      for (const [at, row] of rows.entries()) {
        this.#addRow(recordOf(row), first + at, template);
      }
    }
  }

  /** The connections, and one problem for the rows Figma's CLI cannot publish without a url. */
  finish(): TemplateFile[] {
    if (this.#keyOnly.length > 0) {
      this.#source.problems.push(
        `${this.#source.path}: rows without url (${this.#keyOnly.join(", ")}): Pixelwright matches them by key; Figma's CLI needs a row's url to publish them.`,
      );
    }

    return this.#connections;
  }

  /** The group's shared template, read; null, with a problem, for a group Figma's CLI refuses. */
  async #template(templateFile: unknown, rows: readonly unknown[], number: number): Promise<SharedTemplate | null> {
    const { root, path, problems } = this.#source;

    if (typeof templateFile !== "string" || templateFile === "") {
      problems.push(`${path}: group ${number} has no templateFile; ${REJECTED}.`);

      return null;
    }

    const file = resolve(root, dirname(path), templateFile);
    const refusal = await templateRefusal(file, templateFile, rows);

    if (typeof refusal === "string") {
      problems.push(`${path}: group ${number}'s ${refusal}; ${REJECTED}.`);

      return null;
    }

    const shared = this.#shared.get(file) ?? {
      path: relative(root, file).split("\\").join("/"),
      file,
      source: refusal.source,
    };

    this.#shared.set(file, shared);

    return shared;
  }

  #addRow(row: Record<string, unknown>, number: number, template: SharedTemplate): void {
    const { path, config, problems } = this.#source;
    const component = given(row.component);
    const key = given(row.key);
    const url = given(row.url);
    const name = component ?? `row ${number}`;
    const label = component === undefined ? name : `row ${name}`;

    if (url === undefined && key === undefined) {
      problems.push(`${path}: ${label} has neither url nor key; it is left out (Figma's CLI rejects the whole file).`);

      return;
    }

    const link = url === undefined ? {} : linkOf(`${path}: ${label}`, url, config, problems);

    if (link === null) {
      return;
    }

    if (url === undefined) {
      this.#keyOnly.push(name);
    }

    const codeSource = given(row.source);

    this.#connections.push({
      path: `${path}#${number}`,
      file: template.file,
      source: template.source,
      ...link,
      ...(key === undefined ? {} : { key }),
      ...(component === undefined ? {} : { component }),
      ...(codeSource === undefined ? {} : { codeSource }),
      batch: frozen(row),
      batchFile: path,
      shared: template,
    });
  }
}

/** The shared template's text, or why Figma's CLI refuses it: missing, misnamed, or a group without rows. */
async function templateRefusal(
  file: string,
  written: string,
  rows: readonly unknown[],
): Promise<{ source: string } | string> {
  let source: string;

  try {
    source = await readFile(file, "utf8");
  } catch {
    return `templateFile ${written} does not exist`;
  }

  if (!BATCH_TEMPLATE_SUFFIXES.some((suffix) => file.endsWith(suffix))) {
    return `templateFile ${written} must end in ${BATCH_TEMPLATE_SUFFIXES.join(" or ")}`;
  }

  if (rows.length === 0) {
    return "components must be a non-empty array";
  }

  return { source };
}

function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** A row as its template reads it: a copy no run can change for the next one. */
function frozen<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) {
      frozen(item);
    }

    Object.freeze(value);
  }

  return value;
}
