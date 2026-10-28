#!/usr/bin/env node
/**
 * Dependency-free static server for the built app.
 *
 * Serves `dist/` and sets the strict Content-Security-Policy from `embrollado.config.json`
 * (key `allowedApiOrigin`), so `connect-src` contains the learner's runtime-configured API
 * origin. The header cannot be expressed by a static host — that is why this helper exists.
 *
 *   node tools/serve.mjs            # port 4174, reads ./embrollado.config.json
 *   PORT=8080 node tools/serve.mjs
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const distDir = join(root, 'dist')
const PORT = Number(process.env.PORT ?? 4174)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
}

function defaultPolicy(apiOrigin) {
  const connect = apiOrigin ? `connect-src 'self' ${apiOrigin}` : `connect-src 'self'`
  return [
    `default-src 'self'`,
    `script-src 'self'`,
    `style-src 'self'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    connect,
    `worker-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ')
}

function resolvePath(pathname) {
  const clean = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(distDir, clean)
  if (filePath === distDir) filePath = join(distDir, 'index.html')
  if (!existsSync(filePath)) return null
  const s = statSync(filePath)
  if (s.isDirectory()) return join(filePath, 'index.html')
  return filePath
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' })
    res.end()
    return
  }

  let config = { allowedApiOrigin: '' }
  try {
    config = JSON.parse(await readFile(join(root, 'embrollado.config.json'), 'utf8'))
  } catch {
    /* no config file — CSP carries no allowed API origin */
  }

  let csp
  try {
    csp = (await readFile(join(distDir, '.csp.txt'), 'utf8')).trim()
  } catch {
    csp = defaultPolicy(config.allowedApiOrigin)
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)
  const filePath = resolvePath(url.pathname)
  if (!filePath) {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
    return
  }

  res.writeHead(200, {
    'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'content-security-policy': csp,
    'cache-control':
      filePath.startsWith(join(distDir, 'assets')) || filePath.endsWith('.woff2')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    'x-content-type-options': 'nosniff',
  })
  createReadStream(filePath).pipe(res)
})

server.listen(PORT, () => {
  console.log(
    `embrollado static server on http://localhost:${PORT} (CSP from embrollado.config.json)`,
  )
})
