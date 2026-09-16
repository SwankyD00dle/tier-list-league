import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3001";

const basePath = publicBasePath(process.env.APP_PUBLIC_URL);

const nextConfig: NextConfig = {
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  transpilePackages: ["@tier-list-league/api-schema"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

function publicBasePath(publicUrl: string | undefined): string {
  if (publicUrl === undefined) {
    return "";
  }

  // Do not include the configured URL in errors: misconfiguration may contain credentials.
  const invalid = () =>
    new Error(
      "APP_PUBLIC_URL must be an absolute HTTP(S) URL with a canonical pathname and no credentials, query, or fragment",
    );
  let url: URL;
  try {
    url = new URL(publicUrl);
  } catch {
    throw invalid();
  }

  const pathname = publicUrl.match(/^https?:\/\/[^/?#]+(\/[^?#]*)?$/)?.[1] ?? "/";
  if (
    !/^https?:\/\//.test(publicUrl) ||
    publicUrl !== publicUrl.trim() ||
    publicUrl.includes("\\") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    publicUrl.includes("?") ||
    publicUrl.includes("#") ||
    url.pathname !== pathname ||
    !/^\/[A-Za-z0-9/._~-]*$/.test(pathname) ||
    pathname.includes("//")
  ) {
    throw invalid();
  }

  // Next basePath requires no trailing slash; no pathname segments are discarded.
  return pathname.replace(/\/$/, "");
}
