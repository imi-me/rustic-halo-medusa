import { useRef } from 'react'
import type { ProductDraft } from '../lib/inline-edit'
import { HairClawImageDialog } from './hair-claw-image-dialog'
export function ProductImages({ productId, draft, change, add }: { productId: string; draft: ProductDraft; change: (draft: ProductDraft) => void; add: (files: FileList) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const move = (index: number, step: number) => {
    const images = [...draft.images]
    const [image] = images.splice(index, 1); images.splice(index + step, 0, image)
    change({ ...draft, images })
  }
  return <section className="rh-inline-card"><div className="rh-inline-section-heading"><h2>Images</h2><div className="rh-product-image-tools"><HairClawImageDialog productId={productId}/><button type="button" onClick={() => input.current?.click()}>+ Add images</button></div><input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden aria-label="Upload product images" onChange={event => { if (event.target.files) add(event.target.files); event.target.value = '' }}/></div><p>Choose a cover and arrange images. Changes save with the product.</p><div className="rh-product-images">{draft.images.map((image, index) => <div className={draft.thumbnail === image.url ? 'is-cover' : ''} key={image.key}><img src={image.url} alt={`Product image ${index + 1}`}/><div className="rh-image-actions"><button type="button" aria-pressed={draft.thumbnail === image.url} onClick={() => change({ ...draft, thumbnail: image.url })}>{draft.thumbnail === image.url ? 'Cover image' : 'Use as cover'}</button><div><button type="button" aria-label={`Move image ${index + 1} earlier`} disabled={index === 0} onClick={() => move(index, -1)}>←</button><button type="button" aria-label={`Move image ${index + 1} later`} disabled={index === draft.images.length - 1} onClick={() => move(index, 1)}>→</button><button type="button" aria-label={`Remove image ${index + 1}`} onClick={() => change({ ...draft, images: draft.images.filter(row => row.key !== image.key), thumbnail: draft.thumbnail === image.url ? draft.images.find(row => row.key !== image.key)?.url ?? '' : draft.thumbnail })}>Remove</button></div></div></div>)}</div>{!draft.images.length && <p>Add images to show this product in your store.</p>}</section>
}
export async function uploadProductImage(file: File): Promise<string> {
  const form = new FormData(); form.append('files', file)
  const response = await fetch('/admin/uploads', { method: 'POST', credentials: 'include', body: form })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !/^https?:\/\//.test(data.files?.[0]?.url ?? '')) throw new Error(data.message ?? 'Image upload could not be confirmed. Your draft is kept.')
  return data.files[0].url
}
