#!/usr/bin/env node
// The Node gate comes first (S-057, D-59): the CLI and the server load only on a Node that runs them, through the
// dynamic import below, so an older Node gets a sentence instead of a stack.
import { NodeGate } from "@/cli/main/node-gate.ts";

const refusal = new NodeGate().refusal(process.versions.node);

if (refusal === null) {
  const { CliMain } = await import("@/cli/cli.main.ts");

  await new CliMain().run(process.argv.slice(2));
} else {
  process.stderr.write(refusal);
  process.exitCode = 1;
}
