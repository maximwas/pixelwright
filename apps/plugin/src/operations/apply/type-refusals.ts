import type { ApplyChange, FigmaProps } from "@pixelwright/core";
import { hasFills, refusal, type TypedLayer } from "../../figma/capabilities.ts";
import { componentRefusals } from "./writers/component-steps.ts";
import { attributeOf } from "./writers/layer-writer.ts";
import { stepsFor } from "./writers/steps.ts";
import { checkDecoration } from "./writers/text-decoration.ts";
import { hasTextProps, holdsNoText } from "./writers/text-writer.ts";

/** What a dry run finds refused: the error, the properties it is about, the XML attribute it names. */
export interface TypeRefusal {
  readonly error: unknown;
  readonly keys: readonly (keyof FigmaProps)[];
  readonly attribute?: string | undefined;
}

/**
 * What the real write refuses a change for its layer's type alone, in the order it meets them: the image, the
 * component, each property's step, the text. Nothing is written; the same checks the write runs.
 */
export function typeRefusals(layer: TypedLayer, change: ApplyChange): TypeRefusal[] {
  const found: TypeRefusal[] = [];
  const attempt = (keys: readonly (keyof FigmaProps)[], check: () => void) => {
    try {
      check();
    } catch (error) {
      found.push({
        error,
        keys,
        attribute: attributeOf(change, keys),
      });
    }
  };

  if (change.props.asset !== undefined && change.tag !== "Icon") {
    attempt(["asset"], () => {
      if (!hasFills(layer)) {
        throw refusal(layer, "fills to hold an image");
      }
    });
  }

  for (const { key, error } of componentRefusals(layer, change)) {
    attempt([key], () => {
      throw error;
    });
  }

  for (const step of stepsFor(change.props, layer)) {
    attempt(step.keys, () => step.check?.(layer, change.props));
  }

  return [...found, ...textRefusals(layer, change)];
}

/** A text given to a layer that is no text; a decoration Figma cannot draw, on the text or a run of it. */
function textRefusals(layer: TypedLayer, change: ApplyChange): TypeRefusal[] {
  if (layer.type !== "TEXT") {
    return change.text !== undefined || hasTextProps(change.props)
      ? [
          {
            error: holdsNoText(layer),
            keys: [],
          },
        ]
      : [];
  }

  for (const props of [change.props, ...(change.text?.runs ?? []).map((run) => run.props)]) {
    try {
      if (props.textDecoration !== undefined) {
        checkDecoration(props.textDecoration);
      }
    } catch (error) {
      return [
        {
          error,
          keys: ["textDecoration"],
          attribute: attributeOf(change, ["textDecoration"]),
        },
      ];
    }
  }

  return [];
}
