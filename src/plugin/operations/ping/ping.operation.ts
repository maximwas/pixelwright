import { injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { Operation } from "@/plugin/app/operation.ts";
import type { pingOp } from "@/shared/ops/ping/ping.manifest.ts";

/** The round trip status probe measures (T-021): no Figma call, so it answers even while a read holds its turn. */
@injectable()
export class PingOperation extends Operation<zod.output<typeof pingOp.input>, zod.output<typeof pingOp.output>> {
  protected async execute(): Promise<zod.output<typeof pingOp.output>> {
    return { pong: true };
  }
}
