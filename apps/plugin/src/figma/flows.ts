import {
  BridgeError,
  interactionSummary,
  type OperationInput,
  type OperationOutput,
  type SnapshotReaction,
} from "@pixelwright/core";
import { FILE_MAP_MAX_NODES, FLOW_MAX_LINKS, OP_BUDGET_MS } from "../constants/plugin.ts";
import { pageOf, requireNode } from "./nodes.ts";
import { reactionsOf } from "./snapshot.ts";
import { loaded } from "./used-tokens.ts";

type Link = OperationOutput<"flows">["links"][number];

const SCREEN_TYPES = new Set(["FRAME", "COMPONENT", "INSTANCE"]);

/** The page's screens: its frames, and those in its sections. */
function screensOf(page: PageNode): SceneNode[] {
  return page.children
    .flatMap((node) => (node.type === "SECTION" ? node.children : [node]))
    .filter((node) => SCREEN_TYPES.has(node.type));
}

/** The screen a layer is on, and the page's other screens, each with its children's names (for breakpoints_find). */
export async function screens({ node: id }: OperationInput<"screens">): Promise<OperationOutput<"screens">> {
  const node = await requireNode(id);
  const page = pageOf(node);

  if (page === null) {
    throw new BridgeError("NODE_NOT_FOUND", `${id} is not a layer on a page.`);
  }

  const all = screensOf(page);
  const target = all.find((screen) => screen === node || contains(screen, node));

  if (target === undefined) {
    throw new BridgeError(
      "OP_FAILED",
      `${id} "${node.name}" is on no screen: give a frame on the page or a layer in one.`,
    );
  }

  const describe = (screen: SceneNode) => ({
    id: screen.id,
    name: screen.name,
    width: Math.round(screen.width),
    height: Math.round(screen.height),
    children: "children" in screen ? screen.children.map((child) => child.name) : [],
  });

  return {
    target: describe(target),
    screens: all.filter((screen) => screen !== target).map(describe),
  };
}

function contains(ancestor: BaseNode, node: BaseNode): boolean {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (current === ancestor) {
      return true;
    }
  }

  return false;
}

/**
 * A page's prototype as a map: where its flows start, its screens (its frames, and those in its sections), and every
 * interaction that leaves its layer (a variant switch stays inside its component and is left out).
 */
export async function flows({ page: id }: OperationInput<"flows">): Promise<OperationOutput<"flows">> {
  const page = id === undefined ? figma.currentPage : await requireNode(id);

  if (page.type !== "PAGE") {
    throw new BridgeError("NODE_NOT_FOUND", `${id} is a ${page.type.toLowerCase()}: give a page's id.`);
  }

  await loaded(page);

  const screens = screensOf(page);
  const names = new Map(screens.map((screen) => [screen.id, screen.name]));
  const links: Link[] = [];
  let more = false;

  for (const screen of screens) {
    const layers = [
      screen,
      ...("findAll" in screen ? screen.findAll((node) => "reactions" in node && node.reactions.length > 0) : []),
    ];

    for (const layer of layers) {
      for (const reaction of (await reactionsOf(layer)) as SnapshotReaction[]) {
        for (const action of reaction.actions ?? []) {
          const kind = action.type === "NODE" ? (action.navigation ?? "NAVIGATE") : action.type;

          if (kind === "CHANGE_TO") {
            continue;
          }

          if (links.length >= FLOW_MAX_LINKS) {
            more = true;
            break;
          }

          const destination = action.type === "NODE" ? action.destinationId : null;

          links.push({
            from: {
              id: screen.id,
              name: screen.name,
            },
            layer: {
              id: layer.id,
              name: layer.name,
            },
            trigger: reaction.trigger?.type ?? "NONE",
            action: kind,
            to:
              destination === null || destination === undefined
                ? null
                : {
                    id: destination,
                    name: names.get(destination) ?? action.destinationName ?? destination,
                  },
            ...(action.type === "URL" && typeof action.url === "string" ? { url: action.url } : {}),
            summary: interactionSummary({
              ...reaction,
              actions: [action],
            }),
          });
        }
      }
    }
  }

  return {
    page: page.name,
    starts: page.flowStartingPoints.map(({ nodeId, name }) => ({
      id: nodeId,
      name,
    })),
    screens: screens.map((screen) => ({
      id: screen.id,
      name: screen.name,
      width: Math.round(screen.width),
      height: Math.round(screen.height),
    })),
    links,
    more,
  };
}

/**
 * Every page with its top layers and a section's own, sizes rounded; pages are loaded one at a time within the budget,
 * and at most FILE_MAP_MAX_NODES layers are listed in all (a page cut short says how many it has).
 */
export async function fileMap(): Promise<OperationOutput<"file_map">> {
  const started = Date.now();
  const pages: OperationOutput<"file_map">["pages"] = [];
  let left = FILE_MAP_MAX_NODES;
  let more = false;
  const entry = (node: SceneNode) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    width: Math.round(node.width),
    height: Math.round(node.height),
  });

  for (const page of figma.root.children) {
    if (Date.now() - started > OP_BUDGET_MS || left <= 0) {
      return {
        pages,
        more: true,
      };
    }

    await loaded(page);

    const nodes: OperationOutput<"file_map">["pages"][number]["nodes"] = [];

    for (const node of page.children) {
      if (left <= 0) {
        break;
      }

      const children = node.type === "SECTION" ? node.children.slice(0, Math.max(0, left - 1)).map(entry) : null;

      nodes.push({
        ...entry(node),
        ...(children === null ? {} : { children }),
      });
      left -= 1 + (children?.length ?? 0);
    }

    more ||= nodes.length < page.children.length;
    pages.push({
      id: page.id,
      name: page.name,
      current: page === figma.currentPage,
      ...(nodes.length < page.children.length ? { total: page.children.length } : {}),
      nodes,
    });
  }

  return {
    pages,
    more,
  };
}
