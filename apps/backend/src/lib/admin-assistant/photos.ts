import sharp from 'sharp'

export class CopyPhotoError extends Error {}
export const MAX_COPY_PHOTO_BYTES = 4_500_000
export function publicCopyPhoto(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash &&
      ['cdn.rustichalo.com', 'cdn.shopify.com'].includes(url.hostname) &&
      [...url.searchParams.keys()].every(key => ['v', 'width', 'height', 'crop', 'format'].includes(key))
  } catch { return false }
}

// Remote photos go directly from the approved public CDN to the AI provider.
// This backend never fetches a user-supplied URL or forwards cookies/credentials.
export async function prepareCopyPhotos(photos: string[]) {
  if (new Set(photos).size !== photos.length) throw new CopyPhotoError('Choose different product photos.')
  if (photos.reduce((size, photo) => size + Buffer.byteLength(photo), 0) > MAX_COPY_PHOTO_BYTES)
    throw new CopyPhotoError('Selected photo previews are too large together. Use smaller photos or select fewer newly added images.')
  const result: string[] = []
  // Process previews sequentially so selecting many photos cannot multiply Sharp memory use.
  for (const photo of photos) {
    if (publicCopyPhoto(photo)) { result.push(photo); continue }
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo) || photo.length > 1_400_000)
      throw new CopyPhotoError('Use product photos from Rustic Halo or Shopify, or newly added JPEG, PNG or WebP photos.')
    try {
      const bytes = Buffer.from(photo.split(',')[1], 'base64')
      if (bytes.length > 1_000_000 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw new Error()
      const image = sharp(bytes, { limitInputPixels: 4_000_000, failOn: 'error' })
      const metadata = await image.metadata()
      if (!metadata.width || !metadata.height || (metadata.pages || 1) !== 1) throw new Error()
      const prepared = await image.rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer()
      result.push(`data:image/jpeg;base64,${prepared.toString('base64')}`)
    } catch { throw new CopyPhotoError('A selected photo could not be read. Choose a still photo under 4 megapixels after resizing.') }
  }
  return result
}
