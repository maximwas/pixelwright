import { access } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { TemplateFile } from "../types/code-connect.ts";

/**
 * Whether a connection's source names a file that exists in neither place it is looked for: under the project root,
 * then beside the Code Connect file (an absolute one as written). Only what looks like a file (an extension, no URL
 * scheme) is checked, and only inside the project: a package (lucide-react, @acme/ui), a URL or a path out of the
 * project never is, so it is never missing.
 */
export async function sourceMissing(root: string, template: TemplateFile): Promise<boolean> {
  const source = template.codeSource;

  if (source === undefined || !looksLikeFile(source)) {
    return false;
  }

  const places = (
    isAbsolute(source)
      ? [source]
      : [resolve(root, source), resolve(root, dirname(template.batchFile ?? template.path), source)]
  ).filter((place) => inside(root, place));

  if (places.length === 0) {
    return false;
  }

  for (const place of places) {
    if (await exists(place)) {
      return false;
    }
  }

  return true;
}

function looksLikeFile(source: string): boolean {
  return (
    (isAbsolute(source) || !/^[a-z][a-z0-9+.-]*:/i.test(source)) &&
    /\.[a-z0-9]+$/i.test(source.split(/[\\/]/).pop() ?? "")
  );
}

/** Whether a path is in the project folder (not the folder itself). */
function inside(root: string, path: string): boolean {
  const within = relative(root, path);

  return within !== "" && !within.startsWith("..") && !isAbsolute(within);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);

    return true;
  } catch {
    return false;
  }
}
