import { LINKS_BATCH, LINKS_TIMEOUT_MS, OP_BUDGET_MS } from "../../constants/plugin.ts";
import { devResourcesOf, hasDevResources, LinksTimeout, linksRefusal } from "../../figma/dev-resources.ts";
import { errorMessage } from "../../utils/error-message.ts";
import type { ComponentEntry, ComponentOwner } from "./component-entry.ts";

type Link = NonNullable<ComponentEntry["links"]>[number];

/** Where a listed component's links are read from: the component itself, or an instance for a library's. */
export interface LinkSources {
  owner(id: string): ComponentOwner | undefined;
  /** One of the instances found of it: a library component's links are inherited there. */
  instanceOf(id: string): InstanceNode | undefined;
}

/**
 * The listed components with their Dev Mode links: the file's answer is asked first (a plan without links refuses
 * it), then each component's, LINKS_BATCH at a time while the operation's time lasts. Figma refusing, not answering
 * or running out of time becomes the note, never an error; a Figma without the API reads none.
 */
export async function withLinks(
  entries: readonly ComponentEntry[],
  sources: LinkSources,
  started: number,
): Promise<{ entries: ComponentEntry[]; note?: string }> {
  if (!hasDevResources()) {
    return { entries: [...entries] };
  }

  try {
    const refusal = await linksRefusal();

    if (refusal !== null) {
      return {
        entries: [...entries],
        note: `Dev Mode links are not available in this file: Figma refused them (${refusal}); they come with a paid plan and a Full or Dev seat.`,
      };
    }

    return await linkedEntries(entries, sources, started);
  } catch (error) {
    return {
      entries: [...entries],
      note: noteOf(error),
    };
  }
}

/** Each entry's links, batch by batch; past the operation's time the rest are left without, with a note. */
async function linkedEntries(
  entries: readonly ComponentEntry[],
  sources: LinkSources,
  started: number,
): Promise<{ entries: ComponentEntry[]; note?: string }> {
  const linked: ComponentEntry[] = [];

  for (let index = 0; index < entries.length; index += LINKS_BATCH) {
    if (Date.now() - started > OP_BUDGET_MS) {
      return {
        entries: [...linked, ...entries.slice(index)],
        note: `Dev Mode links were read for the first ${index} components only: ask with query or a smaller limit for the rest.`,
      };
    }

    const batch = entries.slice(index, index + LINKS_BATCH);
    const links = await Promise.all(batch.map((entry) => linksOf(entry, sources)));

    linked.push(
      ...batch.map((entry, at) => ({
        ...entry,
        links: links[at] ?? [],
      })),
    );
  }

  return { entries: linked };
}

/** A component's own links, a set's with its variants' (on naming the variant); a library's through an instance. */
async function linksOf(entry: ComponentEntry, sources: LinkSources): Promise<Link[]> {
  if (entry.remote) {
    const instance = sources.instanceOf(entry.id);

    return instance === undefined
      ? []
      : (await devResourcesOf(instance))
          .filter(({ inheritedNodeId }) => inheritedNodeId !== undefined)
          .map(({ name, url }) => ({
            name,
            url,
          }));
  }

  const owner = sources.owner(entry.id);

  if (owner === undefined) {
    return [];
  }

  const variants = new Map(owner.type === "COMPONENT_SET" ? owner.children.map((child) => [child.id, child.name]) : []);
  const found = await devResourcesOf(owner, owner.type === "COMPONENT_SET");

  return found.flatMap(({ name, url, nodeId, inheritedNodeId }) => {
    if (inheritedNodeId !== undefined || (nodeId !== owner.id && !variants.has(nodeId))) {
      return [];
    }

    const on = variants.get(nodeId);

    return [
      {
        name,
        url,
        ...(on === undefined ? {} : { on }),
      },
    ];
  });
}

function noteOf(error: unknown): string {
  return error instanceof LinksTimeout
    ? `Figma's servers gave no answer about Dev Mode links within ${LINKS_TIMEOUT_MS / 1_000} s: they were not read.`
    : `Dev Mode links could not be read: ${errorMessage(error)}`;
}
