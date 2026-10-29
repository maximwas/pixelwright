import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { NoteCandidate } from "@/core/inspect/nearby.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { LAYER_REFS } from "@/plugin/adapters/figma/layer-refs.ts";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { NOTE } from "@/plugin/operations/nearby/nearby.constants.ts";

/**
 * The layers around a screen that may be the designer's notes (T-058): in the sections and on the page the screen sits
 * on. A note is a text, a small frame or group of nothing but texts and plain shapes, or a layer named like a note (a
 * sticky, a comment); another screen, a stray button, a part handed over for development and hidden layers are none.
 */
@injectable()
export class NoteCandidates {
  readonly #walk;
  readonly #refs;

  constructor(walk = inject(LAYER_WALK), refs = inject(LAYER_REFS)) {
    this.#walk = walk;
    this.#refs = refs;
  }

  around(screen: SceneNode): NoteCandidate[] {
    const deadline = this.#walk.deadline(NOTE.timeMs);

    return this.#beside(screen).flatMap((layer) => {
      const candidate = this.#candidate(layer, deadline);

      return candidate === null ? [] : [candidate];
    });
  }

  /** What lies beside the screen on the canvas: the other layers of each section it sits in, and of its page. */
  #beside(screen: SceneNode): SceneNode[] {
    const beside: SceneNode[] = [];

    for (let level: BaseNode = screen; level.parent !== null && "children" in level.parent; level = level.parent) {
      const within = level;

      beside.push(...level.parent.children.filter((child) => child !== within));

      if (level.parent.type === FIGMA_NODE_TYPE.page) {
        break;
      }
    }

    return beside;
  }

  /** A layer as a note: a text, or a holder of texts small enough to be one; null for anything else. */
  #candidate(layer: SceneNode, deadline: number): NoteCandidate | null {
    const box = layer.visible ? layer.absoluteBoundingBox : null;
    const texts = layer.type === NOTE.text ? [layer] : this.#holder(layer) ? this.#texts(layer, deadline) : null;

    if (box === null || texts === null || texts.length === 0) {
      return null;
    }

    const text = texts.map(({ characters }) => characters).join(NOTE.lines);

    return {
      id: layer.id,
      name: layer.name,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      text: text.length > NOTE.textMax ? text.slice(0, NOTE.textMax) + NOTE.ellipsis : text,
    };
  }

  #holder(layer: SceneNode): boolean {
    return NOTE.holders.includes(layer.type) || (NOTE.namedHolders.includes(layer.type) && NOTE.names.test(layer.name));
  }

  /** A holder's shown texts, top to bottom and then left to right; null when it holds too many layers or a design. */
  #texts(holder: SceneNode, deadline: number): TextNode[] | null {
    const layers: SceneNode[] = [];
    const stack: SceneNode[] = [holder];
    let room: number = NOTE.layersMax;

    for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
      room -= "children" in node ? node.children.length : 0;

      if (room < 0 || this.#walk.passed(deadline)) {
        return null;
      }

      if (node.visible) {
        layers.push(node);
        stack.push(...("children" in node ? node.children : []));
      }
    }

    if (!NOTE.names.test(holder.name) && this.#isDesign(holder, layers)) {
      return null;
    }

    const top = (node: SceneNode) => node.absoluteBoundingBox?.y ?? 0;
    const left = (node: SceneNode) => node.absoluteBoundingBox?.x ?? 0;

    return layers
      .filter((node): node is TextNode => node.type === NOTE.text)
      .sort((first, second) => top(first) - top(second) || left(first) - left(second));
  }

  /** Handed over for development, or holding more than texts and plain shapes (an icon, an instance, a picture). */
  #isDesign(holder: SceneNode, layers: readonly SceneNode[]): boolean {
    return (
      this.#refs.devStatus(holder) !== undefined ||
      layers.some(
        (node) =>
          !NOTE.parts.includes(node.type) ||
          ("fills" in node &&
            Array.isArray(node.fills) &&
            node.fills.some(({ type }: Paint) => NOTE.pictures.includes(type))),
      )
    );
  }
}

export const NOTE_CANDIDATES = new InjectionToken<NoteCandidates>("NoteCandidates");
