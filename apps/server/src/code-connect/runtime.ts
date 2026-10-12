import { readFileSync, statSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import type { SnapshotNode } from "@pixelwright/core";
import { type Identifier, type ImportDeclaration, type Literal, type Pattern, parse } from "acorn";
import {
  CODE_CONNECT_BUDGET_MS,
  HELPER_EXTENSIONS,
  NESTED_TIMEOUT_MARGIN_MS,
  TEMPLATE_TIMEOUT_MS,
} from "../constants/code-connect.ts";
import type { RenderedInstance, ResultSection, TemplateFile } from "../types/code-connect.ts";
import { InstanceHandle, type Runner } from "./handles.ts";
import { reactHelpers } from "./react-helpers.ts";
import { firstError, nestedImports, renderSections, sectionsOf, templateTag } from "./sections.ts";
import { TemplateError } from "./template-error.ts";
import { templateFor } from "./templates.ts";

/** A template compiled once: a context of its own, the function its source became, its relative helpers' functions. */
interface Compiled {
  readonly context: vm.Context;
  /** The `id` its default export writes as a literal, known without running it. */
  readonly id: string | null;
  readonly helpers: Map<string, (...args: unknown[]) => void>;
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
    const run = new TemplateRun(this.#templates, this, Math.min(own, this.#ends), this.#timeout, this.#ends < own);

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
        // The code component's name when the template gives one (Figma's component=), else the Figma component's.
        component: template.component ?? node.instance.setName ?? node.instance.componentName,
        template: template.path,
        snippet: renderSections(sections),
        imports: [...new Set([...imports, ...nestedImports(sections)])],
      };
    } catch (error) {
      const failure =
        error instanceof TemplateError ? error : new TemplateError(...codeOf(error, template, this.#timeout));

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

/** One instance's render: the templates it may nest, the time left, the instances being rendered (for cycles). */
class TemplateRun implements Runner {
  readonly #templates: readonly TemplateFile[];
  readonly #session: RenderSession;
  readonly #deadline: number;
  readonly #timeout: number;
  /** The read's budget ends before this render's own time: running out of time is then the budget's, not a template's. */
  readonly #budgetBound: boolean;
  readonly #running = new Set<string>();
  readonly #done = new Map<string, Executed | TemplateError>();

  constructor(
    templates: readonly TemplateFile[],
    session: RenderSession,
    deadline: number,
    timeout: number,
    budgetBound: boolean,
  ) {
    this.#templates = templates;
    this.#session = session;
    this.#deadline = deadline;
    this.#timeout = timeout;
    this.#budgetBound = budgetBound;
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
    const given = this.#session.failed.get(template);

    if (given !== undefined) {
      throw given;
    }

    if (this.#running.has(node.id)) {
      throw new TemplateError(
        "TEMPLATE_CYCLE",
        `${template.path} renders ${node.name} (${node.id}) inside itself, without end.`,
      );
    }

    let program: Compiled;

    try {
      program = compile(template);
    } catch (error) {
      this.#session.failed.set(template, error as TemplateError);

      throw error;
    }

    const exports: { default?: unknown } = {};
    const figma = this.#figma(node);
    const modules = new Map<string, Record<string, unknown>>();

    this.#running.add(node.id);

    try {
      program.context.__args = [
        figma,
        requirer(program, template, template.file, figma, modules),
        exports,
        QUIET_CONSOLE,
      ];
      // Each nested run stops a little before the one around it, so a runaway is blamed on its own template.
      CALL.runInContext(program.context, {
        timeout: Math.max(1, this.#deadline - Date.now() - this.#running.size * NESTED_TIMEOUT_MARGIN_MS),
      });
    } catch (error) {
      let failure =
        error instanceof TemplateError ? error : new TemplateError(...codeOf(error, template, this.#timeout));

      if (failure.code === "TEMPLATE_TIMEOUT" && !(error instanceof TemplateError)) {
        if (this.#budgetBound) {
          failure = new TemplateError("TEMPLATE_BUDGET", `${template.path} was stopped: the read's time ran out.`);
        } else {
          this.#session.failed.set(template, failure);
        }
      }

      throw failure;
    } finally {
      this.#running.delete(node.id);
    }

    return exported(exports.default, template);
  }

  #templateOf(node: SnapshotNode): TemplateFile | null {
    return node.instance === undefined ? null : templateFor(node.instance, this.#templates);
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

    let result: Executed | TemplateError;

    try {
      result = this.execute(node, template);
    } catch (error) {
      result = error instanceof TemplateError ? error : new TemplateError(...codeOf(error, template, this.#timeout));

      if (result.code === "TEMPLATE_TIMEOUT" || result.code === "TEMPLATE_BUDGET") {
        throw result;
      }
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
 * What a template exports as its code: `{ example, imports?, id?, metadata? }`, or a figma.value (what Figma's React
 * parser writes for a value: its preview is its code).
 */
function exported(value: unknown, template: TemplateFile): Executed {
  if (typeof value === "object" && value !== null && "example" in value) {
    return {
      sections: sectionsOf(value.example),
      imports: "imports" in value && Array.isArray(value.imports) ? value.imports.filter(isString) : [],
      id: "id" in value && typeof value.id === "string" ? value.id : null,
      metadata: "metadata" in value ? value.metadata : undefined,
    };
  }

  if (typeof value === "object" && value !== null && "preview" in value) {
    return {
      sections: sectionsOf(value.preview),
      imports: [],
      id: null,
      metadata: "metadata" in value ? value.metadata : undefined,
    };
  }

  throw new TemplateError(
    "TEMPLATE_EXAMPLE",
    `${template.path} has no example: it must export default { example: figma.code\`…\` }.`,
  );
}

/** A template's metadata as nesting templates read it: `__props`, and `props` (what Figma's migrate writes) the same. */
function metadataOf(metadata: unknown): Record<string, unknown> {
  const given = typeof metadata === "object" && metadata !== null ? (metadata as Record<string, unknown>) : {};
  const props = given.__props ?? given.props ?? {};

  return {
    ...given,
    __props: given.__props ?? props,
    props: given.props ?? props,
  };
}

/**
 * The `require` a template or helper gets: figma itself, or a relative helper of the project (TypeScript or
 * JavaScript, evaluated once per render, in the template's context). Anything else is refused.
 */
function requirer(
  program: Compiled,
  template: TemplateFile,
  from: string | undefined,
  figma: unknown,
  modules: Map<string, Record<string, unknown>>,
): (name: string) => unknown {
  return (name: string) => {
    if (name === "figma") {
      return figma;
    }

    if (!name.startsWith("./") && !name.startsWith("../")) {
      throw new TemplateError(
        "TEMPLATE_IMPORT",
        `${template.path} imports ${name}: a template may import figma and its own relative helpers only.`,
      );
    }

    if (from === undefined) {
      throw new TemplateError(
        "TEMPLATE_IMPORT",
        `${template.path}: ${name} cannot be found without the template's file.`,
      );
    }

    const file = helperFile(resolve(dirname(from), name));

    if (file === null) {
      throw new TemplateError("TEMPLATE_IMPORT", `${template.path}: ${name} (from ${from}) is no file.`);
    }

    const loaded = modules.get(file);

    if (loaded !== undefined) {
      return loaded;
    }

    const exports: Record<string, unknown> = {};

    // Set before it runs, as CommonJS does: helpers that import each other see what is defined so far.
    modules.set(file, exports);
    helperFunction(program, file)(figma, requirer(program, template, file, figma, modules), exports, QUIET_CONSOLE);

    return exports;
  };
}

/** The file a relative import names: as written, else with an extension or as a folder's index. */
function helperFile(path: string): string | null {
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

/** A helper module compiled once in the template's context: a function of (figma, require, exports, console). */
function helperFunction(program: Compiled, file: string): (...args: unknown[]) => void {
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

/**
 * A template's source as a function of (figma, require, exports, console), in a context of its own: TypeScript types
 * stripped by Node, its imports of figma and of relative helpers rewritten, `export default` the only export. A
 * context per template, never per call, with no code generation from strings and its promises settled within the run.
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
    compiled.set(template, program);

    return program;
  } catch (error) {
    const failed = error instanceof TemplateError ? error : new TemplateError(...codeOf(error, template, 0));

    compiled.set(template, failed);

    throw failed;
  }
}

/**
 * A template's or helper's code, rewritten to run inside the function compile wraps it in, on the same lines: types
 * stripped, `import x from 'figma'` and relative imports turned into require, a template's `export default` into an
 * assignment (its literal id kept), a helper's exports onto its exports object. A template's other exports, other
 * modules' imports and figma.connect calls (an old Code Connect file) are refused.
 */
function transform(source: string, path: string, kind: "template" | "helper"): { code: string; id: string | null } {
  let code: string;

  try {
    code = stripTypeScriptTypes(source);
  } catch (error) {
    throw new TemplateError("TEMPLATE_SYNTAX", `${path}: ${messageOf(error)}`);
  }

  const program = parse(code, {
    ecmaVersion: "latest",
    sourceType: "module",
  });
  const edits: { start: number; end: number; text: string }[] = [];
  const exportsAtEnd: string[] = [];
  const names = new Set<string>();
  let declared = false;
  let id: string | null = null;
  const replace = (start: number, end: number, text: string) =>
    edits.push({
      start,
      end,
      text,
    });

  for (const statement of program.body) {
    if (statement.type === "ImportDeclaration") {
      const from = String(statement.source.value);

      if (from === "figma") {
        for (const specifier of statement.specifiers) {
          if (specifier.type === "ImportSpecifier") {
            throw new TemplateError("TEMPLATE_IMPORT", `${path}: import figma as its default, not { … }.`);
          }

          names.add(specifier.local.name);
        }

        replace(statement.start, statement.end, "");
      } else if (from.startsWith("./") || from.startsWith("../")) {
        replace(statement.start, statement.end, requireOf(statement, from));
      } else {
        throw new TemplateError(
          "TEMPLATE_IMPORT",
          `${path} imports ${from}: a template may import figma and its own relative helpers only.`,
        );
      }
    } else if (statement.type === "ExportDefaultDeclaration") {
      if (kind === "template" && statement.declaration.type === "ObjectExpression") {
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

      replace(
        statement.start,
        statement.declaration.start,
        kind === "template" ? "__template.default = (" : "__exports.default = (",
      );
      // The declaration's own end, not the statement's: a semicolon after it is part of the statement.
      replace(statement.declaration.end, statement.end, ");");
    } else if (statement.type === "ExportNamedDeclaration" || statement.type === "ExportAllDeclaration") {
      if (kind === "template") {
        throw new TemplateError("TEMPLATE_EXPORT", `${path}: a template exports its default and nothing else.`);
      }

      if (statement.type === "ExportAllDeclaration") {
        const from = JSON.stringify(String(statement.source.value));

        replace(
          statement.start,
          statement.end,
          statement.exported === null || statement.exported === undefined
            ? `for (const [__name, __value] of Object.entries(require(${from}))) if (__name !== "default") __exports[__name] = __value;`
            : `__exports[${JSON.stringify(nameOf(statement.exported))}] = require(${from});`,
        );
      } else if (statement.declaration !== null && statement.declaration !== undefined) {
        replace(statement.start, statement.declaration.start, "");

        const declaration = statement.declaration;

        const bound =
          declaration.type === "VariableDeclaration"
            ? declaration.declarations.flatMap((declarator) => boundNames(declarator.id))
            : [declaration.id.name];

        exportsAtEnd.push(...bound.map((name) => `__exports.${name} = ${name};`));
      } else {
        const source =
          statement.source === null || statement.source === undefined
            ? null
            : JSON.stringify(String(statement.source.value));
        const assignments = statement.specifiers.map(
          (specifier) =>
            `__exports[${JSON.stringify(nameOf(specifier.exported))}] = ${source === null ? nameOf(specifier.local) : `require(${source})[${JSON.stringify(nameOf(specifier.local))}]`};`,
        );

        // A re-export reads its module where it stands; local names are read at the end, once they are all defined.
        replace(statement.start, statement.end, source === null ? "" : assignments.join(" "));

        if (source === null) {
          exportsAtEnd.push(...assignments);
        }
      }
    } else if (statement.type === "VariableDeclaration") {
      declared ||= statement.declarations.some(
        (declaration) => declaration.id.type === "Identifier" && declaration.id.name === "figma",
      );
    } else if (
      kind === "template" &&
      statement.type === "ExpressionStatement" &&
      statement.expression.type === "CallExpression" &&
      statement.expression.callee.type === "MemberExpression" &&
      statement.expression.callee.object.type === "Identifier" &&
      statement.expression.callee.object.name === "figma" &&
      statement.expression.callee.property.type === "Identifier" &&
      statement.expression.callee.property.name === "connect"
    ) {
      throw new TemplateError(
        "TEMPLATE_LEGACY",
        `${path} is a figma.connect file, which Pixelwright does not run: npx figma connect migrate turns it into a template.`,
      );
    }
  }

  // Without an import, figma is what the code requires, or else what it finds as if it were a global.
  if (names.size === 0 && !declared) {
    names.add("figma");
  }

  const prelude = [...names].map((name) => `const ${name} = __figma;`).join(" ");
  let rewritten = code;

  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    rewritten = rewritten.slice(0, edit.start) + edit.text + rewritten.slice(edit.end);
  }

  return {
    code: `${prelude}\n${rewritten}\n${exportsAtEnd.join(" ")}`,
    id,
  };
}

/** An import of a relative helper as the same bindings, through require. */
function requireOf(statement: ImportDeclaration, from: string): string {
  const module = `require(${JSON.stringify(from)})`;

  return statement.specifiers
    .map((specifier) =>
      specifier.type === "ImportDefaultSpecifier"
        ? `const ${specifier.local.name} = ${module}.default;`
        : specifier.type === "ImportNamespaceSpecifier"
          ? `const ${specifier.local.name} = ${module};`
          : `const { ${JSON.stringify(nameOf(specifier.imported))}: ${specifier.local.name} } = ${module};`,
    )
    .join(" ");
}

/** The names a declaration binds: `const { a, b: [c] } = …` → a, c. */
function boundNames(pattern: Pattern): string[] {
  switch (pattern.type) {
    case "Identifier":
      return [pattern.name];
    case "ObjectPattern":
      return pattern.properties.flatMap((property) =>
        property.type === "RestElement" ? boundNames(property.argument) : boundNames(property.value),
      );
    case "ArrayPattern":
      return pattern.elements.flatMap((element) => (element === null ? [] : boundNames(element)));
    case "RestElement":
      return boundNames(pattern.argument);
    case "AssignmentPattern":
      return boundNames(pattern.left);
    default:
      return [];
  }
}

function nameOf(node: Identifier | Literal): string {
  return node.type === "Identifier" ? node.name : String(node.value);
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

function messageOf(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error ? String(error.message) : String(error);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
