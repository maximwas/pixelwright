/**
 * What the instances of a read override, by the overridden layer's id. A read goes from the top down, so an instance
 * records its list before its layers are read; a read that starts inside an instance takes the lists of the instances
 * above it first.
 */
export class InstanceOverrides {
  readonly #fields = new Map<string, string[]>();

  /** Ready for a read of this layer: what every instance above it overrides is known. */
  static around(root: BaseNode): InstanceOverrides {
    const overrides = new InstanceOverrides();
    const above: BaseNode[] = [];

    for (let current = root.parent; current !== null; current = current.parent) {
      above.push(current);
    }

    for (const node of above.toReversed()) {
      overrides.record(node);
    }

    return overrides;
  }

  /** Records what an instance overrides: its own layers' fields, and its inner instances' layers' too. */
  record(node: BaseNode): void {
    if (node.type !== "INSTANCE" || !Array.isArray(node.overrides)) {
      return;
    }

    for (const { id, overriddenFields } of node.overrides) {
      this.#fields.set(id, [...new Set([...(this.#fields.get(id) ?? []), ...overriddenFields])]);
    }
  }

  /** What the recorded instances override on this layer, the fields a component property carries left out. */
  on(node: SceneNode): string[] {
    const bound = new Set(
      Object.keys(("componentPropertyReferences" in node ? node.componentPropertyReferences : null) ?? {}),
    );

    return (this.#fields.get(node.id) ?? []).filter((field) => !bound.has(field));
  }
}
