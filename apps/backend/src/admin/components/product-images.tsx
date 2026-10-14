import { useRef, useState } from 'react'
import type { ProductDraft } from '../lib/inline-edit'
import type { CopyPhotoSelection } from '../lib/copy-photos'
import { HairClawImageDialog } from './hair-claw-image-dialog'
export function ProductImages({ productId, draft, change, add, photos, hairClaw = false, fittingDisabled = false }: { productId: string; hairClaw?: boolean; fittingDisabled?: boolean; draft: ProductDraft; change: (draft: ProductDraft) => void; add: (files: FileList) => void; photos: CopyPhotoSelection }) {
  const input = useRef<HTMLInputElement>(null)
  const [managedKey, setManagedKey] = useState<string | null>(null)
  const managedIndex = draft.images.findIndex(image => image.key === managedKey)
  const move = (index: number, step: number) => {
    const images = [...draft.images]
    const [image] = images.splice(index, 1); images.splice(index + step, 0, image)
    change({ ...draft, images })
  }
  return <section id={photos.galleryId} className="rh-inline-card rh-shared-images" aria-label="Product images">
    <div className="rh-inline-section-heading"><h2>Images</h2><div className="rh-product-image-tools">{hairClaw && productId !== 'new' && <HairClawImageDialog disabled={fittingDisabled} productId={productId}/>}<button type="button" onClick={() => input.current?.click()}>+ Add images</button></div></div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden aria-label="Upload product images" onChange={event => { if (event.target.files) add(event.target.files); event.target.value = '' }}/>
    <div className="rh-gallery-ai"><label><input type="checkbox" checked={photos.enabled && !!draft.images.length} disabled={!draft.images.length} onChange={event => photos.setEnabled(event.target.checked)}/>Use product photos for AI</label><small>{photos.enabled && draft.images.length ? `${photos.selected.length}/3 selected · shared by website and Etsy writing` : 'Website and Etsy writing use text only'}</small></div>
    <div className="rh-product-images" role="group" aria-label="Product photo gallery">{draft.images.map((image, index) => <div className={draft.thumbnail === image.url ? 'is-cover' : ''} key={image.key}>
      <img src={image.url} alt={`Product image ${index + 1}`}/>
      <div className="rh-image-actions">
        <div className="rh-image-top-actions"><button type="button" aria-label={draft.thumbnail === image.url ? 'Cover image' : `Use image ${index + 1} as cover`} aria-pressed={draft.thumbnail === image.url} onClick={() => change({ ...draft, thumbnail: image.url })}>{draft.thumbnail === image.url ? 'Cover' : 'Set cover'}</button>
          <button type="button" className="rh-image-menu-button" aria-label={`Manage image ${index + 1}`} aria-expanded={managedKey === image.key} onClick={() => setManagedKey(managedKey === image.key ? null : image.key)}>⋯</button>
        </div>
        <label className="rh-image-ai"><input type="checkbox" aria-label={`Use photo ${index + 1} for AI`} checked={photos.selected.includes(image.url)} disabled={!photos.enabled || (!photos.selected.includes(image.url) && photos.selected.length >= 3)} onChange={event => photos.select(image.url, event.target.checked)}/>Use for AI</label>
      </div>
    </div>)}</div>
    {managedIndex >= 0 && <div className="rh-image-management" role="group" aria-label={`Manage image ${managedIndex + 1}`}>
      <strong>Image {managedIndex + 1}</strong>
      <button type="button" aria-label={`Move image ${managedIndex + 1} earlier`} disabled={managedIndex === 0} onClick={() => move(managedIndex, -1)}>Move earlier</button>
      <button type="button" aria-label={`Move image ${managedIndex + 1} later`} disabled={managedIndex === draft.images.length - 1} onClick={() => move(managedIndex, 1)}>Move later</button>
      <button type="button" aria-label={`Remove image ${managedIndex + 1}`} onClick={() => { const image = draft.images[managedIndex]; change({ ...draft, images: draft.images.filter(row => row.key !== image.key), thumbnail: draft.thumbnail === image.url ? draft.images.find(row => row.key !== image.key)?.url ?? '' : draft.thumbnail }); setManagedKey(null) }}>Remove image</button>
      <button type="button" onClick={() => setManagedKey(null)}>Done</button>
    </div>}
    <small>Cover and gallery changes save with the product. AI selections are shared by both writing helpers.</small>
    {!draft.images.length && <p>Add images to show this product in your store.</p>}
  </section>
}
export async function uploadProductImage(file: File): Promise<string> {
  const form = new FormData(); form.append('files', file)
  const response = await fetch('/admin/uploads', { method: 'POST', credentials: 'include', body: form })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !/^https?:\/\//.test(data.files?.[0]?.url ?? '')) throw new Error(data.message ?? 'Image upload could not be confirmed. Your draft is kept.')
  return data.files[0].url
}
