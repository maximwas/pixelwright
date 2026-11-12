import { expect, it } from "vitest";
import * as zod from "zod/mini";
import { OP_CONTRACTS } from "@/shared/ops/op.catalog.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";
import { fixture } from "./support/design-classes.ts";

const declared = (value: unknown) => (typeof value === "function" ? "per input" : value);

// Every op's schemas and declared meta (A§5.5), in the catalog's order. A new op or a changed contract updates
// __golden__/operations.json in the same commit, with the reason.
it("keeps every op's contract", async () => {
  const ops = OP_CONTRACTS.all().map((contract) => ({
    name: contract.name,
    meta: Object.fromEntries(Object.entries(contract.declared).map(([key, value]) => [key, declared(value)])),
    input: zod.toJSONSchema(contract.input),
    output: zod.toJSONSchema(contract.output),
  }));

  await expect(`${JSON.stringify(ops, null, 2)}\n`).toMatchFileSnapshot("__golden__/operations.json");
});

// T-206, K-058: a baseline keeps the page its root is on and finds a remade root there, so the plugin names it.
it("refuses a read op answer whose read does not name its page", () => {
  const { page: _page, ...read } = fixture("orbit-pricing");
  const answer = (page?: { id: string; name: string }) => ({
    reads: [page === undefined ? read : { ...read, page }],
    missing: [],
    cuts: [],
  });

  expect(zod.safeParse(readOp.output, answer()).success).toBe(false);
  expect(zod.safeParse(readOp.output, answer({ id: "54:226", name: "Orbit — Pricing" })).success).toBe(true);
});
