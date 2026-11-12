import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { InstanceProperties } from "@/plugin/adapters/figma/layer-meta/instance-properties.ts";
import type { LayerWalk } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { FIND_RUN } from "@/plugin/operations/find/find.constants.ts";
import { FIND } from "@/shared/ops/find/find.constants.ts";
import type { Ancestor, Found } from "@/shared/ops/find/find.schema.ts";

/**
 * A layer as find lists it (T-040): its box as Figma gives it, its ancestors, whether it is hidden; a text's characters
 * and font size; an instance's properties that differ from its component's defaults, and with `properties` every value.
 */
export class FoundLayer {
  readonly #properties = new InstanceProperties();
  readonly #walk;

  constructor(walk: LayerWalk) {
    this.#walk = walk;
  }

  async of(node: SceneNode, properties: boolean): Promise<Found> {
    const box = "absoluteBoundingBox" in node ? node.absoluteBoundingBox : null;

    return {
      id: node.id,
      name: node.name,
      type: node.type,
      box,
      path: this.#path(node),
      ...(this.#walk.hidden(node) ? { hidden: true as const } : {}),
      ...(node.type === FIGMA_NODE_TYPE.text ? { ...this.#characters(node), fontSize: this.fontSize(node) } : {}),
      ...(node.type === FIGMA_NODE_TYPE.instance ? await this.#instance(node, properties) : {}),
    };
  }

  /** A text's characters, its first FIND.textChars with cut when it has more. */
  #characters({ characters }: TextNode): Pick<Found, "characters" | "cut"> {
    return characters.length > FIND.textChars
      ? { characters: characters.slice(0, FIND.textChars), cut: true }
      : { characters };
  }

  /** A text's font size, or its distinct sizes in text order when it mixes them (Figma's mixed is a symbol). */
  fontSize(node: TextNode): number | number[] {
    return typeof node.fontSize === "number"
      ? node.fontSize
      : [...new Set(node.getStyledTextSegments([...FIND_RUN.fontSize]).map(({ fontSize }) => fontSize))];
  }

  /**
   * The instance's component, and its set's name for a variant; its properties that differ from the component's
   * defaults, and with `properties` every value.
   */
  async #instance(node: InstanceNode,    properties: boolean): Promise<Pick<Found, "component" | "changed" | "properties">> {
    const main = await node.getMainComponentAsync();
    const changed = main === null ? {} : this.#properties.changed(node, main);
    const set = main?.parent?.type === FIGMA_NODE_TYPE.componentSet ? main.parent : null;

    return {
      ...(main === null ? {} : { component: { name: main.name, ...(set === null ? {} : { set: set.name }) } }),
      ...(Object.keys(changed).length === 0 ? {} : { changed }),
      ...(properties ? { properties: this.#properties.values(node) } : {}),
    };
  }

  /** A layer's ancestors below its page, outermost first. */
  #path(node: SceneNode): Ancestor[] {
    const names: Ancestor[] = [];

    for (
      let current = node.parent;
      current !== null && current.type !== FIGMA_NODE_TYPE.page && current.type !== FIGMA_NODE_TYPE.document;
      current = current.parent
    ) {
      names.unshift({ id: current.id, name: current.name, type: current.type });
    }

    return names;
  }
}
