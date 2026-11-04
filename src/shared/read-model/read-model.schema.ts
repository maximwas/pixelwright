import * as zod from "zod/mini";
import { DEV_STATUS } from "@/shared/ops/outline/outline.constants.ts";
import { LayerSchema } from "@/shared/read-model/layer.schema.ts";
import { FontNameSchema, LetterSpacingSchema, LineHeightSchema } from "@/shared/read-model/layer-text.schema.ts";
import { EffectSchema, PaintSchema } from "@/shared/read-model/layer-values.schema.ts";
import { READ_MODEL, READ_PROFILE } from "@/shared/read-model/read-model.constants.ts";

/** A style the read's layers use: its name, and its value for the tokens. */
export const StyleSchema = zod.looseObject({
  name: zod.string(),
  type: zod.string(),
  remote: zod.boolean(),
  paints: zod.exactOptional(zod.array(PaintSchema)),
  effects: zod.exactOptional(zod.array(EffectSchema)),
  fontName: zod.exactOptional(FontNameSchema),
  fontSize: zod.exactOptional(zod.number()),
  lineHeight: zod.exactOptional(LineHeightSchema),
  letterSpacing: zod.exactOptional(LetterSpacingSchema),
  textCase: zod.exactOptional(zod.string()),
  textDecoration: zod.exactOptional(zod.string()),
  /** Its number among styles of its kind with the same name (T-163, D-29): its token is --Name-2. */
  duplicate: zod.exactOptional(zod.int().check(zod.minimum(READ_MODEL.firstDuplicate))),
});

/** A variable the read's layers are bound to, with its value as the first layer that uses it sees it. */
const VariableSchema = zod.strictObject({
  name: zod.string(),
  collection: zod.string(),
  resolvedType: zod.string(),
  remote: zod.boolean(),
  value: zod.exactOptional(zod.unknown()),
  /** The name developers gave it per platform (WEB: the CSS variable Dev Mode shows). */
  codeSyntax: zod.exactOptional(zod.record(zod.string(), zod.string())),
});

/** One end of a Dev Mode measurement: a layer's id and the side measured from (Figma's TOP, RIGHT, BOTTOM, LEFT). */
const MeasuredSideSchema = zod.strictObject({ id: zod.string(), side: zod.string() });

/** The page a read layer is on, by id and name. */
export const ReadPageSchema = zod.strictObject({ id: zod.string(), name: zod.string() });

/**
 * One read of a layer (A§7.1, D-05): a versioned header around 0.7.0's snapshot, whose field names it keeps (K-084).
 * A baseline v1 snapshot has no header and reads as a design model.
 */
export const ReadModelSchema = zod.strictObject({
  model: zod._default(zod.literal(READ_MODEL.version), READ_MODEL.version),
  profile: zod._default(zod.enum(READ_PROFILE), READ_PROFILE.design),
  root: LayerSchema,
  /**
   * Only when asked for: the layers above the root up to its page, nearest first, each with those of its children that
   * overlap the root (what lies behind and over it on the canvas); the child the root is in is a bare entry, no children.
   */
  ancestors: zod.exactOptional(zod.array(LayerSchema)),
  /** Figma's colour profile of the file (LEGACY, SRGB, DISPLAY_P3): a Display P3 file's colours are P3 values. */
  colorProfile: zod.exactOptional(zod.string()),
  /** What the designer marked in Dev Mode on the read layer or the nearest layer above it: ready, or completed. */
  devStatus: zod.exactOptional(zod.enum(DEV_STATUS)),
  styles: zod.record(zod.string(), StyleSchema),
  variables: zod.record(zod.string(), VariableSchema),
  /** The page's Dev Mode measurements with a side on the read layers, with the designer's text when there is one. */
  measurements: zod.exactOptional(
    zod.array(
      zod.strictObject({ start: MeasuredSideSchema, end: MeasuredSideSchema, text: zod.exactOptional(zod.string()) }),
    ),
  ),
  /** The page the read layer is on: the read op names it (T-206); plugins before 0.7.0's stage 11 left it out. */
  page: zod.exactOptional(ReadPageSchema),
});

export type ReadModel = zod.output<typeof ReadModelSchema>;

/** What the CSS mapping reads of a read beside its layers: the colour profile, and the styles and variables by id. */
export type ModelTables = Pick<ReadModel, "colorProfile" | "styles" | "variables">;
