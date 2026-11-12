import type { SnapshotNode } from "@pixelwright/core";
import type { ConnectionIndex, MatchRule } from "../../code-connect/connection-index.ts";
import type { SnapshotInstance, TemplateFile } from "../../types/code-connect.ts";

/** What one connection matched in the read: instances by component and the rule that matched, and the first one. */
export interface TemplateMatches {
  readonly counts: Map<string, { component: string; instances: number; by: MatchRule }>;
  readonly first: SnapshotNode;
}

/** A component shown in the read that no connection connects: what a new one needs to name it. */
export interface Unconnected {
  readonly component: string;
  instances: number;
  readonly id: string;
  readonly key?: string;
  readonly remote?: true;
}

/**
 * The visible instances of a read as design_read shows them: each connected one with its connection, its layers left
 * out (its code holds them), save for the read's own layer; the ones no connection connects by component.
 */
export class TemplateUses {
  readonly matched = new Map<TemplateFile, TemplateMatches>();
  /** The components no connection connects, by the set's or component's id. */
  readonly unconnected = new Map<string, Unconnected>();
  /** A visible layer was read without all its children. */
  cut = false;
  readonly #connections: ConnectionIndex;

  constructor(connections: ConnectionIndex) {
    this.#connections = connections;
  }

  visit(layer: SnapshotNode, root = true): void {
    if (!layer.visible) {
      return;
    }

    this.cut ||= layer.childCount > (layer.children?.length ?? 0);

    const connected = layer.instance !== undefined && this.#count(layer, layer.instance);

    if (connected && !root) {
      return;
    }

    for (const child of layer.children ?? []) {
      this.visit(child, false);
    }
  }

  /** Counts an instance under its connection, or as unconnected; whether a connection connects it. */
  #count(layer: SnapshotNode, instance: SnapshotInstance): boolean {
    const name = instance.setName ?? instance.componentName;
    const match = this.#connections.match(instance);

    if (match === null) {
      this.#unconnected(name, instance);

      return false;
    }

    const entry = this.matched.get(match.template) ?? {
      counts: new Map(),
      first: layer,
    };
    // One component name can match two ways (this file's by its id, a library's by its name): each counted apart.
    const key = `${name}\n${match.by}`;

    entry.counts.set(key, {
      component: name,
      instances: (entry.counts.get(key)?.instances ?? 0) + 1,
      by: match.by,
    });
    this.matched.set(match.template, entry);

    return true;
  }

  #unconnected(name: string, instance: SnapshotInstance): void {
    const id = instance.setId ?? instance.componentId;
    const found = this.unconnected.get(id);

    if (found !== undefined) {
      found.instances += 1;

      return;
    }

    // A variant's own key would match that variant alone: a set is named by the set's key, when the read has it.
    const key = instance.setId === undefined ? instance.componentKey : instance.setKey;

    this.unconnected.set(id, {
      component: name,
      instances: 1,
      id,
      ...(key === undefined ? {} : { key }),
      ...(instance.remote ? { remote: true as const } : {}),
    });
  }
}
