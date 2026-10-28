import { InjectionToken } from "@needle-di/core";
import type { FileId } from "@/plugin/adapters/host/file-id/file-id.ts";

export const FILE_ID = new InjectionToken<FileId>("FileId");
