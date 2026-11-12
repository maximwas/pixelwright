import { readFile } from "node:fs/promises";
import { BridgeError, EXECUTE_CODE_CHARS } from "@pixelwright/core";
import { notAFile, serverFile } from "../../utils/server-file.ts";

/**
 * The code a call runs: its code, or its script read from the server's disk at this call, so the file as it is now is
 * what runs; paths as design_apply's src takes them, a relative one from `cwd`, the project folder.
 */
export async function codeToRun(
  { code, script }: { readonly code?: string; readonly script?: string },
  cwd = process.cwd(),
): Promise<string> {
  if (code !== undefined && script === undefined) {
    return code;
  }

  if (code === undefined && script !== undefined) {
    return await scriptCode(script, cwd);
  }

  throw new BridgeError(
    "OP_FAILED",
    "Give code or script, one of them: the code itself, or the path of a file with it.",
  );
}

async function scriptCode(script: string, cwd: string): Promise<string> {
  const file = await serverFile(script, cwd);

  if (file === null) {
    throw new BridgeError("OP_FAILED", notAFile(script, cwd));
  }

  // A character takes at most 4 bytes in UTF-8: a bigger file is too long, whatever it holds.
  if (file.size > EXECUTE_CODE_CHARS * 4) {
    throw new BridgeError(
      "OP_FAILED",
      `${script} is ${file.size} bytes: execute runs at most ${EXECUTE_CODE_CHARS} characters.`,
    );
  }

  const code = await readFile(file.path, "utf8");

  if (code.length === 0 || code.length > EXECUTE_CODE_CHARS) {
    throw new BridgeError(
      "OP_FAILED",
      `${script} is ${code.length} characters: execute runs 1 to ${EXECUTE_CODE_CHARS} characters.`,
    );
  }

  return code;
}
