import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = resolve(__dirname, '..', 'public', 'icons')
const svgPath = resolve(iconsDir, 'icon.svg')
const svg = readFileSync(svgPath)

const sizes = [16, 32, 48, 128]

for (const size of sizes) {
  const outPath = resolve(iconsDir, `icon-${size}.png`)
  await sharp(svg, { density: 512 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath)
  console.log(`wrote ${outPath}`)
}
