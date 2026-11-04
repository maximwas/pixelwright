import * as zod from "zod/mini";
import { READ_VALUE } from "@/shared/read-model/read-model.constants.ts";

/** What the plugin sends for Figma's `figma.mixed`: a property that differs across a node's parts. */
export const MixedSchema = zod.literal(READ_VALUE.mixed);

const ColorSchema = zod.strictObject({
  r: zod.number(),
  g: zod.number(),
  b: zod.number(),
  a: zod.exactOptional(zod.number()),
});

const OffsetSchema = zod.strictObject({ x: zod.number(), y: zod.number() });

export const BoundVariablesSchema = zod.record(zod.string(), zod.unknown());

/** A Figma Paint as the Plugin API gives it; loose, so a paint type Figma adds later still passes. */
export const PaintSchema = zod.looseObject({
  type: zod.string(),
  visible: zod.exactOptional(zod.boolean()),
  opacity: zod.exactOptional(zod.number()),
  blendMode: zod.exactOptional(zod.string()),
  color: zod.exactOptional(ColorSchema),
  gradientStops: zod.exactOptional(zod.array(zod.looseObject({ position: zod.number(), color: ColorSchema }))),
  gradientTransform: zod.exactOptional(zod.array(zod.array(zod.number()))),
  imageHash: zod.exactOptional(zod.nullable(zod.string())),
  scaleMode: zod.exactOptional(zod.string()),
  boundVariables: zod.exactOptional(BoundVariablesSchema),
});

/** A Figma Effect (shadow or blur) as the Plugin API gives it. */
export const EffectSchema = zod.looseObject({
  type: zod.string(),
  visible: zod.exactOptional(zod.boolean()),
  radius: zod.exactOptional(zod.number()),
  color: zod.exactOptional(ColorSchema),
  offset: zod.exactOptional(OffsetSchema),
  spread: zod.exactOptional(zod.number()),
  blendMode: zod.exactOptional(zod.string()),
  showShadowBehindNode: zod.exactOptional(zod.boolean()),
  boundVariables: zod.exactOptional(BoundVariablesSchema),
  /** A blur's kind: NORMAL, or PROGRESSIVE from startRadius at startOffset to radius at endOffset (0–1 of the box). */
  blurType: zod.exactOptional(zod.string()),
  startRadius: zod.exactOptional(zod.number()),
  startOffset: zod.exactOptional(OffsetSchema),
  endOffset: zod.exactOptional(OffsetSchema),
});

/** A transition's easing: a named curve, a cubic bezier or a spring. */
const EasingSchema = zod.looseObject({
  type: zod.string(),
  easingFunctionCubicBezier: zod.exactOptional(
    zod.strictObject({ x1: zod.number(), y1: zod.number(), x2: zod.number(), y2: zod.number() }),
  ),
  easingFunctionSpring: zod.exactOptional(
    zod.looseObject({ mass: zod.number(), stiffness: zod.number(), damping: zod.number() }),
  ),
});

/** One prototype interaction: what starts it and what it does; NODE actions carry their destination's name. */
export const ReactionSchema = zod.looseObject({
  trigger: zod.nullable(
    zod.looseObject({
      type: zod.string(),
      /** AFTER_TIMEOUT, in seconds. */
      timeout: zod.exactOptional(zod.number()),
      /** MOUSE_ENTER and the like, in seconds. */
      delay: zod.exactOptional(zod.number()),
    }),
  ),
  actions: zod.exactOptional(
    zod.array(
      zod.looseObject({
        type: zod.string(),
        destinationId: zod.exactOptional(zod.nullable(zod.string())),
        destinationName: zod.exactOptional(zod.string()),
        navigation: zod.exactOptional(zod.string()),
        url: zod.exactOptional(zod.string()),
        /** A URL action that opens its page in a new tab. */
        openInNewTab: zod.exactOptional(zod.boolean()),
        transition: zod.exactOptional(
          zod.nullable(
            zod.looseObject({
              type: zod.string(),
              /** In seconds. */
              duration: zod.number(),
              direction: zod.exactOptional(zod.string()),
              easing: EasingSchema,
            }),
          ),
        ),
      }),
    ),
  ),
});
