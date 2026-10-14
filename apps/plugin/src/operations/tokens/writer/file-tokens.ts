import {
  type RawTokens,
  type StyleToken,
  type TokenModel,
  type TokensPlan,
  type TokenVariable,
  tokenModel,
} from "@pixelwright/core";
import { libraryCollectionNames } from "../../../figma/tokens/libraries.ts";
import { tokensOfOtherPages, tokensUnder } from "../../../figma/tokens/raw-tokens-builder.ts";

type RawCollection = RawTokens["collections"][number];
type RawVariable = RawTokens["variables"][number];
type StyleKind = keyof TokensPlan["styles"];

/**
 * What the file holds, as tokens_read sees it: the tokens as Figma keeps them, their model (what "already holds" is
 * judged by: the CSS tokens_read would write), and the enabled libraries' collection names, so a library's token is
 * never taken for a new one.
 */
export class FileTokens {
  readonly raw: RawTokens;
  readonly model: TokenModel;
  readonly #libraryCollections: ReadonlySet<string>;

  private constructor(raw: RawTokens, libraryCollections: ReadonlySet<string>) {
    this.raw = raw;
    this.model = tokenModel(raw);
    this.#libraryCollections = libraryCollections;
  }

  /**
   * The tokens the current page uses; when the plan names a collection or style it does not show, also those the other
   * pages use (a library's may be used only there) and the libraries' collection names.
   */
  static async read(plan: TokensPlan): Promise<FileTokens> {
    const raw = await tokensUnder(figma.currentPage);

    if (shows(raw, plan)) {
      return new FileTokens(raw, new Set());
    }

    for (const page of await tokensOfOtherPages()) {
      merge(raw, page);
    }

    return new FileTokens(raw, await libraryCollectionNames());
  }

  /** The file's own collection of that name. */
  localCollection(name: string): RawCollection | undefined {
    return this.raw.collections.find((collection) => collection.name === name && !collection.remote);
  }

  /** Whether a collection of that name comes from a library: one the file uses, or an enabled library's. */
  isLibraryCollection(name: string): boolean {
    return (
      this.raw.collections.some((collection) => collection.name === name && collection.remote) ||
      this.#libraryCollections.has(name)
    );
  }

  /** The variable the collection holds by that name. */
  heldVariable(collection: RawCollection, name: string): RawVariable | undefined {
    return this.raw.variables.find((variable) => variable.collectionId === collection.id && variable.name === name);
  }

  /** A variable as tokens_read shows it, by collection and name. */
  shownVariable(collection: string, name: string): TokenVariable | undefined {
    return this.model.collections
      .find((item) => item.name === collection)
      ?.variables.find((item) => item.name === name);
  }

  /** A style as tokens_read shows it, by kind and name. */
  shownStyle(kind: StyleKind, name: string): StyleToken | undefined {
    return this.model.styles[kind].find((style) => style.name === name);
  }

  /** Whether a style of that kind and name the file uses comes from a library. */
  isLibraryStyle(kind: StyleKind, name: string): boolean {
    return this.raw.styles.some((style) => style.remote && style.name === name && style.type === kind.toUpperCase());
  }
}

/** Whether the tokens show every collection and style the plan names. */
function shows(raw: RawTokens, plan: TokensPlan): boolean {
  const kinds = ["paint", "text", "effect"] as const;

  return (
    plan.collections.every((collection) => raw.collections.some((item) => item.name === collection.name)) &&
    kinds.every((kind) =>
      plan.styles[kind].every((style) =>
        raw.styles.some((item) => item.name === style.name && item.type === kind.toUpperCase()),
      ),
    )
  );
}

/** Adds another page's tokens the first holds none of. */
function merge(into: RawTokens, more: RawTokens): void {
  const missing = <T extends { id: string }>(held: readonly T[], extra: readonly T[]) =>
    extra.filter((item) => !held.some((other) => other.id === item.id));

  into.collections.push(...missing(into.collections, more.collections));
  into.variables.push(...missing(into.variables, more.variables));
  into.styles.push(...missing(into.styles, more.styles));
  Object.assign(into.external, more.external);
}
