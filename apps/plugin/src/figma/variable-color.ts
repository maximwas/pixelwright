/** Aliases followed at most this deep for a variable's default colour. */
const ALIAS_DEPTH = 4;

const isRgba = (value: unknown): value is RGBA =>
  typeof value === "object" && value !== null && "r" in value && "g" in value && "b" in value && "a" in value;

const isAlias = (value: unknown): value is VariableAlias =>
  typeof value === "object" && value !== null && "type" in value && value.type === "VARIABLE_ALIAS";

/**
 * The colour a colour variable gives a layer: its value in the layer's mode, as Figma resolves it, else its
 * collection's default mode's, aliases followed; null when there is none to read.
 */
export async function variableColor(variable: Variable, consumer?: SceneNode): Promise<RGBA | null> {
  if (consumer !== undefined && typeof variable.resolveForConsumer === "function") {
    try {
      const { value } = variable.resolveForConsumer(consumer);

      if (isRgba(value)) {
        return value;
      }
    } catch {
      // A layer Figma cannot resolve the variable for: its default value below.
    }
  }

  return await defaultColor(variable, ALIAS_DEPTH);
}

async function defaultColor(variable: Variable, depth: number): Promise<RGBA | null> {
  const collection = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
  const value = collection === null ? undefined : variable.valuesByMode[collection.defaultModeId];

  if (isRgba(value)) {
    return value;
  }

  if (!isAlias(value) || depth === 0) {
    return null;
  }

  const target = await figma.variables.getVariableByIdAsync(value.id);

  return target === null ? null : await defaultColor(target, depth - 1);
}
