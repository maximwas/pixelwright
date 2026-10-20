import { VARIABLE_SCOPES } from "@pixelwright/core";

/**
 * A small Figma document for the plugin's operations: nodes with parents, boxes, text and main components, and the
 * writing calls design_apply makes (creating, inserting, resizing, binding, styling text ranges), recorded.
 */
export interface FakeNode {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  parent: FakeNode | null;
  children?: FakeNode[];
  characters?: string;
  absoluteBoundingBox: { x: number; y: number; width: number; height: number };
  absoluteTransform?: number[][];
  width?: number;
  height?: number;
  mainComponent?: {
    id?: string;
    key?: string;
    name: string;
    remote?: boolean;
    parent: { type: string; id?: string; name: string } | null;
  };
  getMainComponentAsync?: () => Promise<FakeNode["mainComponent"] | null>;
  findAll?: (predicate: (node: FakeNode) => boolean) => FakeNode[];
  /** Whatever else a test gives a node: fills, layout, segments for getStyledTextSegments, css for getCSSAsync. */
  [property: string]: unknown;
}

/** Figma's figma.mixed: a symbol, which the plugin must turn into "mixed" before it goes on the wire. */
export const FAKE_MIXED = Symbol("figma.mixed");

type Spec = Partial<Omit<FakeNode, "children" | "parent">> & { id: string; children?: Spec[] };

function walk(node: FakeNode, out: FakeNode[]): void {
  for (const child of node.children ?? []) {
    out.push(child);
    walk(child, out);
  }
}

/** Builds a node tree from a spec, wiring parents, findAll and getMainComponentAsync like Figma's. */
export function tree(spec: Spec, parent: FakeNode | null = null): FakeNode {
  const { children, ...rest } = spec;
  const node: FakeNode = {
    name: spec.id,
    type: "FRAME",
    visible: true,
    absoluteBoundingBox: {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    },
    ...rest,
    parent,
  };

  const box = node.absoluteBoundingBox;

  node.absoluteTransform ??= [
    [1, 0, box.x],
    [0, 1, box.y],
  ];
  node.relativeTransform ??= [
    [1, 0, box.x],
    [0, 1, box.y],
  ];
  node.width ??= box.width;
  node.height ??= box.height;

  if (children !== undefined) {
    node.children = children.map((child) => tree(child, node));
  }

  if (node.segments !== undefined) {
    node.getStyledTextSegments = () => node.segments;
  }

  if (node.css !== undefined) {
    node.getCSSAsync = async () => node.css;
  }

  node.findAllWithCriteria = ({ types }: { types: string[] }) =>
    node.findAll?.((child) => types.includes(child.type)) ?? [];
  node.findAll = (predicate) => {
    const all: FakeNode[] = [];

    walk(node, all);

    return all.filter(predicate);
  };

  if (node.type === "INSTANCE") {
    node.getMainComponentAsync = async () => node.mainComponent ?? null;
  }

  return node;
}

export interface FakeLibrary {
  readonly styles?: Record<string, object>;
  readonly variables?: Record<string, Record<string, unknown> & { name: string; variableCollectionId: string }>;
  readonly collections?: Record<string, Record<string, unknown> & { name: string }>;
  /** The file's own collections and variables (getLocal…Async), and its own styles by kind. */
  readonly localCollections?: object[];
  readonly localVariables?: object[];
  readonly localStyles?: { paint?: object[]; text?: object[]; effect?: object[] };
  /** figma.teamLibrary: the enabled libraries' collections and their variables by collection key, or a failure. */
  readonly teamLibrary?: { collections: object[]; variables: Record<string, object[]> } | Error;
  /** listAvailableFontsAsync: the fonts this Figma has. */
  readonly fonts?: { family: string; style: string }[];
  /** Components and sets that live off the page (a team library's), by key for importComponent…ByKeyAsync. */
  readonly components?: FakeNode[];
  /** The file's annotation categories. */
  readonly categories?: { id: string; label: string; color: string }[];
  /** The file's other pages. */
  readonly pages?: FakeNode[];
  /** How many modes a collection may have (Figma's plan limit): addMode refuses past it. Default 4. */
  readonly modeLimit?: number;
  /** Fonts listed but that loadFontAsync cannot load (a missing file, a broken font). */
  readonly unloadable?: readonly { family: string; style: string }[];
  /** An enabled library's variables as importVariableByKeyAsync brings them in, by key. */
  readonly importable?: Record<string, Record<string, unknown> & { id: string }>;
}

/** A local variable collection as the fake keeps it, writable as Figma's. */
type FakeCollection = Record<string, unknown> & {
  id: string;
  name: string;
  modes: { modeId: string; name: string }[];
};

/** A local variable as the fake keeps it, writable as Figma's. */
type FakeVariable = Record<string, unknown> & {
  id: string;
  name: string;
  variableCollectionId: string;
  resolvedType: string;
  valuesByMode: Record<string, unknown>;
};

/** A variant's values from its name, "Size=Large, State=Default", as Figma names variants. */
export function variantOf(name: string): Record<string, string> {
  return Object.fromEntries(
    name
      .split(",")
      .map((part) => part.split("=").map((item) => item.trim()))
      .filter((pair): pair is [string, string] => pair.length === 2),
  );
}

/** How strictly the fake behaves; by default as loosely as it always did. */
export interface FakeOptions {
  /**
   * Refuse what Figma refuses where the plain fake lets it through: insertChild on a layer that holds no children, a
   * section's resize (Figma gives sections resizeWithoutConstraints only), createImage of other than PNG, JPEG or GIF
   * bytes, or of a PNG over 4096 px a side.
   */
  readonly strict?: boolean;
  /** A removed layer, and every layer in it, throws when its name is read, as Figma's does. */
  readonly removedThrows?: boolean;
  /**
   * A layer hidden inside an instance is gone from the plugin API at once, as Figma can make it
   * (skipInvisibleInstanceChildren on, or the instance drawn again): its type and name throw when read, its id stays.
   */
  readonly hiddenInInstanceGone?: boolean;
}

