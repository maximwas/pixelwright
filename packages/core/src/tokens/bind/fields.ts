/** The kinds of value tokens_bind binds: colours, numbers (spacing, radii, borders, opacity), text styles, effects. */
export const BIND_KINDS = ["color", "number", "text", "effect"] as const;

export type BindKind = (typeof BIND_KINDS)[number];

/** A Figma variable scope a field takes variables of (Figma's VariableScope names). */
export type BindScope =
  | "FRAME_FILL"
  | "SHAPE_FILL"
  | "TEXT_FILL"
  | "STROKE_COLOR"
  | "GAP"
  | "CORNER_RADIUS"
  | "STROKE_FLOAT"
  | "OPACITY";

/** A layer's number field tokens_bind binds: the CSS word results name it by, and the scope its variables need. */
export interface NumberField {
  readonly css: string;
  readonly scope: BindScope;
}

/** The single number fields bound to variables, in the order a layer is read: Figma's names, as setBoundVariable takes them. */
export const NUMBER_FIELDS: Readonly<Record<string, NumberField>> = {
  itemSpacing: {
    css: "gap",
    scope: "GAP",
  },
  counterAxisSpacing: {
    css: "row-gap",
    scope: "GAP",
  },
  gridRowGap: {
    css: "row-gap",
    scope: "GAP",
  },
  gridColumnGap: {
    css: "column-gap",
    scope: "GAP",
  },
  paddingTop: {
    css: "padding",
    scope: "GAP",
  },
  paddingRight: {
    css: "padding",
    scope: "GAP",
  },
  paddingBottom: {
    css: "padding",
    scope: "GAP",
  },
  paddingLeft: {
    css: "padding",
    scope: "GAP",
  },
  opacity: {
    css: "opacity",
    scope: "OPACITY",
  },
};

/** The corners a radius is bound on: all four for one radius, as Figma's own picker binds it. */
export const RADIUS_FIELDS = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;

/** The sides a border width is bound on: all four for one width. */
export const STROKE_FIELDS = [
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
] as const;

/** A layer's fields as a check reads them: Figma's names (a snapshot's, or a live layer's). */
type LayerFields = Readonly<Record<string, unknown>>;

const hasLayout = (layer: LayerFields) => typeof layer.layoutMode === "string" && layer.layoutMode !== "NONE";

/** Whether a number field is one the layer's layout uses: a gap only in a flow that spaces, padding around one. */
const APPLIES: Readonly<Record<string, (layer: LayerFields) => boolean>> = {
  itemSpacing: (layer) =>
    (layer.layoutMode === "HORIZONTAL" || layer.layoutMode === "VERTICAL") &&
    layer.primaryAxisAlignItems !== "SPACE_BETWEEN",
  counterAxisSpacing: (layer) => layer.layoutWrap === "WRAP",
  gridRowGap: (layer) => layer.layoutMode === "GRID",
  gridColumnGap: (layer) => layer.layoutMode === "GRID",
  paddingTop: hasLayout,
  paddingRight: hasLayout,
  paddingBottom: hasLayout,
  paddingLeft: hasLayout,
  opacity: () => true,
};

/** Whether a layer uses one of NUMBER_FIELDS: tokens_bind and design_lint read the same fields. */
export function numberFieldApplies(field: string, layer: LayerFields): boolean {
  return APPLIES[field]?.(layer) ?? false;
}

/** The layer types whose fills Figma scopes as a frame's; text fills are TEXT_FILL, the rest a shape's. */
const FRAME_TYPES: ReadonlySet<string> = new Set(["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SECTION"]);

/** The scope a layer's fill takes colour variables of. */
export function fillScope(type: string): BindScope {
  if (type === "TEXT") {
    return "TEXT_FILL";
  }

  return FRAME_TYPES.has(type) ? "FRAME_FILL" : "SHAPE_FILL";
}

/**
 * Whether a variable with these scopes may be bound to a field of this scope (ALL_FILLS covers every fill); one with no
 * scopes is hidden from every picker in Figma, so it is never offered.
 */
export function scopeAllows(scopes: readonly string[], scope: BindScope): boolean {
  return (
    scopes.includes("ALL_SCOPES") || scopes.includes(scope) || (scope.endsWith("_FILL") && scopes.includes("ALL_FILLS"))
  );
}
