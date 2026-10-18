import { type ComponentEntry, type States, statesFind } from "@pixelwright/core";
import type * as z from "zod";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { PluginSession } from "../../plugin/plugin-session.ts";
import { type Scope, scopeOf } from "../../plugin/scope.ts";
import type { StatesFindInputSchema } from "./schemas.ts";

/**
 * states_find: the components the scope uses (the file's own for "file") and the screens of its pages, each with the
 * states it is drawn in and the ones it lacks.
 */
export async function findStates(
  plugin: PluginClient,
  { within, file }: z.output<typeof StatesFindInputSchema>,
): Promise<States> {
  const session = plugin.session(file);
  const scope = await scopeOf(session, within, { pageWhenEmpty: true });
  const found = statesFind({
    components: await componentsOf(session, scope),
    screens: await screensOf(session, scope),
  });

  return {
    ...found,
    notes: found.components.length === 0 ? [noComponents(scope)] : [],
  };
}

/** Why no component was listed, and where to look instead. */
function noComponents(scope: Scope): string {
  return scope.label === "the file"
    ? "The file defines no component named as interactive (button, field, toggle, tab, link)."
    : `No interactive component is used in ${scope.label}: give within a page, or "file" for the file's own components.`;
}

/** The components to check: the file's own for the file, else those the scope's instances use. */
async function componentsOf(session: PluginSession, scope: Scope): Promise<ComponentEntry[]> {
  if (scope.label === "the file") {
    return (
      await session.run("components", {
        scope: "local",
        limit: 500,
      })
    ).components;
  }

  const entries = new Map<string, ComponentEntry>();

  for (const within of scope.roots) {
    for (const entry of (
      await session.run("components", {
        scope: "used",
        within,
        limit: 500,
      })
    ).components) {
      entries.set(entry.id, entry);
    }
  }

  return [...entries.values()];
}

/** The screens to group: the top layers of the scope's pages, or of the current page for layers. */
async function screensOf(session: PluginSession, scope: Scope): Promise<{ id: string; name: string }[]> {
  const { pages } = await session.run("file_map", null);
  const wanted =
    scope.pages.length > 0
      ? pages.filter(({ id }) => scope.pages.includes(id))
      : pages.filter(({ current }) => current);

  return wanted.flatMap((page) => page.nodes.flatMap((node) => [node, ...(node.children ?? [])]));
}