/** As Figma's layers that are gone from the plugin API: these fields throw when read; the id stays readable. */
function dropped(layer: FakeNode, fields: readonly string[]): void {
  for (const field of fields) {
    Object.defineProperty(layer, field, {
      get: () => {
        throw new Error(
          `in get_${field}: The node (instance sublayer or table cell) with id "${layer.id}" does not exist`,
        );
      },
      set: () => {},
      configurable: true,
    });
  }
}

/** A layer inside an instance that drops out of the plugin API once hidden (FakeOptions.hiddenInInstanceGone). */
function droppedWhenHidden(node: FakeNode): void {
  let inInstance = false;

  for (let at = node.parent; at !== null && at !== undefined; at = at.parent) {
    inInstance ||= at.type === "INSTANCE";
  }

  if (!inInstance) {
    return;
  }

  let visible = node.visible !== false;

  Object.defineProperty(node, "visible", {
    get: () => visible,
    set: (value: boolean) => {
      visible = value;

      if (!value) {
        dropped(node, ["type", "name"]);
      }
    },
    enumerable: true,
    configurable: true,
  });
}

/** Layers Figma lets insertChild put children in; an instance takes them only through its slots. */
const CONTAINERS: ReadonlySet<string> = new Set([
  "PAGE",
  "FRAME",
  "GROUP",
  "SECTION",
  "COMPONENT",
  "COMPONENT_SET",
  "BOOLEAN_OPERATION",
  "SLOT",
  "TRANSFORM_GROUP",
]);

/** What the writing calls did: undo steps, fonts loaded, calls by node, the layers made. */
export interface FakeWrites {
  undo: number;
  readonly loaded: Set<string>;
  readonly calls: { node: string; method: string; args: unknown[] }[];
  readonly created: FakeNode[];
}

const fontKey = (font: { family: string; style: string }) => `${font.family} ${font.style}`;

const SOLID = (r: number, g: number, b: number) => ({
  type: "SOLID",
  visible: true,
  opacity: 1,
  blendMode: "NORMAL",
  color: {
    r,
    g,
    b,
  },
});

/** What Figma gives a new layer of each type. */
const DEFAULTS: Readonly<Record<string, Record<string, unknown>>> = {
  FRAME: {
    fills: [SOLID(1, 1, 1)],
    clipsContent: true,
    layoutMode: "NONE",
    children: [],
  },
  SECTION: {
    fills: [SOLID(1, 1, 1)],
    children: [],
  },
  COMPONENT_SET: {
    layoutMode: "NONE",
    children: [],
  },
  RECTANGLE: { fills: [SOLID(0.85, 0.85, 0.85)] },
  ELLIPSE: { fills: [SOLID(0.85, 0.85, 0.85)] },
  LINE: {
    strokes: [SOLID(0, 0, 0)],
    strokeWeight: 1,
  },
  TEXT: {
    characters: "",
    autoRename: true,
    fontName: {
      family: "Inter",
      style: "Regular",
    },
    fontSize: 12,
    fills: [SOLID(0, 0, 0)],
    textAutoResize: "WIDTH_AND_HEIGHT",
    // As Figma makes one (seen live on 2026-10-15): an empty text is 0 wide, and setting it to fill a row leaves it
    // so; only a resize lays it out again.
    width: 0,
  },
};

/**
 * As Figma's rescale (the scale tool): the layer and everything inside it scaled, their boxes, line weights and corner
 * radii too.
 */
function scaled(node: FakeNode, factor: number): void {
  for (const key of ["width", "height", "strokeWeight", "cornerRadius"]) {
    if (typeof node[key] === "number") {
      node[key] = (node[key] as number) * factor;
    }
  }

  for (const key of ["absoluteBoundingBox", "absoluteRenderBounds"]) {
    const box = node[key] as { width: number; height: number } | undefined;

    if (box !== undefined && box !== null) {
      node[key] = {
        ...box,
        width: box.width * factor,
        height: box.height * factor,
      };
    }
  }

  for (const child of node.children ?? []) {
    scaled(child, factor);
  }
}

/** The new layers that take a stroke weight per side. */
const STROKE_SIDED = new Set(["FRAME", "COMPONENT", "RECTANGLE"]);

/**
 * Figma's stroke weights per side on a new layer, as seen live on 2026-10-15 (border-top left every weight at 0):
 * the sides read its strokeWeight, 1, until one is set; setting one gives the layer weights per side, the sides not
 * set yet 0. strokeWeight is then the sides' weight when they agree, figma.mixed when not, and setting it evens them.
 */
function strokeSides(node: FakeNode): void {
  const SIDES = ["Top", "Right", "Bottom", "Left"] as const;
  let weight = 1;
  let sides: Record<(typeof SIDES)[number], number> | null = null;

  for (const side of SIDES) {
    Object.defineProperty(node, `stroke${side}Weight`, {
      get: () => (sides === null ? weight : sides[side]),
      set: (value: number) => {
        sides ??= {
          Top: 0,
          Right: 0,
          Bottom: 0,
          Left: 0,
        };
        sides[side] = value;
      },
      enumerable: true,
      configurable: true,
    });
  }

  Object.defineProperty(node, "strokeWeight", {
    get: () => {
      const values = sides === null ? [weight] : Object.values(sides);

      return values.every((value) => value === values[0]) ? values[0] : FAKE_MIXED;
    },
    set: (value: number) => {
      weight = value;
      sides = null;
    },
    enumerable: true,
    configurable: true,
  });
}

/**
 * As Figma places a grid's child (seen live on 2026-10-17): with its spans, the cells it covers must lie in the grid
 * and be free of the other children's, or setGridChildPosition throws Figma's words.
 */
