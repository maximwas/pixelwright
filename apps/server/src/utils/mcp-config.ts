/**
 * An MCP client's config with the server added under mcpServers, everything else kept; `changed` is false when the
 * same entry is there already. Throws when the config is not a JSON object: better no change than a broken file.
 */
export function mergeMcpServer(
  config: unknown,
  name: string,
  entry: Readonly<Record<string, unknown>>,
): { config: Record<string, unknown>; changed: boolean } {
  const current = config ?? {};

  if (!isRecord(current)) {
    throw new Error("The MCP config must be a JSON object.");
  }

  const servers = current.mcpServers ?? {};

  if (!isRecord(servers)) {
    throw new Error("The MCP config has an unexpected mcpServers section.");
  }

  if (JSON.stringify(servers[name]) === JSON.stringify(entry)) {
    return {
      config: current,
      changed: false,
    };
  }

  return {
    config: {
      ...current,
      mcpServers: {
        ...servers,
        [name]: entry,
      },
    },
    changed: true,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
