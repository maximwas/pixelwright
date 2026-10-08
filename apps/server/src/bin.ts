#!/usr/bin/env node
// The package's entry point. No static imports: on an old Node.js the check below has to run before anything that
// needs a newer one is loaded.
const { nodeVersionProblem } = await import("./utils/node-version.ts");
const { MINIMUM_NODE_VERSION } = await import("./constants/cli.ts");
const problem = nodeVersionProblem(process.versions.node, MINIMUM_NODE_VERSION);

if (problem === null) {
  const { runCli } = await import("./cli/run-cli.ts");

  await runCli(process.argv.slice(2));
} else {
  process.stderr.write(`${problem}\n`);
  process.exitCode = 1;
}
