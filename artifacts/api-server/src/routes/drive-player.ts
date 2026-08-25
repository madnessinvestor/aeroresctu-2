import { Router, type IRouter, type Request, type Response } from "express";

const drivePlayerRouter: IRouter = Router();

function isValidFileId(value: string | null): value is string {
  return Boolean(value && /^[a-zA-Z0-9_-]+$/.test(value));
}

function getDriveDownloadUrl(fileId: string) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
}

async function streamDriveFile(fileId: string, req: Request, res: Response, forcedContentType?: string) {
  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 AeroRescue/1.0",
    Accept: "*/*",
  };
  if (typeof req.headers.range === "string") headers.Range = req.headers.range;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const abortUpstream = () => {
    if (!res.writableFinished) controller.abort();
  };
  res.once("close", abortUpstream);

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(getDriveDownloadUrl(fileId), {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

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
  if (forcedContentType) {
    res.setHeader("Content-Type", forcedContentType);
  } else if (contentType && !contentType.includes("text/html")) {
    res.setHeader("Content-Type", contentType);
  }
  if (contentLength) res.setHeader("Content-Length", contentLength);
  if (contentRange) res.setHeader("Content-Range", contentRange);

  if (!upstream.body) {
    res.end();
    return;
  }

  try {
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (res.destroyed) break;
      if (!res.write(Buffer.from(value))) {
        await new Promise<void>((resolve) => res.once("drain", resolve));
      }
    }
    reader.releaseLock();
  } finally {
    res.off("close", abortUpstream);
    if (!res.writableEnded && !res.destroyed) res.end();
  }
}

drivePlayerRouter.get("/drive-document", async (req, res) => {
  const fileId = typeof req.query.id === "string" ? req.query.id : null;
  if (!isValidFileId(fileId)) {
    res.status(400).json({ error: "Invalid Google Drive file id" });
    return;
  }

  try {
    res.setHeader("Content-Disposition", "inline");
    // Preserve the upstream MIME type: Drive documents can also be images
    // (for example, the ATR 72 safety cards are JPEG files).
    await streamDriveFile(fileId, req, res);
  } catch {
    if (!res.headersSent) {
      res.status(502).json({ error: "Unable to read Google Drive document" });
    } else {
      res.end();
    }
  }
});

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
    await streamDriveFile(fileId, req, res);
  } catch {
    if (!res.headersSent) {
      res.status(502).json({ error: "Unable to stream Google Drive video" });
    } else {
      res.end();
    }
  }
});

export default drivePlayerRouter;