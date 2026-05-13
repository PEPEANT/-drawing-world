function parseRequestUrl(req) {
  const host = req.headers.host || "localhost";
  const rawUrl = typeof req.url === "string" && req.url.trim() ? req.url : "/";
  const safeUrl = rawUrl.startsWith("//") ? "/" : rawUrl;
  try {
    return new URL(safeUrl, `http://${host}`);
  } catch {
    return new URL("/", `http://${host}`);
  }
}

module.exports = { parseRequestUrl };
