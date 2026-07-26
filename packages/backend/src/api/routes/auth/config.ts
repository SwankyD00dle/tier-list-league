export interface AuthConfig {
  discordClientId: string;
  discordClientSecret: string;
  discordRedirectUri: string;
  jwtSecret: string;
  frontendUrl: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  cookieSecure: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let cached: AuthConfig | undefined;

export function getAuthConfig(): AuthConfig {
  if (cached) {
    return cached;
  }

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  const accessTokenTtlSeconds = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900);
  const refreshTokenTtlSeconds = Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 2_592_000);
  const cookieSecure = process.env.COOKIE_SECURE === "true";

  cached = {
    discordClientId: requireEnv("DISCORD_CLIENT_ID"),
    discordClientSecret: requireEnv("DISCORD_CLIENT_SECRET"),
    discordRedirectUri: requireEnv("DISCORD_REDIRECT_URI"),
    jwtSecret: requireEnv("JWT_SECRET"),
    frontendUrl,
    accessTokenTtlSeconds,
    refreshTokenTtlSeconds,
    cookieSecure,
  };

  return cached;
}

/** Test helper to reset cached config between cases. */
export function resetAuthConfigCache(): void {
  cached = undefined;
}
