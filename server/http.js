const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");
const { LIMITS, PUBLIC_DIR, mimeTypes } = require("./config");
const { listRooms } = require("./rooms");
const { parseRequestUrl } = require("./request-url");

function createHttpServer() {
  return http.createServer((req, res) => {
    const url = parseRequestUrl(req);
    if (url.pathname === "/healthz") {
      respondJson(res, { ok: true, name: "시뮬라크월드: PvP 아레나", at: Date.now() });
      return;
    }

    if (url.pathname === "/api/rooms") {
      respondJson(res, { rooms: getPublicRooms() });
      return;
    }

    if (url.pathname === "/api/upload-audio" && req.method === "POST") {
      handleAudioUpload(req, res);
      return;
    }

    const requestedPath = resolvePublicPath(url.pathname);
    const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, noStoreHeaders("text/plain; charset=utf-8"));
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404, noStoreHeaders("text/plain; charset=utf-8"));
        res.end("Not found");
        return;
      }

      res.writeHead(200, noStoreHeaders(mimeTypes[path.extname(filePath)] || "application/octet-stream"));
      res.end(data);
    });
  });
}

function resolvePublicPath(pathname) {
  if (pathname === "/") return "/index.html";
  if (pathname === "/admin") return "/admin/index.html";
  if (pathname === "/ai") return "/ai/index.html";
  if (pathname.endsWith("/")) return `${pathname}index.html`;
  return pathname;
}

function getPublicRooms() {
  const lobby = listRooms().find((room) => room.name === "lobby");
  return [
    {
      id: "lobby",
      name: "PvP 아레나",
      slug: "lobby",
      players: lobby?.playerCount || 0,
      viewers: lobby?.viewers || 0,
      items: lobby?.items || 0,
      maxPlayers: LIMITS.maxPlayersPerRoom
    }
  ];
}

function handleAudioUpload(req, res) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("audio/") && !contentType.includes("octet-stream")) {
    respondJson(res, { ok: false, error: "audio only" }, 415);
    return;
  }

  const chunks = [];
  let total = 0;
  req.on("data", (chunk) => {
    total += chunk.length;
    if (total > LIMITS.maxAudioUploadBytes) {
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on("end", () => {
    const buffer = Buffer.concat(chunks);
    if (!buffer.length) {
      respondJson(res, { ok: false, error: "empty file" }, 400);
      return;
    }
    const uploadDir = path.join(PUBLIC_DIR, "uploads", "radio");
    fs.mkdirSync(uploadDir, { recursive: true });
    const name = `${crypto.randomUUID()}.mp3`;
    fs.writeFileSync(path.join(uploadDir, name), buffer);
    respondJson(res, { ok: true, url: `/uploads/radio/${name}` });
  });

  req.on("error", () => {
    respondJson(res, { ok: false, error: "upload failed" }, 400);
  });
}

function respondJson(res, payload, status = 200) {
  res.writeHead(status, noStoreHeaders("application/json; charset=utf-8"));
  res.end(JSON.stringify(payload));
}

function noStoreHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  };
}

module.exports = {
  createHttpServer
};
