import { describe, expect, it } from "vitest";
import { Origins } from "@/plugin/operations/apply/origins.ts";

// No Figma here (CLAUDE.md): a layer is plain data that holds children, with the one Figma call a move is, insertChild.
interface Stub {
  readonly id: string;
  readonly children: Stub[];
  parent: Stub | null;
  insertChild(index: number, node: Stub): void;
}

function layer(id: string, children: Stub[] = []): Stub {
  const stub: Stub = {
    id,
    children,
    parent: null,
    insertChild(index, node) {
      node.parent?.children.splice(node.parent.children.indexOf(node), 1);
      stub.children.splice(index, 0, node);
      node.parent = stub;
    },
  };

  for (const child of children) {
    child.parent = stub;
  }

  return stub;
}

function ids(parent: Stub): string[] {
  return parent.children.map(({ id }) => id);
}

function moved(
  origins: Origins,
  node: Stub,
  into: Stub,
): void {
  origins.record(node as never);
  into.insertChild(into.children.length, node);
}

describe("Origins.restore", () => {
  it("puts a layer the call moved into a layer back where it stood", () => {
    const [one, two, three] = [layer("a"), layer("e"), layer("b")];
    const parent = layer("p", [one, two, three]);
    const made = layer("c");
    const origins = new Origins();

    moved(origins, two, made);
    origins.restore(made as never);

    expect(ids(parent)).toEqual(["a", "e", "b"]);
    expect(ids(made)).toEqual([]);
  });

  it("puts back layers moved out of one parent in the order they stood", () => {
    const [one, two, three] = [layer("a"), layer("b"), layer("c")];
    const parent = layer("p", [one, two, three]);
    const made = layer("m");
    const origins = new Origins();

    moved(origins, one, made);
    moved(origins, three, made);
    origins.restore(made as never);

    expect(ids(parent)).toEqual(["a", "b", "c"]);
  });

  it("finds a layer moved into what the made layer holds, at any depth", () => {
    const parent = layer("p", [layer("e")]);
    const inner = layer("i");
    const made = layer("m", [inner]);
    const origins = new Origins();

    moved(origins, parent.children[0] as Stub, inner);
    origins.restore(made as never);

    expect(ids(parent)).toEqual(["e"]);
  });

  it("leaves alone a layer the call moved on, out of the one that goes", () => {
    const parent = layer("p", [layer("e")]);
    const [made, elsewhere] = [layer("m"), layer("o")];
    const origins = new Origins();

    moved(origins, parent.children[0] as Stub, made);
    moved(origins, made.children[0] as Stub, elsewhere);
    origins.restore(made as never);

    expect(ids(elsewhere)).toEqual(["e"]);
    expect(ids(parent)).toEqual([]);
  });

  it("is a layer's only once: what was put back is not held again", () => {
    const parent = layer("p", [layer("e")]);
    const made = layer("m");
    const origins = new Origins();

    moved(origins, parent.children[0] as Stub, made);
    origins.restore(made as never);
    made.insertChild(0, parent.children[0] as Stub);
    origins.restore(made as never);

    expect(ids(made)).toEqual(["e"]);
  });

  it("throws, the layer where it is, when its parent cannot take it back", () => {
    const parent = layer("p", [layer("e")]);
    const made = layer("m");
    const origins = new Origins();

    moved(origins, parent.children[0] as Stub, made);
    parent.insertChild = () => {
      throw new Error("The node has been removed");
    };

    expect(() => origins.restore(made as never)).toThrow("The node has been removed");
    expect(ids(made)).toEqual(["e"]);
  });
});
