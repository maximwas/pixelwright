import { effectsValue, textValue } from "../../tokens/bind/values.ts";
import { findingOf, type LintRule } from "./lint-rule.ts";
import { rawColors, rawNumbers } from "./raw-values.ts";

/** The examples a message lists before it says how many more. */
const LISTED = 3;

const listed = (items: readonly string[]) =>
  `${items.slice(0, LISTED).join(", ")}${items.length > LISTED ? ` and ${items.length - LISTED} more` : ""}`;

const unique = (items: readonly string[]) => [...new Set(items)];

/** Colours no style or variable gives a layer: what the build hard-codes, and what dark mode misses. */
export const RAW_COLOR: LintRule = {
  id: "raw-color",
  severity: "warning",
  about: "Colours bound to no colour variable or paint style.",
  check: ({ node, inInstance }, { hints, space }) => {
    // A mask shows its shape and alpha only: its colour is no colour the build draws.
    const raws = inInstance || node.isMask ? [] : rawColors(node, space);

    if (raws.length === 0) {
      return [];
    }

    const none = "make it a token with tokens_apply, or snap it to a near one with tokens_bind choose";

    return [
      findingOf(RAW_COLOR, node, {
        message: `Raw ${listed(raws.map(({ field, value }) => `${field} ${value}`))}.`,
        fix: hints.fixOf("color", raws, none),
      }),
    ];
  },
};

/** Texts no text style sets: the build repeats their font where a class should be. */
export const TEXT_STYLE: LintRule = {
  id: "text-style",
  severity: "warning",
  about: "Texts, or runs of them, with no text style.",
  check: ({ node, inInstance }, { hints }) => {
    const runs = inInstance ? [] : (node.text?.segments ?? []).filter((segment) => segment.textStyleId === "");
    const values = unique(runs.map((segment) => textValue(segment)));
    const [first] = values;

    if (first === undefined) {
      return [];
    }

    return [
      findingOf(TEXT_STYLE, node, {
        message: `No text style: ${listed(values.map((value) => `"${value}"`))}.`,
        fix: hints.fixOf(
          "text",
          values.map((value) => ({
            field: "font",
            value,
          })),
          "give it a text style (tokens_apply makes one)",
        ),
      }),
    ];
  },
};

/** Shadows and blurs no effect style holds. */
export const EFFECT_STYLE: LintRule = {
  id: "effect-style",
  severity: "info",
  about: "Shadows and blurs held by no effect style.",
  check: ({ node, inInstance }, { hints, space }) => {
    const bound = (node.effects ?? []).some((effect) => Object.keys(effect.boundVariables ?? {}).length > 0);
    const styled = node.effectStyleId !== undefined && node.effectStyleId !== "";
    const value = inInstance || bound || styled ? null : effectsValue(node.effects ?? [], space);

    return value === null
      ? []
      : [
          findingOf(EFFECT_STYLE, node, {
            message: `Raw ${value}.`,
            fix: hints.fixOf(
              "effect",
              [
                {
                  field: "effects",
                  value,
                },
              ],
              "make it an effect style with tokens_apply",
            ),
          }),
        ];
  },
};

/** Spacing, radii, border widths and opacity a token holds but the layer does not use. */
export const RAW_NUMBER: LintRule = {
  id: "raw-number",
  severity: "info",
  about: "Gaps, padding, radii, border widths and opacity a number variable holds, used raw.",
  check: ({ node, inInstance }, { hints }) => {
    const held =
      inInstance || !hints.known
        ? []
        : rawNumbers(node).filter(({ field, value }) => hints.of("number", field, value) !== null);

    if (held.length === 0) {
      return [];
    }

    return [
      findingOf(RAW_NUMBER, node, {
        message: `Raw ${listed(held.map(({ field, value }) => `${field} ${value}`))}.`,
        fix: hints.fixOf("number", held, "bind it"),
      }),
    ];
  },
};
