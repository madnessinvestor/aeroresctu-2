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

function cleanTitle(value: string | null | undefined) {
  if (!value) return null;

  const title = decodeHtmlEntities(value)
    .replace(/^\s+|\s+$/g, "")
    .replace(/\s+/g, " ");

  if (!title) return null;

  const genericTitles = new Set([
    "google drive",
    "drive",
    "youtube",
    "video",
    "vídeo",
    "untitled",
    "sem título",
  ]);

  if (genericTitles.has(title.toLowerCase())) return null;
  return title;
}

function isGoogleDriveHost(hostname: string) {
  return hostname === "drive.google.com" || hostname.endsWith(".drive.google.com");
}

function isYoutubeHost(hostname: string) {
  return /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(hostname);
}

function extractMetaContent(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const propertyFirst = new RegExp(
    `<meta[^>]+(?:property|name)=[\"']${escaped}[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>`,
    "i",
  );
  const contentFirst = new RegExp(
    `<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']${escaped}[\"'][^>]*>`,
    "i",
  );
  return propertyFirst.exec(html)?.[1] ?? contentFirst.exec(html)?.[1] ?? null;
}

function extractDriveFileId(url: string) {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/i,
    /[?&]id=([a-zA-Z0-9_-]+)/i,
    /\/open\?id=([a-zA-Z0-9_-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function decodeJsonString(value: string) {
  try {
    return JSON.parse(`"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`) as string;
  } catch {
    return value;
  }
}

function extractDriveEmbeddedName(html: string) {
  const patterns = [
    /["']fileName["']\s*:\s*["']([^"']+)["']/i,
    /["']file_name["']\s*:\s*["']([^"']+)["']/i,
    /["']filename["']\s*:\s*["']([^"']+)["']/i,
    /["']name["']\s*:\s*["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const candidate = match?.[1] ? decodeJsonString(match[1]) : null;
    const cleaned = cleanTitle(candidate);
    if (cleaned && !/google drive|drive/i.test(cleaned)) return cleaned;
  }

  return null;
}

async function resolveDriveDownloadName(fileId: string) {
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;

  const response = await fetch(downloadUrl, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(10000),
    headers: {
      "User-Agent": "Mozilla/5.0 AeroRescue/1.0",
      Range: "bytes=0-0",
    },
  });

  const disposition = response.headers.get("content-disposition");
  const filenameMatch = disposition?.match(/filename\*=UTF-8''([^;]+)|filename=[\"']?([^\"';]+)[\"']?/i);
  const encodedName = filenameMatch?.[1] ?? filenameMatch?.[2];

  if (encodedName) {
    try {
      return cleanTitle(decodeURIComponent(encodedName));
    } catch {
      return cleanTitle(encodedName);
    }
  }

  return null;
}

async function resolveYoutubeTitle(url: string) {
  const metadataUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const response = await fetch(metadataUrl, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) return null;
  const payload = (await response.json()) as { title?: string };
  return cleanTitle(payload.title);
}

async function resolveDriveTitle(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 AeroRescue/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) return null;

  const html = await response.text();
  const fileId = extractDriveFileId(url);

  // Prefer the actual Drive file metadata over the generic page title.
  const embeddedName = extractDriveEmbeddedName(html);
  if (embeddedName) return embeddedName;

  if (fileId) {
    const downloadName = await resolveDriveDownloadName(fileId);
    if (downloadName) return downloadName;
  }

  const candidates = [
    extractMetaContent(html, "og:title"),
    extractMetaContent(html, "twitter:title"),
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null,
  ];

  for (const candidate of candidates) {
    const cleaned = cleanTitle(candidate);
    if (!cleaned) continue;

    const normalized = cleaned
      .replace(/\s+-\s+Google Drive\s*$/i, "")
      .replace(/\s+\|\s+Google Drive\s*$/i, "")
      .trim();

    if (normalized && !/^google drive$/i.test(normalized)) {
      return normalized;
    }
  }

  return null;
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

  const isDrive = isGoogleDriveHost(parsedUrl.hostname);
  const isYoutube = isYoutubeHost(parsedUrl.hostname);
  if (!isDrive && !isYoutube) {
    res.status(400).json({ error: "Unsupported media host" });
    return;
  }

  if (titleCache.has(url)) {
    res.json({ title: titleCache.get(url) });
    return;
  }

  try {
    const title = isYoutube
      ? await resolveYoutubeTitle(url)
      : await resolveDriveTitle(url);

    titleCache.set(url, title);
    res.json({ title });
  } catch {
    // Metadata must never break the catalog. The frontend will retain the
    // explicitly configured title when the remote platform cannot be reached.
    titleCache.set(url, null);
    res.json({ title: null });
  }
});

export default mediaMetadataRouter;
