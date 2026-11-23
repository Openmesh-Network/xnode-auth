/// Normalizes an nginx `$request_uri` the way nginx does when it picks a location (`$uri`):
/// percent-decoded exactly once, repeated slashes merged. The query string is returned untouched.
/// Anything ambiguous between nginx and the application is rejected instead of guessed:
/// dot segments (also when hidden as %2e / %2f), backslashes, NUL bytes, malformed escapes.
export function normalizeRequestUri(requestUri: string): {
  path: string;
  query: string;
} {
  const queryStart = requestUri.indexOf("?");
  const rawPath =
    queryStart === -1 ? requestUri : requestUri.slice(0, queryStart);
  const query = queryStart === -1 ? "" : requestUri.slice(queryStart);

  // origin-form only (nginx never sends a fragment either)
  if (!rawPath.startsWith("/") || rawPath.includes("#")) {
    throw new Error("Path is malformed.");
  }

  // Percent-decode once, on bytes: like nginx, don't require valid UTF-8.
  // (Node exposes header values as latin1, so this recovers the original bytes.)
  const source = Buffer.from(rawPath, "latin1");
  const bytes: number[] = [];
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== 0x25 /* % */) {
      bytes.push(source[i]);
      continue;
    }
    const hex = source.toString("latin1", i + 1, i + 3);
    if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
      throw new Error("Path is malformed.");
    }
    bytes.push(parseInt(hex, 16));
    i += 2;
  }
  const decoded = Buffer.from(bytes).toString("utf8");

  if (decoded.includes("\0") || decoded.includes("\\")) {
    throw new Error("Path is not normalized.");
  }
  if (decoded.split("/").some((s) => s === "." || s === "..")) {
    throw new Error("Path is not normalized.");
  }

  return { path: decoded.replace(/\/{2,}/g, "/"), query };
}
