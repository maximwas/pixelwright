import type { DesignElement } from "../../design/tree.ts";

/**
 * The elements of a design tree by the values they use: how many use a token, or name a text style. The elements in
 * `skip` (and what is inside them) are not counted: a branch the comparison cannot pair.
 */
export class TokenUses {
  readonly #values: string[][] = [];
  readonly #textStyles: (string | undefined)[] = [];
  readonly #skip: ReadonlySet<string>;

  constructor(root: DesignElement | null, skip: ReadonlySet<string> = new Set()) {
    this.#skip = skip;

    if (root !== null) {
      this.#visit(root);
    }
  }

  /** How many elements use the token (in an attribute or a run), or name the text style. */
  count(token: string, textStyle?: string): number {
    const used = `var(${token})`;

    return this.#values.filter(
      (values, index) =>
        values.some((value) => value.includes(used)) ||
        (textStyle !== undefined && this.#textStyles[index] === textStyle),
    ).length;
  }

  #visit(element: DesignElement): void {
    const spans = (element.content ?? []).flatMap((piece) => (piece.kind === "span" ? piece.attributes : []));

    this.#values.push([...element.attributes, ...spans].map(([, value]) => value));
    this.#textStyles.push(element.attributes.find(([name]) => name === "textStyle")?.[1]);

    for (const child of element.children.filter(({ id }) => !this.#skip.has(id))) {
      this.#visit(child);
    }
  }
}
