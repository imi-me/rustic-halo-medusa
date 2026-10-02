"use client"

import { HttpTypes } from '@medusajs/types'
import { useSearchParams } from 'next/navigation'
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'

const colors = ['Black','Espresso','Mocha','Chocolate','Caramel','Khaki','Taupe','Sand','Ivory','Gray','Terracotta','Rose','Purple']
type Recipe = { url:string; width:number; height:number; scale:number; x:number; y:number; vertical:boolean; enabled:boolean }
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
  const size = sizeOf(selectedSize || soleSize || '')
  const selectedColor = variant?.options?.find(o => o.option_id === colorOption?.id)?.value?.toLowerCase()
  const settings = product.metadata?.hair_claw_overlays_v1 as {recipes?:Record<string,Recipe>} | undefined
  const recipe = size ? settings?.recipes?.[size] : undefined
  const [previewColor,setPreviewColor] = useState('taupe')
  const [failed,setFailed] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  useEffect(() => {setPreviewColor(colors.find(c=>c.toLowerCase()===selectedColor)?.toLowerCase() || 'taupe');setFailed(false)}, [selectedColor, size, recipe?.url])
  const send = useCallback(() => {
    if (recipe) frame.current?.contentWindow?.postMessage({type:'hair-claw-preview',recipe,size,color:previewColor,outline:false}, window.location.origin)
  }, [recipe,size,previewColor])
  useEffect(() => {
    send()
    const ready = (event:MessageEvent) => {if (event.source === frame.current?.contentWindow && event.origin === window.location.origin && event.data?.type === 'hair-claw-preview-ready') send()}
    window.addEventListener('message',ready)
    return () => window.removeEventListener('message',ready)
  }, [send])
  // 2-inch geometry deliberately not synthesized from the 4-inch master.
  if (size !== '4' || !recipe?.enabled || failed) return <>{children}</>
  return <div>
    <iframe ref={frame} src="/previews/shared-hair-claw/embed.html?v=admin1" title={`${product.title} — ${previewColor} color preview`} style={{width:'100%',aspectRatio:'1',border:0}} onLoad={send} onError={()=>setFailed(true)} />
    <label>Preview claw color <select value={previewColor} onChange={e=>setPreviewColor(e.target.value)}>{colors.map(name=><option key={name} value={name.toLowerCase()}>{name}</option>)}</select></label>
    <p className="text-sm my-3">Color preview only. Choose your available size and color in the purchase options; this preview does not change your cart selection.</p>
    <details><summary>Original product photos</summary>{children}</details>
  </div>
}
