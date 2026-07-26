import {
  type HealthRequest,
  type HealthResponse,
  healthRequestSchema,
  healthResponseSchema,
} from "../schema/health-schema";
import { matchesSchema } from "./typecheck";

export function isHealthRequest(data: unknown): data is HealthRequest {
  return matchesSchema(healthRequestSchema, data);
}

export function isHealthResponse(data: unknown): data is HealthResponse {
  return matchesSchema(healthResponseSchema, data);
}