function refuseGridCell(node: FakeNode, row: number, column: number): void {
  const grid = node.parent;

  if (
    grid?.layoutMode !== "GRID" ||
    typeof grid.gridColumnCount !== "number" ||
    typeof grid.gridRowCount !== "number"
  ) {
    return;
  }

  // The cells a child covers from a cell, with its spans: first and last row, first and last column.
  const covers = (child: FakeNode, top: number, left: number) => ({
    top,
    bottom: top + Number(child.gridRowSpan ?? 1) - 1,
    left,
    right: left + Number(child.gridColumnSpan ?? 1) - 1,
  });
  const mine = covers(node, row, column);

  if (mine.bottom >= grid.gridRowCount || mine.right >= grid.gridColumnCount) {
    throw new Error(
      "in setGridChildPosition: Cannot set grid child position: Cannot place child at this position because it is out of bounds of the grid",
    );
  }

  const taken = (grid.children ?? []).some((other) => {
    if (other === node || other.layoutPositioning === "ABSOLUTE" || other.gridRowAnchorIndex === undefined) {
      return false;
    }

    const theirs = covers(other, Number(other.gridRowAnchorIndex), Number(other.gridColumnAnchorIndex));

    return (
      mine.top <= theirs.bottom && theirs.top <= mine.bottom && mine.left <= theirs.right && theirs.left <= mine.right
    );
  });

  if (taken) {
    throw new Error(
      "in setGridChildPosition: Cannot set grid child position: Can't place child at this position because it is occupied by another node",
    );
  }
}

/** Figma's range writers, by the field a whole-text run sets. */
const RANGE_METHODS: Readonly<Record<string, string>> = {
  setRangeFontName: "fontName",
  setRangeFontSize: "fontSize",
  setRangeLineHeight: "lineHeight",
  setRangeLetterSpacing: "letterSpacing",
  setRangeTextCase: "textCase",
  setRangeTextDecoration: "textDecoration",
  setRangeTextDecorationStyle: "textDecorationStyle",
  setRangeTextDecorationOffset: "textDecorationOffset",
  setRangeTextDecorationThickness: "textDecorationThickness",
  setRangeTextDecorationColor: "textDecorationColor",
  setRangeFills: "fills",
  setRangeFillStyleIdAsync: "fillStyleId",
  setRangeTextStyleIdAsync: "textStyleId",
  setRangeHyperlink: "hyperlink",
};

