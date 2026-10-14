import type { OperationResult } from "@pixelwright/core";
import type * as z from "zod";
import { sourceMissing } from "../../code-connect/code-source.ts";
import { ConnectionIndex } from "../../code-connect/connection-index.ts";
import { templateName } from "../../code-connect/names.ts";
import { findTemplates } from "../../code-connect/templates.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import { linkPath } from "./link-paths.ts";
import type { ComponentsReadInputSchema, ComponentsReadOutputSchema } from "./schemas.ts";

type Input = Omit<z.output<typeof ComponentsReadInputSchema>, "file"> & { file?: string };
type Output = z.output<typeof ComponentsReadOutputSchema>;
type Listed = Output["components"][number];

/** What the plugin is asked for when `mapped` filters the list: the most it lists, filtered here, then cut. */
const MAPPED_ASK = 500;

/**
 * The plugin's components joined with the project's Code Connect connections: each with the one that builds it (or
 * null), `mapped` keeping only those with or without code, Dev Mode links with the project file a code link points
 * at, and notes for what was not read.
 */
export async function readComponents(plugin: PluginClient, input: Input, root: string): Promise<Output> {
  const { file, mapped, limit, ...query } = input;
  const session = plugin.session(file);
  const { templates, problems } = await findTemplates(root);
  const answer = await session.run("components", {
    ...query,
    limit: mapped === undefined ? limit : MAPPED_ASK,
  });
  const index = new ConnectionIndex(templates, { fileKey: session.info()?.file.key ?? null });
  const joined = await Promise.all(answer.components.map((entry) => joinedEntry(entry, index, root)));
  const kept = mapped === undefined ? joined : joined.filter(({ code }) => (code !== null) === mapped);
  const notes = [
    ...(answer.pagesNotRead ?? []).map(
      ({ name, error }) => `The page ${name} could not be read (${error}): its components are not listed.`,
    ),
    ...problems.map((problem) => `Code Connect: ${problem}`),
    ...(answer.linksNote === undefined ? [] : [answer.linksNote]),
    ...(input.links && answer.linksRead === undefined
      ? [
          "The Pixelwright plugin in this file is older than the server and reads no Dev Mode links: update it (npx -y pixelwright@latest).",
        ]
      : []),
  ];

  return {
    components: kept.slice(0, limit),
    more: answer.more || kept.length > limit,
    ...(notes.length === 0 ? {} : { notes }),
  };
}

/** A component with its connection and its links' project files. */
async function joinedEntry(
  entry: OperationResult<"components">["components"][number],
  index: ConnectionIndex,
  root: string,
): Promise<Listed> {
  const match = index.forOwner(entry);
  const code =
    match === null
      ? null
      : {
          component: templateName(match.template),
          ...(match.template.codeSource === undefined ? {} : { source: match.template.codeSource }),
          ...((await sourceMissing(root, match.template)) ? { missing: true as const } : {}),
          template: match.template.path,
          by: match.by,
        };
  const links =
    entry.links === undefined
      ? undefined
      : await Promise.all(
          entry.links.map(async (link) => {
            const path = await linkPath(link.url, root);

            return path === undefined
              ? link
              : {
                  ...link,
                  path,
                };
          }),
        );

  return {
    ...entry,
    ...(links === undefined ? {} : { links }),
    code,
  };
}
