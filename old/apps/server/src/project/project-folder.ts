import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The roots the MCP client lists (roots/list), or null when it gives none. */
export type RootsSource = () => Promise<readonly { readonly uri: string }[] | null>;

/**
 * The session's project folder, where a relative path a tool takes starts: the first file root the MCP client gives,
 * else the fallback (CLAUDE_PROJECT_DIR, else the server's working directory).
 */
export class ProjectFolder {
  readonly #fallback: string;
  #roots: RootsSource | null = null;
  #root: Promise<string> | null = null;

  constructor(fallback: string) {
    this.#fallback = fallback;
  }

  /** Asks the client for its roots from now on: the MCP server hands over how, once it can ask. */
  askRoots(roots: RootsSource): void {
    this.#roots = roots;
    this.#root = null;
  }

  /** The client's roots changed: they are asked again for the next path. */
  forget(): void {
    this.#root = null;
  }

  /** The folder itself, asked of the client once until its roots change. */
  root(): Promise<string> {
    this.#root ??= this.#asked();

    return this.#root;
  }

  /** A path a tool was given, absolute: a relative one from the project folder, an absolute one as it is. */
  async resolve(path: string): Promise<string> {
    return isAbsolute(path) ? resolve(path) : resolve(await this.root(), path);
  }

  async #asked(): Promise<string> {
    // A client that cannot list its roots gives none.
    const roots = (await this.#roots?.().catch(() => null)) ?? [];

    for (const { uri } of roots) {
      try {
        return fileURLToPath(uri);
      } catch {
        // Not a folder on this machine (an https root, a file URL with a host): the next one may be.
      }
    }

    return this.#fallback;
  }
}
