import { CSS_PROPERTY } from "@/core/css/css.constants.ts";

/** Every rule design_lint knows, by id, in the order it lists them (K-031). */
export const LINT_RULE = {
  contrast: "contrast",
  rawColor: "raw-color",
  textStyle: "text-style",
  detached: "detached",
  noAutoLayout: "no-auto-layout",
  overflow: "overflow",
  touchTarget: "touch-target",
  missingStates: "missing-states",
  rawNumber: "raw-number",
  offScale: "off-scale",
  effectStyle: "effect-style",
  overridden: "overridden",
  defaultName: "default-name",
  leftover: "leftover",
} as const;

/** How much a finding matters: an error breaks the build or users; a warning costs a rework; info is tidiness. */
export const LINT_SEVERITY = { error: "error", warning: "warning", info: "info" } as const;

/** How findings sort: errors first. */
export const SEVERITY_RANK = { error: 0, warning: 1, info: 2 } as const;

/**
 * The grid spacing and radii are expected on (D-30: data in code, no user setting in 0.8.0): a multiple of `step`;
 * values up to `least` px (hairlines, a nudge) are left alone.
 */
export const LINT_GRID = { step: 4, least: 2 } as const;

export const LINT_LIMITS = {
  /** How far past its room a layer may reach before it counts: Figma's sub-pixel boxes and text metrics (K-038). */
  slack: 1,
  /** Degrees from which a layer counts as turned: its box is no longer what it covers, so overflow leaves it. */
  turned: 0.5,
  /** The examples a message lists before it says how many more. */
  listed: 3,
} as const;

/**
 * The 14 rules with their severities and what each finds (K-031): the order is the contract. This build checks
 * text-style, no-auto-layout, overflow, raw-number, off-scale and effect-style; the others come with item 54.
 * `hidden`: the rule reads hidden layers too (their names and boxes only).
 */
export const LINT_RULES = [
  {
    id: LINT_RULE.contrast,
    severity: LINT_SEVERITY.error,
    about: "Texts below WCAG AA contrast with what is behind them.",
    hidden: false,
  },
  {
    id: LINT_RULE.rawColor,
    severity: LINT_SEVERITY.warning,
    about: "Colours bound to no colour variable or paint style.",
    hidden: false,
  },
  {
    id: LINT_RULE.textStyle,
    severity: LINT_SEVERITY.warning,
    about: "Texts, or runs of them, with no text style.",
    hidden: false,
  },
  {
    id: LINT_RULE.detached,
    severity: LINT_SEVERITY.warning,
    about: "Frames detached from a component.",
    hidden: false,
  },
  {
    id: LINT_RULE.noAutoLayout,
    severity: LINT_SEVERITY.warning,
    about: "Frames placing two children or more by hand that Figma reads as a row or a column.",
    hidden: false,
  },
  {
    id: LINT_RULE.overflow,
    severity: LINT_SEVERITY.warning,
    about: "Layers reaching past the room their parent's flow, grid cell or clip gives them.",
    hidden: false,
  },
  {
    id: LINT_RULE.touchTarget,
    severity: LINT_SEVERITY.warning,
    about: "Pressable layers under 24×24 px (a warning) or 44×44 px (info).",
    hidden: false,
  },
  {
    id: LINT_RULE.missingStates,
    severity: LINT_SEVERITY.info,
    about: "Interactive components used here without hover, focus, disabled or the other states their kind needs.",
    hidden: false,
  },
  {
    id: LINT_RULE.rawNumber,
    severity: LINT_SEVERITY.info,
    about: "Gaps, padding, radii, border widths and opacity a number variable holds, used raw.",
    hidden: false,
  },
  {
    id: LINT_RULE.offScale,
    severity: LINT_SEVERITY.info,
    about: `Gaps, padding and radii off the ${LINT_GRID.step} px grid, bound to no token.`,
    hidden: false,
  },
  {
    id: LINT_RULE.effectStyle,
    severity: LINT_SEVERITY.info,
    about: "Shadows and blurs held by no effect style.",
    hidden: false,
  },
  {
    id: LINT_RULE.overridden,
    severity: LINT_SEVERITY.info,
    about: "Instance layers that change their component's look (fills, radii, fonts) outside its properties.",
    hidden: false,
  },
  {
    id: LINT_RULE.defaultName,
    severity: LINT_SEVERITY.info,
    about: "Layers keeping Figma's default names (Frame 427).",
    hidden: false,
  },
  {
    id: LINT_RULE.leftover,
    severity: LINT_SEVERITY.info,
    about: "Hidden layers outside components, and empty frames or groups that draw nothing.",
    hidden: true,
  },
] as const;

