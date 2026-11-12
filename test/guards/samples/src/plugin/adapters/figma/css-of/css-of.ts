// Planted: an adapter asks Figma for its CSS. Refused by no-restricted-syntax (getCSSAsync anywhere).
export class CssReader {
  async read(node: SceneNode): Promise<Record<string, string>> {
    return await node.getCSSAsync();
  }
}
