/** A layer's Dev Mode status as the tools write it: ready (for development) or completed; none when unmarked. */
export function devStatusOf(node: BaseNode): "ready" | "completed" | undefined {
  const status = "devStatus" in node ? node.devStatus : null;

  if (status?.type === "READY_FOR_DEV") {
    return "ready";
  }

  return status?.type === "COMPLETED" ? "completed" : undefined;
}

/** The status of the layer or of the nearest layer above it that has one: Figma marks frames and sections. */
export function nearestDevStatus(node: BaseNode): "ready" | "completed" | undefined {
  for (let current: BaseNode | null = node; current !== null; current = current.parent) {
    const status = devStatusOf(current);

    if (status !== undefined) {
      return status;
    }
  }

  return undefined;
}
