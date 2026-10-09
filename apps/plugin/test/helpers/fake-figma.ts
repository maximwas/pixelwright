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
  mainComponent?: { name: string; parent: { type: string; name: string } | null };
  getMainComponentAsync?: () => Promise<FakeNode["mainComponent"] | null>;
  findAll?: (predicate: (node: FakeNode) => boolean) => FakeNode[];
}

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

  if (children !== undefined) {
    node.children = children.map((child) => tree(child, node));
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

/** Installs a fake `figma` global over a page tree and returns what the operations changed. */
export function installFigma(page: FakeNode) {
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
    getNodeByIdAsync: async (id: string) => byId.get(id) ?? null,
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
