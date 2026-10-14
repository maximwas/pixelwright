import type { SnapshotNode } from "@pixelwright/core";
import { CODE_CONNECT_BUDGET_MS, TEMPLATE_TIMEOUT_MS } from "../constants/code-connect.ts";
import type { Executed, RenderedInstance, SnapshotInstance, TemplateFile } from "../types/code-connect.ts";
import { firstError, nestedImports, renderSections } from "./sections.ts";
import { type TemplateError, templateErrorOf } from "./template-error.ts";
import { TemplateRun } from "./template-run.ts";
import { templateFor } from "./templates.ts";

/**
 * The templates of one read, run instance by instance as Figma's Dev Mode would: each instance's code is the snippet
 * with the nested connected instances' code inside it, and the imports once each (its own, then the nested ones); its
 * error when it fails (that instance's alone); null when no template connects it. An instance's run, nested templates
 * included, gets `timeout` ms, and all of them `budget` ms; a template that ran out of time, or does not compile, is not
 * run again in the same read. Templates are the project's code: node:vm keeps them from process and the file system
 * and stops a runaway one, but it is no wall against a hostile template.
 */
export class RenderSession {
  readonly #templates: readonly TemplateFile[];
  readonly #timeout: number;
  readonly #budget: number;
  readonly #ends: number;
  /** Templates this read gave up on, with why. */
  readonly failed = new Map<TemplateFile, TemplateError>();

  constructor(
    templates: readonly TemplateFile[],
    { timeout = TEMPLATE_TIMEOUT_MS, budget = CODE_CONNECT_BUDGET_MS }: { timeout?: number; budget?: number } = {},
  ) {
    this.#templates = templates;
    this.#timeout = timeout;
    this.#budget = budget;
    this.#ends = Date.now() + budget;
  }

  render(node: SnapshotNode): RenderedInstance | null {
    const template = node.instance === undefined ? null : templateFor(node.instance, this.#templates);

    if (template === null || node.instance === undefined) {
      return null;
    }

    if (Date.now() >= this.#ends) {
      return {
        template: template.path,
        error: `TEMPLATE_BUDGET: the templates of this read used their ${this.#budget} ms before ${node.name} (${node.id}): read it on its own.`,
      };
    }

    const own = Date.now() + this.#timeout;
    const run = new TemplateRun({
      templates: this.#templates,
      failed: this.failed,
      deadline: Math.min(own, this.#ends),
      timeout: this.#timeout,
      budgetBound: this.#ends < own,
    });

    try {
      return rendered(template, node.instance, run.execute(node, template));
    } catch (error) {
      const failure = templateErrorOf(error, template, this.#timeout);

      return {
        template: template.path,
        error:
          failure.code === "TEMPLATE_BUDGET"
            ? `TEMPLATE_BUDGET: the templates of this read used their ${this.#budget} ms on ${node.name} (${node.id}): read it on its own.`
            : failure.message,
      };
    }
  }
}

/** One instance through a session of its own: for a template tried alone. */
export function renderInstance(
  node: SnapshotNode,
  templates: readonly TemplateFile[],
  options: { timeout?: number; budget?: number } = {},
): RenderedInstance | null {
  return new RenderSession(templates, options).render(node);
}

/** A run as the instance's code: its snippet with the nested instances' code, and the imports once each; or its error. */
function rendered(
  template: TemplateFile,
  instance: SnapshotInstance,
  { sections, imports }: Executed,
): RenderedInstance {
  const error = firstError(sections);

  if (error !== null) {
    return {
      template: template.path,
      error,
    };
  }

  return {
    // The code component's name when the template gives one (Figma's component=), else the Figma component's.
    component: template.component ?? instance.setName ?? instance.componentName,
    template: template.path,
    snippet: renderSections(sections),
    imports: [...new Set([...imports, ...nestedImports(sections)])],
  };
}
