import type { ApplyChange, FigmaProps } from "@pixelwright/core";
import { hasFills, isTextLayer, refusal, type TypedLayer } from "../../figma/capabilities.ts";
import { componentRefusals } from "./writers/component-steps.ts";
import { attributeOf } from "./writers/layer-writer.ts";
import { stepsFor } from "./writers/steps.ts";
import { checkDecoration } from "./writers/text-decoration.ts";
import { lacksTextKey, textKeyRefusal } from "./writers/text-range.ts";
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

/**
 * A text given to a layer that is no text; what only the other kind of text layer has; a decoration Figma cannot
 * draw, on the text or a run of it.
 */
function textRefusals(layer: TypedLayer, change: ApplyChange): TypeRefusal[] {
  if (!isTextLayer(layer)) {
    return change.text !== undefined || hasTextProps(change.props)
      ? [
          {
            error: holdsNoText(layer),
            keys: [],
          },
        ]
      : [];
  }

  const runs = [change.props, ...(change.text?.runs ?? []).map((run) => run.props)];
  const lacked = (Object.keys(change.props) as (keyof FigmaProps)[]).find((key) => lacksTextKey(layer, key));
  const spanLacked = runs.some((props) => props.textDecoration !== undefined) && lacksTextKey(layer, "textDecoration");
  const key = lacked ?? (spanLacked ? "textDecoration" : undefined);

  if (key !== undefined) {
    return [
      {
        error: textKeyRefusal(layer, key),
        keys: [key],
        attribute: attributeOf(change, [key]),
      },
    ];
  }

  return decorationRefusals(change, runs);
}

/** A decoration Figma cannot draw, on the text or a run of it. */
function decorationRefusals(change: ApplyChange, runs: readonly FigmaProps[]): TypeRefusal[] {
  for (const props of runs) {
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
