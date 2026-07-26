import {
  isMeRequest,
  type MeResponse,
  meRequestSchema,
  meResponseSchema,
} from "@tier-list-league/api-schema";
import { eq } from "drizzle-orm";
import user from "../../../database/schema/user";
import { requireAuth } from "../../auth/require-auth";
import type { BaseHandlerConfig } from "../../handler";
import {
  type ApiRequest,
  type ApiResponse,
  defineRoute,
  requestSchemaFailure,
} from "../../route-helper";

export const getMe = (config: BaseHandlerConfig) =>
  defineRoute(config.log, {
    summary: "Current user",
    description: "Return the authenticated user from the access token cookie.",
    tags: ["Auth"],
    request: meRequestSchema,
    response: meResponseSchema,
    handler: async (req: ApiRequest, res: ApiResponse<MeResponse>) => {
      const { log } = config;

      if (!isMeRequest(req)) {
        return requestSchemaFailure(res);
      }

      try {
        const auth = await requireAuth(req, res);
        if (!auth) {
          return;
        }

        const [found] = await config.db
          .select({
            id: user.id,
            name: user.name,
            discordUserId: user.discordUserId,
          })
          .from(user)
          .where(eq(user.id, auth.sub))
          .limit(1);

        if (!found) {
          return res.status(401).json({
            ok: false,
            code: "UNAUTHORIZED",
            message: "User not found",
          });
        }

        return res.status(200).json({
          ok: true,
          id: found.id,
          name: found.name,
          discordUserId: found.discordUserId,
        });
      } catch (error) {
        log.error({ error: String(error) }, "Get me error");
        return res.status(500).json({
          ok: false,
          code: "INTERNAL_ERROR",
          message: "Failed to load current user",
        });
      }
    },
  });
