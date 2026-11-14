import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import type { PluginArrival, PluginArrivals } from "@/core/ports/plugin-arrivals.port.ts";
import { LINK_TEXT, PLUGIN_ARRIVAL } from "@/core/ports/plugin-link.constants.ts";
import type { ConnectedFile, PluginLink, PluginLinkRole, PluginLinkState } from "@/core/ports/plugin-link.port.ts";
import { PluginSessions } from "@/server/app/sessions/plugin-sessions.ts";
import { TargetResolver } from "@/server/app/sessions/target-resolver.ts";
import { CallId } from "@/server/app/tool-runner/call-id.ts";
import { TargetStep } from "@/server/app/tool-runner/steps/target-step.ts";
import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import type { ToolCall } from "@/server/app/tool-runner/tool-runner.ts";

const file: ConnectedFile = {
  session: "a",
  name: "Test MCP",
  key: null,
  page: "Start here",
  editorType: "figma",
  allowEdits: true,
  visible: true,
  active: true,
  pluginVersion: "0.9.0",
};

/** The bridge as the step sees it: the files now. */
class FakeLink implements PluginLink {
  connected: ConnectedFile[] = [];

  async start(): Promise<void> {}

  async close(): Promise<void> {}

  async state(): Promise<PluginLinkState> {
    return { role: this.role(), port: 18_721, files: this.connected, pairing: null, hint: null };
  }

  role(): PluginLinkRole {
    return "owner";
  }

  files(): readonly ConnectedFile[] {
    return this.connected;
  }

  request(): Promise<unknown> {
    return Promise.resolve(undefined);
  }
}

/** The arrivals' answer is scripted; `onWait` is what happens while the call waits. */
class ScriptedArrivals implements PluginArrivals {
  waits = 0;
  readonly #arrival: PluginArrival;
  readonly #onWait: () => void;

  constructor(arrival: PluginArrival, onWait: () => void = () => undefined) {
    this.#arrival = arrival;
    this.#onWait = onWait;
  }

  up(): void {}

  left(): void {}

  arrived(): void {}

  async wait(): Promise<PluginArrival> {
    this.waits += 1;
    this.#onWait();

    return this.#arrival;
  }
}

const manifest = (input: zod.ZodMiniObject, ownTarget = false): ToolManifest => ({
  name: "probe",
  title: "Probe",
  description: "",
  input,
  output: zod.object({}),
  annotations: TOOL_ANNOTATIONS.read,
  ownTarget,
  load: () => Promise.reject(new Error("not loaded in this test")),
});

const TAKES_FILE = zod.object({ file: zod.optional(zod.string()) });

const call = (tool: ToolManifest): ToolCall => ({
  manifest: tool,
  args: {},
  callId: CallId.next(),
  signal: new AbortController().signal,
});

/** The step over a link and arrivals; `seen` is the session id each call's next step got. */
const setup = (link: FakeLink, arrivals: PluginArrivals) => {
  const seen: (string | undefined)[] = [];
  const step = new TargetStep(new PluginSessions(link, new TargetResolver(), []), link, arrivals);
  const handle = (tool: ToolManifest) =>
    step.handle(call(tool), async (next) => {
      seen.push(next.session?.id);

      return { content: [] };
    });

  return { handle, seen };
};

describe("TargetStep waiting for the plugin", () => {
  it("binds the file that connected while the call waited", async () => {
    const link = new FakeLink();
    const arrivals = new ScriptedArrivals(PLUGIN_ARRIVAL.arrived, () => {
      link.connected = [file];
    });
    const { handle, seen } = setup(link, arrivals);

    await handle(manifest(TAKES_FILE));

    expect(seen).toEqual(["a"]);
    expect(arrivals.waits).toBe(1);
  });

  it("says the plugin left and has not come back when the wait ends after a file was connected a moment ago", async () => {
    const { handle } = setup(new FakeLink(), new ScriptedArrivals(PLUGIN_ARRIVAL.left));

    await expect(handle(manifest(TAKES_FILE))).rejects.toMatchObject({
      code: "PLUGIN_NOT_CONNECTED",
      message: LINK_TEXT.pluginLeft,
    });
  });

  it("fails with the run-the-plugin advice when no plugin is expected", async () => {
    const { handle } = setup(new FakeLink(), new ScriptedArrivals(PLUGIN_ARRIVAL.absent));

    await expect(handle(manifest(TAKES_FILE))).rejects.toMatchObject({
      code: "PLUGIN_NOT_CONNECTED",
      message: LINK_TEXT.notConnected,
    });
  });

  it("does not wait while a file is connected", async () => {
    const link = new FakeLink();
    const arrivals = new ScriptedArrivals(PLUGIN_ARRIVAL.arrived);
    const { handle, seen } = setup(link, arrivals);

    link.connected = [file];
    await handle(manifest(TAKES_FILE));

    expect(seen).toEqual(["a"]);
    expect(arrivals.waits).toBe(0);
  });

  it("does not wait for a tool that takes no file (status) or finds its own files", async () => {
    const arrivals = new ScriptedArrivals(PLUGIN_ARRIVAL.left);
    const { handle, seen } = setup(new FakeLink(), arrivals);

    await handle(manifest(zod.object({})));
    await handle(manifest(TAKES_FILE, true));

    expect(seen).toEqual([undefined, undefined]);
    expect(arrivals.waits).toBe(0);
  });
});
