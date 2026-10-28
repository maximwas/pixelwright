import { InjectionToken } from "@needle-di/core";
import type { OpReport } from "@/plugin/app/op-report/op-report.ts";

export const OP_REPORT = new InjectionToken<OpReport>("OpReport");
