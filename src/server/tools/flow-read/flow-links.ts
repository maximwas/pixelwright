import { InjectionToken, inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { INTERACTION_ATTRIBUTES } from "@/core/design/interactions/interaction-attributes.ts";
import { ACTION_TYPE } from "@/core/design/interactions/interactions.constants.ts";
import { FLOW_READ } from "@/server/tools/flow-read/flow-read.constants.ts";
import type { FlowLink, FlowMap } from "@/server/tools/flow-read/flow-read.schema.ts";
import { FLOWS } from "@/shared/ops/flows/flows.constants.ts";
import type { FlowsRaw, ReactiveLayer } from "@/shared/ops/flows/flows.schema.ts";
import type { ReactionSchema } from "@/shared/read-model/layer-values.schema.ts";

type Reaction = zod.output<typeof ReactionSchema>;
type Action = NonNullable<Reaction["actions"]>[number];

/** One action of a layer's interaction, with how it navigates. */
interface FoundAction {
  readonly layer: ReactiveLayer;
  readonly reaction: Reaction;
  readonly action: Action;
  readonly kind: string;
}

/**
 * flow_read's map (T-088, P-121): every action that leaves its layer becomes a link from its screen and layer, on its
 * trigger, to a screen of the page (or back, close, a URL), said in design_read's words (InteractionAttributes); a
 * variant switch stays inside its component and is left out; FLOWS.maxLinks links at most.
 */
@injectable()
export class FlowLinks {
  readonly #interactions;

  constructor(interactions = inject(INTERACTION_ATTRIBUTES)) {
    this.#interactions = interactions;
  }

  map(raw: FlowsRaw): FlowMap {
    const names = new Map(raw.screens.map(({ id, name }) => [id, name]));
    const actions = raw.layers
      .flatMap((layer) =>
        layer.reactions.flatMap((reaction) =>
          (reaction.actions ?? []).map((action) => ({ layer, reaction, action, kind: this.#kind(action) })),
        ),
      )
      .filter(({ kind }) => kind !== FLOW_READ.changeTo);

    return {
      page: raw.page,
      starts: raw.starts,
      screens: raw.screens,
      links: actions.slice(0, FLOWS.maxLinks).map((found) => this.#link(found, names)),
      more: raw.more || actions.length > FLOWS.maxLinks,
    };
  }

  #kind(action: Action): string {
    return action.type === ACTION_TYPE.node ? (action.navigation ?? FLOW_READ.navigate) : action.type;
  }

  #link({ layer, reaction, action, kind }: FoundAction, names: ReadonlyMap<string, string>): FlowLink {
    const destination = action.type === ACTION_TYPE.node ? (action.destinationId ?? null) : null;

    return {
      from: { id: layer.screen, name: names.get(layer.screen) ?? layer.screen },
      layer: { id: layer.id, name: layer.name },
      trigger: reaction.trigger?.type ?? FLOW_READ.noTrigger,
      action: kind,
      to:
        destination === null
          ? null
          : { id: destination, name: names.get(destination) ?? action.destinationName ?? destination },
      ...(action.type === ACTION_TYPE.url && action.url !== undefined ? { url: action.url } : {}),
      summary: this.#interactions.sentence({ ...reaction, actions: [action] }),
    };
  }
}

export const FLOW_LINKS = new InjectionToken<FlowLinks>("FlowLinks");
