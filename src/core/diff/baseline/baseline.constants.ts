import { DESIGN_ATTRIBUTE } from "@/core/design/design.constants.ts";
import { ROOT_PLACEMENT } from "@/core/diff/diff.constants.ts";

/** A baseline diff's own attribute names, marks and bounds (T-205, K-055), as 0.7.0 wrote them. */
export const BASELINE_CHANGE = {
  /** The tag a layer has now when it had another: a detached instance is a Frame. */
  tag: "$tag",
  /** The page the root moved to. */
  page: "$page",
  /** A layer hidden on one side: added as `was: hidden`, removed as `now: hidden`. */
  hidden: "hidden",
  /** How long a label's name may be before it is cut. */
  labelChars: 40,
  /** The longest XML an added layer carries, and the most all of an answer's additions carry together. */
  inlineXml: 4_000,
  xmlBudget: 20_000,
  /** The colour profile of a read that names none. */
  legacyProfile: "LEGACY",
} as const;

/** Attributes a baseline diff never compares: the id, a planned file's path, the marks of a cut (m:ec973ea3). */
export const LEFT_OUT = [
  DESIGN_ATTRIBUTE.id,
  DESIGN_ATTRIBUTE.src,
  DESIGN_ATTRIBUTE.children,
  DESIGN_ATTRIBUTE.truncated,
] as const;

/** Where the root sits in its parent, the design around it; unlike two variants side by side, its name is compared. */
export const BASELINE_ROOT_PLACEMENT = ROOT_PLACEMENT.filter((key) => key !== DESIGN_ATTRIBUTE.name);

/** Attributes listing name=value pairs: only the pairs that differ are kept. */
export const LISTED = [DESIGN_ATTRIBUTE.props, DESIGN_ATTRIBUTE.variant] as const;

/** What a comparison left out: the children a read's budget cut, or a drawing a side did not hold whole. */
export const NOT_COMPARED = { children: "children", drawing: "drawing" } as const;

/** How a change made in a component reached its instances (K-056). */
export const COMPONENT_CHANGE = { changed: "changed", added: "added", removed: "removed" } as const;

export const BASELINE_CHANGE_TEXT = {
  profile: (was: string, now: string) =>
    `The file's colour profile changed from ${was} to ${now}: colours are compared as each read wrote them.`,
} as const;
