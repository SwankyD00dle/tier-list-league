import type { infer as ZodInfer, ZodMiniType } from "zod/mini";

/**
 * Narrows `data` to a schema's inferred type when it satisfies that schema.
 *
 * Internal to this package on purpose: callers use the named request and response guards in this
 * directory so every check is bound to the one schema that describes that payload.
 */
export function matchesSchema<TSchema extends ZodMiniType>(
  schema: TSchema,
  data: unknown,
): data is ZodInfer<TSchema> {
  return schema.safeParse(data).success;
}
