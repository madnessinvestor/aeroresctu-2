import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT || '4173';
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || '/';

function repairMojibake(value: string) {
  if (!/[ÃÂâ]|�/.test(value)) return value;
  try {
    const repaired = Buffer.from(value, 'latin1').toString('utf8');
    if (!repaired || repaired.includes('�')) return value;
    return repaired;
  } catch {
    return value;
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cleanMediaTitle(value: string | null | undefined) {
  if (!value) return null;
  const title = repairMojibake(
    decodeHtmlEntities(value).replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' '),
  );
  if (!title) return null;
  const generic = new Set([
    'google drive',
    'drive',
    'youtube',
    'video',
    'vídeo',
    'untitled',
    'sem título',
  ]);
  return generic.has(title.toLowerCase()) ? null : title;
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

function filenameFromDisposition(value: string | null) {
  if (!value) return null;
  const match = value.match(/filename\*=UTF-8''([^;]+)|filename=[\"']?([^\"';]+)[\"']?/i);
  const encoded = match?.[1] ?? match?.[2];
  if (!encoded) return null;
  try {
    return cleanMediaTitle(decodeURIComponent(encoded));
  } catch {
    return cleanMediaTitle(encoded);
  }
}

function extractDriveEmbeddedName(html: string) {
  const patterns = [
    /["']fileName["']\s*:\s*["']([^"']+)["']/i,
    /["']file_name["']\s*:\s*["']([^"']+)["']/i,
    /["']filename["']\s*:\s*["']([^"']+)["']/i,
    /data-file-name=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const candidate = cleanMediaTitle(html.match(pattern)?.[1]);
    if (candidate) return candidate;
  }
  return null;
}

async function getDriveFilename(url: string) {
  const fileId = extractDriveFileId(url);
  if (!fileId) return null;

  const downloadUrls = [
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
  ];

  for (const downloadUrl of downloadUrls) {
    try {
      const response = await fetch(downloadUrl, {
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
        headers: { 'User-Agent': 'Mozilla/5.0 AeroRescue/1.0', Accept: '*/*' },
      });

      const dispositionName = filenameFromDisposition(response.headers.get('content-disposition'));
      if (dispositionName) return dispositionName;

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('text/html')) {
        const html = await response.text();
        const embeddedName = extractDriveEmbeddedName(html);
        if (embeddedName) return embeddedName;
      }
    } catch {
      // Try the next Drive endpoint.
    }
  }

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
      headers: {
        'User-Agent': 'Mozilla/5.0 AeroRescue/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) return null;

    const html = await response.text();
    const embeddedName = extractDriveEmbeddedName(html);
    if (embeddedName) return embeddedName;

    const candidates = [
      html.match(/<meta[^>]+(?:property|name)=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>/i)?.[1],
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
    ];

    for (const candidate of candidates) {
      const cleaned = cleanMediaTitle(candidate)
        ?.replace(/\s+-\s+Google Drive\s*$/i, '')
        .replace(/\s+\|\s+Google Drive\s*$/i, '')
        .trim();
      if (cleaned) return cleaned;
    }
  } catch {
    // Return null so the UI can retain its configured fallback.
  }

  return null;
}

async function resolveDevMediaTitle(url: string) {
  try {
    const parsed = new URL(url);
    if (/youtube\.com$|youtu\.be$/i.test(parsed.hostname)) {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok) return null;
      const payload = (await response.json()) as { title?: string };
      return cleanMediaTitle(payload.title);
    }

    if (/drive\.google\.com$/i.test(parsed.hostname) || parsed.hostname.endsWith('.drive.google.com')) {
      return getDriveFilename(url);
    }
  } catch {
    return null;
  }
  return null;
}

function getDriveTargetUrl(fileId: string) {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
}

function driveVideoProxyPlugin(): Plugin {
  return {
    name: 'aerorescue-drive-video-proxy',
    configureServer(server) {
      server.middlewares.use('/api/drive-video', async (req, res) => {
        const requestUrl = new URL(req.url || '', 'http://localhost');
        const fileId = requestUrl.searchParams.get('id');

        if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Invalid Google Drive file id' }));
          return;
        }

        try {
          const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 AeroRescue/1.0',
            Accept: 'video/*,*/*;q=0.8',
          };
          const range = req.headers.range;
          if (range) headers.Range = range;

          const upstream = await fetch(getDriveTargetUrl(fileId), {
            method: req.method === 'HEAD' ? 'HEAD' : 'GET',
            redirect: 'follow',
            headers,
            signal: AbortSignal.timeout(30000),
          });

          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: `Google Drive returned HTTP ${upstream.status}` }));
            return;
          }

          const contentType = upstream.headers.get('content-type');
          const contentLength = upstream.headers.get('content-length');
          const contentRange = upstream.headers.get('content-range');
          const acceptRanges = upstream.headers.get('accept-ranges');

          res.statusCode = upstream.status;
          res.setHeader('Cache-Control', 'private, max-age=300');
          res.setHeader('Accept-Ranges', acceptRanges || 'bytes');
          if (contentType && !contentType.includes('text/html')) res.setHeader('Content-Type', contentType);
          if (contentLength) res.setHeader('Content-Length', contentLength);
          if (contentRange) res.setHeader('Content-Range', contentRange);

          if (req.method === 'HEAD' || !upstream.body) {
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
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Unable to stream Google Drive video' }));
          } else {
            res.end();
          }
        }
      });
    },
  };
}

function mediaMetadataDevPlugin(): Plugin {
  return {
    name: 'aerorescue-media-metadata-dev',
    configureServer(server) {
      server.middlewares.use('/api/media-metadata', async (req, res) => {
        const requestUrl = new URL(req.url || '', 'http://localhost');
        const mediaUrl = requestUrl.searchParams.get('url');
        if (!mediaUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Missing media URL' }));
          return;
        }

        const title = await resolveDevMediaTitle(mediaUrl);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ title }));
      });
    },
  };
}

