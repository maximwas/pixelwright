/** A getEnum call: the instance it read, the property by the name Figma shows, and the values its mapping names. */
export interface EnumRead {
  readonly node: string;
  readonly property: string;
  readonly mapped: readonly string[];
}

/** The properties one render's code read, by instance id (the instance and every nested one it reached). */
export class PropertyReads {
  readonly enums: EnumRead[] = [];
  readonly #read = new Map<string, Set<string>>();

  read(node: string, property: string): void {
    this.#read.set(node, (this.#read.get(node) ?? new Set()).add(property));
  }

  readEnum(node: string, property: string, mapping: Readonly<Record<string, unknown>>): void {
    this.read(node, property);
    this.enums.push({
      node,
      property,
      mapped: Object.keys(mapping),
    });
  }

  has(node: string, property: string): boolean {
    return this.#read.get(node)?.has(property) ?? false;
  }
}
