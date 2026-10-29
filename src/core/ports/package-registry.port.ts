import { InjectionToken } from "@needle-di/core";

/** Where the newest release is asked, for the update banner (S-070): its version, or null when it cannot be had. */
export interface PackageRegistry {
  latest(): Promise<string | null>;
}

export const PACKAGE_REGISTRY = new InjectionToken<PackageRegistry>("PackageRegistry");
