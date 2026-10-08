import { BridgeError } from "@pixelwright/core";

/** The operations the server may ask for. Stage 1 has only ping; later stages add the read and write primitives. */
const OPERATIONS: Readonly<Record<string, (input: unknown) => Promise<unknown>>> = {
  ping: async () => ({ pong: true }),
};

export async function runOperation(op: string, input: unknown): Promise<unknown> {
  const run = OPERATIONS[op];

  if (run === undefined) {
    throw new BridgeError("UNKNOWN_OP", `Unknown operation: ${op}`);
  }

  return run(input);
}