/** Figma's words the rules read. */
export const LINT_FIGMA = {
  component: "COMPONENT",
  componentSet: "COMPONENT_SET",
  instance: "INSTANCE",
  slot: "SLOT",
  text: "TEXT",
  grid: "GRID",
  none: "NONE",
  horizontal: "HORIZONTAL",
  vertical: "VERTICAL",
  spaceBetween: "SPACE_BETWEEN",
  wrap: "WRAP",
  absolute: "ABSOLUTE",
  ending: "ENDING",
} as const;

/** The frames that place children: a frame or a main component (an instance's layout is its component's). */
export const LINT_CONTAINERS: Readonly<Record<string, boolean>> = { FRAME: true, COMPONENT: true };

/**
 * An instance's layer id, I<instance>;<id in the component>: a slot's default content keeps that shape, while a layer
 * put into the slot is plain or extends the slot's id (live 2026-10-20).
 */
export const LINT_ID = { instance: "I", inSlot: (slot: string) => `${slot};` } as const;

/** When a layer's layout uses a number field. */
export const LINT_NEEDS = {
  always: "always",
  layout: "layout",
  spacing: "spacing",
  wrap: "wrap",
  grid: "grid",
} as const;

/** The CSS word of a border width, as a finding names it. */
export const LINT_CSS = { borderWidth: "border-width" } as const;

/** The single number fields a variable may hold, by Figma's name: the CSS word findings name them by, and when it applies. */
export const LINT_NUMBER_FIELDS = {
  itemSpacing: { css: CSS_PROPERTY.gap, needs: LINT_NEEDS.spacing },
  counterAxisSpacing: { css: CSS_PROPERTY.rowGap, needs: LINT_NEEDS.wrap },
  gridRowGap: { css: CSS_PROPERTY.rowGap, needs: LINT_NEEDS.grid },
  gridColumnGap: { css: CSS_PROPERTY.columnGap, needs: LINT_NEEDS.grid },
  paddingTop: { css: CSS_PROPERTY.padding, needs: LINT_NEEDS.layout },
  paddingRight: { css: CSS_PROPERTY.padding, needs: LINT_NEEDS.layout },
  paddingBottom: { css: CSS_PROPERTY.padding, needs: LINT_NEEDS.layout },
  paddingLeft: { css: CSS_PROPERTY.padding, needs: LINT_NEEDS.layout },
  opacity: { css: CSS_PROPERTY.opacity, needs: LINT_NEEDS.always },
} as const;

/** A radius and a border width: one field for all four, or each corner's or side's own; a width only with a stroke shown. */
export const LINT_FOUR_FIELDS = [
  {
    single: "cornerRadius",
    parts: ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"],
    css: CSS_PROPERTY.borderRadius,
    stroked: false,
  },
  {
    single: "strokeWeight",
    parts: ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"],
    css: LINT_CSS.borderWidth,
    stroked: true,
  },
] as const;

/** The fields off-scale checks: spacing and radii; border widths and opacity have no grid. */
export const OFF_SCALE_FIELDS: Readonly<Record<string, boolean>> = {
  [CSS_PROPERTY.gap]: true,
  [CSS_PROPERTY.rowGap]: true,
  [CSS_PROPERTY.columnGap]: true,
  [CSS_PROPERTY.padding]: true,
  [CSS_PROPERTY.borderRadius]: true,
};

