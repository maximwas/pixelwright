import {
  BridgeError,
  interactionSummary,
  type OperationInput,
  type OperationOutput,
  type SnapshotReaction,
} from "@pixelwright/core";
import { OP_BUDGET_MS } from "../../constants/plugin.ts";
import { requireNode } from "../../figma/nodes.ts";
import { reactionsOf } from "../../figma/reactions.ts";
import { loaded } from "../../figma/used-tokens.ts";
import { layersUntil } from "../../figma/walk.ts";
import { FLOW_MAX_LINKS } from "./constants.ts";
import { screensOf } from "./screens-of.ts";

type Link = OperationOutput<"flows">["links"][number];
type FlowAction = NonNullable<SnapshotReaction["actions"]>[number];

/** Where a link leaves from: a screen, and the layer in it whose interaction it is. */
interface LinkOrigin {
  readonly screen: SceneNode;
  readonly layer: SceneNode;
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
  const map = new FlowLinks(screens);
  const deadline = Date.now() + OP_BUDGET_MS;

  for (const screen of screens) {
    await map.addScreen(screen, deadline);
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
    links: map.links,
    more: map.more,
  };
}

/** The links a page's screens make, up to the most flows lists, and whether there were more or the time ran out. */
class FlowLinks {
  readonly links: Link[] = [];
  more = false;
  readonly #names: ReadonlyMap<string, string>;

  constructor(screens: readonly SceneNode[]) {
    this.#names = new Map(screens.map((screen) => [screen.id, screen.name]));
  }

  /** The links of every layer of a screen with interactions, walked within the deadline. */
  async addScreen(screen: SceneNode, deadline: number): Promise<void> {
    const walked = layersUntil([screen], deadline);
    const layers = walked.layers.filter((node): node is SceneNode => "reactions" in node && node.reactions.length > 0);

    this.more ||= !walked.finished;

    for (const layer of layers) {
      for (const reaction of (await reactionsOf(layer)) as SnapshotReaction[]) {
        this.#addReaction(
          {
            screen,
            layer,
          },
          reaction,
        );
      }
    }
  }

  #addReaction(origin: LinkOrigin, reaction: SnapshotReaction): void {
    for (const action of reaction.actions ?? []) {
      const kind = action.type === "NODE" ? (action.navigation ?? "NAVIGATE") : action.type;

      if (kind === "CHANGE_TO") {
        continue;
      }

      if (this.links.length >= FLOW_MAX_LINKS) {
        this.more = true;
        break;
      }

      this.links.push(this.#linkOf(origin, reaction, action, kind));
    }
  }

  #linkOf({ screen, layer }: LinkOrigin, reaction: SnapshotReaction, action: FlowAction, kind: string): Link {
    const destination = action.type === "NODE" ? action.destinationId : null;

    return {
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
              name: this.#names.get(destination) ?? action.destinationName ?? destination,
            },
      ...(action.type === "URL" && typeof action.url === "string" ? { url: action.url } : {}),
      summary: interactionSummary({
        ...reaction,
        actions: [action],
      }),
    };
  }
}
