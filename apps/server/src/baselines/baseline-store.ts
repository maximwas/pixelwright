import { mkdir, readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { type BaselineFile, BridgeError, baselineFileOf } from "@pixelwright/core";
import writeFileAtomic from "write-file-atomic";
import { errorMessage } from "../utils/error-message.ts";
import { BASELINES_DIR } from "./constants.ts";

/** A baseline in the project: its file, or why it cannot be read. */
export type StoredBaseline = { readonly name: string; readonly path: string } & (
  | { readonly file: BaselineFile }
  | { readonly error: string }
);

/** The project's baselines: one JSON file each, named after the code built from it. */
export interface BaselineStore {
  /** The folder baselines live in; refused for the home folder and the disk's root, which are no project. */
  folder(): string;
  pathOf(name: string): string;
  /** Every baseline by name, the unreadable ones with why. */
  list(): Promise<StoredBaseline[]>;
  /** One baseline; null when the project has none of that name; an error naming the file when it cannot be read. */
  read(name: string): Promise<BaselineFile | null>;
  /** Writes a baseline whole or not at all, and says when it made the folder first. */
  write(file: BaselineFile): Promise<{ path: string; madeFolder: boolean }>;
}

/** Baselines in `<project>/.pixelwright/baselines`. */
export function folderBaselines(project: string): BaselineStore {
  const folder = () => {
    if ([homedir(), "/"].includes(resolve(project))) {
      throw new BridgeError(
        "OP_FAILED",
        `${project} is no project folder, so baselines have nowhere to live: start the MCP client in the project, or set CLAUDE_PROJECT_DIR.`,
      );
    }

    return join(project, BASELINES_DIR);
  };
  const pathOf = (name: string) => join(folder(), `${name}.json`);

  return {
    folder,
    pathOf,
    list: async () => {
      const names = (await readdir(folder()).catch(() => []))
        .filter((entry) => entry.endsWith(".json"))
        .map((entry) => entry.slice(0, -".json".length))
        .sort();

      return Promise.all(names.map((name) => stored(name, pathOf(name))));
    },
    read: async (name) => {
      const found = await stored(name, pathOf(name));

      if ("error" in found) {
        if (found.error === MISSING) {
          return null;
        }

        throw new BridgeError("OP_FAILED", `${found.path} cannot be read: ${found.error}`);
      }

      return found.file;
    },
    write: async (file) => {
      const made = await mkdir(folder(), { recursive: true });
      const path = pathOf(file.name);

      await writeFileAtomic(path, serialized(file));

      return {
        path,
        madeFolder: made !== undefined,
      };
    },
  };
}

/** Baselines kept while the process runs, in a folder that is only a name: for tests. */
export function memoryBaselines(
  folder = "/project/.pixelwright/baselines",
): BaselineStore & { files: Map<string, string> } {
  const files = new Map<string, string>();
  const pathOf = (name: string) => `${folder}/${name}.json`;

  return {
    files,
    folder: () => folder,
    pathOf,
    list: async () =>
      [...files.keys()].sort().map((name) => {
        try {
          return {
            name,
            path: pathOf(name),
            file: baselineFileOf(JSON.parse(files.get(name) ?? "")),
          };
        } catch (error) {
          return {
            name,
            path: pathOf(name),
            error: errorMessage(error),
          };
        }
      }),
    read: async (name) => {
      const text = files.get(name);

      return text === undefined ? null : baselineFileOf(JSON.parse(text));
    },
    write: async (file) => {
      const madeFolder = files.size === 0;

      files.set(file.name, serialized(file));

      return {
        path: pathOf(file.name),
        madeFolder,
      };
    },
  };
}

const MISSING = "missing";

async function stored(name: string, path: string): Promise<StoredBaseline> {
  let text: string;

  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    const missing = typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

    return {
      name,
      path,
      error: missing ? MISSING : errorMessage(error),
    };
  }

  try {
    return {
      name,
      path,
      file: baselineFileOf(JSON.parse(text)),
    };
  } catch (error) {
    return {
      name,
      path,
      error: errorMessage(error),
    };
  }
}

/** Compact JSON, the header first and the read after it, with a final newline. */
function serialized(file: BaselineFile): string {
  const {
    pixelwrightBaseline,
    name,
    capturedAt,
    by,
    file: figmaFile,
    page,
    node,
    code,
    version,
    snapshot,
    tokens,
  } = file;

  return `${JSON.stringify({
    pixelwrightBaseline,
    name,
    capturedAt,
    by,
    file: figmaFile,
    page,
    node,
    code,
    version,
    snapshot,
    tokens,
  })}\n`;
}
