// Builds extension/dist/ via Vite, then zips it to extension/dist.zip ready for
// Chrome Web Store upload. Excludes sourcemaps + .DS_Store. Reports final size.
//
// Usage: npm run zip

import { execSync } from 'node:child_process'
import { createWriteStream, statSync, existsSync, unlinkSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import archiver from 'archiver'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const distDir = resolve(root, 'dist')
const outZip = resolve(root, 'dist.zip')

console.log('▸ npm run build')
execSync('npm run build', { cwd: root, stdio: 'inherit' })

if (existsSync(outZip)) unlinkSync(outZip)

await new Promise((res, rej) => {
  const archive = archiver('zip', { zlib: { level: 9 } })
  const stream = createWriteStream(outZip)
  archive.on('error', rej)
  stream.on('close', res)
  archive.pipe(stream)
  archive.glob('**/*', {
    cwd: distDir,
    ignore: ['**/*.map', '**/.DS_Store', '**/Thumbs.db'],
    dot: false,
  })
  archive.finalize()
})

const bytes = statSync(outZip).size
const kb = (bytes / 1024).toFixed(1)
console.log(`\n▸ wrote ${outZip}`)
console.log(`▸ size: ${kb} KB`)
if (bytes > 5 * 1024 * 1024) {
  console.warn('▸ WARNING: zip > 5 MB. CWS allows up to 200 MB but a small zip is a trust signal.')
}
