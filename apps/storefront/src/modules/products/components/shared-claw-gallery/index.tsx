"use client"

import { HttpTypes } from '@medusajs/types'
import { useSearchParams } from 'next/navigation'
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import GoldenLoveGallery from '@modules/products/components/golden-love-gallery'
import ApprovedClawGallery from '@modules/products/components/approved-claw-gallery'
import { approvedClawPreviews, ApprovedClawHandle } from '@lib/brand/approved-claw-previews'
import { healingHeartsColors } from '@lib/brand/healing-hearts-colors'
import ClawColorPicker from '@modules/products/components/claw-color-picker'

type Recipe = { url:string; width:number; height:number; scale:number; x:number; y:number; vertical:boolean; enabled:boolean; editor_version?:2 }
// Only explicit physical sizes: never infer 4-inch from the absence of 2-inch.
function sizeOf(value: string) {
  const match = value.trim().match(/^([24])\s*(?:["″]|in(?:ch(?:es)?)?\.?)$/i)
  return match?.[1]
}
export default function SharedClawGallery({product, children}: {product:HttpTypes.StoreProduct; children:ReactNode}) {
  const params = useSearchParams()
  const variants = product.variants || []
  const variant = variants.find(v => v.id === params.get('v_id')) || (variants.length === 1 ? variants[0] : undefined)
  const sizeOption = product.options?.find(o => o.title?.trim().toLowerCase() === 'size')
  const colorOption = product.options?.find(o => ['color','colour'].includes(o.title?.trim().toLowerCase() || ''))
  const selectedSize = sizeOption ? variant?.options?.find(o => o.option_id === sizeOption.id)?.value : undefined
  const soleSize = sizeOption?.values?.length === 1 ? sizeOption.values[0].value : undefined
  const selectedColor = variant?.options?.find(o => o.option_id === colorOption?.id)?.value?.toLowerCase()
  const settings = product.metadata?.hair_claw_overlays_v1 as {recipes?:Record<string,Recipe>} | undefined
  // Admin explicitly records the reviewed physical size for products without a Size option.
  const reviewedFour = settings?.recipes?.['4']
  const size = sizeOf(selectedSize || soleSize || '') || (!sizeOption && reviewedFour?.editor_version === 2 && reviewedFour.enabled ? '4' : undefined)
  const recipe = size ? settings?.recipes?.[size] : undefined
  const [previewColor,setPreviewColor] = useState('taupe')
  const [failed,setFailed] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  useEffect(() => {setPreviewColor(healingHeartsColors.find(c=>c.slug===selectedColor)?.slug || 'taupe');setFailed(false)}, [selectedColor, size, recipe?.url])
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
  if (!adminOverride) {
    if (product.handle && Object.prototype.hasOwnProperty.call(approvedClawPreviews, product.handle)) return <ApprovedClawGallery handle={product.handle as ApprovedClawHandle}>{children}</ApprovedClawGallery>
    if (product.handle === 'golden-love-hair-claw-4') return <GoldenLoveGallery>{children}</GoldenLoveGallery>
    if (product.handle === 'every-paw-matters-hair-claw') return <GoldenLoveGallery design="every-paw">{children}</GoldenLoveGallery>
    if (product.handle === 'country-skies-hair-claw') return <GoldenLoveGallery design="country-skies">{children}</GoldenLoveGallery>
  }
  if (size !== '4' || !recipe?.enabled || failed) return <>{children}</>
  return <div>
    <iframe ref={frame} src="/previews/shared-hair-claw/embed.html?v=editor7" title={`${product.title} — ${previewColor} color preview`} style={{width:'100%',aspectRatio:'1',border:0}} onLoad={send} onError={()=>setFailed(true)} />
    <ClawColorPicker productName={product.title || 'hair claw'} value={previewColor} onChange={setPreviewColor} />
    <p className="text-sm my-3">Color preview only. Choose your available size and color in the purchase options; this preview does not change your cart selection.</p>
    <details><summary>Original product photos</summary>{children}</details>
  </div>
}
