import { InjectionToken, inject, injectable } from "@needle-di/core";
import { type NumberedStyle, STYLE_NUMBERS_READER } from "@/core/tokens/names/style-numbers.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { REFERENCE_FIELD } from "@/plugin/adapters/figma/layer-read/layer-read.constants.ts";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import type { ReadLayer } from "@/shared/read-model/layer.schema.ts";
import { READ_VALUE } from "@/shared/read-model/read-model.constants.ts";
import type { ReadModel } from "@/shared/read-model/read-model.schema.ts";

type Tables = Pick<ReadModel, "styles" | "variables">;

type Style = ReadModel["styles"][string];

type ReadVariable = ReadModel["variables"][string];

/** What a read's entries refer to: style ids, and each variable's id with the first layer that uses it. */
interface Found {
  readonly styles: Set<string>;
  readonly variables: Map<string, string>;
}

/**
 * The styles and variables a read uses (T-163, FX-015): gathered from its entries in reading order (the order token
 * hints rely on), each looked up once by id, one Figma cannot give left out. Same-named styles are numbered by
 * StyleNumbers (D-29) among the file's own and, once a library style is used, the styles the read's page uses too,
 * as every reader numbers them. A variable's value is the one its first layer sees.
 */
@injectable()
export class References {
  readonly #lookup;
  readonly #numbers;
  readonly #walk;

  constructor(
    lookup = inject(NODE_LOOKUP),
    numbers = inject(STYLE_NUMBERS_READER),
    walk = inject(LAYER_WALK),
  ) {
    this.#lookup = lookup;
    this.#numbers = numbers;
    this.#walk = walk;
  }

  /** The tables of one read: `root` its entry, `node` the layer it was read from. */
  async tables(root: ReadLayer, node: SceneNode): Promise<Tables> {
    const found: Found = { styles: new Set(), variables: new Map() };

    this.#layer(root, found);

    return { styles: await this.#styles(found.styles, node), variables: await this.#variables(found.variables, node) };
  }

  #layer(layer: ReadLayer, found: Found): void {
    for (const [key, value] of Object.entries(layer)) {
      if (key === REFERENCE_FIELD.children) {
        for (const child of layer.children ?? []) {
          this.#layer(child, found);
        }
      } else {
        this.#field(key, value, layer.id, found);
      }
    }
  }

