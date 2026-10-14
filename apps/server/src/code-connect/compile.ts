import { readFileSync } from "node:fs";
import vm from "node:vm";
import type { Compiled, TemplateFile } from "../types/code-connect.ts";
import { TemplateError, templateErrorOf } from "./template-error.ts";
import { transform } from "./transform.ts";

/** Each template compiled once, or the error that kept it from compiling: kept as long as the template is. */
const compiled = new WeakMap<TemplateFile, Compiled | TemplateError>();

/**
 * A template's source as a function of (figma, require, exports, console), in a context of its own: TypeScript types
 * stripped by Node, its imports of figma and of relative helpers rewritten, `export default` the only export. A
 * context per template, never per call, with no code generation from strings and its promises settled within the run.
 */
export function compile(template: TemplateFile): Compiled {
  const cached = compiled.get(template);

  if (cached instanceof TemplateError) {
    throw cached;
  }

  if (cached !== undefined) {
    return cached;
  }

  try {
    const program = programOf(template);

    compiled.set(template, program);

    return program;
  } catch (error) {
    const failed = templateErrorOf(error, template, 0);

    compiled.set(template, failed);

    throw failed;
  }
}

/** A helper module compiled once in the template's context: a function of (figma, require, exports, console). */
export function helperFunction(program: Compiled, file: string): (...args: unknown[]) => void {
  const cached = program.helpers.get(file);

  if (cached !== undefined) {
    return cached;
  }

  const { code } = transform(readFileSync(file, "utf8"), file, "helper");
  const run = new vm.Script(`(function (__figma, require, __exports, console) {${code}\n})`, {
    filename: file,
  }).runInContext(program.context) as (...args: unknown[]) => void;

  program.helpers.set(file, run);

  return run;
}

function programOf(template: TemplateFile): Compiled {
  const { code, id } = transform(template.source, template.path, "template");
  const program: Compiled = {
    id,
    helpers: new Map(),
    context: vm.createContext(
      {},
      {
        codeGeneration: {
          strings: false,
          wasm: false,
        },
        // Promises a template starts settle within its run and its time: an endless chain of them cannot hang the server.
        microtaskMode: "afterEvaluate",
      },
    ),
  };

  new vm.Script(`__run = (function (__figma, require, __template, console) {${code}\n});`, {
    filename: template.path,
  }).runInContext(program.context);

  return program;
}
