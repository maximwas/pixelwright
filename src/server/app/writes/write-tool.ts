import { inject } from "@needle-di/core";
import { PLUGIN_SESSION, type PluginSession } from "@/server/app/sessions/plugin-session.ts";
import { SUPPORT_NOTE, type SupportNote } from "@/server/app/stores/support-note.ts";
import { Tool, type ToolOutput } from "@/server/app/tool-runner/tool.ts";
import { VERSIONED_WRITE } from "@/server/app/writes/versioned-write.ts";
import type { WriterOutput } from "@/server/app/writes/writes.schema.ts";
import type { AnyOpContract } from "@/shared/ops/op-contract.ts";

/** The fields every writer's input has (D-35): `dryRun` only where the writer's op honours it. */
export interface WriterInput {
  readonly version?: string;
  readonly dryRun?: boolean;
}

/**
 * A tool that writes (A§6.2, D-41). run() is the one order every writer follows (Template Method), and no writer
 * declares its own: prepare, an answer at once when nothing writes, the versioned write (probe, version, write), then
 * the answer with the fields every writer shares and the weekly support sentence after a change (T-006).
 */
export abstract class WriteTool<Input extends WriterInput, Prepared, Result, Output extends ToolOutput> extends Tool<
  Input,
  Output
> {
  /** The op that writes: its meta says whether a probe can run first. */
  protected abstract readonly op: AnyOpContract;
  protected readonly session: PluginSession;
  readonly #versioned;
  readonly #support;

  constructor(
    session = inject(PLUGIN_SESSION),
    versioned = inject(VERSIONED_WRITE),
    // null for a writer that never counts a change (execute): it has no support sentence to give.
    support: SupportNote | null = inject(SUPPORT_NOTE),
  ) {
    super();
    this.session = session;
    this.#versioned = versioned;
    this.#support = support;
  }

  protected async run(input: Input): Promise<Output> {
    const prepared = await this.prepare(input);
    const now = this.answerNow(prepared);

    if (now !== undefined) {
      return this.output(now, {});
    }

    const written = await this.#versioned.run(
      this.session,
      { title: input.version, dryRun: input.dryRun ?? false, probe: this.probes() },
      { write: (dry) => this.write(prepared, dry), changes: (result) => this.changes(result) },
    );
    const support = !written.dry && this.changes(written.result) > 0 ? (this.#support?.due() ?? null) : null;
    const fields: WriterOutput = {
      ...(written.dry ? { dry: true } : {}),
      ...(written.version === undefined ? {} : { version: written.version }),
      ...(support === null ? {} : { support }),
    };

    return this.output(written.result, fields);
  }

  protected abstract prepare(input: Input): Promise<Prepared>;

  /** A result that needs no write at all (code that does not parse): no plugin write, no version. */
  protected answerNow(_prepared: Prepared): Result | undefined {
    return undefined;
  }

  protected abstract write(prepared: Prepared, dry: boolean): Promise<Result>;

  /** Whether write(true) writes nothing, so a version waits for a probe that finds a change: the op's dry run. */
  protected probes(): boolean {
    return this.op.declared.dryRun;
  }

  /** How many things the result changes: 0 makes a probe the answer, and gives no support sentence. */
  protected abstract changes(result: Result): number;

  protected abstract output(result: Result, fields: WriterOutput): Output;
}