function driveVideoIframeFixPlugin(): Plugin {
  const injection = `
<script>
(() => {
  const getDriveId = (src) => {
    const match = (src || '').match(/https?:\\/\\/drive\\.google\\.com\\/file\\/d\\/([^/]+)\\/(?:preview|view)/i);
    return match?.[1] || null;
  };

  const rewriteDriveIframe = (iframe) => {
    if (!(iframe instanceof HTMLIFrameElement)) return;
    const src = iframe.getAttribute('src') || '';
    const fileId = getDriveId(src);
    if (!fileId) return;

    const playerSrc = '/api/drive-player?id=' + encodeURIComponent(fileId);
    if (src === playerSrc || iframe.dataset.drivePlayerSrc === playerSrc) return;

    iframe.dataset.drivePlayerSrc = playerSrc;
    iframe.src = playerSrc;
  };

  const scan = () => {
    document.querySelectorAll('iframe[src*="drive.google.com/file/"]').forEach(rewriteDriveIframe);
  };

  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
</script>`;

  return {
    name: 'aerorescue-drive-video-playback-fix',
    transformIndexHtml(html) {
      return html.replace('</body>', `${injection}</body>`);
    },
  };
}

function drivePlayerPagePlugin(): Plugin {
  return {
    name: 'aerorescue-drive-player-page',
    configureServer(server) {
      server.middlewares.use('/api/drive-player', (req, res) => {
        const requestUrl = new URL(req.url || '', 'http://localhost');
        const fileId = requestUrl.searchParams.get('id');
        if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end('<!doctype html><html><body>Invalid Google Drive file id</body></html>');
          return;
        }

        const safeId = encodeURIComponent(fileId);
        const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#111}
video{width:100%;height:100%;display:block;background:#111;object-fit:contain}
</style>
</head>
<body>
<video controls playsinline preload="metadata" src="/api/drive-video?id=${safeId}"></video>
</body>
</html>`;

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(html);
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    driveVideoProxyPlugin(),
    mediaMetadataDevPlugin(),
    drivePlayerPagePlugin(),
    driveVideoIframeFixPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(import.meta.dirname, '..', '..', 'attached_assets'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
