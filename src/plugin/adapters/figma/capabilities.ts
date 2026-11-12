import { InjectionToken, injectable } from "@needle-di/core";
import { CAPABILITY_TEXT, CAPABILITY_TYPES } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";

/** A layer as a capability reads it: its type alone, so a dry run asks it of a layer it has not made. */
export type TypedLayer = Pick<BaseNode, "type">;

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

  /** "A line has no fills." for a layer whose type lacks the capability. */
  require(layer: TypedLayer, capability: Capability): void {
    if (!this.has(layer, capability)) {
      throw new WriteError(CAPABILITY_TEXT.refusal(CAPABILITY_TEXT.type(layer.type), CAPABILITY_TEXT.what[capability]));
    }
  }
}

export const CAPABILITIES = new InjectionToken<Capabilities>("Capabilities");
