import { Container, inject, injectable } from "@needle-di/core";
import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import { PLUGIN_LINK } from "@/core/ports/plugin-link/plugin-link.port.ts";
import { STATUS_HINTS } from "@/server/adapters/bridge/hints/status-hints/status-hints.tokens.ts";
import { StatusHints } from "@/server/adapters/bridge/hints/status-hints/status-hints.ts";
import { NoBridge } from "@/server/adapters/bridge/no-bridge/no-bridge.ts";
import { PinoLogger } from "@/server/adapters/logging/pino-logger/pino-logger.ts";
import { CallId } from "@/server/app/tool-runner/call-id/call-id.ts";
import { Tool } from "@/server/app/tool-runner/tool/tool.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { TOOL_CONTEXT } from "@/server/app/tool-runner/tool-runner/tool-runner.tokens.ts";
import { ContainerToolFactory } from "@/server/main/container-tool-factory/container-tool-factory.ts";

/** A tool that shows what it was built with. */
@injectable()
class WiringTool extends Tool {
  protected readonly input = zod.object({});
  readonly link;
  readonly context;

  constructor(
    link = inject(PLUGIN_LINK),
    context = inject(TOOL_CONTEXT),
  ) {
    super();
    this.link = link;
    this.context = context;
  }

  protected async run(): Promise<Record<string, never>> {
    return {};
  }
}

const MANIFEST: ToolManifest = {
  name: "wiring",
  title: "Wiring",
  description: "A tool for the factory's tests.",
  input: zod.object({}),
  output: zod.object({}),
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  load: async () => WiringTool,
};

class FactoryProbe {
  readonly root = new Container()
    .bind({
      provide: STATUS_HINTS,
      useValue: new StatusHints([]),
    })
    .bind({
      provide: PLUGIN_LINK,
      useClass: NoBridge,
    });
  readonly factory = new ContainerToolFactory(this.root);
  readonly logger = new PinoLogger(
    {
      level: "silent",
      file: "unused",
    },
    [],
  );

  async build(): Promise<WiringTool> {
    const context = {
      callId: CallId.next(),
      logger: this.logger,
      signal: new AbortController().signal,
    };
    const tool = await this.factory.create(MANIFEST, context);

    if (!(tool instanceof WiringTool)) {
      throw new Error("the factory built another tool");
    }

    return tool;
  }
}

describe("ContainerToolFactory", () => {
  it("builds a new tool for each call, with that call's context", async () => {
    const probe = new FactoryProbe();
    const first = await probe.build();
    const second = await probe.build();

    expect(first).not.toBe(second);
    expect(first.context.callId).not.toBe(second.context.callId);
  });

  it("hands every call the root's singletons, not new ones", async () => {
    const probe = new FactoryProbe();
    const first = await probe.build();
    const second = await probe.build();

    expect(first.link).toBe(second.link);
    expect(first.link).toBe(probe.root.get(PLUGIN_LINK));
  });
});
