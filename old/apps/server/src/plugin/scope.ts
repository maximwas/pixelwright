import { BridgeError } from "@pixelwright/core";
import * as z from "zod";
import type { PluginSession } from "./plugin-session.ts";

const IdSchema = z.string().min(1).max(200);

/** Where a tool works: a layer or a page by id, or "file" for every page. */
export const WithinSchema = z.union([z.literal("file"), IdSchema]);

/** Several layers by id, for a tool that reads its roots one by one: a big board's frames in one call. */
export const WithinIdsSchema = z.array(IdSchema).min(1);

/** The ids a tool goes through, and how its answer names them. */
export interface Scope {
  readonly roots: readonly string[];
  /** "the selection", "page Pricing", "the file", or the layer's id. */
  readonly label: string;
  /** The pages, when the scope is pages: a page's own top layers are read for tools that read layers one by one. */
  readonly pages: readonly string[];
}

/**
 * The roots of `within`: the layer or page it names, the layers of a list, every page for "file", else the layers
 * selected in Figma; with nothing selected, the current page when the tool reads a page whole, an error naming
 * `within` otherwise.
 */
export async function scopeOf(
  session: PluginSession,
  within: string | readonly string[] | undefined,
  { pageWhenEmpty }: { pageWhenEmpty: boolean },
): Promise<Scope> {
  if (typeof within === "object") {
    return {
      roots: within,
      label: within.join(", "),
      pages: [],
    };
  }

  if (within === "file") {
    const { pages } = await session.run("file_map", null);

    return {
      roots: pages.map(({ id }) => id),
      label: "the file",
      pages: pages.map(({ id }) => id),
    };
  }

  if (within !== undefined) {
    const { pages } = await session.run("file_map", null);
    const page = pages.find(({ id }) => id === within);

    return {
      roots: [within],
      label: page === undefined ? within : `page ${page.name}`,
      pages: page === undefined ? [] : [page.id],
    };
  }

  return selectionScope(session, pageWhenEmpty);
}

/** The layers selected in Figma; with none, the current page, or an error when the tool does not read a page whole. */
async function selectionScope(session: PluginSession, pageWhenEmpty: boolean): Promise<Scope> {
  const { nodes } = await session.run("selection", null);

  if (nodes.length > 0) {
    return {
      roots: nodes.map(({ id }) => id),
      label: "the selection",
      pages: [],
    };
  }

  if (!pageWhenEmpty) {
    throw new BridgeError(
      "NODE_NOT_FOUND",
      'Nothing is selected in Figma: select layers, or give within (a layer or page id, or "file").',
    );
  }

  const { pages } = await session.run("file_map", null);
  const page = pages.find(({ current }) => current) ?? pages[0];

  if (page === undefined) {
    throw new BridgeError("NODE_NOT_FOUND", "The file has no pages to read.");
  }

  return {
    roots: [page.id],
    label: `page ${page.name}`,
    pages: [page.id],
  };
}