/** What the rules say of a layer. */
export const LINT_TEXT = {
  listed: (items: readonly string[]) =>
    `${items.slice(0, LINT_LIMITS.listed).join(", ")}${items.length > LINT_LIMITS.listed ? ` and ${items.length - LINT_LIMITS.listed} more` : ""}`,
  quoted: (value: string) => `"${value}"`,
  pair: (field: string, value: string) => `${field} ${value}`,
  px: (value: number) => `${value}px`,
  declaration: (property: string, value: string) => `${property}: ${value}`,
  parts: "; ",
  joint: ", ",
  noTextStyle: (values: string) => `No text style: ${values}.`,
  raw: (values: string) => `Raw ${values}.`,
  offScale: (values: string) => `Off the ${LINT_GRID.step}px grid: ${values}.`,
  byHand: (children: number, css: string) => `Places ${children} children by hand; Figma reads them as ${css}.`,
  cell: (id: string, name: string) => `Reaches out of its grid cell over ${id} "${name}".`,
  wider: (amount: string) => `${amount} wider`,
  taller: (amount: string) => `${amount} taller`,
  past: (
    reach: string,
    parent: { readonly id: string; readonly name: string },
    clips: boolean,
  ) =>
    `${reach} than the room ${parent.id} "${parent.name}" gives it${clips ? ", which cuts it off" : ""}.`,
} as const;

/** How a finding says to fix it, naming the tool that does. */
export const LINT_FIX = {
  /** No tokens_bind dry run tells which token holds the value: name the tool alone (0.7.0's older-plugin words). */
  unknown: (one: boolean, none: string) =>
    one
      ? `tokens_bind binds it to the token holding it, if one does; else ${none}.`
      : `tokens_bind binds them to the tokens holding them, if any do; else ${none}.`,
  bound: (pairs: string) => `tokens_bind binds ${pairs}.`,
  boundPair: (what: string, token: string) => `${what} to ${token}`,
  it: "it",
  textStyle: "give it a text style (tokens_apply makes one)",
  effectStyle: "make it an effect style with tokens_apply",
  offScale: "Round it to the scale, or snap it to a token with tokens_bind choose.",
  autoLayout: "Give it auto layout (design_apply with that display, gap and padding), so it resizes as the build will.",
  cell: "Let it wrap or shrink to its column, or span it over more cells (grid-column span).",
  text: "Let it wrap (width fill, height auto), shorten it, or give its column more room.",
  layer: "Let it fill its parent, or give the parent more room.",
} as const;

/** The lint's summary and its own notes. */
export const LINT_SUMMARY = {
  notChecked: (unread: number, total: number) =>
    `Not checked: ${unread} of ${total} layers could not be read (the notes say why). `,
  rest: "the rest",
  none: (where: string) => `No findings in ${where} for the rules checked.`,
  counts: (
    total: number,
    where: string,
    [errors, warnings, info]: readonly number[],
    listed: number | null,
  ) =>
    `${total} findings in ${where}: ${errors} errors, ${warnings} warnings, ${info} info${listed === null ? "" : `; the first ${listed} are listed`}.`,
  line: (prefix: string, body: string) => `${prefix}${body}`,
  unchecked: (rules: readonly string[]) =>
    `${rules.join(", ")} ${rules.length === 1 ? "is" : "are"} not checked in this build yet: the other rules were.`,
} as const;

/** What design_lint's answer holds, as clients read it in tools.json. */
export const LINT_FIELD = {
  id: "The layer (or component set) the finding is about.",
  fix: "How to fix it, naming the tool that does.",
  rules: "Each rule with findings, and how many: the list below may stop at the limit.",
  findings: "Errors first, then warnings, then info; in layer order within each.",
  more: "Findings past the limit were left out: raise limit, narrow within or pick rules.",
} as const;
