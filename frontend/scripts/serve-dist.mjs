// Static server for the built SPA. Replaces frontend/nginx.conf on Railpack.
// Keep the rules here in line with nginx.conf: the association files must be
// served in place with a JSON content type and no redirect, and the HTML
// fallback carries the same CSP report-only header.
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const port = Number(process.env.PORT) || 3000

const associationFiles = new Map([
  ['/.well-known/apple-app-site-association', '.well-known/apple-app-site-association'],
  ['/apple-app-site-association', 'apple-app-site-association'],
  ['/.well-known/assetlinks.json', '.well-known/assetlinks.json'],
])

const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://api.murihspace.com https://api-staging.murihspace.com https://graph.murihspace.com https://graph-staging.murihspace.com https://ads.murihspace.com https://staging.murihspace.com wss://api.murihspace.com wss://api-staging.murihspace.com wss://livekit.murihspace.com",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

async function sendFile(res, file, headers) {
  const info = await stat(file).catch(() => null)
  if (!info?.isFile()) return false
  res.writeHead(200, {
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
    'Content-Length': info.size,
    ...headers,
  })
  createReadStream(file).pipe(res)
  return true
}

async function sendIndex(res) {
  const sent = await sendFile(res, join(root, 'index.html'), {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Content-Security-Policy-Report-Only': csp,
  })
  if (!sent) {
    res.writeHead(404).end('index.html missing: run the build first')
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const pathname = decodeURIComponent(url.pathname)

    const associated = associationFiles.get(pathname)
    if (associated) {
      const sent = await sendFile(res, join(root, associated), {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      })
      if (!sent) res.writeHead(404).end()
      return
    }

    const file = normalize(join(root, pathname))
    if (file.startsWith(root + sep) && pathname !== '/') {
      const cache = pathname.startsWith('/assets/')
        ? { 'Cache-Control': 'public, max-age=31536000, immutable' }
        : {}
      if (await sendFile(res, file, cache)) return
    }

    await sendIndex(res)
  } catch {
    res.writeHead(404).end()
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`serving ${root} on :${port}`)
})
