#!/usr/bin/env node
/**
 * Enforces the constitution's JavaScript budget: the gzipped size of every chunk in dist/assets
 * must stay at or below BUDGET_KB (default 250). Runs in CI and locally. Exits non-zero on
 * violation so the gate can fail.
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const assetsDir = join(root, 'dist', 'assets')
const budgetKb = Number(process.env.BUDGET_KB ?? 250)

let names
try {
  names = await readdir(assetsDir)
} catch {
  console.error(`check-bundle-size: ${assetsDir} does not exist. Run "pnpm build" first.`)
  process.exit(1)
}

const jsFiles = names.filter((n) => n.endsWith('.js'))
if (jsFiles.length === 0) {
  console.error('check-bundle-size: no .js files in dist/assets.')
  process.exit(1)
}

let total = 0
const rows = []
for (const name of jsFiles) {
  const file = join(assetsDir, name)
  const raw = await readFile(file)
  const gz = gzipSync(raw, { level: 9 }).length
  total += gz
  const size = await stat(file)
  rows.push({ name, raw: raw.length, gz, shares: false })
}

const budgetBytes = budgetKb * 1024
const pass = total <= budgetBytes

for (const r of rows) {
  console.log(
    `${(r.gz / 1024).toFixed(1).padStart(7)} KB gzip  ${(r.raw / 1024).toFixed(1).padStart(7)} KB raw  ${r.name}`,
  )
}
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB gzip  total (budget ${budgetKb} KB)`)
if (!pass) {
  console.error(`check-bundle-size: FAIL — ${(total / 1024).toFixed(1)} KB exceeds ${budgetKb} KB.`)
  process.exit(1)
}
console.log('check-bundle-size: PASS')
