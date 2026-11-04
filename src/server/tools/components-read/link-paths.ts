import { access } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { InjectionToken, injectable } from "@needle-di/core";
import { LINK_HOSTS, LINK_PATH } from "@/server/tools/components-read/components-read.constants.ts";

/**
 * The project file a Dev Mode link points at (T-192): a GitHub, GitLab or Bitbucket file link, its branch perhaps with
 * slashes (the longest end that is a project file wins), its line anchor dropped; or a vscode://file link inside the
 * project. Nothing for anything else, a file that is not there, or a path that would leave the project.
 */
@injectable()
export class LinkPaths {
  async of(url: string, root: string): Promise<string | undefined> {
    const parsed = this.#url(url);

    if (parsed === undefined) {
      return undefined;
    }

    if (parsed.protocol === LINK_PATH.editorProtocol && parsed.hostname === LINK_PATH.editorHost) {
      const path = this.#decoded(parsed.pathname);

      return path === undefined ? undefined : this.#editorPath(path, root);
    }

    const marker = LINK_HOSTS.find(({ host }) => host.test(parsed.hostname));

    return marker === undefined ? undefined : this.#repositoryPath(parsed.pathname, marker.after, root);
  }

  #url(url: string): URL | undefined {
    try {
      return new URL(url);
    } catch {
      return undefined;
    }
  }

  /** A file inside the project, from a vscode://file link's path, its :line:column dropped. */
  async #editorPath(path: string, root: string): Promise<string | undefined> {
    const file = path.replace(LINK_PATH.lineColumn, "");

    return isAbsolute(file) ? this.#projectFile(relative(root, file), root) : undefined;
  }

  /** The longest end of a file link's branch and path that is a file of the project. */
  async #repositoryPath(
    pathname: string,
    after: readonly string[],
    root: string,
  ): Promise<string | undefined> {
    const segments: string[] = [];

    for (const raw of pathname.split(LINK_PATH.separator)) {
      const segment = this.#decoded(raw);

      // A segment that does not decode, or decodes to a step up or a slash, names no file of the project.
      if (segment === undefined || segment === LINK_PATH.up || segment.includes(LINK_PATH.separator)) {
        return undefined;
      }

      if (segment !== "") {
        segments.push(segment);
      }
    }

    const at = segments.findIndex((_segment, index) =>
      after.every((marker, offset) => segments[index + offset] === marker),
    );
    // What follows is <branch>/<path>, the branch perhaps with slashes of its own: drop one segment at a time.
    const rest = at === -1 ? [] : segments.slice(at + after.length);

    for (let start = 1; start < rest.length; start += 1) {
      const found = await this.#projectFile(rest.slice(start).join(LINK_PATH.separator), root);

      if (found !== undefined) {
        return found;
      }
    }

    return undefined;
  }

  /** A path relative to the project as the project's file, when it stays inside and exists; with forward slashes. */
  async #projectFile(path: string, root: string): Promise<string | undefined> {
    const inside = relative(root, resolve(root, path));

    if (inside === "" || inside.startsWith(LINK_PATH.up) || isAbsolute(inside)) {
      return undefined;
    }

    return (await this.#exists(join(root, inside))) ? inside.split(sep).join(LINK_PATH.separator) : undefined;
  }

  /** A URL path decoded; undefined for one that does not decode (a lone %). */
  #decoded(path: string): string | undefined {
    try {
      return decodeURIComponent(path);
    } catch {
      return undefined;
    }
  }

  async #exists(path: string): Promise<boolean> {
    try {
      await access(path);

      return true;
    } catch {
      return false;
    }
  }
}

export const LINK_PATHS = new InjectionToken<LinkPaths>("LinkPaths");
