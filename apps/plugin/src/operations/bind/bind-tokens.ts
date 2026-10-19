import { type BindInput, type BindKind, isDefaultSlotContent, type OperationOutput } from "@pixelwright/core";
import { OP_BUDGET_MS } from "../../constants/plugin.ts";
import { isLayer, requireRoots } from "../../figma/nodes.ts";
import { layersUntil } from "../../figma/walk.ts";
import type { PluginServices } from "../../services/plugin-services.ts";
import { errorMessage } from "../../utils/error-message.ts";
import { BindChoices } from "./bind-choices.ts";
import { BindContext } from "./bind-context.ts";
import { BindReport } from "./bind-report.ts";
import { colorUses } from "./color-uses.ts";
import { numberUses } from "./number-uses.ts";
import type { RawUse } from "./raw-use.ts";
import { remapTokens } from "./remap.ts";
import { effectUses, textUses } from "./style-uses.ts";

/** How a layer's raw values of each kind are found, in the order a layer is read. */
const FINDERS: readonly (readonly [
  BindKind,
  (layer: SceneNode, context: BindContext) => Promise<RawUse[]> | RawUse[],
])[] = [
  ["color", colorUses],
  ["number", numberUses],
  ["effect", effectUses],
  ["text", textUses],
];

/** What binding the layers needs: the call, its shared context, where results go, and when time is up. */
interface BindRun {
  readonly input: BindInput;
  readonly context: BindContext;
  readonly report: BindReport;
  readonly deadline: number;
}

/**
 * The `bind` operation: under the roots, every raw value bound to the one token holding it (or the call's pick), the
 * rest listed; or, with remaps, one token's uses rebound to another. Instances are left to their components, all but
 * what was put into their slots, unless remaps are asked to override them; a slot's default content always is. A dry
 * run writes nothing and works with Allow edits off; a real run is one undo step.
 */
export async function bindTokens(input: BindInput, { edits }: PluginServices): Promise<OperationOutput<"bind">> {
  if (!input.dryRun) {
    edits.require();
  }

  const roots = await requireRoots(input.roots);
  const context = await BindContext.of(roots);
  const report = new BindReport();
  const deadline = Date.now() + OP_BUDGET_MS;
  const remaps = input.remap.length > 0;
  const { layers, instances, defaults, finished } = bindableLayers(roots, {
    deadline,
    overrides: remaps && input.instances === "override",
  });
  let done = true;

  if (remaps) {
    await remapTokens(layers, input, context, report);
  } else {
    done = await bindValues(layers, {
      input,
      context,
      report,
      deadline,
    });
  }

  if (instances > 0) {
    report.note(leftAlone(instances, remaps));
  }

  if (defaults > 0) {
    report.note(defaultsLeftAlone(defaults));
  }

  if (!input.dryRun && report.wrote) {
    figma.commitUndo();
  }

  return report.result(!finished || !done);
}

/** The note on the instances a call left to their components, and what binds inside them. */
function leftAlone(instances: number, remaps: boolean): string {
  const left =
    instances === 1
      ? "1 instance was left alone: bind its main component, and its instances follow"
      : `${instances} instances were left alone: bind their main components, and the instances follow`;

  return remaps ? `${left}; instances: "override" rebinds the uses inside them as their overrides.` : `${left}.`;
}

/** The note on the slots' default content a call left to the components. */
function defaultsLeftAlone(defaults: number): string {
  return defaults === 1
    ? "1 layer of a slot's default content was left alone: binding it would make the slot the instance's own, so later changes to the component would no longer reach it; bind the component, and the slot follows."
    : `${defaults} layers of slots' default content were left alone: binding them would make their slots the instances' own, so later changes to the components would no longer reach them; bind the components, and the slots follow.`;
}

/** Each layer's raw values bound or listed; false when time ran out first. */
async function bindValues(layers: readonly SceneNode[], run: BindRun): Promise<boolean> {
  const choices = new BindChoices(run.input.choose, run.context.index);

  for (const layer of layers) {
    if (Date.now() > run.deadline) {
      return false;
    }

    for (const [kind, find] of FINDERS) {
      if (run.input.kinds.includes(kind)) {
        for (const use of await find(layer, run.context)) {
          await settle(use, choices, run);
        }
      }
    }
  }

  return true;
}

/** What becomes of one raw value: bound (unless the run is dry), left with its candidates, or with no token. */
async function settle(use: RawUse, choices: BindChoices, { input, report }: BindRun): Promise<void> {
  const decision = choices.decide(use);

  if (decision.kind === "refused") {
    report.error(use.layer.id, decision.message);
  } else if (decision.kind === "ambiguous") {
    report.ambiguous(use);
  } else if (decision.kind === "unmatched") {
    report.unmatched(use);
  } else {
    try {
      if (!input.dryRun) {
        await use.bind(decision.candidate, decision.snapped);
      }

      report.bound(use, decision.candidate, decision.snapped);
    } catch (error) {
      report.error(use.layer.id, errorMessage(error));
    }
  }
}

/**
 * The layers a bind call goes through, the roots among them, how many instances it left to their components (what
 * binds there belongs to the main component, and an instance's own would be overrides), and how many layers of slots'
 * default content it left to theirs. What was put into an instance's slots is the instance's own, so the walk goes on
 * there. With `overrides`, the walk goes into every instance, still not into a slot's default content: binding it
 * would make no override but take the slot from its component.
 */
function bindableLayers(roots: readonly BaseNode[], { deadline, overrides }: { deadline: number; overrides: boolean }) {
  if (overrides) {
    const walked = layersUntil(roots, deadline, (node) => !isDefaultContent(node));
    const layers = walked.layers.filter(isLayer);

    return {
      layers: layers.filter((node) => !isDefaultContent(node)),
      instances: 0,
      defaults: layers.filter(isDefaultContent).length,
      finished: walked.finished,
    };
  }

  const layers: SceneNode[] = [];
  let instances = 0;
  let defaults = 0;
  let next: readonly BaseNode[] = roots;
  let finished = true;

  while (next.length > 0 && finished) {
    const walked = layersUntil(next, deadline, (node) => node.type !== "INSTANCE" && !isDefaultContent(node));
    const kept = walked.layers.filter((node) => !isDefaultContent(node));
    const found = kept.filter((node): node is InstanceNode => node.type === "INSTANCE");

    layers.push(...kept.filter((node): node is SceneNode => node.type !== "INSTANCE" && isLayer(node)));
    instances += found.length;
    defaults += walked.layers.length - kept.length;
    finished = walked.finished;
    next = found.flatMap(slotContent);
  }

  return {
    layers,
    instances,
    defaults,
    finished,
  };
}

/** Whether a layer is a slot's default content (see isDefaultSlotContent). */
function isDefaultContent(node: BaseNode): boolean {
  return node.parent?.type === "SLOT" && isDefaultSlotContent(node.id, node.parent.id);
}

/** The layers in an instance's own slots; a slot of an instance inside it is that instance's. */
function slotContent(instance: InstanceNode): SceneNode[] {
  return instance
    .findAllWithCriteria({ types: ["SLOT"] })
    .filter((slot) => closestInstance(slot)?.id === instance.id)
    .flatMap((slot) => [...slot.children]);
}

function closestInstance(node: BaseNode): BaseNode | null {
  let up = node.parent;

  while (up !== null && up.type !== "INSTANCE") {
    up = up.parent;
  }

  return up;
}
