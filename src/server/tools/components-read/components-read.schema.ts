import * as zod from "zod/mini";
import { FileInputSchema } from "@/server/app/sessions/target-resolver.schema.ts";
import { COMPONENTS_READ_FIELD } from "@/server/tools/components-read/components-read.constants.ts";
import { COMPONENTS, COMPONENTS_SCOPE } from "@/shared/ops/components/components.constants.ts";
import { componentsOp } from "@/shared/ops/components/components.manifest.ts";
import { ComponentEntrySchema, ComponentLinkSchema } from "@/shared/ops/components/components.schema.ts";

const { scope, within, query, limit } = componentsOp.input.shape;

/** A Dev Mode link with the project file a code link points at (T-192). */
const ListedLinkSchema = zod.extend(ComponentLinkSchema, {
  path: zod.exactOptional(zod.string()).check(zod.describe(COMPONENTS_READ_FIELD.path)),
});

/** A component as components_read lists it whole. */
const ListedSchema = zod.extend(ComponentEntrySchema, { links: zod.exactOptional(zod.array(ListedLinkSchema)) });

export const ComponentsReadInputSchema = zod.object({
  scope: zod._default(scope, COMPONENTS_SCOPE.used).check(zod.describe(COMPONENTS_READ_FIELD.scope)),
  within: within.check(zod.describe(COMPONENTS_READ_FIELD.within)),
  query: query.check(zod.describe(COMPONENTS_READ_FIELD.query)),
  limit: zod._default(limit, COMPONENTS.defaultLimit),
  fields: zod
    .exactOptional(zod.array(zod.keyof(ListedSchema)).check(zod.minLength(1)))
    .check(zod.describe(COMPONENTS_READ_FIELD.fields)),
  links: zod._default(zod.boolean(), false).check(zod.describe(COMPONENTS_READ_FIELD.links)),
  file: FileInputSchema,
});

/** Each component, only the fields asked for when fields is given (one schema, not a union: tools/list stays small). */
export const ComponentsReadOutputSchema = zod.object({
  components: zod.array(zod.partial(ListedSchema)).check(zod.describe(COMPONENTS_READ_FIELD.components)),
  more: zod.boolean(),
  notes: zod.exactOptional(zod.array(zod.string())),
});

export type ComponentsReadInput = zod.output<typeof ComponentsReadInputSchema>;

export type ComponentsReadOutput = zod.output<typeof ComponentsReadOutputSchema>;

export type Listed = zod.output<typeof ListedSchema>;
