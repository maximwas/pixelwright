import { stat } from "node:fs/promises";
import { resolve } from "node:path";

/** A file on the server's disk that a tool was given the path of: where it is and how many bytes it holds. */
export interface ServerFile {
  readonly path: string;
  readonly size: number;
}

/** The file at a path a tool was given (design_apply's src, execute's script), from `cwd` unless absolute. */
export async function serverFile(path: string, cwd: string): Promise<ServerFile | null> {
  const absolute = resolve(cwd, path);
  const info = await stat(absolute).catch(() => null);

  return info?.isFile()
    ? {
        path: absolute,
        size: info.size,
      }
    : null;
}

/** Why a path a tool was given names no file it can read, and where relative paths start. */
export function notAFile(path: string, cwd: string): string {
  return `${path} is not a file the server can read (relative paths are from the project folder: ${cwd}).`;
}
