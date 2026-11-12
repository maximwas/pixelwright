import { describe, expect, it } from "vitest";
import { MainRelay } from "../src/link/main-relay.ts";

describe("MainRelay", () => {
  it("gives each request its own id, so two servers' equal request ids cannot swap answers", async () => {
    const sent: { id: string; op: string }[] = [];
    const relay = new MainRelay((id, op) =>
      sent.push({
        id,
        op,
      }),
    );
    const first = relay.call("read", null);
    const second = relay.call("read", null);

    expect(sent[0]?.id).not.toBe(sent[1]?.id);

    relay.settle(sent[1]?.id ?? "", {
      ok: true,
      result: "second",
    });
    relay.settle(sent[0]?.id ?? "", {
      ok: true,
      result: "first",
    });

    await expect(first).resolves.toEqual({
      ok: true,
      result: "first",
    });
    await expect(second).resolves.toEqual({
      ok: true,
      result: "second",
    });
  });

  it("ignores an answer it does not wait for", () => {
    const relay = new MainRelay(() => {});

    expect(() =>
      relay.settle("nope", {
        ok: true,
        result: null,
      }),
    ).not.toThrow();
  });
});
