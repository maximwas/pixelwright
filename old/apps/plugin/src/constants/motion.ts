/**
 * The fields each of Figma's animation styles animates, by the style's name without `motion.preset_name.`: a track
 * one of them made is placed on the timeline by where that style starts.
 */
export const MOTION_STYLE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  opacity: ["OPACITY"],
  position: ["TRANSLATION_X", "TRANSLATION_Y", "TRANSLATION_XY"],
  scale: ["SCALE_X", "SCALE_Y", "SCALE_XY"],
  rotation: ["ROTATION"],
  size: ["WIDTH", "HEIGHT"],
  path: ["PATH_TRIM_START", "PATH_TRIM_END"],
};
