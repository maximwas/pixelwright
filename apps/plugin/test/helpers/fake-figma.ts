/** A small Figma document for the plugin's read operations: nodes with parents, boxes, text and main components. */
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
  readonly collections?: Record<string, { name: string }>;
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
  };
}
