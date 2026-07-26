import { parseCookies } from "../cookie";
import type { ApiRequest, ApiResponse } from "../route-helper";
import { ACCESS_TOKEN_COOKIE } from "./cookies";
import { type AccessTokenPayload, verifyAccessToken } from "./tokens";

export type AuthUser = AccessTokenPayload;

export async function requireAuth(
  req: ApiRequest,
  res: ApiResponse<unknown>,
): Promise<AuthUser | undefined> {
  const cookies = parseCookies(req.headers?.cookie);
  const accessToken = cookies[ACCESS_TOKEN_COOKIE];

  if (accessToken === undefined || accessToken === "") {
    res.status(401).json({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
    return undefined;
  }

  const payload = await verifyAccessToken(accessToken);
  if (!payload) {
    res.status(401).json({
      ok: false,
      code: "UNAUTHORIZED",
      message: "Invalid or expired access token",
    });
    return undefined;
  }

  return payload;
}
