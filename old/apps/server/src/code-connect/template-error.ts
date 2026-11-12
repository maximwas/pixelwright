import type { TemplateFile } from "../types/code-connect.ts";

/** An error of one instance's template, named as Figma names them: PROPERTY_NOT_FOUND, TEMPLATE_TIMEOUT… */
export class TemplateError extends Error {
  readonly code: string;

  constructor(code: string, detail: string) {
    super(`${code}: ${detail}`);
    this.code = code;
  }
}

/**
 * What a template threw, or what stopped its run, as a template error: one the vm threw (from the template's realm, so
 * not instanceof Error here) by what it was, a run stopped past `timeout` ms as TEMPLATE_TIMEOUT.
 */
export function templateErrorOf(error: unknown, template: TemplateFile, timeout: number): TemplateError {
  if (error instanceof TemplateError) {
    return error;
  }

  if (typeof error === "object" && error !== null && "code" in error && error.code === "ERR_SCRIPT_EXECUTION_TIMEOUT") {
    return new TemplateError("TEMPLATE_TIMEOUT", `${template.path} ran past ${timeout} ms and was stopped.`);
  }

  const name = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";

  return new TemplateError(
    name === "SyntaxError" ? "TEMPLATE_SYNTAX" : "TEMPLATE_EXECUTION_ERROR",
    `${template.path}: ${messageOf(error)}`,
  );
}

/** An error's message, whichever realm threw it. */
export function messageOf(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error ? String(error.message) : String(error);
}
