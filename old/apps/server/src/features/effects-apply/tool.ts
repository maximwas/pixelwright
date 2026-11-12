import { WRITE_ANNOTATIONS } from "../../constants/mcp.ts";
import type { ToolContext, ToolDefinition } from "../../types/mcp.ts";
import { applyEffects } from "./apply-effects.ts";
import { EffectsApplyInputSchema, EffectsApplyOutputSchema } from "./schemas.ts";

export function effectsApplyTool({
  plugin,
}: ToolContext): ToolDefinition<typeof EffectsApplyInputSchema, typeof EffectsApplyOutputSchema> {
  return {
    name: "effects_apply",
    title: "Put noise, texture or glass on layers",
    description:
      "Puts Figma's own effects on layers: noise (grain of one, two or many colours), texture (a faint printed, cracked look) and glass (frosted or clear, on frames only). Give a preset (grain, film, risograph, frosted-glass, clear-glass), the effect's own values, or both: the values change the preset's; grain is dark, so on a dark layer give noise.color a light colour. A new effect replaces the layer's one of its type; shadows and blurs stay; remove takes types off. Each layer is written on its own, its errors named while the rest goes in; design_read shows a layer with such an effect as an Image. One undo step in Figma; refused while the plugin's Allow edits switch is off (dryRun checks without writing).",
    input: EffectsApplyInputSchema,
    output: EffectsApplyOutputSchema,
    annotations: WRITE_ANNOTATIONS,
    run: (args) => applyEffects(plugin, args),
    changed: ({ dryRun, changed }) => !dryRun && changed.length > 0,
  };
}
