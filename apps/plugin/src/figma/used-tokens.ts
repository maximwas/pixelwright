/** The style ids and variable aliases the layers under `root` (and `root`) use. A page must be loaded first. */
export function usedUnder(root: BaseNode): { styleIds: Set<string>; variableIds: string[] } {
  const styleIds = new Set<string>();
  const variableIds: string[] = [];
  const layers = "findAll" in root ? [root, ...root.findAll(() => true)] : [root];

  for (const layer of layers) {
    usedBy(layer, styleIds, variableIds);
  }

  return {
    styleIds,
    variableIds,
  };
}

/** Loads a page other than the current one, so its layers can be read (the plugin reads pages on demand). */
export async function loaded(root: BaseNode): Promise<void> {
  if (root.type === "PAGE" && root !== figma.currentPage) {
    await root.loadAsync();
  }
}

/** The style ids and variable aliases one layer uses: its own, its paints' and effects', its text runs'. */
function usedBy(layer: BaseNode, styleIds: Set<string>, variableIds: string[]): void {
  const record = layer as BaseNode & Record<string, unknown>;

  for (const key of ["fillStyleId", "strokeStyleId", "effectStyleId", "textStyleId"]) {
    const id = record[key];

    if (typeof id === "string" && id !== "") {
      styleIds.add(id);
    }
  }

  for (const id of runStyles(layer)) {
    styleIds.add(id);
  }

  variableIds.push(...aliasesIn([record.boundVariables, record.fills, record.strokes, record.effects]));
}

/** The styles a text's runs use, where the text's own say mixed. */
function runStyles(layer: BaseNode): string[] {
  if (layer.type !== "TEXT" || (layer.fillStyleId !== figma.mixed && layer.textStyleId !== figma.mixed)) {
    return [];
  }

  return layer
    .getStyledTextSegments(["fillStyleId", "textStyleId"])
    .flatMap((segment) => [segment.fillStyleId, segment.textStyleId])
    .filter((id) => id !== "");
}

/** Every variable alias inside a value, however deep (paints, effects, bound fields, composed colours). */
export function aliasesIn(value: unknown): string[] {
  const found: string[] = [];
  const scan = (item: unknown): void => {
    if (Array.isArray(item)) {
      item.forEach(scan);
    } else if (typeof item === "object" && item !== null) {
      if ("type" in item && item.type === "VARIABLE_ALIAS" && "id" in item) {
        found.push(String(item.id));
      } else {
        Object.values(item).forEach(scan);
      }
    }
  };

  scan(value);

  return found;
}
