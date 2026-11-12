import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { hasEffects } from "../../figma/capabilities.ts";
import { pageOf } from "../../figma/nodes.ts";
import type { EditsGuard } from "../../services/edits-guard.ts";
import { errorMessage } from "../../utils/error-message.ts";

type Input = OperationInput<"effects">;
type EffectsNode = SceneNode & { effects: readonly Effect[] };

/**
 * Figma's own noise, texture and glass on layers, each layer on its own: a new effect replaces the layer's one of its
 * type and the rest (shadows, blurs) stays; remove takes types off. A dry run checks without writing and works with
 * Allow edits off; a real run is one undo step.
 */
export async function applyEffects(input: Input, edits: EditsGuard): Promise<OperationOutput<"effects">> {
  if (!input.dryRun) {
    edits.require();
  }

  const changed: string[] = [];
  const errors: OperationOutput<"effects">["errors"] = [];

  for (const id of input.nodes) {
    try {
      const node = await layerOf(id);
      const next = effectsFor(node, input);

      if (!input.dryRun) {
        node.effects = next;
      }

      changed.push(id);
    } catch (error) {
      errors.push({
        id,
        message: errorMessage(error),
      });
    }
  }

  if (!input.dryRun && changed.length > 0) {
    figma.commitUndo();
  }

  return {
    changed,
    errors,
  };
}

/** A layer that takes effects, its page loaded. */
async function layerOf(id: string): Promise<EffectsNode> {
  const node = await figma.getNodeByIdAsync(id);

  if (node === null || node.type === "PAGE" || node.type === "DOCUMENT") {
    throw new Error(`No layer ${id} in this file.`);
  }

  if (!hasEffects(node)) {
    throw new Error(`A ${typeName(node)} takes no effects.`);
  }

  const page = pageOf(node);

  if (page !== null && page !== figma.currentPage) {
    await page.loadAsync();
  }

  return node as EffectsNode;
}

/** The layer's effects with the new ones after those kept: its own of each new or removed type left out. */
function effectsFor(node: EffectsNode, { noise, texture, glass, remove }: Input): Effect[] {
  if (glass !== undefined && node.type !== "FRAME") {
    throw new Error(
      `Figma puts glass on a frame only, and ${node.id} is a ${typeName(node)}: wrap it in a frame, or use noise or texture.`,
    );
  }

  const added: Effect[] = [
    ...(noise === undefined
      ? []
      : [
          {
            type: "NOISE",
            visible: true,
            ...noise,
          } as NoiseEffect,
        ]),
    ...(texture === undefined
      ? []
      : [
          {
            type: "TEXTURE",
            visible: true,
            ...texture,
          } as TextureEffect,
        ]),
    ...(glass === undefined
      ? []
      : [
          {
            type: "GLASS",
            visible: true,
            ...glass,
          } as GlassEffect,
        ]),
  ];
  const replaced = new Set<string>([...remove, ...added.map(({ type }) => type)]);

  return [...node.effects.filter(({ type }) => !replaced.has(type)), ...added];
}

/** A layer's type in words: "rectangle", "boolean operation". */
function typeName(node: BaseNode): string {
  return node.type.toLowerCase().replaceAll("_", " ");
}
