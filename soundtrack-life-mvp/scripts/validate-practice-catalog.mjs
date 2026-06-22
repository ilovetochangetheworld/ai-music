import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const publicDir = path.resolve('public')
const catalog = JSON.parse(await readFile(path.join(publicDir, 'catalog/index.json'), 'utf8'))
const strict = process.argv.includes('--strict')
const errors = []
const warnings = []

for (const song of catalog.songs ?? []) {
  if (song.availability !== 'ready') continue
  try {
    const manifestPath = path.join(publicDir, song.manifestUrl)
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    if (manifest.id !== song.id) errors.push(`${song.id}: manifest id mismatch`)
    for (const [key, relative] of Object.entries(manifest.assets ?? {})) {
      try { await access(path.join(publicDir, relative)) } catch { errors.push(`${song.id}: missing ${key} asset ${relative}`) }
    }
    const notes = JSON.parse(await readFile(path.join(publicDir, manifest.assets.notes), 'utf8'))
    if (notes.reviewStatus !== 'reviewed') warnings.push(`${song.id}: reference notes status is ${notes.reviewStatus || 'missing'}, expected reviewed`)
    else if (!Array.isArray(notes.notes) || notes.notes.length === 0) errors.push(`${song.id}: reviewed reference notes are empty`)
  } catch (error) {
    errors.push(`${song.id}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

for (const warning of warnings) console.warn(`WARN ${warning}`)
for (const error of errors) console.error(`ERROR ${error}`)
if (errors.length || (strict && warnings.length)) process.exitCode = 1
else console.log(`Catalog valid: ${catalog.songs?.length ?? 0} entries, ${warnings.length} review warning(s).`)
