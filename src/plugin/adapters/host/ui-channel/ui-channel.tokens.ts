import { InjectionToken } from "@needle-di/core";
import type { UiChannel } from "@/plugin/adapters/host/ui-channel/ui-channel.ts";

export const UI_CHANNEL = new InjectionToken<UiChannel>("UiChannel");
