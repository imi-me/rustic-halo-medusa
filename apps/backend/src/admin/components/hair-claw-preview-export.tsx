import { useEffect, useRef, useState } from 'react'
import { adminRequest, type Entity } from '../lib/inline-edit'
import { uploadProductImage } from './product-images'
export function HairClawPreviewExport({
  product,
  variant,
  accept,
}: {
  product: Entity
  variant: Entity
  accept: (url: string) => void
}) {
  const [origin, setOrigin] = useState('')
  const [busy, setBusy] = useState(false)
  const [image, setImage] = useState('')
  const [error, setError] = useState('')
  const [requestId, setRequestId] = useState('')
  const frame = useRef<HTMLIFrameElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    void adminRequest(`/admin/products/${product.id}/hair-claw-media`)
      .then((data) => {
        const address = new URL(data.preview_origin)
        if (['https:', 'http:'].includes(address.protocol)) setOrigin(address.origin)
      })
      .catch(() => setError('Connect the storefront preview before exporting color images.'))
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [product.id])
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== origin ||
        event.source !== frame.current?.contentWindow ||
        event.data?.type !== 'hair-claw-export-result' ||
        event.data.requestId !== requestId
      )
        return
      if (timer.current) clearTimeout(timer.current)
      if (
        typeof event.data.image === 'string' &&
        event.data.image.startsWith('data:image/png;base64,') &&
        event.data.image.length < 14000000
      )
        setImage(event.data.image)
      else setError(event.data.error || 'The preview could not be exported.')
      setBusy(false)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [origin, requestId])
  const generate = () => {
    const size = String(
      variant.metadata?.physical_size ??
        variant.options?.find((option: Entity) =>
          /size/i.test(
            option.option?.title ??
              product.options?.find((row: Entity) => row.id === option.option_id)?.title ??
              '',
          ),
        )?.value ??
        '',
    ).match(/\d/)?.[0]
    const finish = variant.metadata?.claw_finish ?? 'natural'
    const recipe =
      product.metadata?.hair_claw_overlays_v1?.recipes?.[`${size}-${finish}`] ??
      product.metadata?.hair_claw_overlays_v1?.recipes?.[size!]
    const color = String(
      variant.metadata?.base_claw_color ??
        variant.options?.find((option: Entity) =>
          /colou?r/i.test(
            option.option?.title ??
              product.options?.find((row: Entity) => row.id === option.option_id)?.title ??
              '',
          ),
        )?.value ??
        '',
    ).toLowerCase()
    if (!recipe?.enabled) {
      setError('Save and enable the artwork fit for this size/finish before exporting.')
      return
    }
    const id = crypto.randomUUID()
    setRequestId(id)
    setBusy(true)
    setError('')
    setImage('')
    frame.current?.contentWindow?.postMessage(
      { type: 'hair-claw-export', requestId: id, recipe, size, color },
      origin,
    )
    timer.current = setTimeout(() => {
      setBusy(false)
      setError('Color rendering timed out. Check the storefront preview connection.')
    }, 25000)
  }
  const upload = async () => {
    setBusy(true)
    setError('')
    try {
      const bytes = Uint8Array.from(atob(image.split(',')[1]), (character) =>
        character.charCodeAt(0),
      )
      const url = await uploadProductImage(
        new File([bytes], `etsy-${variant.sku}.png`, { type: 'image/png' }),
      )
      accept(url)
      setImage('')
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <button type="button" disabled={busy || !origin} onClick={generate}>
        {busy ? 'Preparing preview…' : 'Generate color preview image'}
      </button>
      {origin && (
        <iframe
          ref={frame}
          src={`${origin}/previews/shared-hair-claw/export.html`}
          title={`${variant.title} color image renderer`}
          style={{ display: 'none' }}
        />
      )}
      <small>
        Uses the saved artwork fit and approved palette. Review this mockup before sharing.
      </small>
      {image && (
        <div>
          <img src={image} alt={`${variant.title} generated preview for review`} />
          <button type="button" disabled={busy} onClick={() => void upload()}>
            Use approved preview
          </button>
          <button type="button" onClick={() => setImage('')}>
            Discard preview
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
