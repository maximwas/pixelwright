import {
  type ApplyChange,
  assessElements,
  BridgeError,
  Color,
  CurrentLayers,
  changesToSend,
  escapeAttribute,
  layersToRead,
  parseXml,
  planChanges,
  readApply,
  tokenOf,
} from "@pixelwright/core";
import type * as z from "zod";
import { versionedWrite } from "../../history/versioned-write.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { PluginSession } from "../../plugin/plugin-session.ts";
import { TOKEN_DRAFT_COLOR } from "./constants.ts";
import { type IconSet, iconSet, iconSvg, searchIcons } from "./iconify.ts";
import type { IconsInsertInputSchema, IconsInsertOutputSchema } from "./schemas.ts";

type InsertArgs = z.output<typeof IconsInsertInputSchema>;
type Inserted = z.input<typeof IconsInsertOutputSchema>;

/** What the call's colour asks for: a token to bind the icon's paints to, a colour Iconify draws it in, or none. */
type IconPaint = { readonly token: string } | { readonly color: string } | null;

/**
 * icons_insert: a search lists Iconify's icons with their sets' licences and writes nothing; an icon is drawn by
 * Iconify at its size and colour, made an Icon layer through design_apply's own path (core reads the element, the
 * plugin's apply makes and places it), and its paints are bound to a token by tokens_bind's bind when it is one.
 */
export async function insertIcon(plugin: PluginClient, args: InsertArgs): Promise<Inserted> {
  const { search, icon } = args;

  if (search !== undefined && icon !== undefined) {
    throw new BridgeError("OP_FAILED", "Give search or icon, one of them: a search lists icons, an icon is inserted.");
  }

  if (search !== undefined) {
    return await searched(search, args);
  }

  if (icon === undefined) {
    throw new BridgeError("OP_FAILED", "Give search (words to look for) or icon (set:name, as a search lists it).");
  }

  return await inserted(plugin, icon, args);
}

/** A search's icons with their sets and licences. */
async function searched(query: string, { set, limit }: InsertArgs): Promise<Inserted> {
  const found = await searchIcons(query, {
    set,
    limit,
  });

  return {
    icons: found.icons.map((icon) => {
      const prefix = icon.slice(0, icon.indexOf(":"));
      const info = found.sets[prefix];

      return {
        icon,
        set: info?.name ?? prefix,
        license: info?.license?.title ?? "unknown",
      };
    }),
    total: found.total,
    errors: [],
    notes: found.icons.length === 0 ? [`No icon matches "${query}": try other words, or another set.`] : [],
    dryRun: true,
  };
}

/** The icon drawn by Iconify and made a layer, then bound to the call's token; what it made, under which licence. */
async function inserted(plugin: PluginClient, icon: string, args: InsertArgs): Promise<Inserted> {
  const [prefix = "", name = ""] = icon.split(":");
  const set = await iconSet(prefix);

  if (set === null) {
    throw new BridgeError("OP_FAILED", `Iconify has no icon set ${prefix}: search for the icon by words.`);
  }

  const notes: string[] = [];
  const paint = paintOf(args.color, set, notes);
  const svg = await iconSvg(prefix, name, {
    height: args.size,
    color: paint === null ? undefined : "token" in paint ? TOKEN_DRAFT_COLOR : paint.color,
  });

  if (svg === null) {
    throw new BridgeError("OP_FAILED", `Iconify has no icon ${icon}: search for it by words.`);
  }

  const session = plugin.session(args.file);
  const layerName = args.name ?? name;
  const change = await iconChange(session, {
    svg,
    name: layerName,
    icon,
    before: args.before,
  });
  const made = await madeIcon(session, change, args);

  if (made.id !== null && paint !== null && "token" in paint) {
    notes.push(...(await boundTo(session, made.id, paint.token)));
  }

  return {
    created: {
      id: made.id,
      icon,
      name: layerName,
      ...sizeOf(svg),
    },
    license: licenseOf(set),
    errors: made.errors,
    notes,
    dryRun: args.dryRun,
    ...(made.version === undefined ? {} : { version: made.version }),
  };
}

