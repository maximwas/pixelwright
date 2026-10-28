import { homedir } from "node:os";
import { isAbsolute, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { InjectionToken, inject, injectable } from "@needle-di/core";
import { CLIENT_ROOTS } from "@/core/ports/client-roots.port.ts";
import { PROJECT_TEXT } from "@/server/app/project/project.constants.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/**
 * The one resolver every path a tool takes goes through (T-008, A§8): a relative path starts in the project folder,
 * the MCP client's first file root, else CLAUDE_PROJECT_DIR, else the server's working directory. The home folder and
 * the file system's root are never one (S-081): a relative path there is refused, an absolute one still resolves.
 */
@injectable()
export class ProjectFolder {
  readonly #roots;
  readonly #fallback;

  constructor(roots = inject(CLIENT_ROOTS), fallback = inject(PROJECT_FALLBACK)) {
    this.#roots = roots;
    this.#fallback = fallback;
  }

  /** A path a tool was given, absolute: a relative one from the project folder, an absolute one as it is. */
  async resolve(path: string): Promise<string> {
    return isAbsolute(path) ? resolve(path) : resolve(await this.root(), path);
  }

  /** The project folder itself; the client's roots are asked as McpRoots caches them. */
  async root(): Promise<string> {
    const folder = resolve(this.#fileRoot(await this.#roots.uris()) ?? this.#fallback);

    if (folder === homedir() || folder === parse(folder).root) {
      throw new PixelwrightError(ERROR_CODE.opFailed, PROJECT_TEXT.noProject(folder));
    }

    return folder;
  }

  /** The first root that is a folder on this machine: an https root, or a file URL with a host, is skipped. */
  #fileRoot(uris: readonly string[]): string | null {
    for (const uri of uris) {
      try {
        return fileURLToPath(uri);
      } catch {
        // Not a folder here: the next root may be.
      }
    }

    return null;
  }
}

export const PROJECT_FOLDER = new InjectionToken<ProjectFolder>("ProjectFolder");

/** Where relative paths start when the client lists no file root: CLAUDE_PROJECT_DIR, else the server's cwd. */
export const PROJECT_FALLBACK = new InjectionToken<string>("ProjectFallback");
