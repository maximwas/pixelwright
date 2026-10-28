import { expect, it } from "vitest";
import * as zod from "zod/mini";
import { OP_CONTRACTS } from "@/shared/ops/op.catalog.ts";

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
