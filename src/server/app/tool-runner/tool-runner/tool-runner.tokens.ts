import { InjectionToken } from "@needle-di/core";
import type { ToolRunner } from "./tool-runner.ts";
import type { ToolCallStep, ToolContext, ToolFactory } from "./tool-runner.types.ts";

export const TOOL_RUNNER = new InjectionToken<ToolRunner>("ToolRunner");

export const TOOL_FACTORY = new InjectionToken<ToolFactory>("ToolFactory");

/** The runner's chain, outermost first, in the order the composition root binds them. */
export const TOOL_CALL_STEPS = new InjectionToken<ToolCallStep>("ToolCallSteps");

/** Bound per call in the tool's own child container. */
export const TOOL_CONTEXT = new InjectionToken<ToolContext>("ToolContext");
