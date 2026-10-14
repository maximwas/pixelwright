import type { SnapshotNode } from "../../types/snapshot.ts";
import type { EntriesRead } from "../schemas.ts";
import type { LayerEntry, ReadTokens } from "../types.ts";

/** The layers a call read, by id with their parents; the ids the file does not hold; the tokens they came with. */
export class CurrentLayers {
  readonly tokens: ReadTokens;
  readonly #entries: ReadonlyMap<string, LayerEntry>;
  readonly #missing: ReadonlySet<string>;

  constructor(entries: ReadonlyMap<string, LayerEntry>, missing: ReadonlySet<string>, tokens: ReadTokens) {
    this.#entries = entries;
    this.#missing = missing;
    this.tokens = tokens;
  }

  /** Nothing read: a call that names no layer. */
  static none(): CurrentLayers {
    return new CurrentLayers(new Map(), new Set(), {
      styles: {},
      variables: {},
    });
  }

  /** The plugin's entries: each root read with its layers, by id. */
  static of(read: EntriesRead): CurrentLayers {
    const entries = new Map<string, LayerEntry>();

    for (const root of read.roots) {
      index(root.node, root.parent, entries);
    }

    return new CurrentLayers(entries, new Set(read.missing), {
      styles: read.styles,
      variables: read.variables,
      ...(read.colorProfile === undefined ? {} : { colorProfile: read.colorProfile }),
    });
  }

  entry(id: string): LayerEntry | undefined {
    return this.#entries.get(id);
  }

  /** Whether the file said it does not hold this id. */
  isMissing(id: string): boolean {
    return this.#missing.has(id);
  }
}

function index(node: SnapshotNode, parent: SnapshotNode | null, entries: Map<string, LayerEntry>): void {
  entries.set(node.id, {
    node,
    parent,
  });

  for (const child of node.children ?? []) {
    index(child, node, entries);
  }
}
