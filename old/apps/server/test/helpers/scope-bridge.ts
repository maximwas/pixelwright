import type { BridgeView } from "../../src/types/mcp.ts";
import { pluginInfo } from "./fake-plugin.ts";

/** A bridge to one plugin whose answers a test gives, recording what it was asked. */
export interface BindView {
  readonly bridge: BridgeView;
  /** The operations asked for in order, a dry run marked: "bind (dry run)". */
  readonly asked: string[];
  /** The last input of each operation. */
  readonly inputs: Record<string, unknown>;
}

/** A file's pages for file_map, each with its top layers. */
interface FakePage {
  readonly id: string;
  readonly name: string;
  readonly nodes?: readonly { id: string; name: string; type?: string }[];
}

const PAGES: readonly FakePage[] = [
  {
    id: "0:1",
    name: "Pricing",
    nodes: [
      {
        id: "1:1",
        name: "Desktop",
      },
    ],
  },
];

/**
 * A plugin answering selection and file_map from what the test gives, save_version with v-1, and every other operation
 * from `answers` (a function gets the input).
 */
export function scopeBridge({
  selection,
  pages = PAGES,
  answers = {},
}: {
  selection: readonly string[];
  pages?: readonly FakePage[];
  answers?: Record<string, unknown>;
}): BindView {
  const asked: string[] = [];
  const inputs: Record<string, unknown> = {};
  const known: Record<string, (input: unknown) => unknown> = {
    selection: () => ({
      nodes: selection.map((id) => ({
        id,
        name: id,
        type: "FRAME",
        box: null,
      })),
    }),
    file_map: () => ({
      pages: pages.map((page, index) => ({
        id: page.id,
        name: page.name,
        current: index === 0,
        nodes: (page.nodes ?? []).map((node) => ({
          type: "FRAME",
          width: 100,
          height: 100,
          ...node,
        })),
      })),
      more: false,
    }),
    save_version: () => ({ id: "v-1" }),
  };
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
    request: async (op, input) => {
      asked.push((input as { dryRun?: boolean } | null)?.dryRun ? `${op} (dry run)` : op);
      inputs[op] = input;

      const answer = known[op] ?? answers[op];

      if (answer === undefined) {
        throw new Error(`The test gave no answer for ${op}.`);
      }

      return typeof answer === "function" ? (answer as (input: unknown) => unknown)(input) : answer;
    },
  };

  return {
    bridge,
    asked,
    inputs,
  };
}
