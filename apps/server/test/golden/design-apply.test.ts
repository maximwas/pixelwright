import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { designXml, fitPlan, type Snapshot, SnapshotSchema } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { applyDesign } from "../../src/design/apply-design.ts";
import type { BridgeView } from "../../src/types/mcp.ts";
import { PNG, pngHeader } from "../helpers/images.ts";
import { type RecordingOptions, recordingBridge } from "../helpers/recording-bridge.ts";

/**
 * design_apply's requests to the plugin and its answer, call by call, as the code before the rewrite of the apply
 * pipeline made them: round trips, single edits, structure, reads the budget cut, files and errors. Upload streams
 * are numbered in the order they appear, and the files' folder is <dir>.
 */

const fixture = (name: string): Snapshot =>
  SnapshotSchema.parse(
    JSON.parse(readFileSync(new URL(`../../../../packages/core/test/fixtures/${name}.json`, import.meta.url), "utf8")),
  );

const PRICING = fixture("orbit-pricing");
const PLANS = fixture("orbit-plans");
const P3_PRICING: Snapshot = {
  ...PRICING,
  colorProfile: "DISPLAY_P3",
};

/** A frame holding a photo whose image is PNG's bytes: design_read's Image. */
const PHOTO: Snapshot = {
  root: {
    id: "1:1",
    name: "Gallery",
    type: "FRAME",
    visible: true,
    x: 0,
    y: 0,
    width: 300,
    height: 200,
    childCount: 1,
    layoutMode: "HORIZONTAL",
    children: [
      {
        id: "1:2",
        name: "Photo",
        type: "RECTANGLE",
        visible: true,
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        childCount: 0,
        fills: [
          {
            type: "IMAGE",
            imageHash: createHash("sha1").update(PNG).digest("hex"),
            scaleMode: "FILL",
          },
        ],
      },
    ],
  },
  styles: {},
  variables: {},
};

interface Case {
  readonly name: string;
  readonly snapshot: Snapshot;
  readonly xml: string;
  readonly dryRun?: boolean;
  readonly version?: string;
  readonly parent?: string;
  readonly file?: string;
  readonly options?: RecordingOptions;
}

const GAP = '<Frame id="54:227" gap="48px"/>';
const photoXml = designXml(PHOTO).xml;
const copySource = /id="(I54:268;[^"]+)"/.exec(designXml(PLANS).xml)?.[1] ?? "";