/** What the call's colour asks for; null for none. A set drawn in its own colours takes none, which a note says. */
function paintOf(color: string | undefined, set: IconSet, notes: string[]): IconPaint {
  if (color === undefined) {
    return null;
  }

  if (set.palette) {
    notes.push(`${set.name} draws its icons in their own colours: color is left out.`);

    return null;
  }

  const token = tokenOf(color);

  if (token !== null) {
    return { token: token.token };
  }

  const parsed = Color.parse(color);

  if (parsed === null) {
    throw new BridgeError("OP_FAILED", `color="${color}" is not a CSS colour or var(--token).`);
  }

  if (parsed.channels().a < 1) {
    notes.push(`The icon is drawn in ${parsed.hex()}, opaque: give the layer an opacity for ${color}'s transparency.`);
  }

  return { color: parsed.hex() };
}

/**
 * The icon as design_apply's change: an `<Icon>` read and planned by core, as design_apply plans it, with Iconify's SVG
 * on its asset (the server attaches an Icon's file the same way); what core refuses is the call's error.
 */
async function iconChange(
  session: PluginSession,
  { svg, name, icon, before }: { svg: string; name: string; icon: string; before: string | undefined },
): Promise<ApplyChange> {
  const placed = before === undefined ? "" : ` before="${escapeAttribute(before)}"`;
  const read = readApply(`<Icon name="${escapeAttribute(name)}" src="iconify/${escapeAttribute(icon)}.svg"${placed}/>`);
  const ids = layersToRead(read.elements);
  const layers = ids.length === 0 ? CurrentLayers.none() : CurrentLayers.of(await session.run("entries", { ids }));
  const { assessed, errors: refused } = assessElements(read.elements, layers);
  const planned = planChanges({
    elements: read.elements,
    assessed,
    layers,
    files: new Map(),
  });
  const problems = [...read.errors, ...refused, ...planned.errors];
  const [change] = changesToSend(planned.changes);

  if (change === undefined || problems.length > 0) {
    throw new BridgeError(
      "OP_FAILED",
      problems.map(({ message }) => message).join(" ") || `${icon} could not be placed.`,
    );
  }

  const asset = change.props.asset;

  return asset === undefined
    ? change
    : {
        ...change,
        props: {
          ...change.props,
          asset: {
            ...asset,
            svg,
          },
        },
      };
}

/** The change written (a version saved first when asked, and only when the check finds nothing wrong). */
async function madeIcon(
  session: PluginSession,
  change: ApplyChange,
  { parent, dryRun, version: title }: InsertArgs,
): Promise<{ id: string | null; errors: string[]; version: { id: string | null; title: string } | undefined }> {
  const { result, version } = await versionedWrite(
    session,
    {
      title,
      dryRun,
    },
    {
      write: (dry) =>
        session.run("apply", {
          changes: [change],
          ...(parent === undefined ? {} : { parent }),
          dryRun: dry,
        }),
      // A check without errors means the icon goes in: an older plugin's dry run lists no layers it would make.
      changes: (applied) => (applied.errors.length > 0 ? 0 : 1),
    },
  );

  return {
    id: dryRun ? null : (result.created[0]?.id ?? null),
    errors: result.errors.map(({ message, hint }) => (hint === undefined ? message : `${message} ${hint}`)),
    version,
  };
}

/** The new icon's paints bound to the token: tokens_bind's bind snaps the colour it was drawn in to the token. */
async function boundTo(session: PluginSession, id: string, token: string): Promise<string[]> {
  const bound = await session.run("bind", {
    roots: [id],
    kinds: ["color"],
    choose: [
      {
        value: TOKEN_DRAFT_COLOR,
        token,
      },
    ],
    remap: [],
    dryRun: false,
  });

  return [
    ...bound.errors.map(({ message }) => `Binding ${token}: ${message}`),
    ...(bound.bound.length === 0 && bound.errors.length === 0 ? [`No paint of the icon was bound to ${token}.`] : []),
  ];
}

/** The size Iconify drew the icon at, from its SVG's root. */
function sizeOf(svg: string): { width: number; height: number } {
  const root = parseXml(svg).find((node) => node.kind === "element");
  const props = root?.kind === "element" ? root.props : {};

  return {
    width: Number(props.width ?? 0),
    height: Number(props.height ?? 0),
  };
}

function licenseOf(set: IconSet): NonNullable<Inserted["license"]> {
  return {
    set: set.name,
    title: set.license?.title ?? "unknown",
    ...(set.license?.spdx === undefined ? {} : { spdx: set.license.spdx }),
    ...(set.license?.url === undefined ? {} : { url: set.license.url }),
  };
}
