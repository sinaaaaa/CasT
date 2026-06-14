/**
 * Resolve the Unity WebGL entry URL for the student play iframe.
 * Never use the bare site root — that page sets X-Frame-Options: DENY.
 */
export function resolveUnityGameUrl(): string {
  const raw =
    process.env.UNITY_WEBGL_URL?.trim() ||
    process.env.NEXT_PUBLIC_UNITY_WEBGL_URL?.trim() ||
    "";

  if (!raw) return "/unity/index.html";

  try {
    const parsed = new URL(raw, "https://placeholder.local");
    if (parsed.pathname === "/" || parsed.pathname === "") {
      return "/unity/index.html";
    }
    if (parsed.pathname.startsWith("/unity/")) {
      return `${parsed.pathname}${parsed.search}`;
    }
    if (raw.startsWith("http") && parsed.pathname.includes(".html")) {
      return raw;
    }
  } catch {
    if (raw.startsWith("/unity/")) return raw;
  }

  return "/unity/index.html";
}
