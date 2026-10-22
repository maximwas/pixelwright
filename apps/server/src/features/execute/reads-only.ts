import { type AnyNode, type MemberExpression, type ObjectPattern, type Program, parse } from "acorn";
import { fullAncestor } from "acorn-walk";
import { asFunction } from "./syntax-error.ts";

/** Figma's methods that change a file, by how their names start (createRectangle, setPluginData, addMode…). */
const WRITE_PREFIX =
  /^(?:add|append|apply|clear|clone|create|define|delete|detach|edit|extend|import|insert|lock|move|remove|rename|reorder|reset|resize|save|set|swap|unlock)[A-Z]/;

/**
 * Methods that change a file by their whole names (Figma's), write into an object (Object.assign), or run a function
 * the code holds under another name (call, apply, bind, a function's constructor).
 */
const WRITE_NAMES: ReadonlySet<string> = new Set([
  "apply",
  "assign",
  "bind",
  "call",
  "clone",
  "combineAsVariants",
  "commitUndo",
  "constructor",
  "exclude",
  "extend",
  "flatten",
  "group",
  "intersect",
  "outlineStroke",
  "remove",
  "rescale",
  "resize",
  "smartResize",
  "subtract",
  "transformGroup",
  "triggerUndo",
  "ungroup",
  "union",
]);

/** Names that run code the code does not show, or reach the global object where earlier calls may have left some. */
const HIDDEN_CODE: ReadonlySet<string> = new Set(["eval", "Function", "Reflect", "globalThis", "self", "window"]);

/** Pixelwright's helpers on pw that only read; anything else there is a function an earlier call left, unseen. */
const PW_READS: ReadonlySet<string> = new Set(["node", "fonts", "paint", "variable"]);

/** Syntax that may write unseen: `this` (the global object), `with`, an import. */
const HIDDEN_SYNTAX: ReadonlySet<string> = new Set(["ThisExpression", "WithStatement", "ImportExpression"]);

/** Where a property written to sits: counted up, or in a pattern that assigns into it. */
const WRITTEN_IN: ReadonlySet<string> = new Set(["UpdateExpression", "ArrayPattern", "ObjectPattern", "RestElement"]);

/**
 * Whether code only reads, as far as it shows: it writes no property, calls none of the methods that change a file
 * (create*, remove, set*…), runs no code it does not show (eval, a helper of its own on pw, a global function) and
 * reaches no global object. Conservative, for a note that must never tell code that writes that it only reads: any
 * sign of a write, or code that does not parse, says no.
 */
export function readsOnly(code: string): boolean {
  const program = programOf(code);

  if (program === null) {
    return false;
  }

  const declared = new Set<string>();
  const called: string[] = [];
  let writes = false;

  fullAncestor(program, (node, _state, ancestors, type) => {
    if (node.type === "Identifier" && type === "VariablePattern") {
      declared.add(node.name);
    } else {
      writes ||= writesHere(node, ancestors.at(-2));
    }

    if ((node.type === "CallExpression" || node.type === "NewExpression") && node.callee.type === "Identifier") {
      called.push(node.callee.name);
    }
  });

  // shortcut: declared names are matched without scopes, so a global called by a name the code declares elsewhere
  // passes; use eslint-scope if that ever matters.
  return !writes && called.every((name) => declared.has(name) || name in globalThis);
}

function programOf(code: string): Program | null {
  try {
    return parse(asFunction(code), { ecmaVersion: "latest" });
  } catch {
    return null;
  }
}

function writesHere(node: AnyNode, parent: AnyNode | undefined): boolean {
  switch (node.type) {
    case "MemberExpression":
      return memberWrites(node, parent);
    case "ObjectPattern":
      return takesWriter(node);
    case "Identifier":
      return HIDDEN_CODE.has(node.name) || (node.name === "pw" && !pwRead(node, parent));
    default:
      return HIDDEN_SYNTAX.has(node.type);
  }
}

/** A property written to, a method that writes, or a method called by a name the code computes. */
function memberWrites(node: MemberExpression, parent: AnyNode | undefined): boolean {
  const name = keyName(node.property, node.computed);

  return (
    (name !== null && isWriteName(name)) ||
    writtenTo(node, parent) ||
    (name === null && parent?.type === "CallExpression" && parent.callee === node)
  );
}

/** A property's name as written, or null when the code computes it. */
function keyName(key: AnyNode, computed: boolean): string | null {
  if (!computed && (key.type === "Identifier" || key.type === "PrivateIdentifier")) {
    return key.name;
  }

  return key.type === "Literal" && key.value !== null ? String(key.value) : null;
}

function writtenTo(node: AnyNode, parent: AnyNode | undefined): boolean {
  if (parent === undefined) {
    return false;
  }

  if (WRITTEN_IN.has(parent.type)) {
    return true;
  }

  if (parent.type === "UnaryExpression") {
    return parent.operator === "delete";
  }

  return (
    (parent.type === "AssignmentExpression" ||
      parent.type === "AssignmentPattern" ||
      parent.type === "ForInStatement" ||
      parent.type === "ForOfStatement") &&
    parent.left === node
  );
}

/** A method that writes taken out of an object by destructuring (`const { remove } = node`), or one it computes. */
function takesWriter({ properties }: ObjectPattern): boolean {
  return properties.some((property) => {
    if (property.type !== "Property") {
      return false;
    }

    const name = keyName(property.key, property.computed);

    return name === null || isWriteName(name);
  });
}

/** pw used only for its reading helpers: pw.node, pw.fonts, pw.paint, pw.variable. */
function pwRead(node: AnyNode, parent: AnyNode | undefined): boolean {
  return (
    parent?.type === "MemberExpression" &&
    parent.object === node &&
    !parent.computed &&
    parent.property.type === "Identifier" &&
    PW_READS.has(parent.property.name)
  );
}

function isWriteName(name: string): boolean {
  return WRITE_PREFIX.test(name) || WRITE_NAMES.has(name);
}
