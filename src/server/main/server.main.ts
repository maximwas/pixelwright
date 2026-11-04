import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { Container } from "@needle-di/core";
import { pino } from "pino";
import { CSS_READER, CssReader } from "@/core/css/css-reader.ts";
import { AUTO_LINE_HEIGHTS, AutoLineHeights } from "@/core/css/fonts/auto-line-heights.ts";
import { FONT_SHORTHAND, FontShorthand } from "@/core/css/fonts/font-shorthand.ts";
import { GRADIENT_CSS, GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GRADIENT_GEOMETRY, GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { AppearanceGroup } from "@/core/css/groups/appearance/appearance-group.ts";
import { EFFECTS_GROUP, EffectsGroup } from "@/core/css/groups/effects/effects-group.ts";
import { GeometryGroup } from "@/core/css/groups/geometry/geometry-group.ts";
import { PLACEMENT, Placement } from "@/core/css/groups/geometry/placement.ts";
import { LayoutGroup } from "@/core/css/groups/layout/layout-group.ts";
import { FillsGroup } from "@/core/css/groups/paint/fills-group.ts";
import { StrokesGroup } from "@/core/css/groups/paint/strokes-group.ts";
import { TextGroup } from "@/core/css/groups/text/text-group.ts";
import { TEXT_PATH_DATA, TextPathData } from "@/core/css/groups/text/text-path-data.ts";
import { TEXT_RUN, TextRun } from "@/core/css/groups/text/text-run.ts";
import { IMAGE_PAINT, ImagePaint } from "@/core/css/paints/image-paint.ts";
import { PAINT_LIST, PaintList } from "@/core/css/paints/paint-list.ts";
import { SOLID_PAINT, SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { GROUP_REGISTRY, GroupRegistry, PROPERTY_GROUPS } from "@/core/css/registry/group-registry.ts";
import { CSS_LENGTH, CssLength } from "@/core/css/values/css-length.ts";
import { CSS_SPLIT, CssSplit } from "@/core/css/values/css-split.ts";
import { CSS_URL, CssUrl } from "@/core/css/values/css-url.ts";
import { CSS_VAR, CssVar } from "@/core/css/values/css-var.ts";
import { ASSET_CLASSIFIER, AssetClassifier } from "@/core/design/assets/asset-classifier.ts";
import { ASSET_CSS, AssetCss } from "@/core/design/assets/asset-css.ts";
import { ASSET_PLANNER, AssetPlanner } from "@/core/design/assets/asset-planner.ts";
import { DESIGN_BUILDER, DesignBuilder } from "@/core/design/builder/design-builder.ts";
import { COMPONENT_ATTRIBUTES, ComponentAttributes } from "@/core/design/component/component-attributes.ts";
import { DESIGN_READER, DesignReader } from "@/core/design/design-reader.ts";
import { DESIGN_XML, DesignXml } from "@/core/design/design-xml.ts";
import { DESIGN_FIT, DesignFit } from "@/core/design/fit/design-fit.ts";
import { DESIGN_HINTS, DesignHints } from "@/core/design/hints/design-hints.ts";
import { INFERRED_HINTS, InferredHints } from "@/core/design/hints/inferred-hints.ts";
import { LAYER_HINTS, LayerHints } from "@/core/design/hints/layer-hints.ts";
import { LAYOUT_GUESS, LayoutGuess } from "@/core/design/hints/layout-guess.ts";
import { ALIKE_STRUCTURES, AlikeStructures } from "@/core/design/hints/structure/alike-structures.ts";
import { BAKED_PAINTS, BakedPaints } from "@/core/design/hints/structure/baked-paints.ts";
import { LAYER_SHAPE, LayerShape } from "@/core/design/hints/structure/layer-shape.ts";
import { SHARED_LAYERS, SharedLayers } from "@/core/design/hints/structure/shared-layers.ts";
import { STRUCTURE_HINTS, StructureHints } from "@/core/design/hints/structure/structure-hints.ts";
import { TOKEN_HINTS, TokenHints } from "@/core/design/hints/token-hints.ts";
import { INTERACTION_ATTRIBUTES, InteractionAttributes } from "@/core/design/interactions/interaction-attributes.ts";
import { READ_JSON, ReadJson } from "@/core/design/read-json.ts";
import { REPEAT_FOLD, RepeatFold } from "@/core/design/repeats/repeat-fold.ts";
import { READ_CATALOGUE, ReadCatalogue } from "@/core/design/text/read-catalogue.ts";
import { TEXT_CONTENT, TextContent } from "@/core/design/text/text-content.ts";
import { LAYER_TREE, LayerTree } from "@/core/design/tree/layer-tree.ts";
import { INSPECT_FILLS, InspectFills } from "@/core/inspect/inspect-fills.ts";
import { INSPECT_VIEW, InspectView } from "@/core/inspect/inspect-view.ts";
import { MEASURE, Measure } from "@/core/inspect/measure.ts";
import { MEASUREMENTS, Measurements } from "@/core/inspect/measurements.ts";
import { NAME_VALUE_LIST, NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import { SLUG, Slug } from "@/core/kernel/names/slug.ts";
import { NUMBER_FORMAT, NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { CLIENT_ROOTS } from "@/core/ports/client-roots.port.ts";
import { CLOCK } from "@/core/ports/clock.port.ts";
import { JSON_FILE } from "@/core/ports/json-file.port.ts";
import { LOG_COMPONENT } from "@/core/ports/logger.constants.ts";
import { LOGGER } from "@/core/ports/logger.port.ts";
import { PLUGIN_LINK } from "@/core/ports/plugin-link.port.ts";
import { NODE_TAG, NodeTag } from "@/core/xml/node-tag.ts";
import { OUTLINE_XML, OutlineXml } from "@/core/xml/outline/outline-xml.ts";
import { XML_ESCAPE, XmlEscape } from "@/core/xml/xml-escape.ts";
import { XML_WRITER, XmlWriter } from "@/core/xml/xml-writer.ts";
import { SystemClock } from "@/server/adapters/clock/system-clock.ts";
import { AtomicJsonFile } from "@/server/adapters/files/atomic-json-file.ts";
import { LOG_DESTINATIONS, LOG_SETTINGS } from "@/server/adapters/logging/logging.tokens.ts";
import { PinoLogger } from "@/server/adapters/logging/pino-logger.ts";
import { SharedLogFile } from "@/server/adapters/logging/shared-log-file.ts";
import { MCP_ROOTS, McpRoots } from "@/server/adapters/mcp/mcp-roots.ts";
import { StdoutGuard } from "@/server/adapters/mcp/stdout-guard.ts";
import { PROJECT_FALLBACK, PROJECT_FOLDER, ProjectFolder } from "@/server/app/project/project-folder.ts";
import { SELECTED_LAYER, SelectedLayer } from "@/server/app/scope/selected-layer.ts";
import { WITHIN_SCOPE, WithinScope } from "@/server/app/scope/within-scope.ts";
import { OP_CALL_STEPS } from "@/server/app/sessions/plugin-session.ts";
import { PLUGIN_SESSIONS, PluginSessions } from "@/server/app/sessions/plugin-sessions.ts";
import { OpLogStep } from "@/server/app/sessions/steps/op-log-step.ts";
import { OpResultStep } from "@/server/app/sessions/steps/op-result-step.ts";
import { OpTimerStep } from "@/server/app/sessions/steps/op-timer-step.ts";
import { TARGET_RESOLVER, TargetResolver } from "@/server/app/sessions/target-resolver.ts";
import { WRITTEN_STORE } from "@/server/app/stores/stores.constants.ts";
import { WRITTEN_FILES_PATH } from "@/server/app/stores/written-files.ts";
import { CallLogStep } from "@/server/app/tool-runner/steps/call-log-step.ts";
import { ErrorTextStep } from "@/server/app/tool-runner/steps/error-text-step.ts";
import { OutputCheckStep } from "@/server/app/tool-runner/steps/output-check-step.ts";
import { TargetStep } from "@/server/app/tool-runner/steps/target-step.ts";
import { TOOL_CALL_STEPS, TOOL_FACTORY, TOOL_RUNNER, ToolRunner } from "@/server/app/tool-runner/tool-runner.ts";
import { BridgeProviders } from "@/server/main/bridge-providers.ts";
import { CheckProviders } from "@/server/main/check-providers.ts";
import { ComponentProviders } from "@/server/main/component-providers.ts";
import { ConfigReader, type ServerConfig } from "@/server/main/config/config-reader.ts";
import { ContainerToolFactory } from "@/server/main/container-tool-factory.ts";
import { McpEndpoint } from "@/server/main/mcp/mcp-endpoint.ts";
import { RenderProviders } from "@/server/main/render-providers.ts";
import { LOG_FILE, SERVER_LOG } from "@/server/main/server.constants.ts";
import { ShutdownHooks } from "@/server/main/shutdown-hooks.ts";
import { TokenProviders } from "@/server/main/token-providers.ts";
import { UPDATE_FEED } from "@/server/main/update-feed.ts";
import { TOOL_CATALOG, ToolCatalog } from "@/server/tools/tool.catalog.ts";

/**
 * The server's composition root (A§4.1), the one owner of the container. It binds every interface and value once;
 * concrete classes resolve by themselves, and nothing else in src/ sees the container.
 */
export class ServerMain {
  /** Given by the contract tests; read from the environment otherwise. */
  readonly #config: ServerConfig | undefined;
  #container: Container | undefined;

  constructor(config?: ServerConfig) {
    this.#config = config;
  }

  /** The MCP endpoint: start() connects it to stdio, the contract tests to memory. */
  endpoint(): McpEndpoint {
    return this.#composed().get(McpEndpoint);
  }

  /** The composed container, for the composition test alone (A§10.2): nothing else outside main/ sees it. */
  container(): Container {
    return this.#composed();
  }

  async start(): Promise<void> {
    // First, before anything can print: stdout carries MCP only (S-056).
    new StdoutGuard().install();

    const container = this.#composed();

    // The bridge before MCP (A§4.1): the first status call already sees the owner.
    await this.listen();
    container.get(UPDATE_FEED).start();
    container.get(ShutdownHooks).install(() => this.close());
    await container.get(McpEndpoint).connect(new StdioServerTransport());
    container
      .get(LOGGER)
      .child({ component: LOG_COMPONENT.server })
      .info(SERVER_LOG.ready, { role: container.get(PLUGIN_LINK).role() });
  }

  /** Takes the plugin bridge up: the owner listens on the channel's port. The contract tests start it without stdio. */
  async listen(): Promise<void> {
    await this.#composed().get(PLUGIN_LINK).start();
  }

  /** The bridge frees its port first, so a sibling server can take it at once, then MCP closes (S-013). */
  async close(): Promise<void> {
    const container = this.#composed();

    await container.get(PLUGIN_LINK).close();
    await container.get(McpEndpoint).close();
  }

  /** The container with every binding, built once at first use: reading the environment is no constructor's work. */
  #composed(): Container {
    this.#container ??= this.#compose(this.#config ?? new ConfigReader().read());

    return this.#container;
  }

  #compose(config: ServerConfig): Container {
    const container = new Container();

    this.#bindInfra(container, config);
    this.#bindDomain(container);
    this.#bindReadNotes(container);
    new RenderProviders().register(container);
    new CheckProviders().register(container);
    new ComponentProviders().register(container, config.home);
    new TokenProviders().register(container);
    new BridgeProviders().register(container, config);
    this.#bindServices(container);

    return container;
  }

  /** The log, the clock, the home's JSON files and the project folder: what every other service may need. */
  #bindInfra(container: Container, { logLevel, home, projectDir }: ServerConfig): void {
    container
      .bind({ provide: LOG_SETTINGS, useValue: { level: logLevel, file: join(home, LOG_FILE.folder, LOG_FILE.name) } })
      .bind({ provide: LOG_DESTINATIONS, multi: true, useValue: pino.destination({ dest: 2, sync: true }) })
      .bind({ provide: LOG_DESTINATIONS, multi: true, useClass: SharedLogFile })
      .bind({ provide: LOGGER, useClass: PinoLogger })
      .bind({ provide: CLOCK, useClass: SystemClock })
      .bind({ provide: JSON_FILE, useClass: AtomicJsonFile })
      .bind({ provide: MCP_ROOTS, useClass: McpRoots })
      .bind({ provide: CLIENT_ROOTS, useExisting: MCP_ROOTS })
      .bind({ provide: PROJECT_FALLBACK, useValue: projectDir })
      .bind({ provide: PROJECT_FOLDER, useClass: ProjectFolder })
      .bind({ provide: WRITTEN_FILES_PATH, useValue: join(home, WRITTEN_STORE.file) });
  }

  /** What design_read adds beside its XML: the hints, the measurements, Auto line heights in px (T-060, T-061). */
  #bindReadNotes(container: Container): void {
    container
      .bind({ provide: LAYOUT_GUESS, useClass: LayoutGuess })
      .bind({ provide: LAYER_SHAPE, useClass: LayerShape })
      .bind({ provide: ALIKE_STRUCTURES, useClass: AlikeStructures })
      .bind({ provide: SHARED_LAYERS, useClass: SharedLayers })
      .bind({ provide: BAKED_PAINTS, useClass: BakedPaints })
      .bind({ provide: STRUCTURE_HINTS, useClass: StructureHints })
      .bind({ provide: LAYER_HINTS, useClass: LayerHints })
      .bind({ provide: TOKEN_HINTS, useClass: TokenHints })
      .bind({ provide: INFERRED_HINTS, useClass: InferredHints })
      .bind({ provide: DESIGN_HINTS, useClass: DesignHints })
      .bind({ provide: MEASUREMENTS, useClass: Measurements })
      .bind({ provide: INSPECT_FILLS, useClass: InspectFills })
      .bind({ provide: INSPECT_VIEW, useClass: InspectView })
      .bind({ provide: MEASURE, useClass: Measure })
      .bind({ provide: READ_JSON, useClass: ReadJson })
      .bind({ provide: AUTO_LINE_HEIGHTS, useClass: AutoLineHeights });
  }

  /** The core domain's classes the tools read and write with: the D-15 numbers, the CSS mapping, the XML writers. */
  #bindDomain(container: Container): void {
    container
      .bind({ provide: NUMBER_FORMAT, useClass: NumberFormat })
      .bind({ provide: NAME_VALUE_LIST, useClass: NameValueList })
      .bind({ provide: XML_ESCAPE, useClass: XmlEscape })
      .bind({ provide: NODE_TAG, useClass: NodeTag })
      .bind({ provide: XML_WRITER, useClass: XmlWriter })
      .bind({ provide: OUTLINE_XML, useClass: OutlineXml })
      .bind({ provide: CSS_SPLIT, useClass: CssSplit })
      .bind({ provide: CSS_VAR, useClass: CssVar })
      .bind({ provide: CSS_LENGTH, useClass: CssLength })
      .bind({ provide: PLACEMENT, useClass: Placement })
      .bind({ provide: SOLID_PAINT, useClass: SolidPaint })
      .bind({ provide: CSS_URL, useClass: CssUrl })
      .bind({ provide: GRADIENT_GEOMETRY, useClass: GradientGeometry })
      .bind({ provide: GRADIENT_CSS, useClass: GradientCss })
      .bind({ provide: IMAGE_PAINT, useClass: ImagePaint })
      .bind({ provide: PAINT_LIST, useClass: PaintList })
      .bind({ provide: FONT_SHORTHAND, useClass: FontShorthand })
      .bind({ provide: TEXT_RUN, useClass: TextRun })
      .bind({ provide: TEXT_PATH_DATA, useClass: TextPathData })
      .bind({ provide: PROPERTY_GROUPS, multi: true, useClass: LayoutGroup })
      .bind({ provide: PROPERTY_GROUPS, multi: true, useClass: GeometryGroup })
      .bind({ provide: PROPERTY_GROUPS, multi: true, useClass: AppearanceGroup })
      .bind({ provide: PROPERTY_GROUPS, multi: true, useClass: FillsGroup })
      .bind({ provide: PROPERTY_GROUPS, multi: true, useClass: StrokesGroup })
      .bind({ provide: PROPERTY_GROUPS, multi: true, useClass: EffectsGroup })
      .bind({ provide: PROPERTY_GROUPS, multi: true, useClass: TextGroup })
      .bind({ provide: EFFECTS_GROUP, useClass: EffectsGroup })
      .bind({ provide: GROUP_REGISTRY, useClass: GroupRegistry })
      .bind({ provide: CSS_READER, useClass: CssReader })
      .bind({ provide: COMPONENT_ATTRIBUTES, useClass: ComponentAttributes })
      .bind({ provide: INTERACTION_ATTRIBUTES, useClass: InteractionAttributes })
      .bind({ provide: SLUG, useClass: Slug })
      .bind({ provide: ASSET_CLASSIFIER, useClass: AssetClassifier })
      .bind({ provide: ASSET_CSS, useClass: AssetCss })
      .bind({ provide: ASSET_PLANNER, useClass: AssetPlanner })
      .bind({ provide: DESIGN_BUILDER, useClass: DesignBuilder })
      .bind({ provide: TEXT_CONTENT, useClass: TextContent })
      .bind({ provide: READ_CATALOGUE, useClass: ReadCatalogue })
      .bind({ provide: LAYER_TREE, useClass: LayerTree })
      .bind({ provide: REPEAT_FOLD, useClass: RepeatFold })
      .bind({ provide: DESIGN_XML, useClass: DesignXml })
      .bind({ provide: DESIGN_FIT, useClass: DesignFit })
      .bind({ provide: DESIGN_READER, useClass: DesignReader });
  }

  /**
   * The plugin sessions (A§6.1): target resolution, each op's chain, outermost first: log, timeout text, result; and
   * the `within` scope a tool's ops go through (S-043), and the one selected layer (T-051).
   */
  #bindSessions(container: Container): void {
    for (const step of [OpLogStep, OpTimerStep, OpResultStep]) {
      container.bind({ provide: OP_CALL_STEPS, multi: true, useClass: step });
    }

    container
      .bind({ provide: TARGET_RESOLVER, useClass: TargetResolver })
      .bind({ provide: PLUGIN_SESSIONS, useClass: PluginSessions })
      .bind({ provide: WITHIN_SCOPE, useClass: WithinScope })
      .bind({ provide: SELECTED_LAYER, useClass: SelectedLayer });
  }

  #bindServices(container: Container): void {
    this.#bindSessions(container);

    // The runner's chain, outermost first: error text, call log, target, output check.
    for (const step of [ErrorTextStep, CallLogStep, TargetStep, OutputCheckStep]) {
      container.bind({ provide: TOOL_CALL_STEPS, multi: true, useClass: step });
    }

    container
      .bind({ provide: TOOL_CATALOG, useClass: ToolCatalog })
      .bind({ provide: TOOL_FACTORY, useValue: new ContainerToolFactory(container) })
      .bind({ provide: TOOL_RUNNER, useClass: ToolRunner });
  }
}
