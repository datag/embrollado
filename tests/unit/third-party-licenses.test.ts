import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The licences of the bundled components. Every runtime dependency ships inside the browser bundle,
 * so its licence must allow redistribution under the MIT Licence and its copyright notice must be
 * listed in `THIRD_PARTY_LICENSES.md` (see the "Third-party licences" rule in AGENTS.md).
 *
 * The copy in `public/` is what the deployed app serves; it must stay byte-identical to the source
 * so that the notices really travel with the distribution.
 */

const root = path.resolve(import.meta.dirname, '../..')
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8')

/**
 * Licences that may be redistributed inside an MIT-licensed application. The GPL family (GPL, AGPL,
 * LGPL) is deliberately absent: a copyleft of that strength cannot be combined with the MIT Licence
 * of the application as a whole.
 */
const ALLOWED_LICENCES = new Set([
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'BlueOak-1.0.0',
  'MPL-2.0',
  'CC0-1.0',
  'Python-2.0',
  'Zlib',
  'Unlicense',
  'WTFPL',
])

/** The SPDX identifiers of a licence field, e.g. '(MPL-2.0 OR Apache-2.0)' → two ids. */
function licenceIds(licence: string): string[] {
  return licence
    .replace(/[()]/g, '')
    .split(' OR ')
    .map((id) => id.trim())
    .filter(Boolean)
}

/** The rows of the markdown tables in the notices file, as cell arrays. */
function tableRows(markdown: string): string[][] {
  return markdown
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.length >= 5 && !cells[0].startsWith('-'))
}

const notices = read('THIRD_PARTY_LICENSES.md')
const rows = tableRows(notices)
const pkg = JSON.parse(read('package.json')) as {
  license: string
  dependencies: Record<string, string>
}

describe('third-party licences', () => {
  it('licenses the application itself under the MIT Licence', () => {
    expect(pkg.license).toBe('MIT')
    expect(read('LICENSE')).toMatch(/^MIT License/)
  })

  it('lists every runtime dependency with its version and licence', () => {
    for (const name of Object.keys(pkg.dependencies)) {
      const manifest = JSON.parse(read(path.join('node_modules', name, 'package.json'))) as {
        version: string
        license?: string
        licenses?: { type: string }[]
      }

      const licence = manifest.license ?? manifest.licenses?.map((l) => l.type).join(' OR ') ?? ''
      const row = rows.find((cells) => cells[0] === name)

      expect(row, `${name} is missing from THIRD_PARTY_LICENSES.md`).toBeDefined()
      expect(row?.[2], `${name}: wrong version in THIRD_PARTY_LICENSES.md`).toBe(manifest.version)

      for (const id of licenceIds(licence)) {
        expect(
          row?.[3],
          `${name}: licence ${id} is not named in THIRD_PARTY_LICENSES.md`,
        ).toContain(id)
      }
    }
  })

  it('only bundles dependencies whose licence allows redistribution under MIT', () => {
    for (const name of Object.keys(pkg.dependencies)) {
      const manifest = JSON.parse(read(path.join('node_modules', name, 'package.json'))) as {
        license?: string
        licenses?: { type: string }[]
      }

      const licence = manifest.license ?? manifest.licenses?.map((l) => l.type).join(' OR ') ?? ''
      for (const id of licenceIds(licence)) {
        expect(
          ALLOWED_LICENCES.has(id),
          `${name} is licensed under ${id}, which cannot be combined with the MIT Licence`,
        ).toBe(true)
      }
    }
  })

  it('names the bundled font and its Open Font Licence', () => {
    expect(notices).toContain('Atkinson Hyperlegible Next')
    expect(notices).toContain('SIL Open Font License 1.1')
  })

  it('ships the licence files with the app, identical to their sources', () => {
    const pairs: Array<[string, string]> = [
      ['THIRD_PARTY_LICENSES.md', 'public/THIRD_PARTY_LICENSES.md'],
      ['LICENSE', 'public/LICENSE'],
      ['src/assets/fonts/LICENSES/OFL.txt', 'public/LICENSES/OFL.txt'],
      ['src/assets/fonts/LICENSES/NOTICE.md', 'public/LICENSES/NOTICE.md'],
    ]

    for (const [source, shipped] of pairs) {
      expect(existsSync(path.join(root, shipped)), `${shipped} is missing`).toBe(true)
      expect(read(shipped), `${shipped} differs from ${source}`).toBe(read(source))
    }
  })
})
