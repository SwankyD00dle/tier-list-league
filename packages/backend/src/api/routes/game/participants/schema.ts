import type { infer as ZodInfer } from "zod/mini";
import * as z from "zod/mini";
import { apiRequestSchema, apiSuccessResponseSchema } from "../../../route-helper";

export const addParticipantRequestSchema = z.extend(apiRequestSchema, {
  params: z.object({
    gameId: z.uuid(),
  }),
  body: z.object({
    userId: z.uuid(),
  }),
});

export type AddParticipantRequest = ZodInfer<typeof addParticipantRequestSchema>;

export const removeParticipantRequestSchema = z.extend(apiRequestSchema, {
  params: z.object({
    gameId: z.uuid(),
    userId: z.uuid(),
  }),
});

export type RemoveParticipantRequest = ZodInfer<typeof removeParticipantRequestSchema>;

export const participantsResponseSchema = z.extend(apiSuccessResponseSchema, {
  gameId: z.uuid(),
  participants: z.array(z.uuid()),
});

export type ParticipantsResponse = ZodInfer<typeof participantsResponseSchema>;
