import { Router, type IRouter } from "express";

const drivePlayerRouter: IRouter = Router();

function isValidFileId(value: string | null): value is string {
  return Boolean(value && /^[a-zA-Z0-9_-]+$/.test(value));
}

function getDriveDownloadUrl(fileId: string) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
}

drivePlayerRouter.get("/drive-player", (req, res) => {
  const fileId = typeof req.query.id === "string" ? req.query.id : null;
  if (!isValidFileId(fileId)) {
    res.status(400).send("Invalid Google Drive file id");
    return;
  }

  const safeId = encodeURIComponent(fileId);
  res.type("html").send(`<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#111}video{width:100%;height:100%;display:block;background:#111;object-fit:contain}</style>
</head>
<body><video controls playsinline preload="metadata" src="/api/drive-video?id=${safeId}"></video></body>
</html>`);
});

drivePlayerRouter.get("/drive-video", async (req, res) => {
  const fileId = typeof req.query.id === "string" ? req.query.id : null;
  if (!isValidFileId(fileId)) {
    res.status(400).json({ error: "Invalid Google Drive file id" });
    return;
  }

  try {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 AeroRescue/1.0",
      Accept: "video/*,*/*;q=0.8",
    };
    if (typeof req.headers.range === "string") headers.Range = req.headers.range;

    const upstream = await fetch(getDriveDownloadUrl(fileId), {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: `Google Drive returned HTTP ${upstream.status}` });
      return;
    }

    const contentType = upstream.headers.get("content-type");
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    const acceptRanges = upstream.headers.get("accept-ranges");

    res.status(upstream.status);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Accept-Ranges", acceptRanges || "bytes");
    if (contentType && !contentType.includes("text/html")) res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentRange) res.setHeader("Content-Range", contentRange);

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    res.end();
  } catch {
    if (!res.headersSent) {
      res.status(502).json({ error: "Unable to stream Google Drive video" });
    } else {
      res.end();
    }
  }
});

export default drivePlayerRouter;