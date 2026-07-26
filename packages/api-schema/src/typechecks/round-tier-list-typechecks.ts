import {
  type SubmitTierListRequest,
  type SubmitTierListResponse,
  submitTierListRequestSchema,
  submitTierListResponseSchema,
} from "../schema/round-tier-list-schema";
import { matchesSchema } from "./typecheck";

export function isSubmitTierListRequest(data: unknown): data is SubmitTierListRequest {
  return matchesSchema(submitTierListRequestSchema, data);
}

export function isSubmitTierListResponse(data: unknown): data is SubmitTierListResponse {
  return matchesSchema(submitTierListResponseSchema, data);
}
