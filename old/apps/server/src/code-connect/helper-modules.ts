import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { HELPER_EXTENSIONS, QUIET_CONSOLE } from "../constants/code-connect.ts";
import type { Compiled, TemplateFile } from "../types/code-connect.ts";
import { helperFunction } from "./compile.ts";
import { TemplateError } from "./template-error.ts";

/**
 * The modules of one template run, behind the `require` the template and its helpers get: figma itself, or a relative
 * helper of the project (TypeScript or JavaScript, evaluated once per run, in the template's context). Anything else
 * is refused.
 */
export class HelperModules {
  readonly #program: Compiled;
  readonly #template: TemplateFile;
  readonly #figma: unknown;
  readonly #modules = new Map<string, Record<string, unknown>>();

  constructor(program: Compiled, template: TemplateFile, figma: unknown) {
    this.#program = program;
    this.#template = template;
    this.#figma = figma;
  }

  /** The `require` of the code in this file: the template's own, or one of its helpers. */
  requireFrom(from: string | undefined): (name: string) => unknown {
    return (name: string) => this.#require(name, from);
  }

  #require(name: string, from: string | undefined): unknown {
    if (name === "figma") {
      return this.#figma;
    }

    const file = this.#helperFile(name, from);
    const loaded = this.#modules.get(file);

    if (loaded !== undefined) {
      return loaded;
    }

    const exports: Record<string, unknown> = {};

    // Set before it runs, as CommonJS does: helpers that import each other see what is defined so far.
    this.#modules.set(file, exports);
    helperFunction(this.#program, file)(this.#figma, this.requireFrom(file), exports, QUIET_CONSOLE);

    return exports;
  }

  /** The file a relative import names from the code in `from`; anything else is refused. */
  #helperFile(name: string, from: string | undefined): string {
    const { path } = this.#template;

    if (!name.startsWith("./") && !name.startsWith("../")) {
      throw new TemplateError(
        "TEMPLATE_IMPORT",
        `${path} imports ${name}: a template may import figma and its own relative helpers only.`,
      );
    }

    if (from === undefined) {
      throw new TemplateError("TEMPLATE_IMPORT", `${path}: ${name} cannot be found without the template's file.`);
    }

    const file = existingFile(resolve(dirname(from), name));

    if (file === null) {
      throw new TemplateError("TEMPLATE_IMPORT", `${path}: ${name} (from ${from}) is no file.`);
    }

    return file;
  }
}

/** The file a path names: as written, else with an extension or as a folder's index. */
function existingFile(path: string): string | null {
  for (const candidate of [path, ...HELPER_EXTENSIONS.map((extension) => `${path}${extension}`)]) {
    try {
      if (statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Not this one.
    }
  }

  return null;
}
