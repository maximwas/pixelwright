import { join } from "node:path";
import type { Container } from "@needle-di/core";
import { LIBRARIES_FOLDER, LIBRARY_STORE, LibraryStore } from "@/server/app/stores/library-store.ts";
import { LIBRARY_FILES } from "@/server/app/stores/stores.constants.ts";
import { LINK_PATHS, LinkPaths } from "@/server/tools/components-read/link-paths.ts";

/**
 * The components' bindings: the project files Dev Mode code links point at (T-192), and the saved libraries in the
 * channel's own home (T-193), never another channel's.
 */
export class ComponentProviders {
  register(container: Container, home: string): void {
    container
      .bind({ provide: LINK_PATHS, useClass: LinkPaths })
      .bind({ provide: LIBRARIES_FOLDER, useValue: join(home, LIBRARY_FILES.folder) })
      .bind({ provide: LIBRARY_STORE, useClass: LibraryStore });
  }
}
