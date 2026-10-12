import type { SnapshotNode } from "@pixelwright/core";
import type { ResultSection } from "../types/code-connect.ts";
import { sectionsOf } from "./sections.ts";
import { TemplateError } from "./template-error.ts";

/** What handles need from the run they belong to. */
export interface Runner {
  /** Whether a template connects this instance. */
  connected(node: SnapshotNode): boolean;
  /** The instance's template run, as one nested-instance section (or an error section); none without a template. */
  example(node: SnapshotNode): { sections: ResultSection[]; metadata: Record<string, unknown> };
  /** The `id` the instance's template exports, or null. */
  connectedId(node: SnapshotNode): string | null;
}

interface SelectorOptions {
  path?: string[];
  traverseInstances?: boolean;
}

type Property = NonNullable<SnapshotNode["instance"]>["properties"][string];

/** A layer a find did not find, or a property the instance lacks: an error only where the template renders it. */
export class ErrorHandle {
  readonly type = "ERROR";
  readonly message: string;

  constructor(code: string, detail: string) {
    this.message = `${code}: ${detail}`;
  }

  __render__(): ResultSection[] {
    return [
      {
        type: "ERROR",
        message: this.message,
      },
    ];
  }

  executeTemplate() {
    return { example: this.__render__() };
  }
}

/** A text layer inside an instance. */
export class TextHandle {
  readonly type = "TEXT";
  readonly #node: SnapshotNode;

  constructor(node: SnapshotNode) {
    this.#node = node;
  }

  get name(): string {
    return this.#node.name;
  }

  get textContent(): string {
    return this.#node.text?.characters ?? "";
  }

  __render__(): string {
    return this.textContent;
  }
}

/**
 * An instance as Figma's Template API gives it (figma-types.d.ts InstanceHandle), over the layers design_read read:
 * its properties by the names Figma shows (without the #id suffix), the layers inside it found by name, its own
 * template run on request. Hidden layers are not found; finds stay out of nested instances unless asked.
 */
export class InstanceHandle {
  readonly type = "INSTANCE";
  readonly #node: SnapshotNode;
  readonly #run: Runner;
  readonly __properties__;

  constructor(node: SnapshotNode, run: Runner) {
    this.#node = node;
    this.#run = run;
    this.__properties__ = {
      string: (name: string) => this.getString(name),
      boolean: (name: string, mapping?: Record<string, unknown>) => this.getBoolean(name, mapping),
      enum: (name: string, mapping: Record<string, unknown>) => this.getEnum(name, mapping),
      instance: (name: string) => {
        const swapped = this.getInstanceSwap(name);

        return swapped === undefined ? undefined : swapped.__render__();
      },
      __instance__: (name: string) => this.getInstanceSwap(name),
      slot: (name: string) => this.getSlot(name),
      children: (names: string[]) => names.flatMap((name) => sectionsOf(this.findInstance(name))),
    };
  }

  get id(): string {
    return this.#node.id;
  }

  get symbolId(): string {
    return this.#node.instance?.componentId ?? "";
  }

  get name(): string {
    return this.#node.name;
  }