const CASES: readonly Case[] = [
  {
    name: "round trip: pricing",
    snapshot: PRICING,
    xml: designXml(PRICING).xml,
  },
  {
    name: "round trip: pricing in Display P3",
    snapshot: P3_PRICING,
    xml: designXml(P3_PRICING).xml,
  },
  {
    name: "round trip: plans",
    snapshot: PLANS,
    xml: designXml(PLANS).xml,
  },
  {
    name: "round trip: plans cut to 2000 characters",
    snapshot: PLANS,
    xml: designXml(PLANS, fitPlan(PLANS, 2_000)).xml,
  },
  {
    name: "edit: gap",
    snapshot: PRICING,
    xml: GAP,
  },
  {
    name: "edit: gap with a version",
    snapshot: PRICING,
    xml: GAP,
    version: "Before the gap",
  },
  {
    name: "edit: gap as a dry run with a version",
    snapshot: PRICING,
    xml: GAP,
    version: "Before the gap",
    dryRun: true,
  },
  {
    name: "edit: gap with a version Figma refuses",
    snapshot: PRICING,
    xml: GAP,
    version: "fails",
  },
  {
    name: "edit: gap with a version an old plugin cannot save",
    snapshot: PRICING,
    xml: GAP,
    version: "old plugin",
  },
  {
    name: "edit: padding from tokens to px",
    snapshot: PRICING,
    xml: '<Frame id="54:227" padding="64px 120px 120px"/>',
  },
  {
    name: "edit: a hex colour for a token",
    snapshot: PRICING,
    xml: '<Text id="54:240" color="#3B2FD9"/>',
  },
  {
    name: "edit: text",
    snapshot: PRICING,
    xml: '<Text id="54:241">Plans for every orbit</Text>',
  },
  {
    name: "edit: a span's colour over the same characters",
    snapshot: PRICING,
    xml: '<Text id="54:241">Plans that grow with <Span color="#FF6B3D">your orbit</Span></Text>',
  },
  {
    name: "edit: text style",
    snapshot: PRICING,
    xml: '<Text id="54:233" textStyle="Label"/>',
  },
  {
    name: "edit: note",
    snapshot: PRICING,
    xml: '<Frame id="54:238" note="Hero: keep the planet on the right"/>',
  },
  {
    name: "edit: variant",
    snapshot: PRICING,
    xml: '<Instance id="54:236" variant="Variant=Primary, State=Default"/>',
  },
  {
    name: "edit: props",
    snapshot: PRICING,
    xml: '<Instance id="54:236" props="Label=Log in"/>',
  },
  {
    name: "edit: component swap",
    snapshot: PRICING,
    xml: '<Instance id="54:236" component="Plan Card"/>',
  },
  {
    name: "edit: display none",
    snapshot: PRICING,
    xml: '<Frame id="54:232" display="none"/>',
  },
  {
    name: "edit: rename",
    snapshot: PRICING,
    xml: '<Frame id="54:229" name="Brand"/>',
  },
  {
    name: "structure: a create of each creatable tag",
    snapshot: PRICING,
    parent: "54:238",
    xml: [
      '<Frame name="New frame" width="100px" height="40px"/>',
      "<Text>Hello</Text>",
      '<Rectangle name="Box" width="10px" height="10px" background="#FFF"/>',
      '<Ellipse name="Dot" width="8px" height="8px"/>',
      '<Line name="Rule" width="100px" border-top="1px solid #000"/>',
    ].join("\n"),
  },
  {
    name: "structure: the nav's texts in another order",
    snapshot: PRICING,
    xml: '<Frame id="54:232"><Text id="54:235"/><Text id="54:233"/><Text id="54:234"/></Frame>',
  },
  {
    name: "structure: a move into a new parent",
    snapshot: PRICING,
    xml: '<Frame id="54:238"><Frame name="Wrap"><Text id="54:240"/></Frame></Frame>',
  },
  {
    name: "structure: a create after a layer",
    snapshot: PRICING,
    xml: '<Frame name="Spacer" after="54:228" height="8px"/>',
  },
  {
    name: "structure: a copy with its source's ids",
    snapshot: PLANS,
    xml: `<Instance copyOf="54:268" name="Plan – Pro copy"><Text id="${copySource}">Copied text</Text></Instance>`,
  },
  {
    name: "structure: a new instance named by another instance's ids",
    snapshot: PLANS,
    parent: "54:243",
    xml: '<Instance component="Plan Card" name="Plan – Team"><Text id="I54:244;54:207">For teams.</Text></Instance>',
  },
  {
    name: "reads: a layer the read's budget cut",
    snapshot: PRICING,
    xml: '<Frame id="54:227" opacity="0.9"><Frame id="54:228" opacity="0.5"/></Frame>',
    options: { cut: true },
  },
  {
    name: "reads: an id the file does not hold",
    snapshot: PRICING,
    xml: '<Frame id="99:99" opacity="0.5"/>',
    options: { missing: ["99:99"] },
  },
  {
    name: "files: the same bytes",
    snapshot: PHOTO,
    xml: photoXml.replace(/src="[^"]+"/, 'src="photo.png"'),
  },
  {
    name: "files: other bytes",
    snapshot: PHOTO,
    xml: photoXml.replace(/src="[^"]+"/, 'src="other.png"'),
  },
  {
    name: "files: a file that is not there",
    snapshot: PHOTO,
    xml: photoXml.replace(/src="[^"]+"/, 'src="nowhere.png"'),
  },
  {
    name: "files: two images of one file and an icon",
    snapshot: PHOTO,
    parent: "1:1",
    xml: '<Image src="photo.png" width="10px"/>\n<Image src="photo.png" width="20px"/>\n<Icon src="arrow.svg"/>',
  },
  {
    name: "files: two images of one file and an icon, dry run",
    snapshot: PHOTO,
    parent: "1:1",
    dryRun: true,
    xml: '<Image src="photo.png" width="10px"/>\n<Image src="photo.png" width="20px"/>\n<Icon src="arrow.svg"/>',
  },
  {
    name: "files: a WebP image",
    snapshot: PHOTO,
    parent: "1:1",
    xml: '<Image src="photo.webp"/>',
  },
  {
    name: "files: an image wider than Figma takes",
    snapshot: PHOTO,
    parent: "1:1",
    xml: '<Image src="wide.png"/>',
  },
  {
    name: "errors: XML that does not parse",
    snapshot: PRICING,
    xml: '<Frame id="54:227">\n  <Text>Hi</Frame>',
  },
  {
    name: "errors: only refused elements",
    snapshot: PRICING,
    xml: '<Fram id="54:227"/>\n<Frame id="54:228" gapp="8px"/>',
  },
  {
    name: "errors: the plugin's errors merged with the reader's",
    snapshot: PRICING,
    xml: `${GAP}\n<Frame id="54:228" gapp="8px" opacity="0.5"/>`,
    options: {
      pluginErrors: [
        {
          line: 1,
          column: 1,
          id: "54:227",
          attribute: "gap",
          message: "Figma refused the gap",
        },
      ],
    },
  },
  {
    name: "errors: a file named that is not open",
    snapshot: PRICING,
    xml: GAP,
    file: "Another file",
  },
];

