import { inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { COMPONENT_INDEX } from "@/plugin/adapters/figma/components/component-index.ts";
import { VARIANTS } from "@/plugin/adapters/figma/components/variants.ts";
import { CAPABILITY, FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import type { WriteStep } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { STEP_KEYS, WRITERS_TEXT } from "@/plugin/operations/apply/writers/writers.constants.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** An instance's main component now, and the one the change makes it of (null: it stays). */
interface Target {
  readonly main: ComponentNode;
  readonly target: ComponentNode | null;
}

/**
 * An instance's component and variant (T-127, P-084): `component` swaps it to another (its variant's values kept where
 * the new set has them), `variant` switches its set's variant; a new one, made of them, stays as made. A component in a
 * set takes its variant as its name. A dry run finds the same component and variant without writing; one by key and
 * one the call makes only the write looks up, as importing writes to the file and a dry run makes nothing.
 */
@injectable()
export class VariantStep implements WriteStep {
  readonly keys = STEP_KEYS.variant;
  readonly capability = CAPABILITY.variants;
  readonly #components;
  readonly #variants;
  readonly #assign;

  constructor(
    components = inject(COMPONENT_INDEX),
    variants = inject(VARIANTS),
    assign = inject(ASSIGN),
  ) {
    this.#components = components;
    this.#variants = variants;
    this.#assign = assign;
  }

  async check(props: FigmaProps, layer: TypedLayer): Promise<void> {
    const { component, variant } = props;

    if (layer.type === FIGMA_NODE_TYPE.component) {
      if (component !== undefined) {
        throw new WriteError(WRITERS_TEXT.componentOnComponent);
      }
    } else if ("getMainComponentAsync" in layer) {
      await this.#target(layer as InstanceNode, props, false);
    } else if (component !== undefined && this.#components.findable(component)) {
      await this.#components.component(component, variant ?? {});
    }
  }

  async write(node: SceneNode, props: FigmaProps): Promise<void> {
    if (node.type === FIGMA_NODE_TYPE.component) {
      if (props.variant !== undefined) {
        this.#assign.set(node, { name: this.#variants.name(props.variant) });
      }

      return;
    }

    const instance = node as InstanceNode;
    const { main, target } = await this.#target(instance, props, true);

    if (target === null || target.id === main.id) {
      return;
    }

    if (props.component === undefined) {
      instance.setProperties({ ...props.variant });
    } else {
      instance.swapComponent(target);
    }
  }

  async #target(
    node: InstanceNode,
    { component, variant }: FigmaProps,
    writing: boolean,
  ): Promise<Target> {
    const main = await node.getMainComponentAsync();

    if (main === null) {
      throw new WriteError(WRITERS_TEXT.componentGone(node.id));
    }

    if (component === undefined) {
      const values = { ...this.#variants.values(main), ...variant };

      return { main, target: variant === undefined ? null : this.#variants.of(this.#variants.owner(main), values) };
    }

    if (!writing && !this.#components.findable(component)) {
      return { main, target: null };
    }

    const owner = await this.#components.find(component);
    // Swapped within its own set, the instance keeps the values the wanted variant leaves out.
    const kept =
      owner.type === FIGMA_NODE_TYPE.componentSet && main.parent?.id === owner.id ? this.#variants.values(main) : {};

    return { main, target: this.#variants.of(owner, { ...kept, ...variant }) };
  }
}
