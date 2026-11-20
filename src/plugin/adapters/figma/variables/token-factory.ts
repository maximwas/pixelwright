import { InjectionToken, injectable } from "@needle-di/core";
import { TOKEN_KIND } from "@/shared/ops/tokens-apply/tokens-apply.constants.ts";
import type { StylePlans, WritableType } from "@/shared/ops/tokens-apply/tokens-apply.schema.ts";

export type StyleGroup = keyof StylePlans;

/**
 * The file's own variables and styles as tokens_apply writes them (P-163): listed whole, which Figma gives offline too
 * where a by-id lookup waits (P-070), and made; an alias made from the variable itself (FX-052).
 */
@injectable()
export class TokenFactory {
  readonly #lists: Readonly<Record<StyleGroup, () => Promise<BaseStyle[]>>> = {
    [TOKEN_KIND.paint]: async () => await figma.getLocalPaintStylesAsync(),
    [TOKEN_KIND.text]: async () => await figma.getLocalTextStylesAsync(),
    [TOKEN_KIND.effect]: async () => await figma.getLocalEffectStylesAsync(),
  };

  readonly #makers: Readonly<Record<StyleGroup, () => BaseStyle>> = {
    [TOKEN_KIND.paint]: () => figma.createPaintStyle(),
    [TOKEN_KIND.text]: () => figma.createTextStyle(),
    [TOKEN_KIND.effect]: () => figma.createEffectStyle(),
  };

  async collections(): Promise<VariableCollection[]> {
    return await figma.variables.getLocalVariableCollectionsAsync();
  }

  async variables(): Promise<Variable[]> {
    return await figma.variables.getLocalVariablesAsync();
  }

  collection(name: string): VariableCollection {
    return figma.variables.createVariableCollection(name);
  }

  variable(
    name: string,
    collection: VariableCollection,
    type: WritableType,
  ): Variable {
    return figma.variables.createVariable(name, collection, type);
  }

  alias(variable: Variable): VariableAlias {
    return figma.variables.createVariableAlias(variable);
  }

  async styles(group: StyleGroup): Promise<BaseStyle[]> {
    return await this.#lists[group]();
  }

  /** A new style of the group with its name. */
  style(group: StyleGroup, name: string): BaseStyle {
    const style = this.#makers[group]();

    style.name = name;

    return style;
  }
}

export const TOKEN_FACTORY = new InjectionToken<TokenFactory>("TokenFactory");
