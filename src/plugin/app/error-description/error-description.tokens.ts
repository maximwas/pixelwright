import { InjectionToken } from "@needle-di/core";
import type { ErrorDescription } from "@/plugin/app/error-description/error-description.ts";

export const ERROR_DESCRIPTION = new InjectionToken<ErrorDescription>("ErrorDescription");
