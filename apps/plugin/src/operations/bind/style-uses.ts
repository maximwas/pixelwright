import { effectsValue, type SnapshotEffect, type TextParts, textValue } from "@pixelwright/core";
import { loadTextFonts, styleFonts } from "../../figma/fonts.ts";
import { plain } from "../../utils/plain.ts";
import type { BindContext } from "./bind-context.ts";
import type { RawUse } from "./raw-use.ts";

/** The text parts a text style sets, as getStyledTextSegments reads them. */
const TEXT_FIELDS = [
  "textStyleId",
  "fontName",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "textCase",
  "textDecoration",
] as const;

/** A text's runs that no text style sets, each with the text styles setting the same parts. */
export function textUses(layer: SceneNode, context: BindContext): RawUse[] {
  if (layer.type !== "TEXT") {
    return [];
  }

  return layer
    .getStyledTextSegments([...TEXT_FIELDS])
    .filter((segment) => segment.textStyleId === "")
    .map((segment) => {
      const value = textValue(plain<TextParts>(segment));

      return {
        layer,
        kind: "text" as const,
        field: "font",
        value,
        candidates: context.index.texts(value),
        bind: async (candidate) => {
          await loadTextFonts([layer], styleFonts(await context.style(candidate.id)));
          await layer.setRangeTextStyleIdAsync(segment.start, segment.end, candidate.id);
        },
      };
    });
}

/** A layer's shadows and blurs when no effect style holds them, with the effect styles holding the same. */
export function effectUses(layer: SceneNode, context: BindContext): RawUse[] {
  if (!("effects" in layer) || layer.effectStyleId !== "" || layer.effects.length === 0) {
    return [];
  }

  if (
    layer.effects.some((effect) => "boundVariables" in effect && Object.keys(effect.boundVariables ?? {}).length > 0)
  ) {
    return [];
  }

  const value = effectsValue(plain<SnapshotEffect[]>(layer.effects), context.space);

  return value === null
    ? []
    : [
        {
          layer,
          kind: "effect",
          field: "effects",
          value,
          candidates: context.index.effects(value),
          bind: (candidate) => layer.setEffectStyleIdAsync(candidate.id),
        },
      ];
}
