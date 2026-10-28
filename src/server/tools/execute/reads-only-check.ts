import { type AnyNode, type MemberExpression, type ObjectPattern, type Program, parse } from "acorn";
import { fullAncestor } from "acorn-walk";
import {
  AST,
  CODE_WRAPPER,
  HIDDEN_CODE,
  HIDDEN_SYNTAX,
  PW_READS,
  WRITE_NAMES,
  WRITE_PREFIX,
  WRITTEN_IN,
} from "@/server/tools/execute/execute.constants.ts";

/**
 * Whether code only reads, as far as it shows (T-153): it writes no property, calls none of the methods that change a
 * file (create*, remove, set*), runs no code it does not show (eval, a helper of its own on pw, a global function) and
 * reaches no global object. Conservative, for a note that must never tell code that writes that it only reads (D-38):
 * any sign of a write, or code that does not parse, says no.
 */
export class ReadsOnlyCheck {
  readonly #writeNames: ReadonlySet<string> = new Set(WRITE_NAMES);
  readonly #hiddenCode: ReadonlySet<string> = new Set(HIDDEN_CODE);
  readonly #pwReads: ReadonlySet<string> = new Set(PW_READS);
  readonly #hiddenSyntax: ReadonlySet<string> = new Set(HIDDEN_SYNTAX);
  readonly #writtenIn: ReadonlySet<string> = new Set(WRITTEN_IN);

  readsOnly(code: string): boolean {
    const program = this.#program(code);

    if (program === null) {
      return false;
    }

    const declared = new Set<string>();
    const called: string[] = [];
    let writes = false;

    fullAncestor(program, (node, _state, ancestors, type) => {
      if (node.type === AST.identifier && type === AST.variablePattern) {
        declared.add(node.name);
      } else {
        writes ||= this.#writesHere(node, ancestors.at(-2));
      }

      if ((node.type === AST.call || node.type === AST.newCall) && node.callee.type === AST.identifier) {
        called.push(node.callee.name);
      }
    });

    // shortcut: declared names are matched without scopes, so a global called by a name the code declares elsewhere
    // passes; use eslint-scope if that ever matters.
    return !writes && called.every((name) => declared.has(name) || name in globalThis);
  }

  #program(code: string): Program | null {
    try {
      return parse(CODE_WRAPPER.wrapped(code), { ecmaVersion: AST.ecmaVersion });
    } catch {
      return null;
    }
  }

  #writesHere(node: AnyNode, parent: AnyNode | undefined): boolean {
    switch (node.type) {
      case AST.member:
        return this.#memberWrites(node, parent);
      case AST.objectPattern:
        return this.#takesWriter(node);
      case AST.identifier:
        return this.#hiddenCode.has(node.name) || (node.name === AST.pw && !this.#pwRead(node, parent));
      default:
        return this.#hiddenSyntax.has(node.type);
    }
  }

  /** A property written to, a method that writes, or a method called by a name the code computes. */
  #memberWrites(node: MemberExpression, parent: AnyNode | undefined): boolean {
    const name = this.#keyName(node.property, node.computed);

    return (
      (name !== null && this.#isWriteName(name)) ||
      this.#writtenTo(node, parent) ||
      (name === null && parent?.type === AST.call && parent.callee === node)
    );
  }

  /** A property's name as written, or null when the code computes it. */
  #keyName(key: AnyNode, computed: boolean): string | null {
    if (!computed && (key.type === AST.identifier || key.type === AST.privateIdentifier)) {
      return key.name;
    }

    return key.type === AST.literal && key.value !== null ? String(key.value) : null;
  }

  #writtenTo(node: AnyNode, parent: AnyNode | undefined): boolean {
    if (parent === undefined) {
      return false;
    }

    if (this.#writtenIn.has(parent.type)) {
      return true;
    }

    if (parent.type === AST.unary) {
      return parent.operator === AST.deleteOperator;
    }

    return (
      (parent.type === AST.assignment ||
        parent.type === AST.assignmentPattern ||
        parent.type === AST.forIn ||
        parent.type === AST.forOf) &&
      parent.left === node
    );
  }

  /** A method that writes taken out of an object by destructuring (`const { remove } = node`), or one it computes. */
  #takesWriter({ properties }: ObjectPattern): boolean {
    return properties.some((property) => {
      if (property.type !== AST.property) {
        return false;
      }

      const name = this.#keyName(property.key, property.computed);

      return name === null || this.#isWriteName(name);
    });
  }

  /** pw used only for its reading helpers: pw.node, pw.fonts, pw.paint, pw.variable. */
  #pwRead(node: AnyNode, parent: AnyNode | undefined): boolean {
    return (
      parent?.type === AST.member &&
      parent.object === node &&
      !parent.computed &&
      parent.property.type === AST.identifier &&
      this.#pwReads.has(parent.property.name)
    );
  }

  #isWriteName(name: string): boolean {
    return WRITE_PREFIX.test(name) || this.#writeNames.has(name);
  }
}
