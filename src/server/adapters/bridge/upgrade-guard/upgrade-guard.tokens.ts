import { InjectionToken } from "@needle-di/core";
import type { UpgradeGuard } from "./upgrade-guard.ts";

export const UPGRADE_GUARD = new InjectionToken<UpgradeGuard>("UpgradeGuard");
