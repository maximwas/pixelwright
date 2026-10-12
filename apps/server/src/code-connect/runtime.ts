import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import type { SnapshotNode } from "@pixelwright/core";
import { parse } from "acorn";
import { TEMPLATE_TIMEOUT_MS } from "../constants/code-connect.ts";
import type { RenderedInstance, ResultSection, TemplateFile } from "../types/code-connect.ts";
import { InstanceHandle, type Runner } from "./handles.ts";
import { reactHelpers } from "./react-helpers.ts";
import { firstError, nestedImports, renderSections, sectionsOf, templateTag } from "./sections.ts";
import { TemplateError } from "./template-error.ts";
import { templateFor } from "./templates.ts";

/** A template compiled once: a context of its own and the function its source became, called per instance. */
interface Compiled {
  readonly context: vm.Context;
  /** The `id` its default export writes as a literal, known without running it. */
  readonly id: string | null;
}

/** What one run of a template exports. */
interface Executed {
  readonly sections: ResultSection[];
  readonly imports: string[];
  readonly id: string | null;
  readonly metadata?: unknown;
}

const CALL = new vm.Script("__run(...__args)", { filename: "pixelwright:template-call" });
const QUIET_CONSOLE = Object.fromEntries(["log", "info", "warn", "error", "debug"].map((name) => [name, () => {}]));
const compiled = new WeakMap<TemplateFile, Compiled | TemplateError>();

/**
 * Runs the template that connects this instance, as Figma's Dev Mode would, and gives its code: the snippet with the
 * nested connected instances' code inside it, the imports once each (its own, then the nested ones). Its error when it
 * fails (that instance's alone), null when no template connects it. The whole run, nested templates included, gets
 * `timeout` ms. Templates are the project's code: node:vm keeps them from require, process and the file system and
 * stops a runaway one, but it is not a wall against a hostile template.
 */
export function renderInstance(
  node: SnapshotNode,
  templates: readonly TemplateFile[],
  { timeout = TEMPLATE_TIMEOUT_MS }: { timeout?: number } = {},
): RenderedInstance | null {
  const template = node.instance === undefined ? null : templateFor(node.instance, templates);

  if (template === null || node.instance === undefined) {
    return null;
  }

  const run = new TemplateRun(templates, Date.now() + timeout, timeout);

  try {
    const { sections, imports } = run.execute(node, template);
    const error = firstError(sections);

    if (error !== null) {
      return {
        template: template.path,
        error,
      };
    }

    return {
      component: node.instance.setName ?? node.instance.componentName,
      template: template.path,
      snippet: renderSections(sections),
      imports: [...new Set([...imports, ...nestedImports(sections)])],
    };
  } catch (error) {
    return {
      template: template.path,
      error: failure(error, template, timeout),
    };
  }
}

/** One instance's render: the templates it may nest, the time left, the instances being rendered (for cycles). */
class TemplateRun implements Runner {
  readonly #templates: readonly TemplateFile[];
  readonly #deadline: number;
  readonly #timeout: number;
  readonly #running = new Set<string>();
  readonly #done = new Map<string, Executed | TemplateError>();

