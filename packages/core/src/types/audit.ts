import type * as z from "zod";
import type { DesignAuditSchema } from "../schemas/audit.ts";

export type DesignAudit = z.output<typeof DesignAuditSchema>;
