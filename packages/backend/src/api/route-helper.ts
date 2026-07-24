import type { infer as ZodInfer, ZodMiniType } from "zod/mini";
import * as z from "zod/mini";

export const REQUEST_SCHEMA_FAILURE_CODE = "REQUEST_SCHEMA_VALIDATION_FAILURE";
export const REQUEST_SCHEMA_FAILURE_MESSAGE = "Request schema validation failed";

export const apiRequestSchema = z.object({
  params: z.optional(z.record(z.string(), z.string())),
  query: z.optional(z.record(z.string(), z.union([z.string(), z.array(z.string())]))),
  body: z.optional(z.unknown()),
});

export type ApiRequest = ZodInfer<typeof apiRequestSchema>;

export const apiSuccessResponseSchema = z.object({
  ok: z.literal(true),
});

export type ApiSuccessResponse = ZodInfer<typeof apiSuccessResponseSchema>;

export const apiErrorResponseSchema = z.object({
  ok: z.literal(false),
  code: z.string(),
  message: z.string(),
  details: z.optional(z.unknown()),
});

export type ApiErrorResponse = ZodInfer<typeof apiErrorResponseSchema>;

export type ApiResponse<TSuccess> = {
  status(code: number): ApiResponse<TSuccess>;
  json(body: TSuccess | ApiErrorResponse): ApiResponse<TSuccess>;
};

export type RouteHandler<TResponse extends ZodMiniType> = (
  req: ApiRequest,
  res: ApiResponse<ZodInfer<TResponse>>,
) => undefined | Promise<unknown>;

export interface DefineRouteOptions<TRequest extends ZodMiniType, TResponse extends ZodMiniType> {
  summary: string;
  description: string;
  tags: string[];
  request: TRequest;
  response: TResponse;
  handler: RouteHandler<TResponse>;
}

export interface DefinedRoute<
  TRequest extends ZodMiniType = ZodMiniType,
  TResponse extends ZodMiniType = ZodMiniType,
> {
  summary: string;
  description: string;
  tags: string[];
  request: TRequest;
  response: TResponse;
  handler: RouteHandler<TResponse>;
}

export function defineRoute<TRequest extends ZodMiniType, TResponse extends ZodMiniType>(
  _log: unknown,
  options: DefineRouteOptions<TRequest, TResponse>,
): DefinedRoute<TRequest, TResponse> {
  return {
    summary: options.summary,
    description: options.description,
    tags: options.tags,
    request: options.request,
    response: options.response,
    handler: options.handler,
  };
}
