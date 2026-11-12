// Bridge config shared by every pixelwright process on this machine: the bridge port and the peers' token.
import { randomBytes } from "node:crypto";
import { chmodSync, linkSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_BRIDGE_PORT } from "../constants/bridge.ts";
import { BridgeConfigSchema, PortSchema } from "../schemas/bridge.ts";
import type { BridgeConfig, BridgeConfigOptions } from "../types/bridge.ts";

/** Where pixelwright keeps what outlives a process: PIXELWRIGHT_HOME, by default ~/.pixelwright. */
export function homeDir(env: Record<string, string | undefined> = process.env): string {
  return env.PIXELWRIGHT_HOME?.trim() || join(homedir(), ".pixelwright");
}

/** Where bridge.json lives: in the home dir. */
export function bridgeConfigFile(env: Record<string, string | undefined> = process.env): string {
  return join(homeDir(env), "bridge.json");
}

/**
 * Reads `bridge.json` in PIXELWRIGHT_HOME (default ~/.pixelwright), creating it on first use. The first pixelwright process
 * creates the file; every other one reads it. The file's port wins over PIXELWRIGHT_BRIDGE_PORT, so all processes
 * agree: delete the file to apply a new port.
 */
export function loadOrCreateBridgeConfig(options: BridgeConfigOptions = {}): BridgeConfig {
  const env = options.env ?? process.env;
  const warn = options.warn ?? console.warn;
  const file = bridgeConfigFile(env);

  mkdirSync(dirname(file), {
    recursive: true,
    mode: 0o700,
  });

  const envPort = readEnvPort(env, warn);
  const created = createConfigFile(file, envPort ?? DEFAULT_BRIDGE_PORT);

  if (created !== null) {
    return created;
  }

  const existing = readConfigFile(file);

  if (envPort !== null && envPort !== existing.port) {
    warn(
      `PIXELWRIGHT_BRIDGE_PORT differs from the port in ${file}, and the file wins. Delete the file, then restart the MCP server to use the new port.`,
    );
  }

  return existing;
}

function readEnvPort(env: Record<string, string | undefined>, warn: (message: string) => void): number | null {
  const raw = env.PIXELWRIGHT_BRIDGE_PORT?.trim();

  if (raw === undefined || raw === "") {
    return null;
  }

  const port = PortSchema.safeParse(Number(raw));

  if (port.success) {
    return port.data;
  }

  warn("PIXELWRIGHT_BRIDGE_PORT must be an integer from 1024 to 65535; ignoring it.");

  return null;
}

/** Creates the file unless it exists: link(2) of a private temp file is an atomic "create if absent". */
function createConfigFile(file: string, port: number): BridgeConfig | null {
  const fresh: BridgeConfig = {
    version: 1,
    port,
    token: randomBytes(32).toString("base64url"),
    pluginKeys: [],
  };
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;

  writeFileSync(temp, `${JSON.stringify(fresh, null, 2)}\n`, {
    mode: 0o600,
    flag: "wx",
  });

  try {
    linkSync(temp, file);

    return fresh;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      return null;
    }

    throw error;
  } finally {
    unlinkSync(temp);
  }
}

function readConfigFile(file: string): BridgeConfig {
  if ((statSync(file).mode & 0o077) !== 0) {
    chmodSync(file, 0o600);
  }

  // Neither the JSON error nor the zod issues are shown: they could quote the token.
  const config = BridgeConfigSchema.safeParse(parseJson(readFileSync(file, "utf8")));

  if (!config.success) {
    throw new Error(`Invalid ${file}. Delete it and restart the MCP server.`);
  }

  return config.data;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
