import * as zod from "zod/mini";
import { INSPECT_FIELD, MEASURE_FIELD, MEASURE_SIDE, MEASURED, TEXT_BREAK } from "@/core/inspect/inspect.constants.ts";
import { EffectSchema, ReactionSchema } from "@/shared/read-model/layer-values.schema.ts";

const BoxSchema = zod.object({ x: zod.number(), y: zod.number(), width: zod.number(), height: zod.number() });

const PropertyValueSchema = zod.union([zod.string(), zod.boolean()]);

const PointSchema = zod.object({ x: zod.number(), y: zod.number() });

const SidesSchema = zod.object({ top: zod.number(), right: zod.number(), bottom: zod.number(), left: zod.number() });

/** A blend mode as Figma names it and as CSS's mix-blend-mode (B-002). */
const BLEND_FIELDS = {
  blendMode: zod.exactOptional(zod.string()).check(zod.describe(INSPECT_FIELD.blendMode)),
  mixBlendMode: zod.exactOptional(zod.string()).check(zod.describe(INSPECT_FIELD.mixBlendMode)),
};

/** A colour variable a paint is bound to, under its token: its value and its name in Figma. */
const BoundPaintSchema = zod.object({ value: zod.string(), variable: zod.string() });

const FillsViewSchema = zod.object({
  css: zod.string().check(zod.describe(INSPECT_FIELD.fillsCss)),
  style: zod
    .exactOptional(zod.object({ name: zod.string(), token: zod.string() }))
    .check(zod.describe(INSPECT_FIELD.fillsStyle)),
  tokens: zod.exactOptional(zod.record(zod.string(), BoundPaintSchema)).check(zod.describe(INSPECT_FIELD.fillsTokens)),
  paints: zod.array(zod.object({ type: zod.string(), ...BLEND_FIELDS })).check(zod.describe(INSPECT_FIELD.fillsPaints)),
});

const TextViewSchema = zod.object({
  segments: zod
    .exactOptional(
      zod.array(
        zod.object({
          start: zod.number(),
          end: zod.number(),
          characters: zod.string(),
          fontFamily: zod.string(),
          fontStyle: zod.string(),
          fontSize: zod.number(),
          textDecoration: zod.string(),
          fill: zod.exactOptional(zod.string()),
        }),
      ),
    )
    .check(zod.describe(INSPECT_FIELD.segments)),
  lines: zod.array(zod.object({ text: zod.string(), break: zod.nullable(zod.enum(TEXT_BREAK)) })),
  lineHeights: zod.array(zod.string()),
  fontSizes: zod.array(zod.number()),
  autoResize: zod.string(),
  paragraphSpacing: zod.exactOptional(zod.number()),
});