  /** A style a field names, or the aliases and styles its value holds (paints, effects, a text's runs). */
  #field(
    key: string,
    value: unknown,
    consumer: string,
    found: Found,
  ): void {
    if (key === REFERENCE_FIELD.inferred) {
      // Figma's own matches (C-153) name variables by id: they join the read's variables like aliases.
      for (const id of Object.values(value ?? {})) {
        found.variables.set(String(id), found.variables.get(String(id)) ?? consumer);
      }
    } else if (!key.endsWith(REFERENCE_FIELD.styleIdSuffix)) {
      if (!REFERENCE_FIELD.plainFields.includes(key)) {
        this.#value(value, consumer, found);
      }
    } else if (typeof value === "string" && value !== "" && value !== READ_VALUE.mixed) {
      found.styles.add(value);
    }
  }

  #value(
    value: unknown,
    consumer: string,
    found: Found,
  ): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        this.#value(item, consumer, found);
      }
    } else if (typeof value === "object" && value !== null) {
      if ("type" in value && value.type === REFERENCE_FIELD.alias && "id" in value && typeof value.id === "string") {
        found.variables.set(value.id, found.variables.get(value.id) ?? consumer);
      } else {
        for (const [key, item] of Object.entries(value)) {
          this.#field(key, item, consumer, found);
        }
      }
    }
  }

  async #styles(ids: ReadonlySet<string>, node: SceneNode): Promise<Tables["styles"]> {
    const used = (await Promise.all([...ids].map((id) => this.#lookup.style(id)))).filter((style) => style !== null);

    if (used.length === 0) {
      return {};
    }

    const page = used.some((style) => style.remote) ? this.#lookup.pageOf(node) : null;
    const numbers = this.#numbers.numbers([...(await this.#numbering(page)), ...used]);

    return Object.fromEntries(
      used.map((style) => {
        const number = numbers.get(style.id) ?? REFERENCE_FIELD.firstNumber;

        return [
          style.id,
          { ...this.#style(style), ...(number > REFERENCE_FIELD.firstNumber ? { duplicate: number } : {}) },
        ];
      }),
    );
  }

  /**
   * What same-named styles are numbered among: the file's own, and with a page the styles its layers use (a library's).
   * shortcut: the page walk has no deadline and skips a text's runs; give it LayerWalk's deadline if big pages stall.
   */
  async #numbering(page: PageNode | null): Promise<NumberedStyle[]> {
    const own: NumberedStyle[] = [
      ...(await figma.getLocalPaintStylesAsync()),
      ...(await figma.getLocalTextStylesAsync()),
      ...(await figma.getLocalEffectStylesAsync()),
    ];

    if (page === null) {
      return own;
    }

    await page.loadAsync();

    const known = new Set(own.map((style) => style.id));
    const ids = new Set<string>();

    for (const layer of this.#walk.layers(page.children)) {
      for (const field of REFERENCE_FIELD.styleFields) {
        const id: unknown = Reflect.get(layer, field);

        if (typeof id === "string" && id !== "" && !known.has(id)) {
          ids.add(id);
        }
      }
    }

    const library = await Promise.all([...ids].map((id) => this.#lookup.style(id)));

    return [...own, ...library.filter((style) => style !== null)];
  }

  /** A style as the model carries it: its name, and its value for the tokens. */
  #style(style: BaseStyle): Style {
    const base = { name: style.name, type: style.type, remote: style.remote };

    if (style.type === REFERENCE_FIELD.paint) {
      return { ...base, paints: this.#plain(style.paints) };
    }

    if (style.type === REFERENCE_FIELD.effect) {
      return { ...base, effects: this.#plain(style.effects) };
    }

    if (style.type !== REFERENCE_FIELD.text) {
      return base;
    }

    return {
      ...base,
      fontName: { ...style.fontName },
      fontSize: style.fontSize,
      lineHeight: this.#plain(style.lineHeight),
      letterSpacing: this.#plain(style.letterSpacing),
      textCase: style.textCase,
      textDecoration: style.textDecoration,
    };
  }

  async #variables(used: ReadonlyMap<string, string>, node: SceneNode): Promise<Tables["variables"]> {
    const read = await Promise.all(
      [...used].map(async ([id, consumer]) => ({ id, variable: await this.#variable(id, consumer, node) })),
    );

    return Object.fromEntries(read.flatMap(({ id, variable }) => (variable === null ? [] : [[id, variable]])));
  }

  async #variable(
    id: string,
    consumer: string,
    node: SceneNode,
  ): Promise<ReadVariable | null> {
    const variable = await this.#lookup.variable(id);

    if (variable === null) {
      return null;
    }

    const collection = await this.#lookup.collection(variable.variableCollectionId);
    const layer = consumer === node.id ? node : await this.#lookup.node(consumer).catch(() => null);
    const value = this.#resolved(variable, layer);
    const syntax = Object.entries(variable.codeSyntax);

    return {
      name: variable.name,
      collection: collection?.name ?? "",
      resolvedType: variable.resolvedType,
      remote: variable.remote,
      ...(value === undefined ? {} : { value }),
      ...(syntax.length > 0 ? { codeSyntax: Object.fromEntries(syntax) } : {}),
    };
  }

  /** The variable's value for the layer; none when Figma cannot resolve it there (a mode the layer does not have). */
  #resolved(variable: Variable, layer: BaseNode | null): unknown {
    if (layer === null || layer.type === FIGMA_NODE_TYPE.document || layer.type === FIGMA_NODE_TYPE.page) {
      return undefined;
    }

    try {
      return this.#plain(variable.resolveForConsumer(layer).value);
    } catch {
      return undefined;
    }
  }

  /** Plugin API values are frozen objects with readonly arrays: a JSON copy is what goes on the wire anyway. */
  #plain<Value>(value: unknown): Value {
    return JSON.parse(JSON.stringify(value));
  }
}

export const REFERENCES = new InjectionToken<References>("References");
