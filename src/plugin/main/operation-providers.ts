import type { Container } from "@needle-di/core";
import { NEARBY_NOTES, NearbyNotes } from "@/core/inspect/nearby.ts";
import { NAME_VALUE_LIST, NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import type { OperationClass } from "@/plugin/app/operation.ts";
import { OPERATION_FACTORY } from "@/plugin/app/operation-runner.ts";
import { ContainerOperationFactory } from "@/plugin/main/container-operation-factory.ts";
import { ChangesOperation } from "@/plugin/operations/changes/changes.operation.ts";
import { ChunkOperation } from "@/plugin/operations/chunk/chunk.operation.ts";
import { CLIP_COVER, ClipCover } from "@/plugin/operations/cover/clip-cover.ts";
import { CoverOperation } from "@/plugin/operations/cover/cover.operation.ts";
import { CODE_RUNS, CodeRuns } from "@/plugin/operations/execute/code-runs.ts";
import { CODE_SCOPE, CodeScope } from "@/plugin/operations/execute/code-scope.ts";
import { ExecuteOperation } from "@/plugin/operations/execute/execute.operation.ts";
import { ExportOperation } from "@/plugin/operations/export/export.operation.ts";
import { FileMapOperation } from "@/plugin/operations/file-map/file-map.operation.ts";
import { FindOperation } from "@/plugin/operations/find/find.operation.ts";
import { ImageOperation } from "@/plugin/operations/image/image.operation.ts";
import { InspectOperation } from "@/plugin/operations/inspect/inspect.operation.ts";
import { NearbyOperation } from "@/plugin/operations/nearby/nearby.operation.ts";
import { NOTE_CANDIDATES, NoteCandidates } from "@/plugin/operations/nearby/note-candidates.ts";
import { OutlineOperation } from "@/plugin/operations/outline/outline.operation.ts";
import { PingOperation } from "@/plugin/operations/ping/ping.operation.ts";
import { ReadOperation } from "@/plugin/operations/read/read.operation.ts";
import { READ_RUN, ReadRun } from "@/plugin/operations/read/read-run.ts";
import { SelectionOperation } from "@/plugin/operations/selection/selection.operation.ts";
import { SelectionWaitOperation } from "@/plugin/operations/selection-wait/selection-wait.operation.ts";
import { ShowOperation } from "@/plugin/operations/show/show.operation.ts";
import { ViewportOperation } from "@/plugin/operations/viewport/viewport.operation.ts";
import { OP_NAME } from "@/shared/ops/op-meta.constants.ts";
import type { OpName } from "@/shared/ops/op-meta.types.ts";

/**
 * Every op's class by name (A§4b.3): a contract without one here fails to type, so no op is left unserved. execute's
 * pw scope lives as long as the window (T-154), its code's runs outlive their answers (T-156); find reads variants with
 * core's Name=Value lists (K-069).
 */
export class OperationProviders {
  readonly #classes: Readonly<Record<OpName, OperationClass>> = {
    [OP_NAME.ping]: PingOperation,
    [OP_NAME.selection]: SelectionOperation,
    [OP_NAME.changes]: ChangesOperation,
    [OP_NAME.execute]: ExecuteOperation,
    [OP_NAME.show]: ShowOperation,
    [OP_NAME.viewport]: ViewportOperation,
    [OP_NAME.selectionWait]: SelectionWaitOperation,
    [OP_NAME.outline]: OutlineOperation,
    [OP_NAME.fileMap]: FileMapOperation,
    [OP_NAME.find]: FindOperation,
    [OP_NAME.read]: ReadOperation,
    [OP_NAME.nearby]: NearbyOperation,
    [OP_NAME.export]: ExportOperation,
    [OP_NAME.chunk]: ChunkOperation,
    [OP_NAME.cover]: CoverOperation,
    [OP_NAME.image]: ImageOperation,
    [OP_NAME.inspect]: InspectOperation,
  };

  register(container: Container): void {
    container
      .bind({ provide: CODE_SCOPE, useClass: CodeScope })
      .bind({ provide: CODE_RUNS, useClass: CodeRuns })
      .bind({ provide: NAME_VALUE_LIST, useClass: NameValueList })
      .bind({ provide: READ_RUN, useClass: ReadRun })
      .bind({ provide: NOTE_CANDIDATES, useClass: NoteCandidates })
      .bind({ provide: NEARBY_NOTES, useClass: NearbyNotes })
      .bind({ provide: CLIP_COVER, useClass: ClipCover })
      .bind({ provide: OPERATION_FACTORY, useFactory: () => new ContainerOperationFactory(container, this.#classes) });
  }
}
