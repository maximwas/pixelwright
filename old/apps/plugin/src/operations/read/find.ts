import { BridgeError, nameValueList, type OperationInput, type OperationOutput } from "@pixelwright/core";
import { MAIN_COMPONENT_BATCH, OP_BUDGET_MS } from "../../constants/plugin.ts";
import { boxOf, pathOf, requireNode } from "../../figma/nodes.ts";
import { componentNames, valuesOf } from "../../figma/variants.ts";

type FindInput = OperationInput<"find">;
type FindOutput = OperationOutput<"find">;
type Counted = NonNullable<FindOutput["counts"]>[number];

/** What a find keeps: the layers that matched (up to one past the limit), the counts asked for, whether time ran out. */
interface Search {
  readonly found: SceneNode[];
  readonly counts?: Counted[];
  readonly cut: boolean;
}

/**
 * Finds layers on the current page (or inside `within`) by name, type, text, component or variant, in document order;
 * with `counts`, every instance found is also counted by component and variant, past the limit listed.
 */
export async function find(input: FindInput): Promise<FindOutput> {
  const scope = await scopeOf(input.within);
  const variant = input.variant === undefined ? undefined : (nameValueList(input.variant) ?? {});
  const candidates = scope.findAll(matcher(input));
  const search: Search =
    input.component === undefined && variant === undefined && !input.counts
      ? {
          found: candidates.slice(0, input.limit + 1),
          cut: false,
        }
      : await byMain(candidates, input, variant);

  return {
    nodes: search.found.slice(0, input.limit).map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      box: boxOf(node),
      path: pathOf(node),
    })),
    more: search.cut || search.found.length > input.limit,
    ...(variant === undefined ? {} : { variant }),
    ...(search.counts === undefined ? {} : { counts: search.counts }),
    ...(search.counts !== undefined && search.cut ? { countsCut: true as const } : {}),
  };
}

/** Where a find searches: the current page, or the layer or page `within` names (a page loaded first). */
async function scopeOf(within: string | undefined): Promise<ChildrenMixin> {
  const root = within === undefined ? figma.currentPage : await requireNode(within);

  if (root.type === "PAGE" && root !== figma.currentPage) {
    // dynamic-page: a page the user is not on has no layers until it is loaded.
    await root.loadAsync();
  }

  if (!("findAll" in root)) {
    throw new BridgeError("NODE_NOT_FOUND", `${within ?? "this page"} has no layers inside to search.`);
  }

  // A page and a frame search the same way: through ChildrenMixin, whose findAll yields layers.
  return root as ChildrenMixin;
}

/** Whether a layer matches the find's name, type and text, and is an instance when a component or variant is asked for. */
function matcher(input: FindInput): (node: SceneNode) => boolean {
  const name = input.name?.toLowerCase();
  const type = input.type?.toUpperCase();
  const text = input.text?.toLowerCase();
  const instances = input.component !== undefined || input.variant !== undefined;

  return (node) =>
    (name === undefined || node.name.toLowerCase().includes(name)) &&
    (type === undefined || node.type === type) &&
    (text === undefined || (node.type === "TEXT" && node.characters.toLowerCase().includes(text))) &&
    (!instances || node.type === "INSTANCE");
}

/**
 * The candidates whose main component matches, read in batches until one past the limit is found (when counting, to
 * the end), with the instances among them counted; within the time an operation has.
 */
async function byMain(
  candidates: readonly SceneNode[],
  input: FindInput,
  variant: Readonly<Record<string, string>> | undefined,
): Promise<Search> {
  const wanted = mainMatcher(input.component, variant);
  const tally = input.counts ? new Map<string, Counted>() : null;
  const found: SceneNode[] = [];
  const deadline = Date.now() + OP_BUDGET_MS;
  const searchOf = (cut: boolean): Search => ({
    found,
    ...(tally === null ? {} : { counts: [...tally.values()] }),
    cut,
  });

  for (let start = 0; start < candidates.length && (tally !== null || found.length <= input.limit); ) {
    if (Date.now() > deadline) {
      return searchOf(true);
    }

    const batch = candidates.slice(start, start + MAIN_COMPONENT_BATCH);
    const mains = await Promise.all(batch.map(mainOf));

    for (const [at, node] of batch.entries()) {
      const main = mains[at] ?? null;

      if (wanted(main)) {
        take(
          {
            found,
            tally,
            limit: input.limit,
          },
          node,
          main,
        );
      }
    }

    start += batch.length;
  }

  return searchOf(false);
}

/** A matching layer: listed while the list is not one past the limit, and counted when it is an instance. */
function take(
  into: { readonly found: SceneNode[]; readonly tally: Map<string, Counted> | null; readonly limit: number },
  node: SceneNode,
  main: ComponentNode | null,
): void {
  if (into.found.length <= into.limit) {
    into.found.push(node);
  }

  if (into.tally !== null && main !== null) {
    count(into.tally, main);
  }
}

/** An instance's main component; null for any other layer, and for an instance whose component is gone. */
function mainOf(node: SceneNode): Promise<ComponentNode | null> {
  return node.type === "INSTANCE" ? node.getMainComponentAsync() : Promise.resolve(null);
}

/**
 * Whether a main component is named like the component query (its own name or its set's) and has every variant value
 * asked for, names and values in any case; with neither asked, every layer matches.
 */
function mainMatcher(
  component: string | undefined,
  variant: Readonly<Record<string, string>> | undefined,
): (main: ComponentNode | null) => boolean {
  if (component === undefined && variant === undefined) {
    return () => true;
  }

  const query = component?.toLowerCase();
  const pairs = lowered(variant ?? {});

  return (main) => {
    if (main === null) {
      return false;
    }

    const names = [main.name, main.parent?.type === "COMPONENT_SET" ? main.parent.name : undefined];
    const values = new Map(lowered(valuesOf(main)));

    return (
      (query === undefined || names.some((name) => name?.toLowerCase().includes(query))) &&
      pairs.every(([name, value]) => values.get(name) === value)
    );
  };
}

function lowered(values: Readonly<Record<string, string>>): [string, string][] {
  return Object.entries(values).map(([name, value]) => [name.toLowerCase(), value.toLowerCase()]);
}

/** One more instance of this main component, under its component's and variant's names, in the order first met. */
function count(tally: Map<string, Counted>, main: ComponentNode): void {
  const names = componentNames(main);
  const key = `${names.component}\n${names.variant ?? ""}`;

  tally.set(key, {
    ...names,
    count: (tally.get(key)?.count ?? 0) + 1,
  });
}
