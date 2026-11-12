import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insertIcon } from "../src/features/icons-insert/insert-icon.ts";
import { IconsInsertInputSchema } from "../src/features/icons-insert/schemas.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import type { RequestOptions } from "../src/types/bridge.ts";
import type { BridgeView } from "../src/types/mcp.ts";
import { pluginInfo } from "./helpers/fake-plugin.ts";

const LUCIDE = {
  name: "Lucide",
  license: {
    title: "ISC",
    spdx: "ISC",
    url: "https://github.com/lucide-icons/lucide/blob/main/LICENSE",
  },
  palette: false,
};

const LOGOS = {
  name: "SVG Logos",
  license: {
    title: "CC0",
    spdx: "CC0-1.0",
  },
  palette: true,
};

const ARROW = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="none" stroke="${color}" d="M5 12h14"/></svg>`;

/** Iconify's API as the tests need it: what each request asked for, and its answer. */
const asked: string[] = [];

function iconify(url: URL): Response {
  if (url.pathname === "/search") {
    return Response.json({
      icons: ["lucide:arrow-right", "lucide:arrow-left", "logos:figma"],
      total: 3,
      collections: {
        lucide: LUCIDE,
        logos: LOGOS,
      },
    });
  }

  if (url.pathname === "/collections") {
    return Response.json({
      lucide: LUCIDE,
      logos: LOGOS,
    });
  }

  if (url.pathname === "/lucide/arrow-right.svg") {
    return new Response(ARROW(url.searchParams.get("color") ?? "currentColor"));
  }

  if (url.pathname === "/logos/figma.svg") {
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="21" height="32" viewBox="0 0 256 384"><path fill="#0acf83" d="M0 0h1v1z"/></svg>',
    );
  }

  return new Response("404", { status: 404 });
}

/** A bridge recording the operations it is asked for, answering apply with one new layer and bind with one binding. */
function recording() {
  const ops: { op: string; input: unknown; options: RequestOptions | undefined }[] = [];
  const bridge: BridgeView = {
    status: () => {
      throw new Error("not used");
    },
    pairing: () => null,
    plugins: () => [
      {
        session: "s1",
        info: pluginInfo(),
        active: true,
      },
    ],
    request: async (op, input, options) => {
      ops.push({
        op,
        input,
        options,
      });

      if (op === "apply") {
        return {
          created: [
            {
              line: 1,
              ref: "new:1",
              id: "9:1",
              tag: "Icon",
            },
          ],
          changed: [],
          errors: [],
        };
      }

      return {
        bound: [],
        ambiguous: [],
        unmatched: [],
        remapped: [],
        layers: 1,
        errors: [],
        notes: [],
        more: false,
      };
    },
  };

  return {
    ops,
    client: new PluginClient(bridge),
  };
}

beforeEach(() => {
  asked.length = 0;
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = new URL(String(input));

    asked.push(`${url.pathname}${url.search}`);

    return iconify(url);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("icons_insert", () => {
  it("searches Iconify and names each icon's set and licence, writing nothing in Figma", async () => {
    const { ops, client } = recording();
    const result = await insertIcon(
      client,
      IconsInsertInputSchema.parse({
        search: "arrow",
        limit: 2,
      }),
    );

    expect(result.icons).toEqual([
      {
        icon: "lucide:arrow-right",
        set: "Lucide",
        license: "ISC",
      },
      {
        icon: "lucide:arrow-left",
        set: "Lucide",
        license: "ISC",
      },
    ]);
    expect(result.total).toBe(3);
    expect(ops).toEqual([]);
  });

  it("inserts an icon as an Icon layer at its size, inside the parent, named after the icon", async () => {
    const { ops, client } = recording();
    const result = await insertIcon(
      client,
      IconsInsertInputSchema.parse({
        icon: "lucide:arrow-right",
        parent: "1:2",
        size: 32,
      }),
    );
    const [apply] = ops;

    expect(asked).toContain("/lucide/arrow-right.svg?height=32");
    expect(apply).toMatchObject({
      op: "apply",
      input: {
        parent: "1:2",
        dryRun: false,
        changes: [
          {
            kind: "create",
            tag: "Icon",
            props: {
              name: "arrow-right",
              asset: {
                kind: "icon",
                svg: ARROW("currentColor"),
              },
            },
          },
        ],
      },
    });
    expect(result).toMatchObject({
      created: {
        id: "9:1",
        icon: "lucide:arrow-right",
        name: "arrow-right",
        width: 32,
        height: 32,
      },
      license: {
        set: "Lucide",
        title: "ISC",
      },
      errors: [],
    });
  });

  it("draws an icon in a raw colour, and binds a token's colour to its variable", async () => {
    const raw = recording();

    await insertIcon(
      raw.client,
      IconsInsertInputSchema.parse({
        icon: "lucide:arrow-right",
        color: "#3B2FD9",
      }),
    );

    expect(asked).toContain("/lucide/arrow-right.svg?height=24&color=%233B2FD9");
    expect(raw.ops.map(({ op }) => op)).toEqual(["apply"]);

    const token = recording();

    await insertIcon(
      token.client,
      IconsInsertInputSchema.parse({
        icon: "lucide:arrow-right",
        color: "var(--color-brand)",
      }),
    );

    expect(token.ops.map(({ op }) => op)).toEqual(["apply", "bind"]);
    expect(token.ops[1]?.input).toMatchObject({
      roots: ["9:1"],
      kinds: ["color"],
      choose: [
        {
          value: "#000",
          token: "--color-brand",
        },
      ],
      dryRun: false,
    });
  });

  it("keeps the colours of an icon set drawn in its own, and says so", async () => {
    const { client } = recording();
    const result = await insertIcon(
      client,
      IconsInsertInputSchema.parse({
        icon: "logos:figma",
        color: "#000",
      }),
    );

    expect(asked).toContain("/logos/figma.svg?height=24");
    expect(result.notes).toContainEqual(expect.stringMatching(/own colours/));
  });

  it("names an icon Iconify does not have", async () => {
    const { ops, client } = recording();

    await expect(insertIcon(client, IconsInsertInputSchema.parse({ icon: "lucide:no-such-icon" }))).rejects.toThrow(
      /lucide:no-such-icon/,
    );
    expect(ops).toEqual([]);
  });

  it("checks a dry run without making the layer or binding it", async () => {
    const { ops, client } = recording();
    const result = await insertIcon(
      client,
      IconsInsertInputSchema.parse({
        icon: "lucide:arrow-right",
        color: "var(--color-brand)",
        dryRun: true,
      }),
    );

    expect(ops.map(({ op, input }) => [op, (input as { dryRun: boolean }).dryRun])).toEqual([["apply", true]]);
    expect(result.dryRun).toBe(true);
  });

  it("takes a search or an icon by Iconify's set:name, one of them", async () => {
    const { client } = recording();

    expect(IconsInsertInputSchema.safeParse({ icon: "Lucide Arrow" }).success).toBe(false);
    await expect(insertIcon(client, IconsInsertInputSchema.parse({}))).rejects.toThrow(/search.*icon/);
    await expect(
      insertIcon(
        client,
        IconsInsertInputSchema.parse({
          search: "arrow",
          icon: "lucide:arrow-right",
        }),
      ),
    ).rejects.toThrow(/one of them/);
  });
});
