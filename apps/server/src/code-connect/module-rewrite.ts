import type {
  ExportAllDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  ExpressionStatement,
  Identifier,
  ImportDeclaration,
  Literal,
  ModuleDeclaration,
  ObjectExpression,
  Pattern,
  Statement,
} from "acorn";
import type { ModuleKind, Transformed } from "../types/code-connect.ts";
import { TemplateError } from "./template-error.ts";

/** Text that takes the place of the source between two offsets. */
interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/**
 * One module's rewrite, statement by statement: the edits to its source, the exports to assign once all its names are
 * defined, the names it gives figma, and the id a template's default export writes as a literal.
 */
export class ModuleRewrite {
  readonly #path: string;
  readonly #kind: ModuleKind;
  readonly #edits: Edit[] = [];
  readonly #exportsAtEnd: string[] = [];
  readonly #names = new Set<string>();
  /** The module declares a `figma` of its own. */
  #declared = false;
  #id: string | null = null;

  constructor(path: string, kind: ModuleKind) {
    this.#path = path;
    this.#kind = kind;
  }

  statement(statement: Statement | ModuleDeclaration): void {
    switch (statement.type) {
      case "ImportDeclaration":
        this.#import(statement);
        break;
      case "ExportDefaultDeclaration":
        this.#exportDefault(statement);
        break;
      case "ExportNamedDeclaration":
        this.#exportNamed(statement);
        break;
      case "ExportAllDeclaration":
        this.#exportAll(statement);
        break;
      case "VariableDeclaration":
        this.#declared ||= statement.declarations.some(
          (declaration) => declaration.id.type === "Identifier" && declaration.id.name === "figma",
        );
        break;
      case "ExpressionStatement":
        this.#refuseConnect(statement);
        break;
      default:
        break;
    }
  }

  /** The code with every edit made, figma bound under the names it goes by, and the exports assigned at its end. */
  applyTo(code: string): Transformed {
    // Without an import, figma is what the code requires, or else what it finds as if it were a global.
    const names = this.#names.size === 0 && !this.#declared ? ["figma"] : [...this.#names];
    const prelude = names.map((name) => `const ${name} = __figma;`).join(" ");
    const rewritten = [...this.#edits]
      .sort((a, b) => b.start - a.start)
      .reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), code);

    return {
      code: `${prelude}\n${rewritten}\n${this.#exportsAtEnd.join(" ")}`,
      id: this.#id,
    };
  }

  #import(statement: ImportDeclaration): void {
    const from = String(statement.source.value);

    if (from === "figma") {
      for (const specifier of statement.specifiers) {
        if (specifier.type === "ImportSpecifier") {
          throw new TemplateError("TEMPLATE_IMPORT", `${this.#path}: import figma as its default, not { … }.`);
        }

        this.#names.add(specifier.local.name);
      }

      this.#replace(statement.start, statement.end, "");
    } else if (from.startsWith("./") || from.startsWith("../")) {
      this.#replace(statement.start, statement.end, requireOf(statement, from));
    } else {
      throw new TemplateError(
        "TEMPLATE_IMPORT",
        `${this.#path} imports ${from}: a template may import figma and its own relative helpers only.`,
      );
    }
  }

  #exportDefault(statement: ExportDefaultDeclaration): void {
    const { declaration } = statement;

    if (this.#kind === "template" && declaration.type === "ObjectExpression") {
      this.#id = literalId(declaration) ?? this.#id;
    }

    this.#replace(
      statement.start,
      declaration.start,
      this.#kind === "template" ? "__template.default = (" : "__exports.default = (",
    );
    // The declaration's own end, not the statement's: a semicolon after it is part of the statement.
    this.#replace(declaration.end, statement.end, ");");
  }

  #exportNamed(statement: ExportNamedDeclaration): void {
    this.#refuseExport();

    const { declaration } = statement;

    if (declaration !== null && declaration !== undefined) {
      this.#replace(statement.start, declaration.start, "");

      const bound =
        declaration.type === "VariableDeclaration"
          ? declaration.declarations.flatMap((declarator) => boundNames(declarator.id))
          : [declaration.id.name];

      this.#exportsAtEnd.push(...bound.map((name) => `__exports.${name} = ${name};`));

      return;
    }

    const source =
      statement.source === null || statement.source === undefined
        ? null
        : JSON.stringify(String(statement.source.value));
    const assignments = statement.specifiers.map(
      (specifier) =>
        `__exports[${JSON.stringify(nameOf(specifier.exported))}] = ${source === null ? nameOf(specifier.local) : `require(${source})[${JSON.stringify(nameOf(specifier.local))}]`};`,
    );

    // A re-export reads its module where it stands; local names are read at the end, once they are all defined.
    this.#replace(statement.start, statement.end, source === null ? "" : assignments.join(" "));

    if (source === null) {
      this.#exportsAtEnd.push(...assignments);
    }
  }

  #exportAll(statement: ExportAllDeclaration): void {
    this.#refuseExport();

    const from = JSON.stringify(String(statement.source.value));

    this.#replace(
      statement.start,
      statement.end,
      statement.exported === null || statement.exported === undefined
        ? `for (const [__name, __value] of Object.entries(require(${from}))) if (__name !== "default") __exports[__name] = __value;`
        : `__exports[${JSON.stringify(nameOf(statement.exported))}] = require(${from});`,
    );
  }

  #refuseExport(): void {
    if (this.#kind === "template") {
      throw new TemplateError("TEMPLATE_EXPORT", `${this.#path}: a template exports its default and nothing else.`);
    }
  }

  #refuseConnect(statement: ExpressionStatement): void {
    if (this.#kind === "template" && isConnectCall(statement)) {
      throw new TemplateError(
        "TEMPLATE_LEGACY",
        `${this.#path} is a figma.connect file, which Pixelwright does not run: npx figma connect migrate turns it into a template.`,
      );
    }
  }

  #replace(start: number, end: number, text: string): void {
    this.#edits.push({
      start,
      end,
      text,
    });
  }
}

/** The string an exported object literal gives its `id`; with several, the last one, as the object keeps. */
function literalId(object: ObjectExpression): string | null {
  let id: string | null = null;

  for (const property of object.properties) {
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

  return id;
}

/** A statement calling figma.connect: an old Code Connect file. */
function isConnectCall({ expression }: ExpressionStatement): boolean {
  return (
    expression.type === "CallExpression" &&
    expression.callee.type === "MemberExpression" &&
    expression.callee.object.type === "Identifier" &&
    expression.callee.object.name === "figma" &&
    expression.callee.property.type === "Identifier" &&
    expression.callee.property.name === "connect"
  );
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
