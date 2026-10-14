import { useRef, useState } from 'react'
import type { ProductDraft } from '../lib/inline-edit'
import type { CopyPhotoSelection } from '../lib/copy-photos'
import { ProductSection } from './product-section'
import { HairClawImageDialog } from './hair-claw-image-dialog'
export function ProductImages({ productId, draft, change, add, photos, hairClaw = false, fittingDisabled = false }: { productId: string; hairClaw?: boolean; fittingDisabled?: boolean; draft: ProductDraft; change: (draft: ProductDraft) => void; add: (files: FileList) => void; photos: CopyPhotoSelection }) {
  const input = useRef<HTMLInputElement>(null)
  const [managedKey, setManagedKey] = useState<string | null>(null)
  const [targetKey, setTargetKey] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const drag = useRef<{ key: string; x: number; y: number; target: string | null; moved: boolean } | null>(null)
  const managedIndex = draft.images.findIndex(image => image.key === managedKey)
  const move = (from: number, to: number) => {
    if (from < 0 || to < 0 || to >= draft.images.length || from === to) return
    const images = [...draft.images]
    const [image] = images.splice(from, 1); images.splice(to, 0, image)
    change({ ...draft, images }); setAnnouncement(`Image moved to position ${to + 1}.`)
  }
  return <ProductSection id={photos.galleryId} title="Images" className="rh-shared-images" actions={<div className="rh-product-image-tools">{hairClaw && productId !== 'new' && <HairClawImageDialog disabled={fittingDisabled} productId={productId}/>}<button type="button" onClick={() => input.current?.click()}>+ Add images</button></div>}>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden aria-label="Upload product images" onChange={event => { if (event.target.files) add(event.target.files); event.target.value = '' }}/>
    <div className="rh-gallery-ai"><label><input type="checkbox" checked={photos.enabled && !!draft.images.length} disabled={!draft.images.length} onChange={event => photos.setEnabled(event.target.checked)}/>Use product photos for AI</label><small>{photos.enabled && draft.images.length ? `${photos.selected.length}/${photos.available.length} selected · shared by website and Etsy writing` : 'Website and Etsy writing use text only'}</small><div className="rh-gallery-selection"><button type="button" disabled={!photos.enabled || !photos.available.length} onClick={() => photos.selectAll(true)}>Select all</button><button type="button" disabled={!photos.enabled || !photos.selected.length} onClick={() => photos.selectAll(false)}>Clear selection</button></div></div>
    <div className="rh-product-images" role="group" aria-label="Product photo gallery">{draft.images.map((image, index) => <div data-image-key={image.key} className={`${draft.thumbnail === image.url ? 'is-cover' : ''} ${targetKey === image.key ? 'is-drop-target' : ''}`} key={image.key}>
      <button type="button" className="rh-image-drag" aria-label={`Reorder image ${index + 1}`} title="Drag to reorder, or use arrow keys" aria-describedby={`${photos.galleryId}-instructions`}
        onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { key: image.key, x: event.clientX, y: event.clientY, target: null, moved: false } }}
        onPointerMove={event => {
          const current = drag.current; if (!current || current.key !== image.key) return
          if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6 && !current.moved) return
          current.moved = true
          const target = document.elementsFromPoint(event.clientX, event.clientY).map(element => element.closest<HTMLElement>('[data-image-key]')).find(element => element?.closest('.rh-shared-images')?.id === photos.galleryId)
          current.target = target?.dataset.imageKey ?? null; setTargetKey(current.target)
        }}
        onPointerUp={() => { const current = drag.current; if (current?.moved && current.target) move(draft.images.findIndex(row => row.key === current.key), draft.images.findIndex(row => row.key === current.target)); drag.current = null; setTargetKey(null) }}
        onPointerCancel={() => { drag.current = null; setTargetKey(null) }}
        onKeyDown={event => { const step = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 0; if (step) { event.preventDefault(); move(index, index + step) } }}>⠿</button>
      <img draggable={false} src={image.url} alt={`Product image ${index + 1}`}/>
      <div className="rh-image-actions">
        <div className="rh-image-top-actions"><button type="button" aria-label={draft.thumbnail === image.url ? 'Cover image' : `Use image ${index + 1} as cover`} aria-pressed={draft.thumbnail === image.url} onClick={() => change({ ...draft, thumbnail: image.url })}>{draft.thumbnail === image.url ? 'Cover' : 'Set cover'}</button>
          <button type="button" className="rh-image-menu-button" aria-label={`Manage image ${index + 1}`} aria-expanded={managedKey === image.key} onClick={() => setManagedKey(managedKey === image.key ? null : image.key)}>⋯</button>
        </div>
        <label className="rh-image-ai"><input type="checkbox" aria-label={`Use photo ${index + 1} for AI`} checked={photos.selected.includes(image.url)} disabled={!photos.enabled} onChange={event => photos.select(image.url, event.target.checked)}/>Use for AI</label>
      </div>
    </div>)}</div>
    {managedIndex >= 0 && <div className="rh-image-management" role="group" aria-label={`Manage image ${managedIndex + 1}`}>
      <strong>Image {managedIndex + 1}</strong>
      <button type="button" aria-label={`Remove image ${managedIndex + 1}`} onClick={() => { const image = draft.images[managedIndex]; change({ ...draft, images: draft.images.filter(row => row.key !== image.key), thumbnail: draft.thumbnail === image.url ? draft.images.find(row => row.key !== image.key)?.url ?? '' : draft.thumbnail }); setManagedKey(null) }}>Remove image</button>
      <button type="button" onClick={() => setManagedKey(null)}>Done</button>
    </div>}
    <p id={`${photos.galleryId}-instructions`} className="rh-gallery-hint">Drag the grip to reorder images. Keyboard: focus a grip and use arrow keys.</p><span className="rh-sr-only" role="status">{announcement}</span>
    <small>Cover and gallery changes save with the product. AI selections are shared by both writing helpers.</small>
    {!draft.images.length && <p>Add images to show this product in your store.</p>}
  </ProductSection>
}
export async function uploadProductImage(file: File): Promise<string> {
  const form = new FormData(); form.append('files', file)
  const response = await fetch('/admin/uploads', { method: 'POST', credentials: 'include', body: form })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !/^https?:\/\//.test(data.files?.[0]?.url ?? '')) throw new Error(data.message ?? 'Image upload could not be confirmed. Your draft is kept.')
  return data.files[0].url
}
