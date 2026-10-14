import { stripTypeScriptTypes } from "node:module";
import { parse } from "acorn";
import type { ModuleKind, Transformed } from "../types/code-connect.ts";
import { ModuleRewrite } from "./module-rewrite.ts";
import { messageOf, TemplateError } from "./template-error.ts";

/**
 * A template's or helper's code, rewritten to run inside the function compile wraps it in, on the same lines: types
 * stripped, `import x from 'figma'` and relative imports turned into require, a template's `export default` into an
 * assignment (its literal id kept), a helper's exports onto its exports object. A template's other exports, other
 * modules' imports and figma.connect calls (an old Code Connect file) are refused.
 */
export function transform(source: string, path: string, kind: ModuleKind): Transformed {
  const code = stripped(source, path);
  const rewrite = new ModuleRewrite(path, kind);

  for (const statement of parse(code, {
    ecmaVersion: "latest",
    sourceType: "module",
  }).body) {
    rewrite.statement(statement);
  }

  return rewrite.applyTo(code);
}

/** The source without its TypeScript types, by Node's own stripping (which keeps every line where it was). */
function stripped(source: string, path: string): string {
  try {
    return stripTypeScriptTypes(source);
  } catch (error) {
    throw new TemplateError("TEMPLATE_SYNTAX", `${path}: ${messageOf(error)}`);
  }
}
