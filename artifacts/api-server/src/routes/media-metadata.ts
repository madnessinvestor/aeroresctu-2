import { Router, type IRouter } from "express";

const mediaMetadataRouter: IRouter = Router();
const titleCache = new Map<string, string | null>();

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

mediaMetadataRouter.get("/media-metadata", async (req, res) => {
  const url = typeof req.query.url === "string" ? req.query.url : "";
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid media URL" });
    return;
  }

  const isDrive = parsedUrl.hostname === "drive.google.com";
  const isYoutube = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(parsedUrl.hostname);
  if (!isDrive && !isYoutube) {
    res.status(400).json({ error: "Unsupported media host" });
    return;
  }

  if (titleCache.has(url)) {
    res.json({ title: titleCache.get(url) });
    return;
  }

  try {
    const metadataUrl = isYoutube
      ? `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      : url;
    const response = await fetch(metadataUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      res.status(502).json({ error: "Media metadata unavailable" });
      return;
    }

    if (isYoutube) {
      const payload = (await response.json()) as { title?: string };
      const title = payload.title || null;
      titleCache.set(url, title);
      res.json({ title });
      return;
    }

    const html = await response.text();
    const rawTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || null;
    const title = rawTitle ? decodeHtmlEntities(rawTitle).replace(/\s+-\s+Google Drive\s*$/i, "") : null;
    titleCache.set(url, title);
    res.json({ title });
  } catch {
    res.status(502).json({ error: "Media metadata unavailable" });
  }
});

export default mediaMetadataRouter;