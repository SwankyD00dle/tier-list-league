import type { ApiErrorResponse, ApiRequest } from "@tier-list-league/api-schema/types";
import type { infer as ZodInfer, ZodMiniType } from "zod/mini";

export type {
  ApiErrorResponse,
  ApiRequest,
  ApiSuccessResponse,
} from "@tier-list-league/api-schema/types";

export const REQUEST_SCHEMA_FAILURE_CODE = "REQUEST_SCHEMA_VALIDATION_FAILURE";
export const REQUEST_SCHEMA_FAILURE_MESSAGE = "Request schema validation failed";

export type ApiResponse<TSuccess> = {
  status(code: number): ApiResponse<TSuccess>;
  setHeader(name: string, value: string): ApiResponse<TSuccess>;
  setCookie(name: string, value: string, options?: CookieOptions): ApiResponse<TSuccess>;
  clearCookie(name: string, options?: CookieOptions): ApiResponse<TSuccess>;
  redirect(url: string): ApiResponse<TSuccess>;
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

/** Rejects a request that failed its schema typecheck. */
export function requestSchemaFailure<TSuccess>(res: ApiResponse<TSuccess>) {
  return res.status(400).json({
    ok: false,
    code: REQUEST_SCHEMA_FAILURE_CODE,
    message: REQUEST_SCHEMA_FAILURE_MESSAGE,
  });
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
