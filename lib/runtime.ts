export function isLocalRepo(env: { APP_URL?: string; NODE_ENV?: string } = process.env) {
  const url = env.APP_URL;
  if (!url) return env.NODE_ENV !== "production";
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}