/** Gives a node Figma's writing methods, recording each call; a text refuses new characters until its font loads. */
function writable(
  node: FakeNode,
  writes: FakeWrites,
  register: (node: FakeNode) => void,
  options: FakeOptions = {},
): void {
  const define = (name: string, value: unknown) =>
    Object.defineProperty(node, name, {
      value,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  const record = (method: string, args: unknown[]) =>
    writes.calls.push({
      node: node.id,
      method,
      args,
    });
  const insert = (index: number, child: FakeNode) => {
    if ((options.strict ?? false) && !CONTAINERS.has(node.type)) {
      throw new Error(`in insertChild: a ${node.type} holds no children`);
    }

    const old = child.parent?.children;
    // As Figma (checked live): the index is read in the list as it is, a child of this layer still in its place, so
    // one moved further along lands just before the layer that was at the index.
    const at = old !== undefined && child.parent === node ? old.indexOf(child) : -1;

    if (old !== undefined) {
      old.splice(old.indexOf(child), 1);
    }

    node.children ??= [];
    node.children.splice(at !== -1 && at < index ? index - 1 : index, 0, child);
    child.parent = node;
    register(child);
    record("insertChild", [index, child.id]);
  };

  define("appendChild", (child: FakeNode) => insert(node.children?.length ?? 0, child));
  define("insertChild", insert);
  // A section takes resize as Figma does (seen live on 2026-10-15), as well as resizeWithoutConstraints.
  define("resize", (width: number, height: number) => {
    if (node.type === "TEXT" && !writes.loaded.has(fontKey(node.fontName as { family: string; style: string }))) {
      throw new Error(
        `Cannot resize a text with unloaded font "${fontKey(node.fontName as { family: string; style: string })}"`,
      );
    }

    node.width = width;
    node.height = height;

    // As Figma does: a resize fixes the size, hugging stops on both axes, and a text stops sizing itself.
    for (const sizing of ["layoutSizingHorizontal", "layoutSizingVertical"]) {
      if (node[sizing] === "HUG") {
        node[sizing] = "FIXED";
      }
    }

    if (node.type === "TEXT") {
      textAutoResize = "NONE";
    }

    record("resize", [width, height]);
  });
  define("resizeWithoutConstraints", (width: number, height: number) => {
    node.width = width;
    node.height = height;
    record("resizeWithoutConstraints", [width, height]);
  });
  define("setProperties", (properties: Record<string, string | boolean>) => {
    record("setProperties", [properties]);

    const own = node.componentProperties as Record<string, { type: string; value: unknown }> | undefined;
    const main = node.mainComponent as FakeNode | undefined;

    for (const [key, value] of Object.entries(properties)) {
      if (own !== undefined && own[key] === undefined) {
        throw new Error(`Could not find a component property with name: '${key}'`);
      }

      if (own?.[key] !== undefined) {
        own[key] = {
          ...own[key],
          value,
        };
      }

      // A variant's value switches the instance to that variant of its set.
      if (own?.[key]?.type === "VARIANT" && main?.parent?.type === "COMPONENT_SET") {
        const wanted = {
          ...variantOf(main.name),
          [key]: String(value),
        };
        const next = main.parent.children?.find((child) =>
          Object.entries(wanted).every(([name, option]) => variantOf(child.name)[name] === option),
        );

        if (next === undefined) {
          throw new Error(`No variant ${JSON.stringify(wanted)}`);
        }

        node.mainComponent = next;
      }
    }

    const walkTexts = (layer: FakeNode) => {
      const key = (layer.componentPropertyReferences as { characters?: string } | undefined)?.characters;

      if (key !== undefined && properties[key] !== undefined) {
        layer.characters = String(properties[key]);
      }

      for (const child of layer.children ?? []) {
        walkTexts(child);
      }
    };

    walkTexts(node);
  });
  define("swapComponent", (component: FakeNode) => {
    node.mainComponent = component;
    record("swapComponent", [component.id]);
  });
  // As Figma: every overridden field goes back to the main component's value (the same layer there), then none is.
  define("removeOverrides", () => {
    const main = node.mainComponent as FakeNode | undefined;
    const counterpart = (id: string): FakeNode | undefined => {
      const own = id === node.id ? main?.id : id.replace(`I${node.id};`, "");
      const find = (at: FakeNode | undefined): FakeNode | undefined =>
        at === undefined || at.id === own ? at : (at.children ?? []).map(find).find((found) => found !== undefined);

      return find(main);
    };
    const layer = (id: string): FakeNode | undefined => {
      const find = (at: FakeNode): FakeNode | undefined =>
        at.id === id ? at : (at.children ?? []).map(find).find((found) => found !== undefined);

      return find(node);
    };

    for (const { id, overriddenFields } of (node.overrides ?? []) as { id: string; overriddenFields: string[] }[]) {
      const target = layer(id);
      const source = counterpart(id);

      if (target !== undefined && source !== undefined) {
        for (const field of overriddenFields) {
          target[field] = structuredClone(source[field]);
        }
      }
    }

    node.overrides = [];
    record("removeOverrides", []);
  });

  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    // Never read here: Figma refuses reading a variant's definitions, and some tests model that with a getter.
    if (Object.getOwnPropertyDescriptor(node, "componentPropertyDefinitions") === undefined) {
      node.componentPropertyDefinitions = {};
    }

    define("addComponentProperty", (name: string, type: string, defaultValue: unknown) => {
      const definitions = node.componentPropertyDefinitions as Record<string, unknown>;
      const key = type === "VARIANT" ? name : `${name}#${Object.keys(definitions).length + 1}:0`;

      definitions[key] = {
        type,
        defaultValue,
      };
      record("addComponentProperty", [name, type, defaultValue]);

      return key;
    });
  }

  define("setBoundVariable", (field: string, variable: { id: string } | null) => {
    node.boundVariables = {
      ...(node.boundVariables as object | undefined),
      [field]:
        variable === null
          ? undefined
          : {
              type: "VARIABLE_ALIAS",
              id: variable.id,
            },
    };
    record("setBoundVariable", [field, variable?.id ?? null]);
  });

  for (const kind of ["Fill", "Stroke", "Effect", "Text"]) {
    define(`set${kind}StyleIdAsync`, async (id: string) => {
      node[`${kind.toLowerCase()}StyleId`] = id;
      record(`set${kind}StyleIdAsync`, [id]);
    });
  }

  define("setExplicitVariableModeForCollection", (collection: { id: string }, modeId: string) => {
    node.explicitVariableModes = {
      ...((node.explicitVariableModes as Record<string, string> | undefined) ?? {}),
      [collection.id]: modeId,
    };
    record("setExplicitVariableModeForCollection", [collection.id, modeId]);
  });
  define("clearExplicitVariableModeForCollection", (collection: { id: string }) => {
    const { [collection.id]: _cleared, ...kept } =
      (node.explicitVariableModes as Record<string, string> | undefined) ?? {};

    node.explicitVariableModes = kept;
    record("clearExplicitVariableModeForCollection", [collection.id]);
  });
  define("remove", () => {
    node.parent?.children?.splice(node.parent.children.indexOf(node), 1);
    node.parent = null;
    record("remove", []);

    // As Figma (when the test asks for it): a removed layer, and every layer in it, throws when read.
    const gone = (layer: FakeNode) => {
      Object.defineProperty(layer, "name", {
        get: () => {
          throw new Error(`in get_name: The node with id "${layer.id}" does not exist`);
        },
        set: () => {},
        configurable: true,
      });

      for (const child of layer.children ?? []) {
        gone(child);
      }
    };

    if (options.removedThrows ?? false) {
      gone(node);
    }
  });
  define("setGridChildPosition", (row: number, column: number) => {
    refuseGridCell(node, row, column);
    node.gridRowAnchorIndex = row;
    node.gridColumnAnchorIndex = column;
    record("setGridChildPosition", [row, column]);
  });

  if (options.hiddenInInstanceGone ?? false) {
    droppedWhenHidden(node);
  }

  if (node.type !== "TEXT") {
    return;
  }

  let characters = typeof node.characters === "string" ? node.characters : "";
  let textAutoResize = typeof node.textAutoResize === "string" ? node.textAutoResize : "NONE";

  // Figma: setting how a text sizes itself requires its font loaded.
  Object.defineProperty(node, "textAutoResize", {
    get: () => textAutoResize,
    set: (value: string) => {
      if (!writes.loaded.has(fontKey(node.fontName as { family: string; style: string }))) {
        throw new Error(
          `Cannot write to node with unloaded font "${fontKey(node.fontName as { family: string; style: string })}"`,
        );
      }

      textAutoResize = value;
      record("textAutoResize", [value]);
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(node, "characters", {
    get: () => characters,
    set: (value: string) => {
      const font = node.fontName as { family: string; style: string };

      if (!writes.loaded.has(fontKey(font))) {
        throw new Error(`Cannot write to node with unloaded font "${fontKey(font)}"`);
      }

      characters = value;
      record("characters", [value]);

      // As Figma: a new text is named after its characters until its name is set.
      if ((node.autoRename as boolean | undefined) ?? false) {
        name = value;
      }
    },
    enumerable: true,
    configurable: true,
  });

  let name = node.name;

  Object.defineProperty(node, "name", {
    get: () => name,
    set: (value: string) => {
      name = value;
      node.autoRename = false;
    },
    enumerable: true,
    configurable: true,
  });

  for (const [method, field] of Object.entries(RANGE_METHODS)) {
    define(method, (start: number, end: number, value: unknown) => {
      if (method === "setRangeFontName" && !writes.loaded.has(fontKey(value as { family: string; style: string }))) {
        throw new Error(`Cannot use unloaded font "${fontKey(value as { family: string; style: string })}"`);
      }

      // A run over the whole text is the text's own value, as Figma reports it.
      if (start === 0 && end === characters.length) {
        node[field] = value;
      }

      record(method, [start, end, value]);

      return method.endsWith("Async") ? Promise.resolve() : undefined;
    });
  }

  // As Figma: inserting or deleting characters needs the text's font loaded; an insert takes a neighbour's style.
  const requireFont = (method: string) => {
    const font = node.fontName as { family: string; style: string };

    if (!writes.loaded.has(fontKey(font))) {
      throw new Error(`in ${method}: Cannot write to node with unloaded font "${fontKey(font)}"`);
    }
  };

  define("insertCharacters", (start: number, text: string, useStyle = "BEFORE") => {
    requireFont("insertCharacters");
    characters = `${characters.slice(0, start)}${text}${characters.slice(start)}`;
    record("insertCharacters", [start, text, useStyle]);
  });
  define("deleteCharacters", (start: number, end: number) => {
    requireFont("deleteCharacters");
    characters = `${characters.slice(0, start)}${characters.slice(end)}`;
    record("deleteCharacters", [start, end]);
  });
  define("setRangeBoundVariable", (start: number, end: number, field: string, variable: { id: string } | null) => {
    // A run over the whole text binds the text's own field, as Figma reports it.
    if (start === 0 && end === characters.length) {
      node.boundVariables = {
        ...((node.boundVariables as object | undefined) ?? {}),
        [field]:
          variable === null
            ? undefined
            : {
                type: "VARIABLE_ALIAS",
                id: variable.id,
              },
      };
    }

    record("setRangeBoundVariable", [start, end, field, variable?.id ?? null]);
  });
  define("getRangeAllFontNames", (start: number, end: number) => {
    // As Figma: a range of no characters is refused, so an empty text is read through its own fontName.
    if (end <= start) {
      throw new Error("in getRangeAllFontNames: Empty range selected. 'end' must be greater than 'start'");
    }

    return [node.fontName];
  });
  define(
    "getStyledTextSegments",
    (fields: string[]) =>
      (node.segments as object[] | undefined) ??
      (characters === "" ? [] : undefined) ?? [
        {
          characters,
          start: 0,
          end: characters.length,
          ...Object.fromEntries(fields.map((field) => [field, node[field]])),
        },
      ],
  );
}

/** Installs a fake `figma` global over a page tree and returns what the operations changed. */
export function installFigma(page: FakeNode, library: FakeLibrary = {}, options: FakeOptions = {}) {
  const byId = new Map<string, FakeNode>();
  const all: FakeNode[] = [page];

  walk(page, all);

  for (const node of all) {
    byId.set(node.id, node);
  }

  const state = {
    zoomedTo: [] as FakeNode[],
    currentPage: page,
  };
  const writes: FakeWrites = {
    undo: 0,
    loaded: new Set(),
    calls: [],
    created: [],
  };
  /** As Figma: a layer's modes are the collections' defaults, then each layer's own from the page down to it. */
  const resolvedModes = (node: FakeNode): Record<string, string> => {
    const chain: FakeNode[] = [];

    for (let at: FakeNode | null = node; at !== null; at = at.parent) {
      chain.unshift(at);
    }

    return Object.assign(
      Object.fromEntries(localCollections.map((collection) => [collection.id, String(collection.defaultModeId)])),
      ...chain.map((each) => (each.explicitVariableModes as Record<string, string> | undefined) ?? {}),
    );
  };
  const register = (node: FakeNode) => {
    byId.set(node.id, node);

    if (Object.getOwnPropertyDescriptor(node, "resize") === undefined) {
      writable(node, writes, register, options);
      copyable(node);
    }

    // A test that sets the field itself keeps its own value.
    if (Object.getOwnPropertyDescriptor(node, "resolvedVariableModes") === undefined) {
      Object.defineProperty(node, "resolvedVariableModes", {
        get: () => resolvedModes(node),
        set: (value: unknown) =>
          Object.defineProperty(node, "resolvedVariableModes", {
            value,
            writable: true,
            enumerable: true,
            configurable: true,
          }),
        enumerable: false,
        configurable: true,
      });
    }
  };
  /**
   * A deep copy with fresh ids, as Figma's clone(): same structure, same properties, parented nowhere yet. A copy of an
   * instance keeps its main component and holds its layers as I<copy>;<layer>, the way any instance does.
   */
  const cloneOf = (source: FakeNode, rename?: (id: string) => string): FakeNode => {
    const { children, parent: _parent, mainComponent, defaultVariant: _default, ...rest } = source;
    const id = rename?.(source.id) ?? `90:${writes.created.length + 1}`;
    const copy = tree({
      ...(structuredClone(
        Object.fromEntries(
          Object.entries(rest).filter(([, value]) => typeof value !== "function" && typeof value !== "symbol"),
        ),
      ) as Omit<FakeNode, "children" | "parent">),
      ...(mainComponent === undefined ? {} : { mainComponent }),
      id,
    });
    const inside =
      source.type === "INSTANCE" ? (layer: string) => `I${id};${layer.replace(`I${source.id};`, "")}` : rename;

    writes.created.push(copy);
    register(copy);
    copy.children = (children ?? []).map((child) => {
      const inner = cloneOf(child, inside);

      inner.parent = copy;

      return inner;
    });

    // A copied set's default is its own first variant.
    if (source.type === "COMPONENT_SET") {
      copy.defaultVariant = copy.children[0];
    }

    return copy;
  };

  function copyable(node: FakeNode): void {
    Object.defineProperty(node, "clone", {
      value: () => cloneOf(node),
      enumerable: false,
      configurable: true,
    });
    Object.defineProperty(node, "rescale", {
      value: (factor: number) => {
        scaled(node, factor);
        writes.calls.push({
          node: node.id,
          method: "rescale",
          args: [factor],
        });
      },
      enumerable: false,
      configurable: true,
    });

    if (node.type === "COMPONENT") {
      Object.defineProperty(node, "createSlot", {
        value: () => {
          const slot = create("SLOT")();

          (node as FakeNode & { appendChild: (child: FakeNode) => void }).appendChild(slot);

          return slot;
        },
        enumerable: false,
        configurable: true,
      });
    }

    if (node.type === "PAGE") {
      Object.defineProperty(node, "loadAsync", {
        value: async () => {
          writes.calls.push({
            node: node.id,
            method: "loadAsync",
            args: [],
          });
        },
        enumerable: false,
        configurable: true,
      });
    }
  }

  const create = (type: string) => () => {
    const node = tree({
      id: `90:${writes.created.length + 1}`,
      name: type.charAt(0) + type.slice(1).toLowerCase(),
      type,
      ...structuredClone(DEFAULTS[type] ?? {}),
    });

    if (STROKE_SIDED.has(type)) {
      strokeSides(node);
    }

    writes.created.push(node);
    register(node);

    return node;
  };

  for (const node of all) {
    register(node);
  }

  const lost: FakeNode[] = [];

  for (const other of library.pages ?? []) {
    walk(other, lost);
    lost.push(other);
  }

  for (const component of library.components ?? []) {
    walk(component, lost);
    register(component);
  }

  for (const node of lost) {
    register(node);
  }

  const categories = [
    ...(library.categories ?? [
      {
        id: "cat-dev",
        label: "Development",
        color: "blue",
      },
    ]),
  ];
  /** An instance of a component, its properties at their defaults (a variant's values from its name). */
  const instanceOf = (component: FakeNode) => {
    const owner = component.parent?.type === "COMPONENT_SET" ? component.parent : component;
    const definitions = (owner.componentPropertyDefinitions ?? {}) as Record<
      string,
      { type: string; defaultValue: unknown }
    >;
    const id = `90:${writes.created.length + 1}`;
    // As Figma: an instance looks like its component (fills, sizing) and holds its layers as I<instance>;<layer> ids.
    const sublayers = (layer: FakeNode): Record<string, unknown> => {
      const { children, parent: _parent, id: own, ...rest } = layer;

      return {
        ...structuredClone(
          Object.fromEntries(
            Object.entries(rest).filter(([, value]) => typeof value !== "function" && typeof value !== "symbol"),
          ),
        ),
        id: `I${id};${own}`,
        children: (children ?? []).map(sublayers),
      };
    };
    const instance = tree({
      id,
      name: owner.name,
      type: "INSTANCE",
      layoutMode: component.layoutMode ?? "NONE",
      ...(component.fills === undefined ? {} : { fills: structuredClone(component.fills) }),
      ...(component.layoutSizingHorizontal === undefined
        ? {}
        : {
            layoutSizingHorizontal: component.layoutSizingHorizontal,
            layoutSizingVertical: component.layoutSizingVertical,
          }),
      width: component.width,
      height: component.height,
      mainComponent: component,
      componentProperties: Object.fromEntries(
        Object.entries(definitions).map(([key, definition]) => [
          key,
          {
            type: definition.type,
            value: definition.type === "VARIANT" ? variantOf(component.name)[key] : definition.defaultValue,
          },
        ]),
      ),
      children: (component.children ?? []).map((child) => sublayers(child) as never),
    });

    writes.created.push(instance);

    for (const node of [instance, ...(instance.findAll?.(() => true) ?? [])]) {
      register(node);
    }

    return instance;
  };

  for (const node of [...all, ...lost, ...(library.components ?? [])]) {
    if (node.type === "COMPONENT") {
      Object.defineProperty(node, "createInstance", {
        value: () => instanceOf(node),
        enumerable: false,
        configurable: true,
      });
    }
  }

  // The file's own collections and variables, which the writing calls change as Figma's do.
  const method = (target: object, name: string, value: unknown) =>
    Object.defineProperty(target, name, {
      value,
      enumerable: false,
      configurable: true,
    });
  const localCollections: FakeCollection[] = [];
  const localVariables: FakeVariable[] = [];
  const collectionStore = (collection: FakeCollection): FakeCollection => {
    method(collection, "addMode", (name: string) => {
      if (collection.modes.length >= (library.modeLimit ?? 4)) {
        throw new Error(`in addMode: Limited to ${library.modeLimit ?? 4} modes only`);
      }

      const modeId = `${collection.id}/m${collection.modes.length + 1}`;

      collection.modes.push({
        modeId,
        name,
      });
      writes.calls.push({
        node: collection.id,
        method: "addMode",
        args: [name],
      });

      return modeId;
    });
    method(collection, "renameMode", (modeId: string, name: string) => {
      const mode = collection.modes.find((item) => item.modeId === modeId);

      if (mode === undefined) {
        throw new Error(`No mode ${modeId}`);
      }

      mode.name = name;
      writes.calls.push({
        node: collection.id,
        method: "renameMode",
        args: [modeId, name],
      });
    });
    localCollections.push(collection);

    return collection;
  };
  const variableStore = (variable: FakeVariable): FakeVariable => {
    method(variable, "setValueForMode", (modeId: string, value: unknown) => {
      variable.valuesByMode[modeId] = structuredClone(value);
      writes.calls.push({
        node: variable.id,
        method: "setValueForMode",
        args: [modeId, value],
      });
    });
    method(variable, "setVariableCodeSyntax", (platform: string, value: string) => {
      // As Figma (seen live on 2026-10-17).
      if (value.trim() === "") {
        throw new Error("in setVariableCodeSyntax: Code syntax value cannot be a blank string");
      }

      variable.codeSyntax = {
        ...(variable.codeSyntax as Record<string, string> | undefined),
        [platform]: value,
      };
      writes.calls.push({
        node: variable.id,
        method: "setVariableCodeSyntax",
        args: [platform, value],
      });
    });
    method(variable, "removeVariableCodeSyntax", (platform: string) => {
      const { [platform]: _removed, ...rest } = (variable.codeSyntax as Record<string, string> | undefined) ?? {};

      variable.codeSyntax = rest;
      writes.calls.push({
        node: variable.id,
        method: "removeVariableCodeSyntax",
        args: [platform],
      });
    });

    // Figma keeps scopes in its own order, whatever order they were set in.
    let scopes = [...((variable.scopes as string[] | undefined) ?? ["ALL_SCOPES"])];

    Object.defineProperty(variable, "scopes", {
      get: () => scopes,
      set: (value: string[]) => {
        scopes = VARIABLE_SCOPES.filter((scope) => value.includes(scope));
        writes.calls.push({
          node: variable.id,
          method: "scopes",
          args: [value],
        });
      },
      enumerable: true,
      configurable: true,
    });
    localVariables.push(variable);

    return variable;
  };

  // The file's own styles, made and changed as Figma's: a text style takes a font only once it is loaded.
  const localStyles: Record<"paint" | "text" | "effect", Record<string, unknown>[]> = {
    paint: [...((library.localStyles?.paint ?? []) as Record<string, unknown>[])],
    text: [...((library.localStyles?.text ?? []) as Record<string, unknown>[])],
    effect: [...((library.localStyles?.effect ?? []) as Record<string, unknown>[])],
  };
  const createStyle = (kind: "paint" | "text" | "effect", type: string, values: Record<string, unknown>) => () => {
    const style: Record<string, unknown> = {
      id: `S:90:${localStyles.paint.length + localStyles.text.length + localStyles.effect.length + 1}`,
      type,
      name: "",
      remote: false,
      ...structuredClone(values),
    };

    if (kind === "text") {
      let fontName = style.fontName as { family: string; style: string };

      delete style.fontName;
      Object.defineProperty(style, "fontName", {
        get: () => fontName,
        set: (value: { family: string; style: string }) => {
          if (!writes.loaded.has(fontKey(value))) {
            throw new Error(`Cannot use unloaded font "${fontKey(value)}"`);
          }

          fontName = value;
        },
        enumerable: true,
        configurable: true,
      });
    }

    localStyles[kind].push(style);
    writes.calls.push({
      node: style.id as string,
      method: `create${type.charAt(0)}${type.slice(1).toLowerCase()}Style`,
      args: [],
    });

    return style;
  };

  for (const collection of library.localCollections ?? []) {
    collectionStore(collection as FakeCollection);
  }

  for (const variable of library.localVariables ?? []) {
    variableStore(variable as FakeVariable);
  }

  // Events as Figma's: figma.on/off for the document, page.on/off for a page's own; tests fire them with emit.
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const listen = (key: string) => (name: string, handler: (event: unknown) => void) => {
    listeners.set(`${key}:${name}`, (listeners.get(`${key}:${name}`) ?? new Set()).add(handler));
  };
  const unlisten = (key: string) => (name: string, handler: (event: unknown) => void) => {
    listeners.get(`${key}:${name}`)?.delete(handler);
  };
  const emit = (name: string, event: unknown = undefined, pageId?: string) => {
    for (const handler of [...(listeners.get(`${pageId ?? "figma"}:${name}`) ?? [])]) {
      handler(event);
    }
  };

  for (const each of [page, ...(library.pages ?? [])]) {
    each.on = listen(each.id);
    each.off = unlisten(each.id);
    // A page always has a selection in Figma, empty at first.
    each.selection ??= [];
  }

  const figma = {
    on: listen("figma"),
    off: unlisten("figma"),
    currentPage: page as FakeNode & { selection?: FakeNode[] },
    mixed: FAKE_MIXED,
    getNodeByIdAsync: async (id: string) => byId.get(id) ?? null,
    getStyleByIdAsync: async (id: string) =>
      library.styles?.[id] ??
      [...localStyles.paint, ...localStyles.text, ...localStyles.effect].find(
        (style) => (style as { id?: string }).id === id,
      ) ??
      null,
    variables: {
      getVariableByIdAsync: async (id: string) => {
        const variable = library.variables?.[id];

        return variable === undefined
          ? (localVariables.find((local) => local.id === id) ?? null)
          : {
              remote: false,
              codeSyntax: {},
              ...variable,
              resolveForConsumer: () => ({ value: variable.value }),
            };
      },
      getVariableCollectionByIdAsync: async (id: string) =>
        library.collections?.[id] ?? localCollections.find((local) => local.id === id) ?? null,
      getLocalVariableCollectionsAsync: async () => localCollections,
      getLocalVariablesAsync: async () => localVariables,
      createVariableCollection: (name: string) => {
        const id = `VariableCollectionId:90:${localCollections.length + 1}`;

        writes.calls.push({
          node: id,
          method: "createVariableCollection",
          args: [name],
        });

        return collectionStore({
          id,
          name,
          remote: false,
          defaultModeId: `${id}/m1`,
          modes: [
            {
              modeId: `${id}/m1`,
              name: "Mode 1",
            },
          ],
        });
      },
      createVariable: (name: string, collection: { id: string }, resolvedType: string) => {
        // As Figma (its staff on the forum): a name with ".", "{", "}" or "$" is refused.
        if (/[.{}$]/.test(name)) {
          throw new Error(`in createVariable: invalid variable name "${name}"`);
        }

        const id = `VariableID:90:${localVariables.length + 1}`;

        writes.calls.push({
          node: id,
          method: "createVariable",
          args: [name, collection.id, resolvedType],
        });

        return variableStore({
          id,
          name,
          variableCollectionId: collection.id,
          resolvedType,
          description: "",
          scopes: ["ALL_SCOPES"],
          codeSyntax: {},
          valuesByMode: {},
        });
      },
      importVariableByKeyAsync: async (key: string) => {
        writes.calls.push({
          node: key,
          method: "importVariableByKeyAsync",
          args: [key],
        });

        const variable = library.importable?.[key];

        if (variable === undefined) {
          throw new Error(`No variable with key ${key}`);
        }

        return variable;
      },
      createVariableAlias: (variable: { id: string }) => ({
        type: "VARIABLE_ALIAS",
        id: variable.id,
      }),
      createVariableAliasByIdAsync: async (id: string) => ({
        type: "VARIABLE_ALIAS",
        id,
      }),
      setBoundVariableForPaint: (paint: object, field: string, variable: { id: string }) => ({
        ...paint,
        boundVariables: {
          [field]: {
            type: "VARIABLE_ALIAS",
            id: variable.id,
          },
        },
      }),
      // A copy of the effect with the field bound, its other bound fields kept.
      setBoundVariableForEffect: (effect: { boundVariables?: object }, field: string, variable: { id: string }) => ({
        ...effect,
        boundVariables: {
          ...effect.boundVariables,
          [field]: {
            type: "VARIABLE_ALIAS",
            id: variable.id,
          },
        },
      }),
    },
    getLocalPaintStylesAsync: async () => localStyles.paint,
    getLocalTextStylesAsync: async () => localStyles.text,
    getLocalEffectStylesAsync: async () => localStyles.effect,
    createPaintStyle: createStyle("paint", "PAINT", { paints: [] }),
    createTextStyle: createStyle("text", "TEXT", {
      fontName: {
        family: "Inter",
        style: "Regular",
      },
      fontSize: 12,
      lineHeight: { unit: "AUTO" },
      letterSpacing: {
        unit: "PERCENT",
        value: 0,
      },
      textCase: "ORIGINAL",
      textDecoration: "NONE",
    }),
    createEffectStyle: createStyle("effect", "EFFECT", { effects: [] }),
    teamLibrary: {
      getAvailableLibraryVariableCollectionsAsync: async () => {
        if (library.teamLibrary instanceof Error) {
          throw library.teamLibrary;
        }

        return library.teamLibrary?.collections ?? [];
      },
      getVariablesInLibraryCollectionAsync: async (key: string) =>
        library.teamLibrary instanceof Error ? [] : (library.teamLibrary?.variables[key] ?? []),
    },
    createFrame: create("FRAME"),
    createSection: create("SECTION"),
    createText: create("TEXT"),
    createRectangle: create("RECTANGLE"),
    createEllipse: create("ELLIPSE"),
    createLine: create("LINE"),
    createImage: (bytes: Uint8Array) => {
      if (options.strict ?? false) {
        checkImage(bytes);
      }

      return { hash: `hash-${bytes.length}` };
    },
    createNodeFromSvg: (svg: string) => {
      const frame = create("FRAME")();
      const vector = create("VECTOR")();

      frame.width = 24;
      frame.height = 24;
      frame.svg = svg;
      (frame as FakeNode & { appendChild: (child: FakeNode) => void }).appendChild(vector);

      return frame;
    },
    createComponent: () => {
      const component = create("COMPONENT")();

      Object.defineProperty(component, "createInstance", {
        value: () => instanceOf(component),
        enumerable: false,
        configurable: true,
      });

      return component;
    },
    combineAsVariants: (
      components: FakeNode[],
      parent: FakeNode & { insertChild: (index: number, child: FakeNode) => void },
      index?: number,
    ) => {
      const set = create("COMPONENT_SET")();
      const definitions = set.componentPropertyDefinitions as Record<
        string,
        { type: string; defaultValue: string; variantOptions: string[] }
      >;

      parent.insertChild(index ?? parent.children?.length ?? 0, set);

      for (const component of components) {
        (set as FakeNode & { appendChild: (child: FakeNode) => void }).appendChild(component);

        for (const [name, option] of Object.entries(variantOf(component.name))) {
          definitions[name] ??= {
            type: "VARIANT",
            defaultValue: option,
            variantOptions: [],
          };
          definitions[name].variantOptions.push(option);
        }
      }

      set.defaultVariant = components[0];
      writes.calls.push({
        node: set.id,
        method: "combineAsVariants",
        args: [components.map(({ id }) => id)],
      });

      return set;
    },
    root: {
      type: "DOCUMENT",
      children: [page, ...(library.pages ?? [])],
      findAllWithCriteria: ({ types }: { types: string[] }) =>
        [...byId.values()].filter((node) => types.includes(node.type) && node.parent !== null),
    },
    loadAllPagesAsync: async () => {
      writes.calls.push({
        node: "0:0",
        method: "loadAllPagesAsync",
        args: [],
      });
    },
    importComponentByKeyAsync: async (key: string) => {
      writes.calls.push({
        node: key,
        method: "importComponentByKeyAsync",
        args: [key],
      });

      const found = [...lost, ...(library.components ?? [])].find(
        (node) => node.key === key && node.type === "COMPONENT",
      );

      if (found === undefined) {
        throw new Error(`No component with key ${key}`);
      }

      return found;
    },
    importComponentSetByKeyAsync: async (key: string) => {
      writes.calls.push({
        node: key,
        method: "importComponentSetByKeyAsync",
        args: [key],
      });

      const found = (library.components ?? []).find((node) => node.key === key && node.type === "COMPONENT_SET");

      if (found === undefined) {
        // As Figma does (measured 2026-10-18): a lone component's key, an unpublished set's or an unknown one never
        // settles.
        return new Promise<never>(() => undefined);
      }

      return found;
    },
    annotations: {
      getAnnotationCategoriesAsync: async () => categories,
      addAnnotationCategoryAsync: async ({ label, color }: { label: string; color: string }) => {
        const category = {
          id: `cat-${categories.length + 1}`,
          label,
          color,
        };

        categories.push(category);

        return category;
      },
    },
    loadFontAsync: async (font: { family: string; style: string }) => {
      if (library.unloadable?.some((unloadable) => fontKey(unloadable) === fontKey(font))) {
        throw new Error(`The font "${fontKey(font)}" could not be loaded`);
      }

      writes.loaded.add(fontKey(font));
    },
    listAvailableFontsAsync: async () => (library.fonts ?? []).map((fontName) => ({ fontName })),
    base64Decode: (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0)),
    commitUndo: () => {
      writes.undo += 1;
    },
    setCurrentPageAsync: async (next: FakeNode) => {
      state.currentPage = next;
    },
    viewport: {
      zoom: 1,
      center: {
        x: 0,
        y: 0,
      },
      bounds: {
        x: 0,
        y: 0,
        width: 1440,
        height: 900,
      },
      scrollAndZoomIntoView: (nodes: FakeNode[]) => {
        state.zoomedTo = nodes;
      },
    },
  };

  Object.assign(globalThis, { figma });

  return {
    figma,
    state,
    writes,
    emit,
  };
}

/** As Figma's createImage: PNG, JPEG or GIF bytes only, and no side over 4096 px (read from a PNG's header). */
function checkImage(bytes: Uint8Array): void {
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const png = starts(0x89, 0x50, 0x4e, 0x47);

  if (!png && !starts(0xff, 0xd8, 0xff) && !starts(0x47, 0x49, 0x46)) {
    throw new Error("Image type is unsupported");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (png && bytes.length >= 24 && (view.getUint32(16) > 4096 || view.getUint32(20) > 4096)) {
    throw new Error("Image is too large");
  }
}
