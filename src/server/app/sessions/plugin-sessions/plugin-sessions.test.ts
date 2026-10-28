import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkState,
} from "@/core/ports/plugin-link/plugin-link.port.ts";
import { PluginSessions } from "@/server/app/sessions/plugin-sessions/plugin-sessions.ts";
import { OpResultStep } from "@/server/app/sessions/steps/op-result-step/op-result-step.ts";
import { OpTimerStep } from "@/server/app/sessions/steps/op-timer-step/op-timer-step.ts";
import { TargetResolver } from "@/server/app/sessions/target-resolver/target-resolver.ts";
import { CallId } from "@/server/app/tool-runner/call-id/call-id.ts";
import { ErrorTextStep } from "@/server/app/tool-runner/steps/error-text-step/error-text-step.ts";
import { TOOL_ANNOTATIONS } from "@/server/app/tool-runner/tool-annotations.constants.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error/pixelwright-error.ts";
import { OpContract } from "@/shared/ops/op-contract/op-contract.ts";
import { OP_NAME, OP_TURN } from "@/shared/ops/op-meta.constants.ts";
import { pingOp } from "@/shared/ops/ping/ping.manifest.ts";

const file = (
  session: string,
  active: boolean,
): ConnectedFile => ({
  session,
  name: session === "a" ? "Test MCP" : "Orbit",
  key: null,
  page: "Start here",
  editorType: "figma",
  allowEdits: true,
  visible: active,
  active,
  pluginVersion: "0.8.0",
});

const envelope = (data: unknown) => ({
  ok: true,
  data,
  cuts: [],
  missing: [],
  touched: [],
});

/** The bridge as the sessions see it: the files now, and every request it was handed, answered by `answer`. */
class FakeLink implements PluginLink {
  connected: ConnectedFile[];
  readonly requests: OpRequest[] = [];
  readonly #answer: () => Promise<unknown>;

  constructor(
    connected: ConnectedFile[],
    answer: () => Promise<unknown>,
  ) {
    this.connected = connected;
    this.#answer = answer;
  }

  async start(): Promise<void> {}

  async close(): Promise<void> {}

  state(): PluginLinkState {
    return {
      role: "owner",
      port: 18_721,
      files: this.connected,
      pairing: null,
      hint: null,
    };
  }

  files(): readonly ConnectedFile[] {
    return this.connected;
  }

  request(request: OpRequest): Promise<unknown> {
    this.requests.push(request);

    return this.#answer();
  }
}

/** A write tool as the runner hands it over; its code never loads here. */
const nodesDelete: ToolManifest = {
  name: "nodes_delete",
  title: "Delete layers",
  description: "",
  input: zod.object({}),
  output: zod.object({}),
  annotations: TOOL_ANNOTATIONS.write,
  load: () => Promise.reject(new Error("not loaded in this test")),
};

const sessions = (link: PluginLink) =>
  new PluginSessions(link, new TargetResolver(), [new OpTimerStep(), new OpResultStep()]);

describe("PluginSessions", () => {
  it("keeps a call on its file when another file comes to the front meanwhile (T-002)", async () => {
    const link = new FakeLink([file("a", true), file("b", false)], async () => envelope({ pong: true }));
    const session = sessions(link).session(undefined);

    await session.run(pingOp, {});
    link.connected = [file("a", false), file("b", true)];
    await session.run(pingOp, {});

    expect(link.requests.map((request) => request.session)).toEqual(["a", "a"]);
  });

  it("refuses an answer that does not match the op's output, and keeps the plugin's own error code (T-002)", async () => {
    const odd = sessions(new FakeLink([file("a", true)], async () => envelope({ pong: false }))).session(undefined);
    const failed = sessions(
      new FakeLink([file("a", true)], async () => ({
        ok: false,
        error: {
          code: "EDITS_DISABLED",
          message: "Allow edits is off",
        },
        cuts: [],
        missing: [],
        touched: [],
      })),
    ).session(undefined);

    await expect(odd.run(pingOp, {})).rejects.toMatchObject({ code: "OP_FAILED" });
    await expect(failed.run(pingOp, {})).rejects.toMatchObject({ code: "EDITS_DISABLED" });
  });

  it("says a timed-out write may still be writing, under the tool's name (S-009, A§6.5)", async () => {
    const write = new OpContract({
      name: OP_NAME.ping,
      input: zod.strictObject({}),
      output: zod.object({}),
      meta: {
        write: true,
        dryRun: false,
        timeoutMs: 1_000,
        needsAllowEdits: true,
        turn: OP_TURN.write,
      },
    });
    const session = sessions(
      new FakeLink([file("a", true)], async () => {
        throw new PixelwrightError("TIMEOUT", "ping: the plugin did not answer in 1 s");
      }),
    ).session(undefined);
    const answer = await new ErrorTextStep().handle(
      {
        manifest: nodesDelete,
        args: {},
        signal: new AbortController().signal,
        callId: CallId.next(),
      },
      async () => {
        await session.run(write, {});

        return { content: [] };
      },
    );

    expect(answer.content[0]?.text).toBe(
      "TIMEOUT: nodes_delete: the plugin may still be writing: read the layers before you retry",
    );
  });
});
