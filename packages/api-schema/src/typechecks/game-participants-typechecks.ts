import {
  type AddParticipantRequest,
  addParticipantRequestSchema,
  type ParticipantsResponse,
  participantsResponseSchema,
  type RemoveParticipantRequest,
  removeParticipantRequestSchema,
} from "../schema/game-participants-schema";
import { matchesSchema } from "./typecheck";

export function isAddParticipantRequest(data: unknown): data is AddParticipantRequest {
  return matchesSchema(addParticipantRequestSchema, data);
}

export function isRemoveParticipantRequest(data: unknown): data is RemoveParticipantRequest {
  return matchesSchema(removeParticipantRequestSchema, data);
}

export function isParticipantsResponse(data: unknown): data is ParticipantsResponse {
  return matchesSchema(participantsResponseSchema, data);
}
