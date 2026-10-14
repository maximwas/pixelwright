import { BridgeError, type RawTokens, type Snapshot, usedTokens } from "@pixelwright/core";
import type { PluginSession } from "../plugin/plugin-session.ts";
import { errorMessage } from "../utils/error-message.ts";

/** A layer read as a baseline keeps it, with when and by which plugin. */
export interface Capture {
  /** As nodes_diff reads it: Figma's CSS where core cannot write it yet, vector paths hashed. */
  readonly snapshot: Snapshot;
  /** The tokens the layer uses, with every mode; null when they could not be read. */
  readonly tokens: RawTokens | null;
  readonly capturedAt: string;
  readonly plugin: string | null;
  readonly notes: string[];
}

/** Reads a layer for a baseline on one session: its snapshot, then the tokens it uses. A hidden root is refused. */
export async function captureLayer(session: PluginSession, node: string): Promise<Capture> {
  const capturedAt = new Date().toISOString();
  const snapshot = await session.run("snapshot", {
    node,
    css: "unmapped",
    paths: true,
  });

  if (!snapshot.root.visible) {
    throw new BridgeError(
      "OP_FAILED",
      `${node} is hidden in Figma, and a hidden layer is read as a name and a box only: show it, or read a visible one.`,
    );
  }

  const notes: string[] = [];
  let tokens: RawTokens | null = null;

  try {
    tokens = usedTokens(
      await session.run("variables", {
        used: true,
        within: node,
      }),
      snapshot,
    );
  } catch (error) {
    notes.push(
      `The tokens could not be read (${errorMessage(error)}): a diff compares them as the reads wrote them, one mode.`,
    );
  }

  return {
    snapshot,
    tokens,
    capturedAt,
    plugin: session.info()?.pluginVersion ?? null,
    notes,
  };
}
