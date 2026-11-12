import { DESIGN_ATTRIBUTE } from "@/core/design/design.constants.ts";

export const REPEATS = {
  /** Runs shorter than this stay as they are: two alike layers read as well side by side (T-059). */
  min: 3,
  /** The field of a text's characters. */
  text: "$text",
  /** A path's step label and the separator between steps, as 0.7.0 wrote them. */
  label: (
    tag: string,
    name: string,
    index: number,
  ) => `${tag} "${name}"${index > 0 ? `[${index + 1}]` : ""}`,
  separator: " / ",
} as const;

/**
 * What alike layers may hold apart, each one having it or not: what they show (texts, files, variants, component
 * properties and which of them an instance overrides, links, notes and names) and where they sit. Every other
 * attribute, and the shape of their children, is the same in each.
 */
export const ROW_ATTRIBUTES: ReadonlySet<string> = new Set([
  DESIGN_ATTRIBUTE.name,
  DESIGN_ATTRIBUTE.override,
  DESIGN_ATTRIBUTE.src,
  DESIGN_ATTRIBUTE.href,
  DESIGN_ATTRIBUTE.variant,
  DESIGN_ATTRIBUTE.props,
  DESIGN_ATTRIBUTE.note,
  DESIGN_ATTRIBUTE.description,
  "left",
  "top",
  "right",
  "bottom",
]);
