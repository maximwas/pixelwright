import {
  BridgeError,
  NEARBY_MAX_NOTES,
  type NoteCandidate,
  nearbyNotes,
  type OperationInput,
  type OperationOutput,
} from "@pixelwright/core";
import { devStatusOf } from "../../figma/dev-status.ts";
import { boxOf, isLayer, requireNode } from "../../figma/nodes.ts";
import { layersUntil } from "../../figma/walk.ts";
import { NEARBY_TIME_MS, NOTE_LAYERS_MAX, NOTE_NAMES, NOTE_TEXT_MAX } from "./constants.ts";

/** Layers that hold a note's texts: frames and groups, and components and instances named like a note. */
const HOLDERS: ReadonlySet<string> = new Set(["FRAME", "GROUP"]);
const NAMED_HOLDERS: ReadonlySet<string> = new Set(["INSTANCE", "COMPONENT", "COMPONENT_SET"]);
/** What a frame or group not named like a note may hold and still be one: texts and the plain shapes around them. */
const NOTE_PARTS: ReadonlySet<string> = new Set(["TEXT", "FRAME", "GROUP", "RECTANGLE", "ELLIPSE", "LINE"]);

/**
 * The designer's notes around the screen that holds a layer: in the section and on the page the screen sits on,
 * outside it or over it, within `distance` px. A note is a text, a small frame or group of nothing but texts and plain
 * shapes, or a layer named like a note (a sticky, a comment); another screen, a stray button or toast, a part handed
 * over for development and hidden layers are none. Reads only.
 */
export async function nearby({ node, distance }: OperationInput<"nearby">): Promise<OperationOutput<"nearby">> {
  const layer = await requireNode(node);

  if (!isLayer(layer)) {
    throw new BridgeError("NODE_NOT_FOUND", `${node} is a page: read the notes around a layer on it.`);
  }

  const screen = screenOf(layer);
  const box = boxOf(screen);

  if (box === null) {
    throw new BridgeError("OP_FAILED", `${screen.name} has no box on the canvas.`);
  }

  const deadline = Date.now() + NEARBY_TIME_MS;
  const candidates = around(screen).flatMap((beside) => {
    const candidate = candidateOf(beside, deadline);

    return candidate === null ? [] : [candidate];
  });

  return {
    screen: {
      id: screen.id,
      name: screen.name,
    },
    ...nearbyNotes(box, candidates, {
      distance,
      max: NEARBY_MAX_NOTES,
    }),
  };
}

/**
 * The screen a layer is on, as flows reads a page's screens (the page's frames and those of its sections): its topmost
 * layer under the page or a section, the layer itself when it is one.
 */
function screenOf(layer: SceneNode): SceneNode {
  const { parent } = layer;

  return parent === null || parent.type === "PAGE" || parent.type === "SECTION" || !isLayer(parent)
    ? layer
    : screenOf(parent);
}

/** What lies beside the screen on the canvas: the other layers of each section it sits in, and of its page. */
function around(screen: SceneNode): SceneNode[] {
  const beside: SceneNode[] = [];

  for (let level: BaseNode = screen; level.parent !== null && "children" in level.parent; level = level.parent) {
    const within = level;

    beside.push(...level.parent.children.filter((child) => child !== within));

    if (level.parent.type === "PAGE") {
      break;
    }
  }

  return beside;
}

/** A layer as a note: a text, or a holder of texts small enough to be one; null for anything else. */
function candidateOf(layer: SceneNode, deadline: number): NoteCandidate | null {
  const box = layer.visible ? boxOf(layer) : null;
  const texts = layer.type === "TEXT" ? [layer] : isHolder(layer) ? textsIn(layer, deadline) : null;

  return box === null || texts === null || texts.length === 0
    ? null
    : {
        id: layer.id,
        name: layer.name,
        box,
        text: clipped(texts.map(({ characters }) => characters).join("\n")),
      };
}

function isHolder(layer: SceneNode): boolean {
  return HOLDERS.has(layer.type) || (NAMED_HOLDERS.has(layer.type) && NOTE_NAMES.test(layer.name));
}

/** A holder's shown texts, top to bottom and then left to right; null when it holds too many layers or a design. */
function textsIn(holder: SceneNode, deadline: number): TextNode[] | null {
  let room = NOTE_LAYERS_MAX;
  const { layers, finished } = layersUntil([holder], deadline, (node) => {
    room -= "children" in node ? node.children.length : 0;

    return room >= 0 && (!("visible" in node) || node.visible);
  });

  if (!finished || room < 0 || (!NOTE_NAMES.test(holder.name) && isDesign(holder, layers))) {
    return null;
  }

  return layers
    .filter((node): node is TextNode => node.type === "TEXT" && node.visible)
    .sort((a, b) => topOf(a) - topOf(b) || leftOf(a) - leftOf(b));
}

/**
 * Whether a holder not named like a note is a design: handed over for development, or holding more than texts and the
 * plain shapes around them (an icon, an instance, a picture).
 */
function isDesign(holder: SceneNode, layers: readonly BaseNode[]): boolean {
  return (
    devStatusOf(holder) !== undefined ||
    layers.some(
      (node) =>
        !NOTE_PARTS.has(node.type) ||
        ("fills" in node &&
          Array.isArray(node.fills) &&
          node.fills.some(({ type }: Paint) => type === "IMAGE" || type === "VIDEO")),
    )
  );
}

const topOf = (node: SceneNode) => node.absoluteBoundingBox?.y ?? 0;
const leftOf = (node: SceneNode) => node.absoluteBoundingBox?.x ?? 0;

function clipped(text: string): string {
  return text.length > NOTE_TEXT_MAX ? `${text.slice(0, NOTE_TEXT_MAX)}…` : text;
}
