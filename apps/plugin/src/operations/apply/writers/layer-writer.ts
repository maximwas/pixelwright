import type { ApplyChange, FigmaProps } from "@pixelwright/core";
import { fitIcon, writeImage } from "./asset-steps.ts";
import { componentSteps } from "./component-steps.ts";
import { layOutFillingText } from "./size-steps.ts";
import { stepsFor } from "./steps.ts";
import { hasTextProps, holdsNoText, TextWriter } from "./text-writer.ts";
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
 * properties, then its text, and hiding it last. Each step on its own: a step that fails leaves the others, its error
 * naming its attribute.
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
    const { props, scaled } = this.#icon(target);
    const component = await this.#component(target);

    this.#mark(target);

    // A layer hidden inside an instance can be gone from the plugin API at once ("… does not exist"): nothing after.
    const { visible, ...shown } = props;
    const steps = await this.#steps(target, visible === false ? shown : props);
    const text = await this.#text(target);

    layOutFillingText(node);

    const hidden = visible === false && (await this.#steps(target, { visible }));

    return asset || scaled || component || steps || text || hidden;
  }

  /** An Icon is sized by scaling it with its vectors, a new one or an existing one: a resize would leave them. */
  #icon({ node, change, fail }: Target): { props: FigmaProps; scaled: boolean } {
    if (change.tag !== "Icon") {
      return {
        props: change.props,
        scaled: false,
      };
    }

    try {
      return fitIcon(node, change.props, change.kind === "create");
    } catch (error) {
      fail(error, ["width", "height"]);

      const { width: _width, height: _height, ...props } = change.props;

      return {
        props,
        scaled: false,
      };
    }
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

    for (const step of stepsFor(props, node)) {
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
      fail(holdsNoText(node));
    }

    return false;
  }
}

/** The XML attribute a step's properties came from: the first one the change names, else the first property. */
export function attributeOf(change: ApplyChange, keys: readonly (keyof FigmaProps)[]): string | undefined {
  return keys.map((key) => change.sources[key]).find((attribute) => attribute !== undefined) ?? keys[0];
}
