import { closest, tokenName, variableTokenName } from "@pixelwright/core";
import { variables } from "./variables.ts";
import { WriteError } from "./write-error.ts";

type StyleKind = "PAINT" | "EFFECT" | "TEXT";

/**
 * Tokens by the CSS names design_read gives them (text styles also by their own name, as textStyle names them): the
 * file's styles and variables and the library ones its page uses, so what a read wrote binds back.
 */
export interface TokenIndex {
  /** A style's id, or null when no style of that kind has the name. */
  style(token: string, kind: StyleKind): string | null;
  /** A text style's id by its name; an error naming close ones when none has it. */
  textStyle(name: string): string;
  /** A variable of the type, or an error naming close tokens. */
  variable(token: string, type: VariableResolvedDataType): Promise<Variable>;
}

export async function tokenIndex(): Promise<TokenIndex> {
  const raw = await variables({
    libraries: false,
    used: true,
  });
  const styles = new Map<string, string>();
  const textStyles = new Map<string, string>();
  const tokens = new Map<string, { id: string; resolvedType: string }>();

  for (const style of raw.styles) {
    styles.set(`${style.type} ${tokenName(style.name)}`, style.id);

    if (style.type === "TEXT") {
      textStyles.set(style.name, style.id);
    }
  }

  for (const variable of raw.variables) {
    tokens.set(variableTokenName(variable), variable);
  }

  for (const [id, variable] of Object.entries(raw.external)) {
    tokens.set(variableTokenName(variable), {
      id,
      resolvedType: variable.resolvedType,
    });
  }

  const names = [...tokens.keys(), ...[...styles.keys()].map((key) => key.slice(key.indexOf(" ") + 1))];
  const unknown = (what: string, token: string, candidates: Iterable<string>) => {
    const near = closest(token, candidates);

    return new WriteError(
      `No ${what} is named ${token} in this file or the libraries its page uses.`,
      near === null ? "tokens_read lists the file's tokens." : `Did you mean ${near}?`,
    );
  };

  return {
    style: (token, kind) => styles.get(`${kind} ${token}`) ?? null,
    textStyle: (name) => {
      const id = textStyles.get(name);

      if (id === undefined) {
        throw unknown("text style", name, textStyles.keys());
      }

      return id;
    },
    variable: async (token, type) => {
      const entry = tokens.get(token);

      if (entry === undefined) {
        throw unknown(type === "COLOR" ? "paint style or colour variable" : "variable", token, names);
      }

      const variable = await figma.variables.getVariableByIdAsync(entry.id);

      if (variable === null) {
        throw new WriteError(
          `${token} names a variable Figma cannot reach now.`,
          "Enable its library, or use a value.",
        );
      }

      if (variable.resolvedType !== type) {
        throw new WriteError(
          `${token} is a ${variable.resolvedType.toLowerCase()} variable: this needs a ${type.toLowerCase()} one.`,
        );
      }

      return variable;
    },
  };
}
