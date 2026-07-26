import { getAuthConfig } from "../routes/auth/config";

const DISCORD_AUTHORIZE_URL = "https://discord.com/api/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_USER_URL = "https://discord.com/api/users/@me";

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
}

export function buildDiscordAuthorizeUrl(state: string): string {
  const { discordClientId, discordRedirectUri } = getAuthConfig();
  const url = new URL(DISCORD_AUTHORIZE_URL);
  url.searchParams.set("client_id", discordClientId);
  url.searchParams.set("redirect_uri", discordRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);
  return url.toString();
}

function isDiscordAccessTokenResponse(data: unknown): data is { access_token: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "access_token" in data &&
    typeof data.access_token === "string"
  );
}

export async function exchangeDiscordCode(code: string): Promise<string> {
  const { discordClientId, discordClientSecret, discordRedirectUri } = getAuthConfig();

  const body = new URLSearchParams({
    client_id: discordClientId,
    client_secret: discordClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: discordRedirectUri,
  });

  const response = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Discord token exchange failed: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isDiscordAccessTokenResponse(data)) {
    throw new Error("Discord token response missing access_token");
  }

  return data.access_token;
}

function isDiscordUserResponse(
  data: unknown,
): data is { id: string; username: string; global_name?: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    typeof data.id === "string" &&
    "username" in data &&
    typeof data.username === "string"
  );
}
export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch(DISCORD_USER_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Discord user fetch failed: ${response.status}`);
  }

  const data = await response.json();
  if (!isDiscordUserResponse(data)) {
    throw new Error("Discord user response missing required fields");
  }

  const globalName =
    "global_name" in data && typeof data.global_name === "string" ? data.global_name : null;

  return {
    id: data.id,
    username: data.username,
    global_name: globalName,
  };
}

export function discordDisplayName(user: DiscordUser): string {
  if (user.global_name !== null && user.global_name !== "") {
    return user.global_name;
  }
  return user.username;
}
