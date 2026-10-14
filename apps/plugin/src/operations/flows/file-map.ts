import type { OperationOutput } from "@pixelwright/core";
import { OP_BUDGET_MS } from "../../constants/plugin.ts";
import { devStatusOf } from "../../figma/dev-status.ts";
import { loaded } from "../../figma/used-tokens.ts";
import { FILE_MAP_MAX_NODES } from "./constants.ts";

type MapPage = OperationOutput<"file_map">["pages"][number];

/**
 * Every page with its top layers and a section's own, sizes rounded; pages are loaded one at a time within the budget,
 * and at most FILE_MAP_MAX_NODES layers are listed in all (a page cut short says how many it has).
 */
export async function fileMap(): Promise<OperationOutput<"file_map">> {
  const started = Date.now();
  const map = new FileMap();

  for (const page of figma.root.children) {
    if (Date.now() - started > OP_BUDGET_MS || map.full) {
      return {
        pages: map.pages,
        more: true,
      };
    }

    await loaded(page);
    map.addPage(page);
  }

  return {
    pages: map.pages,
    more: map.more,
  };
}

/** The pages mapped so far, and the layers still allowed. */
class FileMap {
  readonly pages: MapPage[] = [];
  more = false;
  #left = FILE_MAP_MAX_NODES;

  get full(): boolean {
    return this.#left <= 0;
  }

  addPage(page: PageNode): void {
    const nodes: MapPage["nodes"] = [];

    for (const node of page.children) {
      if (this.#left <= 0) {
        break;
      }

      const children =
        node.type === "SECTION" ? node.children.slice(0, Math.max(0, this.#left - 1)).map(entryOf) : null;

      nodes.push({
        ...entryOf(node),
        ...(children === null ? {} : { children }),
      });
      this.#left -= 1 + (children?.length ?? 0);
    }

    this.more ||= nodes.length < page.children.length;
    this.pages.push({
      id: page.id,
      name: page.name,
      current: page === figma.currentPage,
      ...(nodes.length < page.children.length ? { total: page.children.length } : {}),
      nodes,
    });
  }
}

function entryOf(node: SceneNode) {
  const devStatus = devStatusOf(node);

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    width: Math.round(node.width),
    height: Math.round(node.height),
    ...(devStatus === undefined ? {} : { devStatus }),
  };
}
