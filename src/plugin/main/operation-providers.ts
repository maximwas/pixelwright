import type { Container } from "@needle-di/core";
import { NEARBY_NOTES, NearbyNotes } from "@/core/inspect/nearby.ts";
import { PLACEMENT_SPAN, PlacementSpan } from "@/core/kernel/geometry/placement-span.ts";
import { NAME_VALUE_LIST, NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import { ASSIGN, Assign } from "@/plugin/adapters/figma/assign.ts";
import { CAPABILITIES, Capabilities } from "@/plugin/adapters/figma/capabilities.ts";
import { LAYER_FACTORY, LayerFactory } from "@/plugin/adapters/figma/layer-factory.ts";
import { FILE_TOKENS, FileTokens } from "@/plugin/adapters/figma/variables/file-tokens.ts";
import { LIBRARY_CATALOGUE, LibraryCatalogue } from "@/plugin/adapters/figma/variables/library-catalogue.ts";
import { USED_TOKENS, UsedTokens } from "@/plugin/adapters/figma/variables/used-tokens.ts";
import type { OperationClass } from "@/plugin/app/operation.ts";
import { OPERATION_FACTORY } from "@/plugin/app/operation-runner.ts";
import { ContainerOperationFactory } from "@/plugin/main/container-operation-factory.ts";
import { ApplyOperation } from "@/plugin/operations/apply/apply.operation.ts";
import { APPLY_LAYERS, ApplyLayers } from "@/plugin/operations/apply/apply-layers.ts";
import { APPLY_RUN, ApplyRun } from "@/plugin/operations/apply/apply-run.ts";
import { APPLY_CHECKS, ApplyChecks } from "@/plugin/operations/apply/checks.ts";
import { NEW_LAYERS, NewLayers } from "@/plugin/operations/apply/new-layers.ts";
import { PAGES, Pages } from "@/plugin/operations/apply/pages.ts";
import { PLACEMENT, Placement } from "@/plugin/operations/apply/placement.ts";
import { ClipStep } from "@/plugin/operations/apply/writers/clip-step.ts";
import { FillsStep } from "@/plugin/operations/apply/writers/fills-step.ts";
import { LimitsStep } from "@/plugin/operations/apply/writers/geometry/limits-step.ts";
import { PlaceStep } from "@/plugin/operations/apply/writers/geometry/place-step.ts";
import { SizeStep } from "@/plugin/operations/apply/writers/geometry/size-step.ts";
import { STEP_GEOMETRY, StepGeometry } from "@/plugin/operations/apply/writers/geometry/step-geometry.ts";
import { TurnStep } from "@/plugin/operations/apply/writers/geometry/turn-step.ts";
import { LAYER_WRITER, LayerWriter, WRITE_STEPS } from "@/plugin/operations/apply/writers/layer-writer.ts";
import { ChildStep } from "@/plugin/operations/apply/writers/layout/child-step.ts";
import { GridCellStep } from "@/plugin/operations/apply/writers/layout/grid-cell-step.ts";
import { LayoutStep } from "@/plugin/operations/apply/writers/layout/layout-step.ts";
import { NameStep } from "@/plugin/operations/apply/writers/name-step.ts";
import { OpacityStep } from "@/plugin/operations/apply/writers/opacity-step.ts";
import { STEP_VALUES, StepValues } from "@/plugin/operations/apply/writers/step-values.ts";
import { ChangesOperation } from "@/plugin/operations/changes/changes.operation.ts";
import { ChunkOperation } from "@/plugin/operations/chunk/chunk.operation.ts";
import { COMPONENT_DETAILS, ComponentDetails } from "@/plugin/operations/components/component-details.ts";
import { COMPONENT_ENTRIES, ComponentEntries } from "@/plugin/operations/components/component-entries.ts";
import { COMPONENT_FINDER, ComponentFinder } from "@/plugin/operations/components/component-finder.ts";
import { COMPONENT_LINKS, ComponentLinks } from "@/plugin/operations/components/component-links.ts";
import { ComponentsOperation } from "@/plugin/operations/components/components.operation.ts";
import { EXPOSED_INSTANCES, ExposedInstances } from "@/plugin/operations/components/exposed-instances.ts";
import { CLIP_COVER, ClipCover } from "@/plugin/operations/cover/clip-cover.ts";
import { CoverOperation } from "@/plugin/operations/cover/cover.operation.ts";
import { DeleteOperation } from "@/plugin/operations/delete/delete.operation.ts";
import { CODE_RUNS, CodeRuns } from "@/plugin/operations/execute/code-runs.ts";
import { CODE_SCOPE, CodeScope } from "@/plugin/operations/execute/code-scope.ts";
import { ExecuteOperation } from "@/plugin/operations/execute/execute.operation.ts";
import { ExportOperation } from "@/plugin/operations/export/export.operation.ts";
import { FileMapOperation } from "@/plugin/operations/file-map/file-map.operation.ts";
import { FindOperation } from "@/plugin/operations/find/find.operation.ts";
import { FlowsOperation } from "@/plugin/operations/flows/flows.operation.ts";
import { ImageOperation } from "@/plugin/operations/image/image.operation.ts";
import { InspectOperation } from "@/plugin/operations/inspect/inspect.operation.ts";
import { NearbyOperation } from "@/plugin/operations/nearby/nearby.operation.ts";
import { NOTE_CANDIDATES, NoteCandidates } from "@/plugin/operations/nearby/note-candidates.ts";
import { OutlineOperation } from "@/plugin/operations/outline/outline.operation.ts";
import { PingOperation } from "@/plugin/operations/ping/ping.operation.ts";
import { ReadOperation } from "@/plugin/operations/read/read.operation.ts";
import { READ_RUN, ReadRun } from "@/plugin/operations/read/read-run.ts";
import { SaveVersionOperation } from "@/plugin/operations/save-version/save-version.operation.ts";
import { ScreensOperation } from "@/plugin/operations/screens/screens.operation.ts";
import { SelectionOperation } from "@/plugin/operations/selection/selection.operation.ts";
import { SelectionWaitOperation } from "@/plugin/operations/selection-wait/selection-wait.operation.ts";
import { SetOfOperation } from "@/plugin/operations/set-of/set-of.operation.ts";
import { ShowOperation } from "@/plugin/operations/show/show.operation.ts";
import { UsageOperation } from "@/plugin/operations/usage/usage.operation.ts";
import { VariablesOperation } from "@/plugin/operations/variables/variables.operation.ts";
import { ViewportOperation } from "@/plugin/operations/viewport/viewport.operation.ts";
import { OP_NAME } from "@/shared/ops/op-meta.constants.ts";
import type { OpName } from "@/shared/ops/op-meta.types.ts";

/**
 * Every op's class by name (A§4b.3): a contract without one here fails to type, so no op is left unserved. execute's
 * pw scope lives as long as the window (T-154), its code's runs outlive their answers (T-156); find reads variants with
 * core's Name=Value lists (K-069); components finds, lists, exposes and links components (T-190, T-192); variables reads the file's raw tokens (P-125);
 * usage lists the layers that use a style or variable (P-126).
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
    [OP_NAME.setOf]: SetOfOperation,
    [OP_NAME.screens]: ScreensOperation,
    [OP_NAME.flows]: FlowsOperation,
    [OP_NAME.components]: ComponentsOperation,
    [OP_NAME.variables]: VariablesOperation,
    [OP_NAME.usage]: UsageOperation,
    [OP_NAME.delete]: DeleteOperation,
    [OP_NAME.saveVersion]: SaveVersionOperation,
    [OP_NAME.apply]: ApplyOperation,
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
      .bind({ provide: COMPONENT_ENTRIES, useClass: ComponentEntries })
      .bind({ provide: COMPONENT_FINDER, useClass: ComponentFinder })
      .bind({ provide: EXPOSED_INSTANCES, useClass: ExposedInstances })
      .bind({ provide: COMPONENT_DETAILS, useClass: ComponentDetails })
      .bind({ provide: COMPONENT_LINKS, useClass: ComponentLinks })
      .bind({ provide: USED_TOKENS, useClass: UsedTokens })
      .bind({ provide: FILE_TOKENS, useClass: FileTokens })
      .bind({ provide: LIBRARY_CATALOGUE, useClass: LibraryCatalogue })
      .bind({ provide: ASSIGN, useClass: Assign })
      .bind({ provide: CAPABILITIES, useClass: Capabilities })
      .bind({ provide: LAYER_FACTORY, useClass: LayerFactory })
      .bind({ provide: STEP_VALUES, useClass: StepValues })
      .bind({ provide: STEP_GEOMETRY, useClass: StepGeometry })
      .bind({ provide: WRITE_STEPS, multi: true, useClass: NameStep })
      .bind({ provide: WRITE_STEPS, multi: true, useClass: LayoutStep })
      .bind({ provide: WRITE_STEPS, multi: true, useClass: SizeStep })
      .bind({ provide: WRITE_STEPS, multi: true, useClass: LimitsStep })
      .bind({ provide: WRITE_STEPS, multi: true, useClass: ChildStep })
      .bind({ provide: WRITE_STEPS, multi: true, useClass: GridCellStep })
      .bind({ provide: WRITE_STEPS, multi: true, useClass: TurnStep })
      .bind({ provide: WRITE_STEPS, multi: true, useClass: PlaceStep })
      .bind({ provide: WRITE_STEPS, multi: true, useClass: OpacityStep })
      .bind({ provide: WRITE_STEPS, multi: true, useClass: ClipStep })
      .bind({ provide: WRITE_STEPS, multi: true, useClass: FillsStep })
      .bind({ provide: LAYER_WRITER, useClass: LayerWriter })
      .bind({ provide: APPLY_CHECKS, useClass: ApplyChecks })
      .bind({ provide: PLACEMENT_SPAN, useClass: PlacementSpan })
      .bind({ provide: NEW_LAYERS, useClass: NewLayers })
      .bind({ provide: PLACEMENT, useClass: Placement })
      .bind({ provide: PAGES, useClass: Pages })
      .bind({ provide: APPLY_LAYERS, useClass: ApplyLayers })
      .bind({ provide: APPLY_RUN, useClass: ApplyRun })
      .bind({ provide: OPERATION_FACTORY, useFactory: () => new ContainerOperationFactory(container, this.#classes) });
  }
}
