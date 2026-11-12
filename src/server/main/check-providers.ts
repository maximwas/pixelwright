import type { Container } from "@needle-di/core";
import { BUILD_STYLES, BuildStyles } from "@/core/checks/build-styles/build-styles.ts";
import { SHAPE_MATCH, ShapeMatch } from "@/core/checks/build-styles/shape-match.ts";
import { SHORTHANDS, Shorthands } from "@/core/checks/build-styles/shorthands.ts";
import { STYLE_CHECK, StyleCheck } from "@/core/checks/build-styles/style-check.ts";
import { STYLE_MATCH, StyleMatch } from "@/core/checks/build-styles/style-match.ts";
import { GRADIENT_PARSER, GradientParser } from "@/core/css/gradients/gradient-parser.ts";
import { EDGE_DIFF, EdgeDiff } from "@/core/images/edge-diff.ts";
import { IMAGE_COMPARISON, ImageComparison } from "@/core/images/image-comparison.ts";
import { RMSE, Rmse } from "@/core/images/rmse.ts";
import { FONT_DIRECTORY, FONT_DIRECTORY_FALLBACK } from "@/core/ports/font-directory.port.ts";
import { PIXEL_DIFF } from "@/core/ports/pixel-diff.port.ts";
import { FontsourceDirectory } from "@/server/adapters/http/fontsource-directory.ts";
import { GoogleMetadataDirectory } from "@/server/adapters/http/google-metadata-directory.ts";
import { PixelmatchDiff } from "@/server/adapters/images/pixelmatch-diff.ts";
import { FONT_SOURCES, FontSources } from "@/server/tools/fonts-check/font-sources.ts";
import { COMPARED_IMAGES, ComparedImages } from "@/server/tools/image-compare/compared-images.ts";

/**
 * The checks' bindings: styles_compare's build styles and the gradient reader they compare gradients with (T-090);
 * image_compare's comparison and images (T-089); fonts_check's font directories, read once for the server (T-101).
 */
export class CheckProviders {
  register(container: Container): void {
    container
      .bind({ provide: GRADIENT_PARSER, useClass: GradientParser })
      .bind({ provide: SHAPE_MATCH, useClass: ShapeMatch })
      .bind({ provide: STYLE_MATCH, useClass: StyleMatch })
      .bind({ provide: SHORTHANDS, useClass: Shorthands })
      .bind({ provide: STYLE_CHECK, useClass: StyleCheck })
      .bind({ provide: RMSE, useClass: Rmse })
      .bind({ provide: EDGE_DIFF, useClass: EdgeDiff })
      .bind({ provide: PIXEL_DIFF, useClass: PixelmatchDiff })
      .bind({ provide: IMAGE_COMPARISON, useClass: ImageComparison })
      .bind({ provide: COMPARED_IMAGES, useClass: ComparedImages })
      .bind({ provide: FONT_DIRECTORY, useClass: FontsourceDirectory })
      .bind({ provide: FONT_DIRECTORY_FALLBACK, useClass: GoogleMetadataDirectory })
      .bind({ provide: FONT_SOURCES, useClass: FontSources })
      .bind({ provide: BUILD_STYLES, useClass: BuildStyles });
  }
}