  get properties(): Record<string, { value: string | boolean }> {
    return Object.fromEntries(
      Object.entries(this.#node.instance?.properties ?? {}).map(([name, property]) => [
        bare(name),
        { value: property.value },
      ]),
    );
  }

  get children(): (InstanceHandle | TextHandle)[] {
    return this.#layers({}).flatMap(({ node }) => this.#handle(node) ?? []);
  }

  codeConnectId(): string | null {
    return this.#run.connectedId(this.#node);
  }

  hasCodeConnect(): boolean {
    return this.#run.connected(this.#node);
  }

  getString(name: string): string {
    return String(this.#property(name).value);
  }

  getBoolean(name: string, mapping?: Record<string, unknown>): unknown {
    const { value } = this.#property(name);
    const on = typeof value === "boolean" ? value : value.toLowerCase() === "true";

    return mapping === undefined ? on : mapping[String(on)];
  }

  getEnum(name: string, mapping: Record<string, unknown>): unknown {
    return mapping[String(this.#property(name).value)];
  }

  getPropertyValue(name: string): string | boolean | ErrorHandle {
    const property = this.#find(name);

    return property === null ? this.#missing(name) : property.value;
  }

  /** The nested instance an instance-swap property put in, found by its component; undefined when none shows. */
  getInstanceSwap(name: string): InstanceHandle | ErrorHandle | undefined {
    const property = this.#find(name);

    if (property === null) {
      return this.#missing(name);
    }

    const swapped = this.#layers({}).find(({ node }) => node.instance?.componentId === property.value);

    return swapped === undefined ? undefined : new InstanceHandle(swapped.node, this.#run);
  }

  /** A slot's content: the layer named after the slot property, its instances rendered and listed. */
  getSlot(name: string) {
    const slot = this.#layers({}).find(({ node }) => node.type === "SLOT" && node.name === bare(name));

    if (slot === undefined) {
      return undefined;
    }

    const instances = (slot.node.children ?? [])
      .filter((child) => child.visible && child.type === "INSTANCE")
      .map((child) => new InstanceHandle(child, this.#run));

    return Object.assign(
      instances.flatMap((instance) => instance.__render__()),
      { connectedInstances: instances.filter((instance) => instance.hasCodeConnect()) },
    );
  }

  findInstance(name: string, options: SelectorOptions = {}): InstanceHandle | ErrorHandle {
    const found = this.#layers(options).find(({ node }) => node.type === "INSTANCE" && node.name === name);

    return found === undefined ? this.#notFound("instance", name) : new InstanceHandle(found.node, this.#run);
  }

  findText(name: string, options: SelectorOptions = {}): TextHandle | ErrorHandle {
    const found = this.#layers(options).find(({ node }) => node.type === "TEXT" && node.name === name);

    return found === undefined ? this.#notFound("text", name) : new TextHandle(found.node);
  }

  findConnectedInstance(id: string, options: SelectorOptions = {}): InstanceHandle | null {
    return this.findConnectedInstances((instance) => instance.codeConnectId() === id, options)[0] ?? null;
  }

  findConnectedInstances(test: (instance: InstanceHandle) => boolean, options: SelectorOptions = {}): InstanceHandle[] {
    return this.#layers(options)
      .filter(({ node }) => node.type === "INSTANCE" && this.#run.connected(node))
      .map(({ node }) => new InstanceHandle(node, this.#run))
      .filter((instance) => test(instance));
  }

  findLayers(
    test: (layer: InstanceHandle | TextHandle) => boolean,
    options: SelectorOptions = {},
  ): (InstanceHandle | TextHandle)[] {
    return this.#layers(options)
      .flatMap(({ node }) => this.#handle(node) ?? [])
      .filter((layer) => test(layer));
  }

  executeTemplate(): { example: ResultSection[]; metadata?: unknown } {
    const { sections, metadata } = this.#run.example(this.#node);

    return metadata === undefined
      ? { example: sections }
      : {
          example: sections,
          metadata,
        };
  }

  __render__(): ResultSection[] {
    return this.#run.example(this.#node).sections;
  }

  // What templates `npx figma connect migrate` writes call.
  __find__(name: string): InstanceHandle | ErrorHandle {
    return this.findInstance(name);
  }

  __findChildWithCriteria__({ type, name }: { type: "INSTANCE" | "TEXT"; name: string }) {
    return type === "TEXT" ? this.findText(name) : this.findInstance(name);
  }

  __getPropertyValue__(name: string): string | boolean | ErrorHandle {
    return this.getPropertyValue(name);
  }

  __getPropertyValueByType__(name: string, type: string): string | boolean | ErrorHandle {
    const property = this.#find(name);

    return property === null || property.type !== type ? this.#missing(name) : property.value;
  }

  __getProps__(): unknown {
    return this.hasCodeConnect() ? this.#run.example(this.#node).metadata.__props : undefined;
  }

  /** The instance rendered by a function of its template's props (Figma's React parser writes such templates). */
  __renderWithFn__(render: (props: unknown) => unknown): ResultSection[] | undefined {
    const props = this.__getProps__();

    return props === undefined ? undefined : sectionsOf(render(props));
  }

  #handle(node: SnapshotNode): InstanceHandle | TextHandle | null {
    return node.type === "INSTANCE"
      ? new InstanceHandle(node, this.#run)
      : node.type === "TEXT"
        ? new TextHandle(node)
        : null;
  }

  #find(name: string): Property | null {
    const properties = Object.entries(this.#node.instance?.properties ?? {});

    return (properties.find(([key]) => key === name) ?? properties.find(([key]) => bare(key) === name))?.[1] ?? null;
  }

  #property(name: string): Property {
    const property = this.#find(name);

    if (property === null) {
      throw new TemplateError("PROPERTY_NOT_FOUND", this.#lacks(name));
    }

    return property;
  }

  #missing(name: string): ErrorHandle {
    return new ErrorHandle("PROPERTY_NOT_FOUND", this.#lacks(name));
  }

  #lacks(name: string): string {
    const names = Object.keys(this.properties);

    return `${this.#node.name} (${this.#node.id}) has no property ${name}${names.length === 0 ? "" : `; it has ${names.join(", ")}`}.`;
  }

  #notFound(kind: string, name: string): ErrorHandle {
    return new ErrorHandle(
      "CHILD_LAYER_NOT_FOUND",
      `no ${kind} layer named ${name} in ${this.#node.name} (${this.#node.id}).`,
    );
  }

  /**
   * The visible layers inside the instance, in layer order, each with the instances it sits in (outer first). Nested
   * instances are entered only with traverseInstances, or along `path`: the instances a layer must sit in, exactly.
   */
  #layers({ path, traverseInstances = false }: SelectorOptions): { node: SnapshotNode; within: string[] }[] {
    const found: { node: SnapshotNode; within: string[] }[] = [];
    const walk = (node: SnapshotNode, within: string[]) => {
      for (const child of node.children ?? []) {
        if (!child.visible) {
          continue;
        }

        found.push({
          node: child,
          within,
        });

        if (child.type === "INSTANCE") {
          const deeper = [...within, child.name];

          if (
            traverseInstances ||
            (path !== undefined && path.slice(0, deeper.length).join("\n") === deeper.join("\n"))
          ) {
            walk(child, deeper);
          }
        } else {
          walk(child, within);
        }
      }
    };

    walk(this.#node, []);

    return path === undefined ? found : found.filter(({ within }) => within.join("\n") === path.join("\n"));
  }
}

/** A property's name as Figma shows it: TEXT, BOOLEAN and INSTANCE_SWAP keys end in #<id>. */
function bare(name: string): string {
  const hash = name.lastIndexOf("#");

  return hash === -1 ? name : name.slice(0, hash);
}
