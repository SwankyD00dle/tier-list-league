import type { infer as ZodInfer, ZodMiniType } from "zod/mini";

/**
 * Not exported from the package: callers go through the named guards in this directory so every
 * check stays bound to the one schema that describes that payload.
 */
export function matchesSchema<TSchema extends ZodMiniType>(
  schema: TSchema,
  data: unknown,
): data is ZodInfer<TSchema> {
  return schema.safeParse(data).success;
}
