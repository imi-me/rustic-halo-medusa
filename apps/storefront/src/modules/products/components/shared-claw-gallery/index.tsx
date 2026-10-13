"use client"

import { HttpTypes } from '@medusajs/types'
import { useSearchParams } from 'next/navigation'
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import GoldenLoveGallery from '@modules/products/components/golden-love-gallery'
import ApprovedClawGallery from '@modules/products/components/approved-claw-gallery'
import { approvedClawPreviews, ApprovedClawHandle } from '@lib/brand/approved-claw-previews'
import { healingHeartsColors } from '@lib/brand/healing-hearts-colors'
import ClawColorPicker from '@modules/products/components/claw-color-picker'
import GalleryControls from '@modules/products/components/gallery-controls'
import { resolveHairClawSize } from '@lib/util/hair-claw-size'
import { useHappyCowPreview } from '@modules/products/components/happy-cow-color-preview-context'
import { hairClawTemplate } from '@lib/util/hair-claw-template'
import ClawMediaGallery from '@modules/products/components/claw-media-gallery'

type Recipe = { url:string; width:number; height:number; scale:number; x:number; y:number; vertical:boolean; enabled:boolean; editor_version?:2 }
export default function SharedClawGallery({product, children}: {product:HttpTypes.StoreProduct; children:ReactNode}) {
  const params = useSearchParams()
  const { productSelection } = useHappyCowPreview()
  const template = hairClawTemplate(product)
  const variants = product.variants || []
  const variant = variants.find(v => v.id === params.get('v_id')) || (variants.length === 1 ? variants[0] : undefined)
  const sizeOption = product.options?.find(o => o.title?.trim().toLowerCase() === 'size')
  const colorOption = product.options?.find(o => ['color','colour'].includes(o.title?.trim().toLowerCase() || ''))
  const finishOption = product.options?.find(o => o.id === template?.finish_option_id)
  const localOptions = productSelection?.productId === product.id ? productSelection.options : undefined
  const selectedSize = sizeOption ? localOptions?.[sizeOption.id] || variant?.options?.find(o => o.option_id === sizeOption.id)?.value : undefined
  const selectedColor = (colorOption ? localOptions?.[colorOption.id] || variant?.options?.find(o => o.option_id === colorOption.id)?.value : undefined)?.toLowerCase()
  const settings = product.metadata?.hair_claw_overlays_v1 as {recipes?:Record<string,Recipe>} | undefined
  // Admin explicitly records the reviewed physical size for products without a Size option.
  const reviewedFour = settings?.recipes?.['4']
  // Show the reviewed 4-inch fit before shoppers complete their choices. An
  // explicit other/unknown size always wins and never borrows the 4-inch fit.
  const size = resolveHairClawSize({
    selectedSize,
    sizeValues: sizeOption ? (sizeOption.values || []).map(v => v.value) : undefined,
    reviewedFour: reviewedFour?.editor_version === 2 && Boolean(reviewedFour.enabled),
  })
  const selectedFinish = finishOption ? localOptions?.[finishOption.id] || variant?.options?.find(o => o.option_id === finishOption.id)?.value || finishOption.values?.[0]?.value : undefined
  const finish = selectedFinish === 'Colors by Cate' ? 'cbc' : selectedFinish === 'Natural' ? 'natural' : undefined
  const recipe = size ? settings?.recipes?.[template?.offer_mode ? `${size}-${finish}` : size] : undefined
  const [previewColor,setPreviewColor] = useState('taupe')
  const [failed,setFailed] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  useEffect(() => {setPreviewColor(healingHeartsColors.find(c=>c.slug===selectedColor)?.slug || 'taupe');setFailed(false)}, [selectedColor, size, finish, recipe?.url])
  const send = useCallback(() => {
    if (recipe) frame.current?.contentWindow?.postMessage({type:'hair-claw-preview',recipe,size,color:previewColor,outline:false}, window.location.origin)
  }, [recipe,size,previewColor])
  useEffect(() => {
    send()
    const ready = (event:MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== window.location.origin) return
      if (event.data?.type === 'hair-claw-preview-ready') send()
      if (event.data?.type === 'hair-claw-preview-error') setFailed(true)
    }
    window.addEventListener('message',ready)
    return () => window.removeEventListener('message',ready)
  }, [send])
  // 2-inch geometry deliberately not synthesized from the 4-inch master.
  // Owner-approved, explicitly 4-inch product; no inference from a missing Size option.
  const adminOverride = size === '4' && recipe?.enabled && recipe.editor_version === 2 && !failed
  if (template?.offer_mode && !adminOverride) return <>{children}</>
  const media = (preview:ReactNode) => <ClawMediaGallery product={product} preview={preview} viewKey={`${size}:${finish}:${template ? selectedColor || 'taupe' : previewColor}`} colorHex={healingHeartsColors.find(c => c.slug === (template ? selectedColor || 'taupe' : previewColor))?.hex || '#927f6f'} />
  // A 2-inch purchase must never show an approved 4-inch design as its preview.
  if (template && size !== '4') return <>{children}</>
  if (!adminOverride) {
    const purchaseColor = template ? selectedColor || 'taupe' : undefined
    if (product.handle && Object.prototype.hasOwnProperty.call(approvedClawPreviews, product.handle)) return media(<ApprovedClawGallery handle={product.handle as ApprovedClawHandle} purchaseColor={purchaseColor}>{children}</ApprovedClawGallery>)
    if (product.handle === 'golden-love-hair-claw-4') return media(<GoldenLoveGallery purchaseColor={purchaseColor}>{children}</GoldenLoveGallery>)
    if (product.handle === 'every-paw-matters-hair-claw') return media(<GoldenLoveGallery design="every-paw" purchaseColor={purchaseColor}>{children}</GoldenLoveGallery>)
    if (product.handle === 'country-skies-hair-claw') return media(<GoldenLoveGallery design="country-skies" purchaseColor={purchaseColor}>{children}</GoldenLoveGallery>)
  }
  if (size !== '4' || !recipe?.enabled || failed) return <>{children}</>
  return media(<div className="rh-shared-claw-gallery">
    <iframe ref={frame} src="/previews/shared-hair-claw/embed.html?v=editor8" title={`${product.title} — ${previewColor} color preview`} style={{width:'100%',aspectRatio:'1',border:0}} onLoad={send} onError={()=>setFailed(true)} />
    <GalleryControls>
      {!template && <ClawColorPicker compact productName={product.title || 'hair claw'} value={previewColor} onChange={setPreviewColor} />}
      <p className="rh-preview-disclaimer">{template ? '4-inch preview. Base color selects the item added to your cart.' : '4-inch color preview. Your cart uses the available purchase options below.'}</p>
    </GalleryControls>
  </div>)
}
