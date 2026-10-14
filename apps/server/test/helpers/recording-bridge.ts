import { type ApplyChange, type ApplyError, BridgeError, type Snapshot } from "@pixelwright/core";
import type { BridgeView } from "../../src/types/mcp.ts";
import { pluginInfo } from "./fake-plugin.ts";

/** A request the bridge was asked, with the session it was sent to (none: the active one). */
export interface RecordedRequest {
  readonly op: string;
  readonly input: Record<string, unknown>;
  readonly session: string | null;
}

/** How the recording bridge answers. */
export interface RecordingOptions {
  /** Entries answer with the root's children cut, as when the read passes its size budget. */
  readonly cut?: boolean;
  /** Ids entries says the file does not hold. */
  readonly missing?: readonly string[];
  /** Errors the plugin's apply answers with, besides what it writes. */
  readonly pluginErrors?: readonly ApplyError[];
}

/**
 * A bridge over one snapshot that records every request. Entries answer with the snapshot (cut below the root when
 * asked); apply answers what it was given, a create with a made-up id; save_version saves, refuses for the title
 * "fails" and is unknown to an "old plugin"; upload takes every chunk.
 */
export function recordingBridge(snapshot: Snapshot, options: RecordingOptions = {}) {
  const requests: RecordedRequest[] = [];
  const bridge: BridgeView = {
    status: () => {
      throw new Error("not used");
    },
    pairing: () => null,
    plugins: () => [
      {
        session: "s1",
        info: pluginInfo(),
        active: true,
      },
    ],
    request: async (op, input, requestOptions) => {
      requests.push({
        op,
        input: input as Record<string, unknown>,
        session: requestOptions?.session ?? null,
      });

      return answer(snapshot, op, input, options);
    },
  };

  return {
    bridge,
    requests,
    sent: () => (requests.find(({ op }) => op === "apply")?.input.changes ?? []) as ApplyChange[],
  };
}

function answer(snapshot: Snapshot, op: string, input: unknown, options: RecordingOptions): unknown {
  switch (op) {
    case "save_version":
      return savedVersion((input as { title: string }).title);
    case "upload": {
      const { offset, chunk } = input as { offset: number; chunk: string };

      return { received: offset + Buffer.from(chunk, "base64").length };
    }
    case "entries":
      return entriesOf(snapshot, options);
    default:
      return applied((input as { changes: ApplyChange[] }).changes, options.pluginErrors ?? []);
  }
}

function savedVersion(title: string): { id: string } {
  if (title === "fails") {
    throw new Error("Figma refused the version");
  }

  if (title === "old plugin") {
    throw new BridgeError("UNKNOWN_OP", "Unknown operation: save_version");
  }

  return { id: "v-1" };
}

function entriesOf(snapshot: Snapshot, { cut = false, missing = [] }: RecordingOptions) {
  return {
    roots: [
      {
        node: cut
          ? {
              ...snapshot.root,
              children: [],
            }
          : snapshot.root,
        parent: null,
      },
    ],
    missing,
    styles: snapshot.styles,
    variables: snapshot.variables,
    ...(snapshot.colorProfile === undefined ? {} : { colorProfile: snapshot.colorProfile }),
  };
}

function applied(changes: readonly ApplyChange[], errors: readonly ApplyError[]) {
  return {
    created: changes
      .filter((change) => change.kind === "create")
      .map((change) => ({
        line: change.line,
        ref: change.ref,
        id: `90:${change.line}`,
        tag: change.tag,
      })),
    changed: changes.flatMap((change) => (change.id === null ? [] : [change.id])),
    errors,
  };
}
