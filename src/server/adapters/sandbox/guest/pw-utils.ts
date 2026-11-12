import { modeRgb, useMode } from "culori/fn";
import { chunk, pick } from "es-toolkit";
import pLimit from "p-limit";
import { GUEST } from "@/server/adapters/sandbox/guest/guest.constants.ts";

/** A pw call's arguments, or one entry of its answer: plain data, an entry with its layer's id. */
type Args = Readonly<Record<string, unknown>>;
type Entry = { readonly id: string } & Args;

/** The pw functions utils call, as the sandbox gives them to the code. */
interface GuestPw {
  nodesFind(args: Args): Promise<{ readonly nodes: readonly Entry[]; readonly more: boolean }>;
  inspect(args: {
    readonly nodes: readonly string[];
    readonly file?: unknown;
  }): Promise<{ readonly layers: readonly Entry[] }>;
}

/** One element of pw.designRead's tree, or of utils.outlineTree's: its layer's id, tag, attributes, children. */
export interface TreeElement {
  readonly id: string;
  readonly tag: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly text?: string;
  readonly children: readonly TreeElement[];
}

/** Where walk is: the ancestors' names from the root, how deep, whether the element or an ancestor is hidden. */
interface Place {
  readonly path: readonly string[];
  readonly depth: number;
  readonly hidden: boolean;
}

type Visit = (element: TreeElement, place: Place) => unknown;

/** A colour's channels, 0-255, and its alpha, 0-1. */
interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** culori/fn parses only the modes registered: rgb reads hex, rgb() and rgba() in both syntaxes, names, transparent. */
const TO_RGB = useMode(modeRgb);

/**
 * The code's `utils` in the sandbox: what runs kept writing by hand over pw, each of its pw calls counted in the
 * run's limits like the code's own. esbuild bundles this file and its packages into one script (`pnpm build:pw`,
 * ../data/pw-utils.json), which the prelude evaluates; every helper is an arrow field, so `const { map } = utils` works.
 */
export class PwUtils {
  readonly #pw: GuestPw;

  constructor(pw: GuestPw) {
    this.#pw = pw;
  }

  /** pw.nodesFind(find), then pw.inspect of the ids found in batches, each find entry merged with its inspect fields. */
  readonly layers = async (find: Args = {}, { fields }: { readonly fields?: readonly string[] } = {}) => {
    const { nodes, more } = await this.#pw.nodesFind(find);
    const file = find.file === undefined ? {} : { file: find.file };
    const batches = chunk(
      nodes.map(({ id }) => id),
      GUEST.inspectBatch,
    );
    const answers = await this.map(batches, async (ids) => await this.#pw.inspect({ nodes: ids, ...file }));
    const inspected = new Map(
      answers
        .flatMap(({ layers }) => layers)
        .map((layer) => [layer.id, fields === undefined ? layer : pick(layer, fields)] as const),
    );

    return { layers: nodes.map((node) => ({ ...node, ...inspected.get(node.id) })), more };
  };

  /** mapper over items, at most limit at once (4 by default, as a run's pw calls), the answers in the items' order. */
  readonly map = async <Item, Answer>(
    items: Iterable<Item>,
    mapper: (item: Item, index: number) => Answer | PromiseLike<Answer>,
    { limit = GUEST.inFlight }: { readonly limit?: number } = {},
  ): Promise<Answer[]> => await pLimit(limit).map(items, mapper);

  /** items in arrays of size, the last one shorter. */
  readonly chunk = <Item>(items: readonly Item[], size: number): Item[][] => chunk(items, size);

  /** visit(element, { path, depth, hidden }) for each element of a tree, depth first from the root. */
  readonly walk = (tree: TreeElement | null, visit: Visit): void => {
    if (tree !== null) {
      this.#visit(tree, visit, { path: [], depth: 0, hidden: false });
    }
  };

  /** Every element of a tree that test passes, depth first, as walk visits them. */
  readonly find = (tree: TreeElement | null, test: Visit): TreeElement[] => {
    const found: TreeElement[] = [];

    this.walk(tree, (element, place) => {
      if (test(element, place)) {
        found.push(element);
      }
    });

    return found;
  };

  /** pw.outline's XML as a tree like pw.designRead's, each attribute a string, to walk or find in. */
  readonly outlineTree = (xml: string): TreeElement | null => {
    const roots: TreeElement[] = [];
    const open = [roots];

    for (const [, closing, tag = "", attributes = "", selfClosing] of xml.matchAll(GUEST.tag)) {
      if (closing === undefined) {
        const children: TreeElement[] = [];
        const named = this.#attributes(attributes);

        open.at(-1)?.push({ id: named.id ?? "", tag, attributes: named, children });

        if (selfClosing === undefined) {
          open.push(children);
        }
      } else {
        open.pop();
      }
    }

    return roots[0] ?? null;
  };

  /** A CSS colour as { r, g, b, a } (0-255, a 0-1), null when it is none; color.same compares two. */
  readonly color = Object.assign((value: string): Rgba | null => this.#rgba(value), {
    /** Whether two colours (CSS, or utils.color's) differ by at most tolerance on each 0-255 channel, alpha × 255. */
    same: (
      one: string | Rgba,
      other: string | Rgba,
      tolerance: number = GUEST.tolerance,
    ): boolean =>
      this.#same(one, other, tolerance),
  });

  #visit(
    element: TreeElement,
    visit: Visit,
    place: Place,
  ): void {
    const { display, hidden: flag, name } = element.attributes;
    const hidden = place.hidden || display === GUEST.hiddenDisplay || flag === GUEST.hiddenFlag;
    const path = [...place.path, name ?? element.tag];

    visit(element, { ...place, hidden });

    for (const child of element.children) {
      this.#visit(child, visit, { path, depth: place.depth + 1, hidden });
    }
  }

  #attributes(text: string): Record<string, string> {
    return Object.fromEntries(
      [...text.matchAll(GUEST.attribute)].map(([, name = "", value = ""]) => [name, this.#unescaped(value)]),
    );
  }

  /** An attribute's value as XmlEscape wrote it, its references read back. */
  #unescaped(value: string): string {
    return value.replace(GUEST.reference, (_reference, code: string | undefined, name: keyof typeof GUEST.named) =>
      code === undefined ? GUEST.named[name] : String.fromCodePoint(Number(code)),
    );
  }

  #rgba(value: string | Rgba): Rgba | null {
    if (typeof value !== "string") {
      return value;
    }

    const rgb = TO_RGB(value);

    return rgb === undefined
      ? null
      : { r: this.#channel(rgb.r), g: this.#channel(rgb.g), b: this.#channel(rgb.b), a: rgb.alpha ?? GUEST.opaque };
  }

  #channel(unit: number): number {
    return Math.round(unit * GUEST.channel);
  }

  #same(
    one: string | Rgba,
    other: string | Rgba,
    tolerance: number,
  ): boolean {
    const first = this.#rgba(one);
    const second = this.#rgba(other);

    if (first === null || second === null) {
      return false;
    }

    const alpha = Math.abs(first.a - second.a) * GUEST.channel;

    return (
      Math.max(Math.abs(first.r - second.r), Math.abs(first.g - second.g), Math.abs(first.b - second.b), alpha) <=
      tolerance
    );
  }
}
