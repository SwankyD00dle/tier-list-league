import type { CookieOptions } from "../route-helper";
import { getAuthConfig } from "../routes/auth/config";

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const OAUTH_STATE_COOKIE = "oauth_state";

const DEFAULT_PATH = "/";

export function authCookieOptions(maxAgeSeconds: number): CookieOptions {
  const { cookieSecure } = getAuthConfig();
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "Lax",
    path: DEFAULT_PATH,
    maxAge: maxAgeSeconds,
  };
}

export function clearAuthCookieOptions(): CookieOptions {
  const { cookieSecure } = getAuthConfig();
  return {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "Lax",
    path: DEFAULT_PATH,
  };
}
