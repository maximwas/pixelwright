import { InjectionToken } from "@needle-di/core";
import type { MainChannel } from "@/plugin-ui/adapters/main-channel/main-channel.ts";

export const MAIN_CHANNEL = new InjectionToken<MainChannel>("MainChannel");