  constructor(templates: readonly TemplateFile[], deadline: number, timeout: number) {
    this.#templates = templates;
    this.#deadline = deadline;
    this.#timeout = timeout;
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

  example(node: SnapshotNode): { sections: ResultSection[]; metadata?: unknown } {
    const result = this.#result(node);

    if (result === null) {
      return { sections: [] };
    }

    if (result instanceof TemplateError) {
      return {
        sections: [
          {
            type: "ERROR",
            message: result.message,
          },
        ],
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
      metadata: result.metadata,
    };
  }

  /** The template run on this instance: what it exports, or the error that stopped it. */
  execute(node: SnapshotNode, template: TemplateFile): Executed {
    if (this.#running.has(node.id)) {
      throw new TemplateError(
        "TEMPLATE_CYCLE",
        `${template.path} renders ${node.name} (${node.id}) inside itself, without end.`,
      );
    }

    const program = compile(template);
    const exports: { default?: unknown } = {};
    const figma = this.#figma(node);

    this.#running.add(node.id);

    try {
      program.context.__args = [
        figma,
        (name: string) => {
          if (name !== "figma") {
            throw new TemplateError(
              "TEMPLATE_IMPORT",
              `${template.path} requires ${name}: a template may use only figma.`,
            );
          }

          return figma;
        },
        exports,
        QUIET_CONSOLE,
      ];
      CALL.runInContext(program.context, { timeout: Math.max(1, this.#deadline - Date.now()) });
    } catch (error) {
      throw error instanceof TemplateError ? error : new TemplateError(...codeOf(error, template, this.#timeout));
    } finally {
      this.#running.delete(node.id);
    }

    const value = exports.default;

    if (typeof value !== "object" || value === null || !("example" in value)) {
      throw new TemplateError(
        "TEMPLATE_EXAMPLE",
        `${template.path} has no example: it must export default { example: figma.code\`…\` }.`,
      );
    }

    return {
      sections: sectionsOf(value.example),
      imports: "imports" in value && Array.isArray(value.imports) ? value.imports.filter(isString) : [],
      id: "id" in value && typeof value.id === "string" ? value.id : null,
      metadata: "metadata" in value ? value.metadata : undefined,
    };
  }

  #templateOf(node: SnapshotNode): TemplateFile | null {
    return node.instance === undefined ? null : templateFor(node.instance, this.#templates);
  }

  /** A nested instance's run, once per instance: what its template exports, its error, or null without one. */
  #result(node: SnapshotNode): Executed | TemplateError | null {
    const template = this.#templateOf(node);

    if (template === null) {
      return null;
    }

    const done = this.#done.get(node.id);

    if (done !== undefined) {
      return done;
    }

    let result: Executed | TemplateError;

    try {
      result = this.execute(node, template);
    } catch (error) {
      result = error instanceof TemplateError ? error : new TemplateError(...codeOf(error, template, this.#timeout));
    }

    // A cycle is the caller's to report; anything else is this instance's for good.
    if (!(result instanceof TemplateError && result.code === "TEMPLATE_CYCLE")) {
      this.#done.set(node.id, result);
    }

    return result;
  }

  /** The `figma` a template imports, for this instance (figma-types.d.ts Figma). */
  #figma(node: SnapshotNode) {
    const selected = new InstanceHandle(node, this);
    const tsx = templateTag("tsx");
    const prefixed = (children: unknown, prefix: string) => [
      {
        type: "CODE",
        code: prefix,
      },
      ...sectionsOf(children),
    ];

    return {
      selectedInstance: selected,
      currentLayer: selected,
      properties: selected.__properties__,
      batch: {},
      code: templateTag("raw"),
      tsx,
      html: templateTag("html"),
      swift: templateTag("swift"),
      kotlin: templateTag("kotlin"),
      value: (raw: unknown, preview?: unknown) => ({
        type: "VALUE",
        value: raw,
        preview: preview ?? raw,
      }),
      helpers: {
        react: reactHelpers(tsx),
        swift: { renderChildren: prefixed },
        kotlin: { renderChildren: prefixed },
      },
    };
  }
}

/**
 * A template's source as a function of (figma, require, exports, console), in a context of its own: TypeScript types
 * stripped by Node, `import figma from 'figma'` the only import, `export default` the only export. A context per
 * template, never per call, and no code generation from strings in it.
 */
function compile(template: TemplateFile): Compiled {
  const cached = compiled.get(template);

  if (cached instanceof TemplateError) {
    throw cached;
  }

  if (cached !== undefined) {
    return cached;
  }

  try {
    const { code, id } = body(template);
    const program = {
      id,
      context: vm.createContext(
        {},
        {
          codeGeneration: {
            strings: false,
            wasm: false,
          },
        },
      ),
    };

    new vm.Script(`__run = (function (__figma, require, __template, console) {${code}\n});`, {
      filename: template.path,
    }).runInContext(program.context);
    compiled.set(template, program);

    return program;
  } catch (error) {
    const failed = error instanceof TemplateError ? error : new TemplateError(...codeOf(error, template, 0));

    compiled.set(template, failed);

    throw failed;
  }
}

/**
 * The template's own code, rewritten to run inside the function compile wraps it in, on the same lines, and the id its
 * default export writes as a literal.
 */
function body(template: TemplateFile): { code: string; id: string | null } {
  if (/\bfigma\.connect\s*\(/.test(template.source)) {
    throw new TemplateError(
      "TEMPLATE_LEGACY",
      `${template.path} is a figma.connect file, which Pixelwright does not run: npx figma connect migrate turns it into a template.`,
    );
  }

  let code: string;

  try {
    code = stripTypeScriptTypes(template.source);
  } catch (error) {
    throw new TemplateError("TEMPLATE_SYNTAX", `${template.path}: ${messageOf(error)}`);
  }

  const program = parse(code, {
    ecmaVersion: "latest",
    sourceType: "module",
  });
  const edits: { start: number; end: number; text: string }[] = [];
  const names = new Set<string>();
  let declared = false;
  let id: string | null = null;

  for (const statement of program.body) {
    if (statement.type === "ImportDeclaration") {
      if (statement.source.value !== "figma") {
        throw new TemplateError(
          "TEMPLATE_IMPORT",
          `${template.path} imports ${String(statement.source.value)}: a template may import only figma.`,
        );
      }

      for (const specifier of statement.specifiers) {
        if (specifier.type === "ImportSpecifier") {
          throw new TemplateError("TEMPLATE_IMPORT", `${template.path}: import figma as its default, not { … }.`);
        }

        names.add(specifier.local.name);
      }

      edits.push({
        start: statement.start,
        end: statement.end,
        text: "",
      });
    } else if (statement.type === "ExportDefaultDeclaration") {
      if (statement.declaration.type === "ObjectExpression") {
        for (const property of statement.declaration.properties) {
          if (
            property.type === "Property" &&
            ((property.key.type === "Identifier" && property.key.name === "id") ||
              (property.key.type === "Literal" && property.key.value === "id")) &&
            property.value.type === "Literal" &&
            typeof property.value.value === "string"
          ) {
            id = property.value.value;
          }
        }
      }

      edits.push(
        {
          start: statement.start,
          end: statement.declaration.start,
          text: "__template.default = (",
        },
        {
          start: statement.end,
          end: statement.end,
          text: ");",
        },
      );
    } else if (statement.type === "ExportNamedDeclaration" || statement.type === "ExportAllDeclaration") {
      throw new TemplateError("TEMPLATE_EXPORT", `${template.path}: a template exports its default and nothing else.`);
    } else if (statement.type === "VariableDeclaration") {
      declared ||= statement.declarations.some(
        (declaration) => declaration.id.type === "Identifier" && declaration.id.name === "figma",
      );
    }
  }

  // Without an import, figma is what the template requires, or else what it finds as if it were a global.
  if (names.size === 0 && !declared) {
    names.add("figma");
  }

  // The figma the template imports or finds as a global, under each name it imports it as.
  const prelude = [...names].map((name) => `const ${name} = __figma;`).join(" ");
  let rewritten = code;

  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    rewritten = rewritten.slice(0, edit.start) + edit.text + rewritten.slice(edit.end);
  }

  return {
    code: `${prelude}\n${rewritten}`,
    id,
  };
}

/** An error the vm threw (from the template's realm, so not instanceof Error here) as a template error's parts. */
function codeOf(error: unknown, template: TemplateFile, timeout: number): [string, string] {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "ERR_SCRIPT_EXECUTION_TIMEOUT") {
    return ["TEMPLATE_TIMEOUT", `${template.path} ran past ${timeout} ms and was stopped.`];
  }

  const name = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";

  return [
    name === "SyntaxError" ? "TEMPLATE_SYNTAX" : "TEMPLATE_EXECUTION_ERROR",
    `${template.path}: ${messageOf(error)}`,
  ];
}

function failure(error: unknown, template: TemplateFile, timeout: number): string {
  return error instanceof TemplateError
    ? error.message
    : new TemplateError(...codeOf(error, template, timeout)).message;
}

function messageOf(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error ? String(error.message) : String(error);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
