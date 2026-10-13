import { closest, type RawTokens, styleTokenName, tokenName, variableTokenName } from "@pixelwright/core";
import { variables } from "./variables.ts";
import { WriteError } from "./write-error.ts";

type StyleKind = "PAINT" | "EFFECT" | "TEXT";

/**
 * Tokens by the CSS names design_read gives them (text styles also by their own name, as textStyle names them): the
 * file's styles and variables and the library ones its pages use, then the enabled libraries' variables, so what a
 * read wrote binds back wherever the file uses it.
 */
export interface TokenIndex {
  /** A style's id, or null when no style of that kind has the name. */
  style(token: string, kind: StyleKind): Promise<string | null>;
  /** A text style's id by its name; an error naming close ones when none has it. */
  textStyle(name: string): Promise<string>;
  /** A variable of the type (of any type when none is given), or an error naming close tokens. */
  variable(token: string, type?: VariableResolvedDataType): Promise<Variable>;
}

/**
 * Built from what the current page uses; a name it lacks is looked for once on the file's other pages, then a variable
 * among the enabled libraries' (imported on use, which writes: a dry run only finds it and gets a stand-in).
 */
export async function tokenIndex({ importing = true }: { importing?: boolean } = {}): Promise<TokenIndex> {
  const styles = new Map<string, string>();
  const textStyles = new Map<string, string>();
  const tokens = new Map<string, { id: string; resolvedType: string }>();
  const take = (raw: RawTokens) => {
    for (const style of raw.styles) {
      styles.set(`${style.type} ${styleTokenName(style)}`, style.id);

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
  };

  take(
    await variables({
      libraries: false,
      used: true,
    }),
  );

  let farther: Promise<void> | null = null;
  // The other pages, read once and only when a name is missing: loading every page is slow on big files.
  const lookFarther = () => {
    farther ??= (async () => {
      await figma.loadAllPagesAsync();

      for (const page of figma.root.children) {
        if (page.id !== figma.currentPage.id) {
          take(
            await variables({
              libraries: false,
              used: true,
              within: page.id,
            }),
          );
        }
      }
    })();

    return farther;
  };
  let catalogue: Promise<Map<string, LibraryVariable>> | null = null;
  const libraries = () => {
    catalogue ??= libraryVariables();

    return catalogue;
  };
  const names = () => [...tokens.keys(), ...[...styles.keys()].map((key) => key.slice(key.indexOf(" ") + 1))];
  const unknown = (what: string, token: string, candidates: Iterable<string>) => {
    const near = closest(token, candidates);

    return new WriteError(
      `No ${what} is named ${token} in this file or the libraries it uses.`,
      near === null ? "tokens_read lists the file's tokens." : `Did you mean ${near}?`,
    );
  };
  // A name a variable has is a variable's: no style of it is looked for farther.
  const style = async (token: string, kind: StyleKind) => {
    if (!styles.has(`${kind} ${token}`) && !tokens.has(token)) {
      await lookFarther();
    }

    return styles.get(`${kind} ${token}`) ?? null;
  };
  const imports = new Map<string, Promise<Variable>>();

  return {
    style,
    textStyle: async (name) => {
      if (!textStyles.has(name)) {
        await lookFarther();
      }

      const id = textStyles.get(name);

      if (id === undefined) {
        throw unknown("text style", name, textStyles.keys());
      }

      return id;
    },
    variable: async (token, type) => {
      if (!tokens.has(token)) {
        await lookFarther();
      }

      const entry = tokens.get(token);

      if (entry === undefined) {
        const listed = (await libraries()).get(token);

        if (listed === undefined) {
          throw unknown(type === "COLOR" ? "paint style or colour variable" : "variable", token, names());
        }

        // Each library variable brought in once per call, however often it is named.
        let brought = imports.get(listed.key);

        if (brought === undefined) {
          brought = imported(listed, importing);
          imports.set(listed.key, brought);
        }

        return ofType(await brought, token, type);
      }

      const variable = await figma.variables.getVariableByIdAsync(entry.id);

      if (variable === null) {
        throw new WriteError(
          `${token} names a variable Figma cannot reach now.`,
          "Enable its library, or use a value.",
        );
      }

      return ofType(variable, token, type);
    },
  };
}

/** An enabled library's variable as figma.teamLibrary lists it. */
interface LibraryVariable {
  readonly key: string;
  readonly name: string;
  readonly resolvedType: string;
}

/** The enabled libraries' variables by the CSS name design_read would give them; none when the libraries fail. */
async function libraryVariables(): Promise<Map<string, LibraryVariable>> {
  const found = new Map<string, LibraryVariable>();

  try {
    for (const collection of await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()) {
      for (const variable of await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collection.key)) {
        found.set(tokenName(variable.name), variable);
      }
    }
  } catch {
    // Libraries that cannot be read leave the name unknown, which is the error the caller gives.
  }

  return found;
}

/** A library variable brought into the file, or on a dry run a stand-in that only says it is there. */
async function imported(listed: LibraryVariable, importing: boolean): Promise<Variable> {
  if (!importing) {
    return {
      id: `library:${listed.key}`,
      name: listed.name,
      resolvedType: listed.resolvedType,
    } as unknown as Variable;
  }

  return await figma.variables.importVariableByKeyAsync(listed.key);
}

/** The variable, when it is of the type asked for (any type when none is). */
function ofType(variable: Variable, token: string, type: VariableResolvedDataType | undefined): Variable {
  if (type !== undefined && variable.resolvedType !== type) {
    throw new WriteError(
      `${token} is a ${variable.resolvedType.toLowerCase()} variable: this needs a ${type.toLowerCase()} one.`,
    );
  }

  return variable;
}
