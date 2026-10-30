import type { Container } from "@needle-di/core";
import { BUILD_STYLES, BuildStyles } from "@/core/checks/build-styles/build-styles.ts";
import { SHAPE_MATCH, ShapeMatch } from "@/core/checks/build-styles/shape-match.ts";
import { SHORTHANDS, Shorthands } from "@/core/checks/build-styles/shorthands.ts";
import { STYLE_CHECK, StyleCheck } from "@/core/checks/build-styles/style-check.ts";
import { STYLE_MATCH, StyleMatch } from "@/core/checks/build-styles/style-match.ts";
import { GRADIENT_PARSER, GradientParser } from "@/core/css/gradients/gradient-parser.ts";

/** The checks' bindings (T-090): styles_compare's build styles, and the gradient reader they compare gradients with. */
export class CheckProviders {
  register(container: Container): void {
    container
      .bind({ provide: GRADIENT_PARSER, useClass: GradientParser })
      .bind({ provide: SHAPE_MATCH, useClass: ShapeMatch })
      .bind({ provide: STYLE_MATCH, useClass: StyleMatch })
      .bind({ provide: SHORTHANDS, useClass: Shorthands })
      .bind({ provide: STYLE_CHECK, useClass: StyleCheck })
      .bind({ provide: BUILD_STYLES, useClass: BuildStyles });
  }
}
