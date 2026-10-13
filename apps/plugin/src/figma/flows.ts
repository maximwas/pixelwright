import {
  BridgeError,
  interactionSummary,
  type OperationInput,
  type OperationOutput,
  type SnapshotReaction,
} from "@pixelwright/core";
import { FLOW_MAX_LINKS } from "../constants/plugin.ts";
import { requireNode } from "./nodes.ts";
import { reactionsOf } from "./snapshot.ts";
import { loaded } from "./used-tokens.ts";

type Link = OperationOutput<"flows">["links"][number];

const SCREEN_TYPES = new Set(["FRAME", "COMPONENT", "INSTANCE"]);

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

  const screens = page.children
    .flatMap((node) =>
      node.type === "SECTION" ? node.children.filter((child) => SCREEN_TYPES.has(child.type)) : [node],
    )
    .filter((node) => SCREEN_TYPES.has(node.type));
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
