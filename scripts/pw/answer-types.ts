import { writeFileSync } from "node:fs";
import { camelCase, pascalCase } from "es-toolkit";
import { compile } from "json-schema-to-typescript";
import * as zod from "zod/mini";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { TOOL_JSON_SCHEMA } from "@/server/main/mcp/mcp.constants.ts";
import { ToolCatalog } from "@/server/tools/tool.catalog.ts";

/** One read as types_read answers it: its tool, how a script calls it, its whole answer type. */
export interface AnswerType {
  tool: string;
  call: string;
  type: string;
}

const TARGET = new URL("../../src/server/tools/types-read/data/answer-types.json", import.meta.url);
/**
 * The tools that answer in content blocks and list no outputSchema (T-005): what pw gives back, by hand. A handle
 * names an image the run keeps; returned, execute shows it after its answer.
 */
const RESULTS: Readonly<Record<string, string>> = {
  design_read: `export interface DesignReadResult {
  /** The design XML, as design_read writes it. */
  xml: string;
  /** The JSON block beside the XML, in its order. */
  json: DesignReadJson;
  /** The XML's elements as data, to filter layers without parsing the XML. */
  tree: DesignElement | null;
  /** With screenshot: true, the image's handle: return it and execute shows the image. */
  image?: string;
}
/** design_read's JSON block, as the tool builds it (DesignReader, ReadJson and the tool's own fields). */
export interface DesignReadJson {
  /** The layer read. */
  node: string;
  /** Each variable and paint or effect style the read uses, by its token name, with its value as the XML writes it. */
  tokens: Record<string, string>;
  /** Each text style the texts name, as its font shorthand with its spacing and case. */
  textStyles: Record<string, string>;
  /** Each font family the texts use, with its weights in numeric order (italic said). */
  fonts: Record<string, string[]>;
  /** The files the XML's src names (only planned unless assetsDir wrote them), or a video, which has no file. */
  assets: {
    node: string;
    kind: "icon" | "image" | "video";
    format?: string;
    src?: string;
    scale?: number;
    imageHash?: string;
  }[];
  /** The designer's Dev Mode measurements, when there are any: each end as "<id> <side>", the px between them. */
  measurements?: {
    from: string;
    to: string;
    px?: number;
    text?: string;
  }[];
  /** What the code should know or fix, one per kind with a count and examples. */
  hints: string[];
  /** Ids of the layers the read cut, $children="N" or $truncated="true" on them: read each on its own. */
  truncated: string[];
  /** With repeats: each run read as its first, the fields its layers hold apart, and a row of values per layer. */
  repeats?: {
    template: string;
    layers: string[];
    fields: {
      layer: string;
      path?: string;
      attribute: string;
    }[];
    rows: (string | string[])[][];
  }[];
  /** false when the files are only planned: every src is a plan, and a hint says how to write them. */
  written?: false;
  /** With assetsDir: the layers whose asset was not written, and why. */
  assetErrors?: {
    node: string;
    message: string;
    kind?: "video";
  }[];
  /** With nearby: the screen the layer is on, the designer's notes around it nearest first, and how many more. */
  nearby?: {
    screen: {
      id: string;
      name: string;
    };
    notes: {
      id: string;
      name: string;
      text: string;
      side: "over" | "left" | "right" | "above" | "below";
      distance: number;
    }[];
    more: number;
  };
}
/** One element of the XML: its layer's id, its tag, its attributes (CSS, and metadata such as name), a Text's text. */
export interface DesignElement {
  id: string;
  tag: string;
  attributes: Record<string, string>;
  text?: string;
  children: DesignElement[];
}
`,
};
/** prettier 3's objectWrap collapse: an object type that fits in 120 characters on one line. */
const OPTIONS = {
  bannerComment: "",
  additionalProperties: false,
  ignoreMinAndMaxItems: true,
  style: { printWidth: 120, objectWrap: "collapse", bracketSpacing: true },
} as const;

/**
 * types_read's answer types, written at build time (`pnpm build:pw`): for every read a script can call, its answer as
 * TypeScript from the JSON Schema tools/list publishes for its output, whole (json-schema-to-typescript 16.0.0 and its
 * prettier stay devDependencies: only the strings ship). pw's names are the tools' in camelCase, as the server's.
 */
export class AnswerTypes {
  async entries(): Promise<AnswerType[]> {
    return await Promise.all(
      new ToolCatalog().reads().map(async (manifest) => {
        const name = camelCase(manifest.name);

        return {
          tool: manifest.name,
          call: `pw.${name}`,
          type: await this.#type(manifest, `${pascalCase(name)}Result`),
        };
      }),
    );
  }

  async write(): Promise<void> {
    writeFileSync(TARGET, `${JSON.stringify(await this.entries(), null, 2)}\n`);
  }

  async #type(manifest: ToolManifest, title: string): Promise<string> {
    if (manifest.output === undefined) {
      return (RESULTS[manifest.name] ?? "").trim();
    }

    const output = zod.toJSONSchema(manifest.output, { target: TOOL_JSON_SCHEMA.target, io: TOOL_JSON_SCHEMA.output });

    return (await compile({ ...output, title } as never, title, OPTIONS)).trim();
  }
}
