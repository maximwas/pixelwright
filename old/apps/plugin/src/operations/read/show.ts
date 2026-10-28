import { BridgeError, type OperationInput, type OperationOutput } from "@pixelwright/core";
import { pageOf, requireNode } from "../../figma/nodes.ts";

/** Selects layers and brings them into view, switching to their page when needed. */
export async function show({ node, nodes, zoom, select }: OperationInput<"show">): Promise<OperationOutput<"show">> {
  const ids = nodes ?? (node === undefined ? [] : [node]);

  if (ids.length === 0) {
    throw new BridgeError("OP_FAILED", "Give node or nodes: the layers to show.");
  }

  const { layers, page } = await layersOnOnePage(ids);

  if (page !== null && page !== figma.currentPage) {
    await figma.setCurrentPageAsync(page);
  }

  if (select) {
    figma.currentPage.selection = layers;
  }

  figma.viewport.scrollAndZoomIntoView(layers);

  if (zoom !== "fit") {
    figma.viewport.zoom = zoom;
  }

  return {
    nodes: layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
    })),
    page: page?.name ?? figma.currentPage.name,
    zoom: figma.viewport.zoom,
  };
}

/** The layers to show and their page: every one a layer, all on one page. */
async function layersOnOnePage(ids: readonly string[]): Promise<{ layers: SceneNode[]; page: PageNode | null }> {
  const layers: SceneNode[] = [];
  let page: PageNode | null = null;

  for (const id of ids) {
    const found = await requireNode(id);
    const on = pageOf(found);

    if (on === null || found.type === "PAGE" || found.type === "DOCUMENT") {
      throw new BridgeError("NODE_NOT_FOUND", `${id} is not a layer on a page.`);
    }

    if (page !== null && on !== page) {
      throw new BridgeError(
        "OP_FAILED",
        `${id} is on page ${on.name}, the others on ${page.name}: show one page at a time.`,
      );
    }

    page = on;
    layers.push(found as SceneNode);
  }

  return {
    layers,
    page,
  };
}
