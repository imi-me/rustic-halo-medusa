import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { MedusaError, Modules } from '@medusajs/framework/utils'
import { IFileModuleService } from '@medusajs/framework/types'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'

// Accept image bytes, never fetch a supplied URL (including private network URLs).
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const data = (req.body as { content?: unknown })?.content
  if (typeof data !== 'string' || data.length > 12_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Upload a transparent PNG under 8 MB.')
  }
  const input = Buffer.from(data, 'base64')
  if (input.length > 8_000_000) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Maximum upload size is 8 MB.')
  let output: Buffer
  let width: number
  let height: number
  let vertical = false
  try {
    const source = sharp(input, { limitInputPixels: 24_000_000 })
    const meta = await source.metadata()
    if (meta.format !== 'png' || !meta.hasAlpha || !meta.width || !meta.height || meta.width > 6000 || meta.height > 6000 || (meta.pages || 1) !== 1) throw Error('format')
    const stats = await source.stats()
    if (stats.channels[stats.channels.length - 1].min !== 0 || stats.channels[stats.channels.length - 1].max < 200) throw Error('alpha')
    // Normalize orientation, color space and transparent padding; no art warping.
    const normalized = await source.rotate().toColourspace('srgb').trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true })
    output = normalized.data
    width = normalized.info.width
    height = normalized.info.height
    if (height > width) {
      output = await sharp(output).rotate(90).png().toBuffer()
      ;[width, height] = [height, width]
      vertical = true
    }
  } catch {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Use a still, transparent PNG of the whole wood overlay (maximum 6000 px / 24 MP). Remove the background first.')
  }
  const files: IFileModuleService = req.scope.resolve(Modules.FILE)
  const file = await files.createFiles({ filename: `hair-claw-overlay-${randomUUID()}.png`, mimeType: 'image/png', content: output.toString('base64'), access: 'public' })
  res.json({ file_id: file.id, url: file.url, width, height, vertical })
}
