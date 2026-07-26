import {
  type GetTierListRequest,
  type GetTierListResponse,
  getTierListRequestSchema,
  getTierListResponseSchema,
} from "../schema/tier-list-schema";
import { matchesSchema } from "./typecheck";

export function isGetTierListRequest(data: unknown): data is GetTierListRequest {
  return matchesSchema(getTierListRequestSchema, data);
}

export function isGetTierListResponse(data: unknown): data is GetTierListResponse {
  return matchesSchema(getTierListResponseSchema, data);
}
