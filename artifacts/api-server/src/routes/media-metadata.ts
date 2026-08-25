import { Router, type IRouter } from "express";

const mediaMetadataRouter: IRouter = Router();
const titleCache = new Map<string, string>();

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
  const title = decodeHtmlEntities(value).replace(/^\s+|\s+$/g, "").replace(/\s+/g, " ");
  if (!title) return null;

  const genericTitles = new Set([
    "google drive", "drive", "youtube", "video", "vídeo", "untitled", "sem título",
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
  const propertyFirst = new RegExp(`<meta[^>]+(?:property|name)=[\"']${escaped}[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>`, "i");
  const contentFirst = new RegExp(`<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']${escaped}[\"'][^>]*>`, "i");
  return propertyFirst.exec(html)?.[1] ?? contentFirst.exec(html)?.[1] ?? null;
}

function extractDriveFileId(url: string) {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/i,
    /[?&]id=([a-zA-Z0-9_-]+)/i,
    /\/open\?id=([a-zA-Z0-9_-]+)/i,
    /\/d\/([a-zA-Z0-9_-]+)/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractFilenameFromDisposition(value: string | null) {
  if (!value) return null;
  const match = value.match(/filename\*=UTF-8''([^;]+)|filename=[\"']?([^\"';]+)[\"']?/i);
  const encoded = match?.[1] ?? match?.[2];
  if (!encoded) return null;
  try {
    return cleanTitle(decodeURIComponent(encoded));
  } catch {
    return cleanTitle(encoded);
  }
}

function extractDriveEmbeddedName(html: string) {
  // Google has changed the Drive viewer markup several times. These fields
  // are file-level metadata, unlike the generic page title.
  const patterns = [
    /["']fileName["']\s*:\s*["']([^"']+)["']/i,
    /["']file_name["']\s*:\s*["']([^"']+)["']/i,
    /["']filename["']\s*:\s*["']([^"']+)["']/i,
    /data-file-name=["']([^"']+)["']/i,
    /itemprop=["']name["'][^>]+content=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const candidate = cleanTitle(match?.[1]);
    if (candidate && !/^(google drive|drive)$/i.test(candidate)) return candidate;
  }
  return null;
}

async function fetchFilename(url: string) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
    headers: {
      "User-Agent": "Mozilla/5.0 AeroRescue/1.0",
      Accept: "*/*",
    },
  });

  const filename = extractFilenameFromDisposition(response.headers.get("content-disposition"));
  if (filename) return filename;

  // Large public Drive files may first return a confirmation page. The form
  // contains the actual download endpoint, which in turn exposes the filename.
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    const html = await response.text();
    const formMatch = html.match(/<form[^>]+action=[\"']([^\"']*drive\.usercontent\.google\.com[^\"']*)[\"'][^>]*>([\s\S]*?)<\/form>/i);
    if (formMatch) {
      const action = formMatch[1].replace(/&amp;/g, "&");
      const hiddenFields = [...formMatch[2].matchAll(/<input[^>]+type=[\"']hidden[\"'][^>]+name=[\"']([^\"']+)[\"'][^>]+value=[\"']([^\"']*)[\"']/gi)];
      const params = new URLSearchParams();
      for (const field of hiddenFields) params.set(field[1], field[2]);
      const downloadUrl = `${action}${action.includes("?") ? "&" : "?"}${params.toString()}`;
      const downloadResponse = await fetch(downloadUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
        headers: { "User-Agent": "Mozilla/5.0 AeroRescue/1.0" },
      });
      return extractFilenameFromDisposition(downloadResponse.headers.get("content-disposition"));
    }
  }

  return null;
}

async function resolveDriveTitle(url: string) {
  const fileId = extractDriveFileId(url);

  if (fileId) {
    // This endpoint is currently the most reliable way to obtain the original
    // filename of a public Drive file without requiring a Google API key.
    const directUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
    const directName = await fetchFilename(directUrl);
    if (directName) return directName;

    const legacyUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
    const legacyName = await fetchFilename(legacyUrl);
    if (legacyName) return legacyName;
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 AeroRescue/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) return null;

  const html = await response.text();
  const embeddedName = extractDriveEmbeddedName(html);
  if (embeddedName) return embeddedName;

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
    if (normalized && !/^google drive$/i.test(normalized)) return normalized;
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
    const title = isYoutube ? await resolveYoutubeTitle(url) : await resolveDriveTitle(url);
    if (title) titleCache.set(url, title);
    res.json({ title: title ?? null });
  } catch {
    // Do not cache failures. A temporary Drive/YouTube/network failure must
    // not permanently lock the catalog to its generic fallback name.
    res.json({ title: null });
  }
});

export default mediaMetadataRouter;
