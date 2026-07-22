import type { z } from "zod";
import { z as zod } from "zod";

export const apiErrorResponseSchema = zod.object({
  ok: zod.literal(false),
  code: zod.string(),
  message: zod.string(),
  details: zod.object({ unknown: zod.unknown() }),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

export interface TypedRequest {
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string | string[] | undefined>;
}

export interface TypedResponse {
  status(code: number): TypedResponse;
  json(body: unknown): TypedResponse;
}

export type RouteHandler = (
  req: TypedRequest,
  res: TypedResponse,
) => void | Promise<void | TypedResponse>;

export interface DefineRouteOptions<TBody extends z.ZodType | undefined = undefined> {
  body?: TBody extends z.ZodType ? { schema: TBody; skipValidation?: boolean } : undefined;
  summary: string;
  description: string;
  tags: string[];
  response: z.ZodType;
  successStatusCode?: number;
  handler: RouteHandler;
}

export interface DefinedRoute {
  summary: string;
  description: string;
  tags: string[];
  body?: { schema: z.ZodType; skipValidation?: boolean };
  response: z.ZodType;
  successStatusCode: number;
  handler: RouteHandler;
}

export function defineRoute(
  _log: unknown,
  options: DefineRouteOptions<z.ZodType | undefined>,
): DefinedRoute {
  return {
    summary: options.summary,
    description: options.description,
    tags: options.tags,
    body: options.body,
    response: options.response,
    successStatusCode: options.successStatusCode ?? 200,
    handler: options.handler,
  };
}
