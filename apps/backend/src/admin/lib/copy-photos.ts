export type CopyPhoto = { url: string }
export function copyPhotoChoices(images: CopyPhoto[], thumbnail = '') {
  const urls = images.map(image => image.url).filter(Boolean)
  if (thumbnail && !urls.includes(thumbnail)) urls.unshift(thumbnail)
  return [...new Set(urls)].sort((a, b) => Number(b === thumbnail) - Number(a === thumbnail))
}

export async function copyPhotoSource(url: string): Promise<string> {
  if (!url.startsWith('blob:')) return url
  // New uploads remain local until Save. Send only a resized preview to AI.
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Photo preparation timed out. Try another photo.')), 10000)
    image.onload = () => { clearTimeout(timeout); resolve() }
    image.onerror = () => { clearTimeout(timeout); reject(new Error('A new photo could not be read. Try another photo.')) }
    image.src = url
  })
  const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Photo preparation is unavailable in this browser.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const photo = canvas.toDataURL('image/jpeg', 0.82)
  if (photo.length > 1_400_000) throw new Error('This photo is too large for AI. Choose a smaller photo.')
  return photo
}
