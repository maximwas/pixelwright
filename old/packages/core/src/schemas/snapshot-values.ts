import * as z from "zod";

/** What the plugin sends for Figma's `figma.mixed`: a property that differs across a node's parts. */
export const MIXED = "mixed";

export const MixedSchema = z.literal(MIXED);

const ColorSchema = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  a: z.number().optional(),
});

export const BoundVariablesSchema = z.record(z.string(), z.unknown());

/** A Figma Paint as the Plugin API gives it; loose, so a paint type Figma adds later still passes. */
export const PaintSchema = z.looseObject({
  type: z.string(),
  visible: z.boolean().optional(),
  opacity: z.number().optional(),
  blendMode: z.string().optional(),
  color: ColorSchema.optional(),
  gradientStops: z
    .array(
      z.looseObject({
        position: z.number(),
        color: ColorSchema,
      }),
    )
    .optional(),
  gradientTransform: z.array(z.array(z.number())).optional(),
  imageHash: z.string().nullable().optional(),
  scaleMode: z.string().optional(),
  boundVariables: BoundVariablesSchema.optional(),
});

/** A Figma Effect (shadow or blur) as the Plugin API gives it. */
export const EffectSchema = z.looseObject({
  type: z.string(),
  visible: z.boolean().optional(),
  radius: z.number().optional(),
  color: ColorSchema.optional(),
  offset: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  spread: z.number().optional(),
  blendMode: z.string().optional(),
  showShadowBehindNode: z.boolean().optional(),
  boundVariables: BoundVariablesSchema.optional(),
  /** A blur's kind: NORMAL, or PROGRESSIVE from startRadius at startOffset to radius at endOffset (0–1 of the box). */
  blurType: z.string().optional(),
  startRadius: z.number().optional(),
  startOffset: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  endOffset: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

/** A transition's easing: a named curve, a cubic bezier or a spring. */
const EasingSchema = z.looseObject({
  type: z.string(),
  easingFunctionCubicBezier: z
    .object({
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
    })
    .optional(),
  easingFunctionSpring: z
    .looseObject({
      mass: z.number(),
      stiffness: z.number(),
      damping: z.number(),
    })
    .optional(),
});

/** One prototype interaction: what starts it and what it does; NODE actions carry their destination's name. */
export const ReactionSchema = z.looseObject({
  trigger: z
    .looseObject({
      type: z.string(),
      /** AFTER_TIMEOUT, in seconds. */
      timeout: z.number().optional(),
      /** MOUSE_ENTER and the like, in seconds. */
      delay: z.number().optional(),
    })
    .nullable(),
  actions: z
    .array(
      z.looseObject({
        type: z.string(),
        destinationId: z.string().nullable().optional(),
        destinationName: z.string().optional(),
        navigation: z.string().optional(),
        url: z.string().optional(),
        transition: z
          .looseObject({
            type: z.string(),
            /** In seconds. */
            duration: z.number(),
            direction: z.string().optional(),
            easing: EasingSchema,
          })
          .nullable()
          .optional(),
      }),
    )
    .optional(),
});
