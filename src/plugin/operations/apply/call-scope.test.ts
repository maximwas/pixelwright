import { describe, expect, it, vi } from "vitest";
import { CallScope } from "@/plugin/operations/apply/call-scope.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";

const changes: ApplyChangeData[] = [
  { props: { asset: { kind: "image", src: "hero.png", stream: "s1" } } },
  { props: { fills: [{ kind: "image", src: "bg.jpg", stream: "s2" }, { kind: "solid" }] } },
  { props: { textFills: [{ kind: "image", src: "tex.png", stream: "s3" }] } },
  { props: { opacity: 0.5 } },
].map((change) => change as never);

function build() {
  const uploads = { drop: vi.fn() };
  const tokens = { start: vi.fn() };
  const scope = new CallScope(tokens as never, { deadline: () => 42 } as never, uploads as never);

  return { scope, uploads, tokens };
}

// P-140, P-030: the files a call uploaded are dropped once it is done, refused or not (0.7.0 apply-changes.ts).
describe("CallScope", () => {
  it("starts the call's token index within the op's budget and drops its uploads once it answers", async () => {
    const { scope, uploads, tokens } = build();

    await expect(scope.around(changes, async () => "done")).resolves.toBe("done");
    expect(tokens.start).toHaveBeenCalledWith(42, expect.any(Array));
    expect(uploads.drop.mock.calls.map(([stream]) => stream)).toEqual(["s1", "s2", "s3"]);
  });

  it("drops them when the call throws too", async () => {
    const { scope, uploads } = build();

    await expect(
      scope.around(changes, async () => {
        throw new Error("refused");
      }),
    ).rejects.toThrow("refused");
    expect(uploads.drop).toHaveBeenCalledTimes(3);
  });
});
