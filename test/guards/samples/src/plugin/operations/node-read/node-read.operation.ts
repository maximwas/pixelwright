// Planted: an operation looks a layer up by id with the figma global. Refused by no-restricted-globals (figma outside
// plugin/adapters and plugin/main) and no-restricted-syntax (get*ByIdAsync outside plugin/adapters/figma/lookup/).
export class NodeReadOperation {
  async run(id: string): Promise<string | undefined> {
    const node = await figma.getNodeByIdAsync(id);

    return node?.name;
  }
}
