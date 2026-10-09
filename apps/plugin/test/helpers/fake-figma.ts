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
  /** Components and sets that live off the page (a team library's), by key for importComponent…ByKeyAsync. */
  readonly components?: FakeNode[];
  /** The file's annotation categories. */
  readonly categories?: { id: string; label: string; color: string }[];
  /** The file's other pages. */
  readonly pages?: FakeNode[];
}

/** A variant's values from its name, "Size=Large, State=Default", as Figma names variants. */
export function variantOf(name: string): Record<string, string> {
  return Object.fromEntries(
    name
      .split(",")
      .map((part) => part.split("=").map((item) => item.trim()))
      .filter((pair): pair is [string, string] => pair.length === 2),
  );
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
      copyable(node);
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
        node.width = (node.width ?? 0) * factor;
        node.height = (node.height ?? 0) * factor;
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
    createImage: (bytes: Uint8Array) => ({ hash: `hash-${bytes.length}` }),
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
    loadAllPagesAsync: async () => undefined,
    importComponentByKeyAsync: async (key: string) => {
      const found = [...lost, ...(library.components ?? [])].find(
        (node) => node.key === key && node.type === "COMPONENT",
      );

      if (found === undefined) {
        throw new Error(`No component with key ${key}`);
      }

      return found;
    },
    importComponentSetByKeyAsync: async (key: string) => {
      const found = (library.components ?? []).find((node) => node.key === key && node.type === "COMPONENT_SET");

      if (found === undefined) {
        throw new Error(`No component set with key ${key}`);
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
