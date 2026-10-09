import type { BridgeView } from "../../../server/src/types/mcp.ts";
import { runOperation } from "../../src/figma/operations.ts";

/**
 * The server's view of the plugin with this plugin behind it: a request runs the plugin's operation on the fake Figma,
 * so a tool's server side and the plugin are tested together (testing them apart once hid a copy bug).
 */
export function pluginBridge(): BridgeView {
  return {
    status: () => {
      throw new Error("not used");
    },
    pairing: () => null,
    plugins: () => [
      {
        session: "s1",
        info: {
          instanceId: "window-a",
          pluginVersion: "0.1.0",
          editorType: "figma",
          file: {
            name: "Positivus",
            key: null,
          },
          page: {
            id: "0:1",
            name: "Page 1",
          },
          allowEdits: true,
          visible: true,
        },
        active: true,
      },
    ],
    request: async (op, input) => await runOperation(op, input),
  };
}
