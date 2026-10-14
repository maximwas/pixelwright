import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { TemplateFile } from "../types/code-connect.ts";

/**
 * Whether a connection's source names a file that exists in neither place it is looked for: under the project root,
 * then beside the Code Connect file. Only what looks like a file (an extension, no URL scheme) is checked; a package
 * (lucide-react, @acme/ui) or a URL never is.
 */
export async function sourceMissing(root: string, template: TemplateFile): Promise<boolean> {
  const source = template.codeSource;

  if (source === undefined || !looksLikeFile(source)) {
    return false;
  }

  for (const candidate of [join(root, source), join(root, dirname(template.batchFile ?? template.path), source)]) {
    if (await exists(candidate)) {
      return false;
    }
  }

  return true;
}

function looksLikeFile(source: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(source) && /\.[a-z0-9]+$/i.test(source.split("/").pop() ?? "");
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);

    return true;
  } catch {
    return false;
  }
}
