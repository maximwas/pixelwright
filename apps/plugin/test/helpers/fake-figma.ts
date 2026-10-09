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
}

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
  RECTANGLE: { fills: [SOLID(0.85, 0.85, 0.85)] },
  ELLIPSE: { fills: [SOLID(0.85, 0.85, 0.85)] },
  LINE: {
    strokes: [SOLID(0, 0, 0)],
    strokeWeight: 1,
  },
  TEXT: {
    characters: "",
    fontName: {
      family: "Inter",
      style: "Regular",
    },
    fontSize: 12,
    fills: [SOLID(0, 0, 0)],
    textAutoResize: "WIDTH_AND_HEIGHT",
  },
};

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
function writable(node: FakeNode, writes: FakeWrites, register: (node: FakeNode) => void): void {
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
    const old = child.parent?.children;

    if (old !== undefined) {
      old.splice(old.indexOf(child), 1);
    }

    node.children ??= [];
    node.children.splice(index, 0, child);
    child.parent = node;
    register(child);
    record("insertChild", [index, child.id]);
  };

  define("appendChild", (child: FakeNode) => insert(node.children?.length ?? 0, child));
  define("insertChild", insert);
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
  define("setProperties", (properties: Record<string, string>) => {
    record("setProperties", [properties]);

    const walkTexts = (layer: FakeNode) => {
      const key = (layer.componentPropertyReferences as { characters?: string } | undefined)?.characters;

      if (key !== undefined && properties[key] !== undefined) {
        layer.characters = properties[key];
      }

      for (const child of layer.children ?? []) {
        walkTexts(child);
      }
    };

    walkTexts(node);
  });
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

  define("remove", () => {
    node.parent?.children?.splice(node.parent.children.indexOf(node), 1);
    node.parent = null;
    record("remove", []);
  });
  define("setGridChildPosition", (row: number, column: number) => {
    node.gridRowAnchorIndex = row;
    node.gridColumnAnchorIndex = column;
    record("setGridChildPosition", [row, column]);
  });

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
export function installFigma(page: FakeNode, library: FakeLibrary = {}) {
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
  const register = (node: FakeNode) => {
    byId.set(node.id, node);

    if (Object.getOwnPropertyDescriptor(node, "resize") === undefined) {
      writable(node, writes, register);
    }
  };
  const create = (type: string) => () => {
    const node = tree({
      id: `90:${writes.created.length + 1}`,
      name: type.charAt(0) + type.slice(1).toLowerCase(),
      type,
      ...structuredClone(DEFAULTS[type] ?? {}),
    });

    writes.created.push(node);
    register(node);

    return node;
  };

  for (const node of all) {
    register(node);
  }

  const figma = {
    currentPage: page as FakeNode & { selection?: FakeNode[] },
    mixed: FAKE_MIXED,
    getNodeByIdAsync: async (id: string) => byId.get(id) ?? null,
    getStyleByIdAsync: async (id: string) => library.styles?.[id] ?? null,
    variables: {
      getVariableByIdAsync: async (id: string) => {
        const variable = library.variables?.[id];

        return variable === undefined
          ? null
          : {
              remote: false,
              codeSyntax: {},
              ...variable,
              resolveForConsumer: () => ({ value: variable.value }),
            };
      },
      getVariableCollectionByIdAsync: async (id: string) => library.collections?.[id] ?? null,
      getLocalVariableCollectionsAsync: async () => library.localCollections ?? [],
      getLocalVariablesAsync: async () => library.localVariables ?? [],
      setBoundVariableForPaint: (paint: object, field: string, variable: { id: string }) => ({
        ...paint,
        boundVariables: {
          [field]: {
            type: "VARIABLE_ALIAS",
            id: variable.id,
          },
        },
      }),
    },
    getLocalPaintStylesAsync: async () => library.localStyles?.paint ?? [],
    getLocalTextStylesAsync: async () => library.localStyles?.text ?? [],
    getLocalEffectStylesAsync: async () => library.localStyles?.effect ?? [],
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
    loadFontAsync: async (font: { family: string; style: string }) => {
      writes.loaded.add(fontKey(font));
    },
    listAvailableFontsAsync: async () => (library.fonts ?? []).map((fontName) => ({ fontName })),
    commitUndo: () => {
      writes.undo += 1;
    },
    setCurrentPageAsync: async (next: FakeNode) => {
      state.currentPage = next;
    },
    viewport: {
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
  };
}