/** A folder of the files the cases name. */
function folder(): string {
  const dir = mkdtempSync(join(tmpdir(), "pixelwright-golden-apply-"));

  writeFileSync(join(dir, "photo.png"), PNG);
  writeFileSync(join(dir, "other.png"), Buffer.concat([PNG, Buffer.from("x")]));
  writeFileSync(join(dir, "arrow.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>');
  writeFileSync(join(dir, "photo.webp"), Buffer.from("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ", "latin1"));
  writeFileSync(join(dir, "wide.png"), pngHeader(4_100, 2));

  return dir;
}

/** How a case runs: the one place the apply pipeline's rewrite changes in this file. */
function run(bridge: BridgeView, testCase: Case, cwd: string) {
  return applyDesign(
    bridge,
    {
      xml: testCase.xml,
      dryRun: testCase.dryRun ?? false,
      ...(testCase.parent === undefined ? {} : { parent: testCase.parent }),
      ...(testCase.file === undefined ? {} : { file: testCase.file }),
      ...(testCase.version === undefined ? {} : { version: testCase.version }),
    },
    { cwd },
  );
}

/** A thrown error as its code and message. */
function thrownOf(error: unknown): Record<string, unknown> {
  return error instanceof Error
    ? {
        name: error.name,
        ...("code" in error ? { code: error.code } : {}),
        message: error.message,
      }
    : { value: String(error) };
}

/** The record with upload streams numbered in order of appearance and the files' folder as <dir>. */
function normalized(record: unknown, dir: string): string {
  const streams = new Map<string, string>();

  return JSON.stringify(record, null, 2)
    .replaceAll(dir, "<dir>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (stream) => {
      if (!streams.has(stream)) {
        streams.set(stream, `stream-${streams.size + 1}`);
      }

      return streams.get(stream) ?? stream;
    });
}

describe("golden design_apply", () => {
  it("keeps every call's requests to the plugin and its answer", async () => {
    const dir = folder();
    const record: Record<string, unknown> = {};

    for (const testCase of CASES) {
      const { bridge, requests } = recordingBridge(testCase.snapshot, testCase.options);
      const outcome = await run(bridge, testCase, dir).then(
        (result) => ({ result }),
        (error: unknown) => ({ thrown: thrownOf(error) }),
      );

      record[testCase.name] = {
        requests,
        ...outcome,
      };
    }

    await expect(`${normalized(record, dir)}\n`).toMatchFileSnapshot("__golden__/design-apply.json");
  });
});