/** One layer as inspect gives it (T-080..T-083, B-002, O-026). */
const LayerViewSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  type: zod.string(),
  parent: zod.exactOptional(zod.nullable(zod.object({ id: zod.string(), name: zod.string(), type: zod.string() }))),
  box: zod.exactOptional(BoxSchema.check(zod.describe(INSPECT_FIELD.box))),
  center: zod.exactOptional(PointSchema.check(zod.describe(INSPECT_FIELD.center))),
  path: zod
    .exactOptional(zod.array(zod.object({ id: zod.string(), name: zod.string(), type: zod.string() })))
    .check(zod.describe(INSPECT_FIELD.path)),
  page: zod.exactOptional(zod.object({ id: zod.string(), name: zod.string() })).check(zod.describe(INSPECT_FIELD.page)),
  distance: zod.exactOptional(zod.number()).check(zod.describe(INSPECT_FIELD.distance)),
  angle: zod.exactOptional(zod.number()).check(zod.describe(INSPECT_FIELD.angle)),
  paintedBox: zod.exactOptional(BoxSchema).check(zod.describe(INSPECT_FIELD.paintedBox)),
  rotation: zod.exactOptional(zod.number()).check(zod.describe(INSPECT_FIELD.rotation)),
  ...BLEND_FIELDS,
  overflow: zod
    .exactOptional(
      zod.object({
        left: zod.exactOptional(zod.number()),
        right: zod.exactOptional(zod.number()),
        top: zod.exactOptional(zod.number()),
        bottom: zod.exactOptional(zod.number()),
      }),
    )
    .check(zod.describe(INSPECT_FIELD.overflow)),
  strokes: zod.exactOptional(
    zod.object({
      align: zod.string(),
      weight: zod.exactOptional(zod.number()),
      weights: zod.exactOptional(SidesSchema),
      dashes: zod.exactOptional(zod.array(zod.number())),
      colors: zod.array(zod.string()),
      tokens: zod
        .exactOptional(zod.record(zod.string(), BoundPaintSchema))
        .check(zod.describe(INSPECT_FIELD.strokesTokens)),
      includedInLayout: zod.exactOptional(zod.boolean()),
    }),
  ),
  effects: zod.exactOptional(zod.array(EffectSchema)).check(zod.describe(INSPECT_FIELD.effects)),
  text: zod.exactOptional(TextViewSchema),
  layout: zod
    .exactOptional(zod.record(zod.string(), zod.union([zod.number(), zod.string()])))
    .check(zod.describe(INSPECT_FIELD.layout)),
  parentLayout: zod
    .exactOptional(zod.record(zod.string(), zod.union([zod.number(), zod.string()])))
    .check(zod.describe(INSPECT_FIELD.parentLayout)),
  fills: zod.exactOptional(FillsViewSchema),
  bound: zod
    .exactOptional(
      zod.record(
        zod.string(),
        zod.object({
          token: zod.string(),
          variable: zod.string(),
          value: zod.exactOptional(zod.union([zod.number(), zod.string(), zod.boolean()])),
        }),
      ),
    )
    .check(zod.describe(INSPECT_FIELD.bound)),
  interactions: zod.exactOptional(
    zod.array(zod.object({ trigger: zod.string(), summary: zod.string(), reaction: ReactionSchema })),
  ),
  component: zod.exactOptional(
    zod.object({
      name: zod.string(),
      set: zod.exactOptional(zod.string()),
      variant: zod.record(zod.string(), zod.string()),
      properties: zod
        .record(
          zod.string(),
          zod.object({
            type: zod.string(),
            value: PropertyValueSchema,
            default: zod.exactOptional(PropertyValueSchema),
          }),
        )
        .check(zod.describe(INSPECT_FIELD.componentProperties)),
    }),
  ),
});

/** inspect's answer (A§9.3): the layers in the order asked, what their boxes start from, and what was not read. */
export const InspectViewSchema = zod.object({
  relativeTo: zod.string().check(zod.describe(INSPECT_FIELD.relativeTo)),
  around: zod.exactOptional(PointSchema).check(zod.describe(INSPECT_FIELD.around)),
  layers: zod.array(LayerViewSchema),
  missing: zod.array(zod.string()).check(zod.describe(INSPECT_FIELD.missing)),
  left: zod.exactOptional(zod.int()).check(zod.describe(INSPECT_FIELD.left)),
  more: zod.exactOptional(zod.literal(true)).check(zod.describe(INSPECT_FIELD.more)),
  leftIds: zod.exactOptional(zod.array(zod.string())).check(zod.describe(INSPECT_FIELD.leftIds)),
});

export type InspectAnswer = zod.output<typeof InspectViewSchema>;

export type InspectLayerView = InspectAnswer["layers"][number];

const LayerRefSchema = zod.object({ id: zod.string(), name: zod.string() });

/** How one layer sits against the one before it in the list (K-061). */
const MeasuredPairSchema = zod.object({
  a: LayerRefSchema,
  b: LayerRefSchema,
  summary: zod.string(),
  gap: zod.object({ x: zod.number(), y: zod.number() }).check(zod.describe(MEASURE_FIELD.gap)),
  edges: zod
    .object({
      left: zod.number(),
      right: zod.number(),
      top: zod.number(),
      bottom: zod.number(),
      centerX: zod.number(),
      centerY: zod.number(),
    })
    .check(zod.describe(MEASURE_FIELD.edges)),
  contains: zod.exactOptional(zod.enum(MEASURE_SIDE)).check(zod.describe(MEASURE_FIELD.contains)),
  inset: zod.exactOptional(SidesSchema).check(zod.describe(MEASURE_FIELD.inset)),
});

/** measure's answer (T-084). */
export const MeasureSchema = zod.object({
  measured: zod.enum(MEASURED).check(zod.describe(MEASURE_FIELD.measured)),
  pairs: zod.array(MeasuredPairSchema),
  missing: zod.array(zod.string()).check(zod.describe(MEASURE_FIELD.missing)),
});

export type MeasureAnswer = zod.output<typeof MeasureSchema>;

export type MeasuredPair = zod.output<typeof MeasuredPairSchema>;
