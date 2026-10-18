import { CODE_SYNTAX_PLATFORMS, type CodeSyntax, sameScopes, type TokenVariable, tokenName } from "@pixelwright/core";
import type { TokenRun } from "./token-run.ts";
import { attempt, type WrittenVariable } from "./variable-attempt.ts";

/**
 * What a variable carries besides its values, written where the call's differs from the file's: its description, its
 * scopes, its code syntax (the token's WEB one, or each platform the call gives: "" removes one). Whether each changes.
 */
export async function writeMeta(
  run: TokenRun,
  item: WrittenVariable,
  shown: TokenVariable | undefined,
): Promise<boolean[]> {
  return [
    await writeDescription(run, item, shown),
    await writeScopes(run, item),
    await writeTokenSyntax(run, item, shown),
    ...(await writeCodeSyntax(run, item)),
  ];
}

async function writeDescription(run: TokenRun, item: WrittenVariable, shown: TokenVariable | undefined) {
  const { description } = item.plan;

  if (description === undefined || description === (shown?.description ?? "")) {
    return false;
  }

  return await attempt(run, item, (variable) => {
    variable.description = description;
  });
}

/** The scopes the call gives, unless the variable has them already (a new one has every field's). */
async function writeScopes(run: TokenRun, item: WrittenVariable): Promise<boolean> {
  const { scopes } = item.plan;

  if (scopes === undefined || sameScopes(scopes, item.held?.scopes ?? ["ALL_SCOPES"])) {
    return false;
  }

  return await attempt(run, item, (variable) => {
    variable.scopes = [...scopes];
  });
}

/** The WEB code syntax, when the call's token is not the one the variable's name gives and no WEB one is given. */
async function writeTokenSyntax(run: TokenRun, item: WrittenVariable, shown: TokenVariable | undefined) {
  const { token, name, codeSyntax } = item.plan;

  if (token === undefined || codeSyntax?.WEB !== undefined || token === (shown?.token ?? tokenName(name))) {
    return false;
  }

  return await attempt(run, item, (variable) => {
    variable.setVariableCodeSyntax("WEB", `var(${token})`);
  });
}

/** Each platform's code syntax the call gives and the variable lacks; a blank one removes the platform's. */
async function writeCodeSyntax(run: TokenRun, item: WrittenVariable): Promise<boolean[]> {
  const given = item.plan.codeSyntax ?? {};
  const held: CodeSyntax = item.held?.codeSyntax ?? {};
  const changes: boolean[] = [];

  for (const platform of CODE_SYNTAX_PLATFORMS) {
    const value = given[platform]?.trim();

    if (value !== undefined && value !== (held[platform] ?? "")) {
      changes.push(
        await attempt(run, item, (variable) => {
          if (value === "") {
            variable.removeVariableCodeSyntax(platform);
          } else {
            variable.setVariableCodeSyntax(platform, value);
          }
        }),
      );
    }
  }

  return changes;
}
