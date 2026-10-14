import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { BridgeError } from "@pixelwright/core";

/** The project's files a baseline lists: relative, inside the project, with `/`; a file not there yet is only noted. */
export function codePaths(paths: readonly string[], project: string): { paths: string[]; notes: string[] } {
  const notes: string[] = [];
  const checked = paths.map((given) => {
    const path = given.replaceAll("\\", "/");

    if (isAbsolute(path) || /^[a-z]:/i.test(path) || path.split("/").includes("..")) {
      throw new BridgeError("OP_FAILED", `${given}: code lists the project's files relative to it, inside it.`);
    }

    if (!existsSync(join(project, path))) {
      notes.push(`${path} is not in the project yet.`);
    }

    return path;
  });

  return {
    paths: checked,
    notes,
  };
}
