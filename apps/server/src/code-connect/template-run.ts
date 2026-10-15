import vm from "node:vm";
import type { SnapshotNode } from "@pixelwright/core";
import { NESTED_TIMEOUT_MARGIN_MS, QUIET_CONSOLE } from "../constants/code-connect.ts";
import type { Compiled, Executed, ResultSection, TemplateFile } from "../types/code-connect.ts";
import { compile } from "./compile.ts";
import type { ConnectionIndex } from "./connection-index.ts";
import { figmaApi } from "./figma-api.ts";
import type { Runner } from "./handles.ts";
import { HelperModules } from "./helper-modules.ts";
import { PropertyReads } from "./property-reads.ts";
import { TemplateError, templateErrorOf } from "./template-error.ts";
import { exported, metadataOf } from "./template-exports.ts";

const CALL = new vm.Script("__run(...__args)", { filename: "pixelwright:template-call" });

/** What one instance's render runs within: the read's connections and the ones it gave up on, and the render's time. */
export interface RunLimits {
  readonly connections: ConnectionIndex;
  /** Templates the read gave up on, with why: shared by every render of the read. */
  readonly failed: Map<TemplateFile, TemplateError>;
  /** When the render stops, on Date.now()'s clock. */
  readonly deadline: number;
  /** An instance's time, as errors name it. */
  readonly timeout: number;
  /** The read's budget ends before this render's own time: running out of time is then the budget's, not a template's. */
  readonly budgetBound: boolean;
}

/** One instance's render: its nested instances' runs, once each, and the instances being rendered (for cycles). */
export class TemplateRun implements Runner {
  readonly reads = new PropertyReads();
  readonly #limits: RunLimits;
  readonly #running = new Set<string>();
  readonly #done = new Map<string, Executed | TemplateError>();

  constructor(limits: RunLimits) {
    this.#limits = limits;
  }

  connected(node: SnapshotNode): boolean {
    return this.#templateOf(node) !== null;
  }

  /** The template's id as written, without running it (the instance may be the one being rendered); else its run's. */
  connectedId(node: SnapshotNode): string | null {
    const template = this.#templateOf(node);

    if (template === null) {
      return null;
    }

    try {
      const { id } = compile(template);

      if (id !== null || this.#running.has(node.id)) {
        return id;
      }
    } catch {
      return null;
    }

    const result = this.#result(node);

    return result === null || result instanceof TemplateError ? null : result.id;
  }

  example(node: SnapshotNode): { sections: ResultSection[]; metadata: Record<string, unknown> } {
    const result = this.#result(node);

    if (result === null) {
      return {
        sections: [],
        metadata: metadataOf(undefined),
      };
    }

    if (result instanceof TemplateError) {
      return {
        sections: [
          {
            type: "ERROR",
            message: result.message,
          },
        ],
        metadata: metadataOf(undefined),
      };
    }

    return {
      sections: [
        {
          type: "INSTANCE",
          guid: node.id,
          symbolId: node.instance?.componentId ?? "",
          resultSections: result.sections,
          nestedImports: result.imports,
        },
      ],
      metadata: metadataOf(result.metadata),
    };
  }

  /** The template run on this instance: what it exports, or the error that stopped it. */
  execute(node: SnapshotNode, template: TemplateFile): Executed {
    const given = this.#limits.failed.get(template);

    if (given !== undefined) {
      throw given;
    }

    if (this.#running.has(node.id)) {
      throw new TemplateError(
        "TEMPLATE_CYCLE",
        `${template.path} renders ${node.name} (${node.id}) inside itself, without end.`,
      );
    }

    const program = this.#compiled(template);
    const exports: { default?: unknown } = {};

    this.#running.add(node.id);

    try {
      this.#call(program, template, node, exports);
    } catch (error) {
      throw this.#failure(error, template);
    } finally {
      this.#running.delete(node.id);
    }

    return exported(exports.default, template);
  }

  #templateOf(node: SnapshotNode): TemplateFile | null {
    return node.instance === undefined ? null : (this.#limits.connections.match(node.instance)?.template ?? null);
  }

  /** The template compiled; one that does not compile is given up on for the read. */
  #compiled(template: TemplateFile): Compiled {
    try {
      return compile(template);
    } catch (error) {
      this.#limits.failed.set(template, error as TemplateError);

      throw error;
    }
  }

  #call(program: Compiled, template: TemplateFile, node: SnapshotNode, exports: { default?: unknown }): void {
    const figma = figmaApi(node, this, template.batch);

    program.context.__args = [
      figma,
      new HelperModules(program, template, figma).requireFrom(template.file),
      exports,
      QUIET_CONSOLE,
    ];
    // Each nested run stops a little before the one around it, so a runaway is blamed on its own template.
    CALL.runInContext(program.context, {
      timeout: Math.max(1, this.#limits.deadline - Date.now() - this.#running.size * NESTED_TIMEOUT_MARGIN_MS),
    });
  }

  /**
   * Why a run stopped. A template that ran out of its own time is given up on for the read, unless the read's budget
   * ended first: then the time was the budget's.
   */
  #failure(error: unknown, template: TemplateFile): TemplateError {
    const failure = templateErrorOf(error, template, this.#limits.timeout);

    if (failure.code !== "TEMPLATE_TIMEOUT" || error instanceof TemplateError) {
      return failure;
    }

    if (this.#limits.budgetBound) {
      return new TemplateError("TEMPLATE_BUDGET", `${template.path} was stopped: the read's time ran out.`);
    }

    this.#limits.failed.set(template, failure);

    return failure;
  }

  /**
   * A nested instance's run, once per instance: what its template exports, its error, or null without one. A nested
   * template that ran out of time stops the template around it too: the time is the whole render's.
   */
  #result(node: SnapshotNode): Executed | TemplateError | null {
    const template = this.#templateOf(node);

    if (template === null) {
      return null;
    }

    const done = this.#done.get(node.id);

    if (done !== undefined) {
      return done;
    }

    const result = this.#tried(node, template);

    // A cycle is the caller's to report; anything else is this instance's for good.
    if (!(result instanceof TemplateError && result.code === "TEMPLATE_CYCLE")) {
      this.#done.set(node.id, result);
    }

    return result;
  }

  #tried(node: SnapshotNode, template: TemplateFile): Executed | TemplateError {
    try {
      return this.execute(node, template);
    } catch (error) {
      const failure = templateErrorOf(error, template, this.#limits.timeout);

      if (failure.code === "TEMPLATE_TIMEOUT" || failure.code === "TEMPLATE_BUDGET") {
        throw failure;
      }

      return failure;
    }
  }
}
