import { describe, expect, it } from "vitest";
import type {
  ConnectedFile,
  OpRequest,
  PluginLink,
  PluginLinkRole,
  PluginLinkState,
} from "@/core/ports/plugin-link.port.ts";
import { PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { VersionedWrite } from "@/server/app/writes/versioned-write.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

/** A plugin that saves versions, or refuses to with `refusal`; every step of the call kept in order. */
class VersionPlugin implements PluginLink {
  readonly steps: string[];
  readonly #refusal: PixelwrightError | undefined;

  constructor(steps: string[], refusal?: PixelwrightError) {
    this.steps = steps;
    this.#refusal = refusal;
  }

  async start(): Promise<void> {}

  async close(): Promise<void> {}

  async state(): Promise<PluginLinkState> {
    throw new Error("only status reads the state");
  }

  role(): PluginLinkRole {
    return "owner";
  }

  files(): readonly ConnectedFile[] {
    return [];
  }

  async request({ op, input }: OpRequest): Promise<unknown> {
    this.steps.push(`${op} ${(input as { title: string }).title}`);

    if (this.#refusal !== undefined) {
      throw this.#refusal;
    }

    return { id: "12:3" };
  }
}

/** A write whose every run, dry or real, changes `count` layers; the runs kept in the same steps. */
function writer(steps: string[], count: number) {
  return {
    write: async (dry: boolean) => {
      steps.push(dry ? "dry run" : "write");

      return { count };
    },
    changes: ({ count: changed }: { count: number }) => changed,
  };
}

function call(refusal?: PixelwrightError) {
  const steps: string[] = [];
  const session = new PluginSession("6f1c2e0a-8b4d-4c3e-9a71-2d5f0b8e9c13", new VersionPlugin(steps, refusal), []);

  return { steps, session, versioned: new VersionedWrite() };
}

// D-41, T-011, T-143: one path for every writer.
describe("VersionedWrite", () => {
  it("answers with the probe and saves no version when the write would change nothing", async () => {
    const { steps, session, versioned } = call();
    const written = await versioned.run(session, { title: "Before", dryRun: false, probe: true }, writer(steps, 0));

    expect(steps).toEqual(["dry run"]);
    expect(written).toEqual({ result: { count: 0 }, dry: true });
  });

  it("probes, saves the version, then writes, when the write changes something", async () => {
    const { steps, session, versioned } = call();
    const written = await versioned.run(session, { title: "Before", dryRun: false, probe: true }, writer(steps, 3));

    expect(steps).toEqual(["dry run", "save_version Before", "write"]);
    expect(written).toEqual({ result: { count: 3 }, dry: false, version: { id: "12:3", title: "Before" } });
  });

  it("writes nothing when the version cannot be saved, and says so", async () => {
    const { steps, session, versioned } = call(new PixelwrightError(ERROR_CODE.opFailed, "Figma said no"));
    const written = versioned.run(session, { title: "Before", dryRun: false, probe: true }, writer(steps, 3));

    await expect(written).rejects.toThrow(
      'The version "Before" could not be saved, so nothing was written: Figma said no',
    );
    expect(steps).toEqual(["dry run", "save_version Before"]);
  });

  it("saves execute's version without a probe: its op has no dry run", async () => {
    const { steps, session, versioned } = call();

    await versioned.run(session, { title: "Before", dryRun: false, probe: false }, writer(steps, 0));

    expect(steps).toEqual(["save_version Before", "write"]);
  });

  it("saves no version for a dry run, nor without a title", async () => {
    const { steps, session, versioned } = call();

    await versioned.run(session, { title: "Before", dryRun: true, probe: true }, writer(steps, 3));
    await versioned.run(session, { title: undefined, dryRun: false, probe: true }, writer(steps, 3));

    expect(steps).toEqual(["dry run", "write"]);
  });
});
