import { InjectionToken, injectable } from "@needle-di/core";
import { CAPABILITY_TEXT, CAPABILITY_TYPES, FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";

/**
 * A layer as a capability reads it: its type, so a dry run asks it of a layer it has not made, and the layer it sits in
 * (a stand-in's `parent`, as a real layer's), so what holds it can be walked up to on either.
 */
export type TypedLayer = Pick<BaseNode, "type"> & { readonly parent?: TypedLayer | null };

export type Capability = keyof typeof CAPABILITY_TYPES;

/** What a node type can take (P-079), read from the table in figma.constants.ts. */
@injectable()
export class Capabilities {
  readonly #types: ReadonlyMap<string, ReadonlySet<string>> = new Map(
    Object.entries(CAPABILITY_TYPES).map(([capability, types]) => [capability, new Set<string>(types)]),
  );

  has(layer: TypedLayer, capability: Capability): boolean {
    return this.#types.get(capability)?.has(layer.type) ?? false;
  }

  /** Whether a layer sits in an instance and not in a slot of it: there its children come from the component. */
  inInstance(layer: TypedLayer | null | undefined): boolean {
    for (let up = layer; up !== undefined && up !== null; up = up.parent) {
      if (up.type === FIGMA_NODE_TYPE.slot) {
        return false;
      }

      if (up.type === FIGMA_NODE_TYPE.instance) {
        return true;
      }
    }

    return false;
  }

  /** "A line has no fills." for a layer whose type lacks the capability. */
  require(layer: TypedLayer, capability: Capability): void {
    if (!this.has(layer, capability)) {
      throw new WriteError(CAPABILITY_TEXT.refusal(CAPABILITY_TEXT.type(layer.type), CAPABILITY_TEXT.what[capability]));
    }
  }
}

export const CAPABILITIES = new InjectionToken<Capabilities>("Capabilities");
