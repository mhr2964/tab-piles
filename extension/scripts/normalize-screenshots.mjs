import sharp from 'sharp'
import { readdirSync } from 'node:fs'
import { resolve, dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(__dirname, '..', '..', 'listing', 'screenshots')

// CWS standard sizes: 1280x800 or 640x400. Use 1280x800.
const TARGET_W = 1280
const TARGET_H = 800

const bg = await sharp({
  create: {
    width: TARGET_W,
    height: TARGET_H,
    channels: 4,
    background: { r: 238, g: 242, b: 246, alpha: 1 },
  },
})
  .composite([
    {
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TARGET_W} ${TARGET_H}">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#eef2f6"/>
              <stop offset="100%" stop-color="#d4dde6"/>
            </linearGradient>
            <radialGradient id="r" cx="80%" cy="20%" r="50%">
              <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.15"/>
              <stop offset="100%" stop-color="#F59E0B" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#g)"/>
          <rect width="100%" height="100%" fill="url(#r)"/>
        </svg>`,
      ),
      top: 0,
      left: 0,
    },
  ])
  .png()
  .toBuffer()

const files = readdirSync(srcDir).filter((f) => /^cws-\d+-.+\.png$/.test(f) && !f.endsWith('.1280x800.png'))

for (const f of files) {
  const inputPath = join(srcDir, f)
  const meta = await sharp(inputPath).metadata()
  const srcW = meta.width
  const srcH = meta.height
  // Fit into a centered region that's 80% of target height, preserve aspect
  const targetH = Math.round(TARGET_H * 0.92)
  const scale = targetH / srcH
  const scaledW = Math.round(srcW * scale)
  const scaledH = targetH
  const resized = await sharp(inputPath)
    .resize(scaledW, scaledH, { fit: 'fill' })
    .png()
    .toBuffer()

  const outPath = join(srcDir, basename(f, '.png') + '.1280x800.png')
  await sharp(bg)
    .composite([
      {
        input: resized,
        top: Math.round((TARGET_H - scaledH) / 2),
        left: Math.round((TARGET_W - scaledW) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outPath)
  console.log(`${f} (${srcW}x${srcH}) -> ${basename(outPath)}`)
}
