import type { ApplyChange, FigmaProps } from "@pixelwright/core";
import { WriteError } from "../../../figma/write-error.ts";
import { fitIcon, writeImage } from "./asset-steps.ts";
import { componentSteps } from "./component-steps.ts";
import { STEPS } from "./steps.ts";
import { hasTextProps, TextWriter } from "./text-writer.ts";
import type { WriteScope } from "./write-scope.ts";

/** Reports a step's error under the XML attribute its properties came from. */
type Fail = (error: unknown, attribute?: string) => void;

/** One layer's write: the layer, its change, and where its errors go. */
interface Target {
  readonly node: SceneNode;
  readonly change: ApplyChange;
  readonly fail: (error: unknown, keys?: readonly (keyof FigmaProps)[]) => void;
}

/**
 * Writes a change onto its layer, step by step in Figma's order: its file, its component, the property it makes, its
 * properties, then its text. Each step on its own: a step that fails leaves the others, its error naming its attribute.
 */
export class LayerWriter {
  readonly #scope: WriteScope;

  constructor(scope: WriteScope) {
    this.#scope = scope;
  }

  /** Whether it wrote anything. */
  async write(node: SceneNode, change: ApplyChange, fail: Fail): Promise<boolean> {
    const target: Target = {
      node,
      change,
      fail: (error, keys) => fail(error, keys === undefined ? undefined : attributeOf(change, keys)),
    };
    const asset = this.#asset(target);
    // A new icon is sized by scaling it with its vectors; a resize would leave them as they are.
    const props = change.tag === "Icon" && change.kind === "create" ? fitIcon(node, change.props) : change.props;
    const component = await this.#component(target);

    this.#mark(target);

    const steps = await this.#steps(target, props);
    const text = await this.#text(target);

    return asset || component || steps || text;
  }

  #asset({ node, change, fail }: Target): boolean {
    if (change.props.asset === undefined || change.tag === "Icon") {
      return false;
    }

    try {
      writeImage(node, change.props, this.#scope);

      return true;
    } catch (error) {
      fail(error, ["asset"]);

      return false;
    }
  }

  async #component({ node, change, fail }: Target): Promise<boolean> {
    let wrote = false;

    for (const { key, run } of componentSteps(node, change, this.#scope.components)) {
      try {
        await run();
        wrote = true;
      } catch (error) {
        fail(error, [key]);
      }
    }

    return wrote;
  }

  #mark({ node, change, fail }: Target): void {
    const property = change.props.property;

    if (property !== undefined) {
      this.#scope.mark({
        node,
        property,
        fail: (error) => fail(error, ["property"]),
      });
    }
  }

  async #steps({ node, fail }: Target, props: FigmaProps): Promise<boolean> {
    let wrote = false;

    for (const step of STEPS) {
      // A text's link is a run of it: the text writer writes it.
      if (
        !step.keys.some((key) => props[key] !== undefined) ||
        (step.keys[0] === "hyperlink" && node.type === "TEXT")
      ) {
        continue;
      }

      try {
        await step.write(node, props, this.#scope);
        wrote = true;
      } catch (error) {
        fail(error, step.keys);
      }
    }

    return wrote;
  }

  async #text({ node, change, fail }: Target): Promise<boolean> {
    if (node.type === "TEXT") {
      return await new TextWriter(node, change, this.#scope).write((key, error) =>
        fail(error, key === "text" ? undefined : [key]),
      );
    }

    if (change.text !== undefined || hasTextProps(change.props)) {
      fail(new WriteError(`A ${node.type.toLowerCase()} holds no text: text and its styles go on a Text inside it.`));
    }

    return false;
  }
}

/** The XML attribute a step's properties came from: the first one the change names, else the first property. */
function attributeOf(change: ApplyChange, keys: readonly (keyof FigmaProps)[]): string | undefined {
  return keys.map((key) => change.sources[key]).find((attribute) => attribute !== undefined) ?? keys[0];
}
