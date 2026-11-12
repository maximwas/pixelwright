import type { Container } from "@needle-di/core";
import { CROP, Crop } from "@/core/images/crop.ts";
import { RGBA, Rgba } from "@/core/images/rgba.ts";
import { IMAGE_CODEC } from "@/core/ports/image-codec.port.ts";
import { IMAGE_SNIFFER } from "@/core/ports/image-sniffer.port.ts";
import { PNG_FILES } from "@/core/ports/png-files.port.ts";
import { WEBP_ENCODER } from "@/core/ports/webp-encoder.port.ts";
import { NodePngFiles } from "@/server/adapters/files/node-png-files.ts";
import { FastPngCodec } from "@/server/adapters/images/fast-png-codec.ts";
import { ImageSizeSniffer } from "@/server/adapters/images/image-size-sniffer.ts";
import { JsquashWebp } from "@/server/adapters/images/jsquash-webp.ts";
import { ASSET_FILES, AssetFiles } from "@/server/app/assets/asset-files.ts";
import { ASSET_WRITER, AssetWriter } from "@/server/app/assets/asset-writer.ts";
import { EXPORT_PULL, ExportPull } from "@/server/app/renders/export-pull.ts";
import { PNG_RENDER, PngRender } from "@/server/app/renders/png-render.ts";
import { RENDER_TO_FIT, RenderToFit } from "@/server/app/renders/render-to-fit.ts";
import { SCREENSHOTS, Screenshots } from "@/server/app/renders/screenshots.ts";
import { WRITTEN_FILES, WrittenFiles } from "@/server/app/stores/written-files.ts";
import { EXPORT_PLANNER, ExportPlanner } from "@/server/tools/assets-export/export-planner.ts";
import { DESIGN_READ_EXTRAS, DesignReadExtras } from "@/server/tools/design-read/design-read-extras.ts";

/**
 * The renders' bindings (T-070): the image adapters, the PNG files, the export pull and the screenshot engine; the
 * asset files (T-055, T-194): the WebP encoder, the writer and the store of written files.
 */
export class RenderProviders {
  register(container: Container): void {
    container
      .bind({ provide: IMAGE_CODEC, useClass: FastPngCodec })
      .bind({ provide: IMAGE_SNIFFER, useClass: ImageSizeSniffer })
      .bind({ provide: CROP, useClass: Crop })
      .bind({ provide: RGBA, useClass: Rgba })
      .bind({ provide: PNG_FILES, useClass: NodePngFiles })
      .bind({ provide: EXPORT_PULL, useClass: ExportPull })
      .bind({ provide: PNG_RENDER, useClass: PngRender })
      .bind({ provide: RENDER_TO_FIT, useClass: RenderToFit })
      .bind({ provide: SCREENSHOTS, useClass: Screenshots })
      .bind({ provide: DESIGN_READ_EXTRAS, useClass: DesignReadExtras })
      .bind({ provide: WEBP_ENCODER, useClass: JsquashWebp })
      .bind({ provide: WRITTEN_FILES, useClass: WrittenFiles })
      .bind({ provide: ASSET_WRITER, useClass: AssetWriter })
      .bind({ provide: ASSET_FILES, useClass: AssetFiles })
      .bind({ provide: EXPORT_PLANNER, useClass: ExportPlanner });
  }
}
