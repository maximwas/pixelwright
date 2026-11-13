import { describe, expect, it, vi } from "vitest";
import { FileAttach } from "@/server/tools/design-apply/file-attach.ts";

type Read =
  | { file: { path: string; bytes: Buffer; sha1: string; image: object | null } }
  | { problem: string; message: string };

function file(
  format: string,
  width = 10,
  height = 10,
): Read {
  return { file: { path: "/p/x", bytes: Buffer.from("<svg>"), sha1: "s", image: { format, width, height } } };
}

function build(reads: Record<string, Read>) {
  const push = vi.fn(async () => "stream-1");
  const sources = { read: async (path: string) => reads[path] };

  return { attach: new FileAttach(sources as never, { push } as never), push };
}

function change(props: object, kind = "create") {
  return {
    kind,
    ref: "new:1",
    id: kind === "create" ? null : "1:2",
    tag: "Image",
    parent: null,
    index: 0,
    line: 3,
    column: 5,
    props,
    sources: {},
  } as never;
}

const image = (src: string) => ({ asset: { kind: "image", src } });
const sent = { session: {} as never, dry: false, reads: new Map() };

describe("FileAttach.attach", () => {
  it("pushes an image once however many layers name it, and names its stream on each", async () => {
    const { attach, push } = build({ "a.png": file("png") });
    const done = await attach.attach([change(image("a.png")), change(image("a.png"))], sent);

    expect(push).toHaveBeenCalledTimes(1);
    expect(done.changes.map(({ props }) => props.asset?.stream)).toEqual(["stream-1", "stream-1"]);
  });

  it("takes 4096 px a side and refuses 4097 before anything is pushed; a refused create makes no layer", async () => {
    const { attach, push } = build({ "ok.png": file("png", 4096, 100), "wide.png": file("png", 4097, 100) });
    const ok = await attach.attach([change(image("ok.png"))], sent);
    const wide = await attach.attach([change(image("wide.png"))], sent);

    expect(ok.changes).toHaveLength(1);
    expect(wide.changes).toHaveLength(0);
    expect(wide.errors).toMatchObject([
      { line: 3, column: 5, attribute: "src", message: expect.stringContaining("4097") },
    ]);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("refuses a WebP before the push; an existing layer is kept without its file", async () => {
    const { attach, push } = build({ "w.webp": file("webp") });
    const done = await attach.attach([change(image("w.webp"), "update")], sent);

    expect(push).not.toHaveBeenCalled();
    expect(done.errors[0]?.message).toContain("WebP");
    expect(done.changes).toHaveLength(1);
    expect(done.changes[0]?.props.asset).toBeUndefined();
  });

  it("sends nothing on a dry run, and the change has no stream", async () => {
    const { attach, push } = build({ "a.png": file("png") });
    const done = await attach.attach([change(image("a.png"))], { ...sent, dry: true });

    expect(push).not.toHaveBeenCalled();
    expect(done.changes[0]?.props.asset?.stream).toBeUndefined();
  });

  it("puts an Icon's SVG on its change and pushes nothing", async () => {
    const { attach, push } = build({ "i.svg": file("svg") });
    const done = await attach.attach([change({ asset: { kind: "icon", src: "i.svg" } })], sent);

    expect(push).not.toHaveBeenCalled();
    expect(done.changes[0]?.props.asset?.svg).toBe("<svg>");
  });

  it("drops the fills of a layer whose background image cannot be used, naming background", async () => {
    const { attach } = build({ "bad.png": { problem: "missing", message: "bad.png is not a file" } });
    const done = await attach.attach([change({ fills: [{ kind: "image", src: "bad.png" }] }, "update")], sent);

    expect(done.changes[0]?.props.fills).toBeUndefined();
    expect(done.errors[0]).toMatchObject({ attribute: "background", message: "bad.png is not a file" });
  });
});
