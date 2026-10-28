import { InjectionToken } from "@needle-di/core";
import type { OperationTurns } from "@/plugin/app/operation-turns/operation-turns.ts";

export const OPERATION_TURNS = new InjectionToken<OperationTurns>("OperationTurns");
