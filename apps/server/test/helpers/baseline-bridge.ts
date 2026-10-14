import { BridgeError, type RawTokens, type Snapshot, type SnapshotNode } from "@pixelwright/core";
import type { ConnectedPlugin } from "../../src/types/bridge.ts";
import type { BridgeView } from "../../src/types/mcp.ts";
import { pluginInfo } from "./fake-plugin.ts";
import type { RecordedRequest } from "./recording-bridge.ts";

/** What the fake file holds: the layer a read gets, the tokens, the selection, the version Figma saves. */
export interface BaselineFakeState {
  snapshot: Snapshot;
  tokens: RawTokens | Error;
  selection: string[];
  allowEdits?: boolean;
  /** Figma's answer to save_version: an id, an error, or none echoed back (an older plugin). */
  version?: { id: string | null; echo: boolean } | Error;
  file?: { name: string; key: string | null };
}

/**
 * A bridge over one file for the baseline tools: snapshot answers the state's read whatever node is asked, variables
 * its tokens, outline and find look in the read's layers, save_version saves. Every request is recorded; the state can
 * change between calls, as the designer would change the file.
 */
export function baselineBridge(state: BaselineFakeState) {
  const requests: RecordedRequest[] = [];
  const plugins = (): ConnectedPlugin[] => [
    {
      session: "s1",
      info: pluginInfo({
        pluginVersion: "0.3.0",
        file: state.file ?? {
          name: "Orbit",
          key: null,
        },
        allowEdits: state.allowEdits ?? false,
      }),
      active: true,
    },
  ];
  const bridge: BridgeView = {
    status: () => {
      throw new Error("not used");
    },
    pairing: () => null,
    plugins,
    request: async (op, input, options) => {
      requests.push({
        op,
        input: input as Record<string, unknown>,
        session: options?.session ?? null,
      });

      return answer(state, op, input as Record<string, unknown>);
    },
  };

  return {
    bridge,
    requests,
    ops: () => requests.map(({ op }) => op),
  };
}

function answer(state: BaselineFakeState, op: string, input: Record<string, unknown>): unknown {
  const layers = layersOf(state.snapshot.root);

  switch (op) {
    case "snapshot":
      return state.snapshot;
    case "variables":
      if (state.tokens instanceof Error) {
        throw state.tokens;
      }

      return state.tokens;
    case "selection":
      return { nodes: layers.filter((layer) => state.selection.includes(layer.id)).map(refOf) };
    case "outline":
      return outlineOf(layers, String(input.node));
    case "find":
      return {
        nodes: layers
          .filter((layer) => layer.name.toLowerCase().includes(String(input.name ?? "").toLowerCase()))
          .map((layer) => ({
            ...refOf(layer),
            path: [],
          })),
        more: false,
      };
    case "save_version":
      return savedVersion(state, input);
    default:
      throw new Error(`The baseline bridge does not answer ${op}.`);
  }
}

function savedVersion(state: BaselineFakeState, input: Record<string, unknown>): unknown {
  const version = state.version ?? {
    id: "123",
    echo: true,
  };

  if (version instanceof Error) {
    throw version;
  }

  return {
    id: version.id,
    ...(version.echo && typeof input.description === "string" ? { description: input.description } : {}),
  };
}

function outlineOf(layers: SnapshotNode[], id: string): unknown {
  const layer = layers.find((each) => each.id === id);

  if (layer === undefined) {
    throw new BridgeError("NODE_NOT_FOUND", `No node ${id} in this file.`);
  }

  return {
    root: {
      id: layer.id,
      name: layer.name,
      type: layer.type,
      childCount: layer.childCount,
    },
  };
}

function refOf(layer: SnapshotNode) {
  return {
    id: layer.id,
    name: layer.name,
    type: layer.type,
    box: null,
  };
}

function layersOf(root: SnapshotNode): SnapshotNode[] {
  return [root, ...(root.children ?? []).flatMap(layersOf)];
}
