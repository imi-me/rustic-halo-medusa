import { useEffect, useRef, useState } from 'react'
import { Button, Container, Heading, Text } from '@medusajs/ui'
import HairClawPhotoUpload from './hair-claw-photo-upload'

type Recipe = { file_id: string; url: string; width: number; height: number; scale: number; x: number; y: number; vertical: boolean; enabled: boolean }
type Settings = { revision: string | null; recipes: Record<string, Recipe> }
const palette = ['Black','Espresso','Mocha','Chocolate','Caramel','Khaki','Taupe','Sand','Ivory','Gray','Terracotta','Rose','Purple']
async function api(path: string, body?: unknown) {
  const response = await fetch(path, { credentials: 'include', ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body) }) })
  const data = await response.json()
  if (!response.ok) throw Error(data.message || 'Request failed')
  return data
}
export default function HairClawEditor({ productId }: { productId: string }) {
  const [settings, setSettings] = useState<Settings>({ revision: null, recipes: {} })
  const [size, setSize] = useState('4')
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [origin, setOrigin] = useState('')
  const [color, setColor] = useState('taupe')
  const [notice, setNotice] = useState('Loading…')
  const [busy, setBusy] = useState(true)
  const [dirty, setDirty] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const previewUrl = /^https?:\/\//.test(origin) ? `${origin.replace(/\/$/, '')}/previews/shared-hair-claw/embed.html?v=admin1` : ''
  useEffect(() => {
    let active = true
    setBusy(true)
    api(`/admin/products/${productId}/hair-claw-media`).then(data => {
      if (!active) return
      setSettings(data.settings); setRecipe(data.settings.recipes['4'] || null); setSize('4'); setDirty(false)
      setOrigin(data.preview_origin || ''); setNotice('Choose the size, upload a wood photo, then review and save. Existing gallery images are retained.')
    }).catch(error => active && setNotice(error.message)).finally(() => active && setBusy(false))
    return () => { active = false }
  }, [productId])
  function preview() {
    if (previewUrl && recipe) frame.current?.contentWindow?.postMessage({ type:'hair-claw-preview', recipe, size, color, outline:true }, new URL(previewUrl).origin)
  }
  useEffect(() => {
    preview()
    const ready = (event: MessageEvent) => { if (event.source === frame.current?.contentWindow && event.data?.type === 'hair-claw-preview-ready') preview() }
    window.addEventListener('message', ready)
    return () => window.removeEventListener('message', ready)
  }, [recipe, size, color, previewUrl])
  function change(patch: Partial<Recipe>) { if (recipe) { setRecipe({ ...recipe, ...patch }); setDirty(true) } }
  async function save() {
    setBusy(true)
    try {
      const clean = recipe ? { file_id:recipe.file_id, width:recipe.width, height:recipe.height, scale:recipe.scale, x:recipe.x, y:recipe.y, vertical:recipe.vertical, enabled:recipe.enabled } : null
      const result = await api(`/admin/products/${productId}/hair-claw-media`, { size, revision:settings.revision, recipe:clean })
      setSettings(result.settings); setRecipe(result.settings.recipes[size] || null); setDirty(false)
      setNotice('Saved. The same overlay is used across color previews; pricing, stock and variants were not changed.')
    } catch (error) { setNotice((error as Error).message) } finally { setBusy(false) }
  }
  return <Container className="space-y-4">
    <Heading level="h2">Hair-claw wood overlay</Heading>
    <Text>{notice}</Text>
    <label>Physical size <select disabled={busy || dirty} value={size} onChange={event => { setSize(event.target.value); setRecipe(settings.recipes[event.target.value] || null) }}><option value="2">2 inches</option><option value="4">4 inches</option></select></label>
    {dirty && <Text>Save or discard before changing size.</Text>}
    {size === '2' && <Text>2-inch template pending: upload and save a draft now. Storefront keeps existing photos until its measured shape is approved.</Text>}
    <HairClawPhotoUpload key={`${productId}-${size}`} size={size} disabled={busy} onWorking={setBusy} onAccept={result=>{setRecipe({...result,scale:1,x:0,y:0,enabled:false});setDirty(true);setNotice('New cutout ready. Review its placement before enabling and saving.')}} />
    {recipe && <>
      <details><summary>Preview connection settings</summary><label className="block">Preview storefront origin <input value={origin} onChange={event => setOrigin(event.target.value)} placeholder="https://staging.rustichalo.com" /></label></details>
      <label className="block">Preview color <select value={color} onChange={event => setColor(event.target.value)}>{palette.map(name => <option key={name} value={name.toLowerCase()}>{name}</option>)}</select></label>
      {size === '4' && previewUrl && <iframe ref={frame} src={previewUrl} title="Wood overlay alignment preview" onLoad={preview} style={{ width:'100%', maxWidth:650, aspectRatio:'1', border:0 }} />}
      {size === '2' && <img src={recipe.url} alt="Uploaded 2-inch wood overlay, uncomposited" style={{maxWidth:450,maxHeight:250}} />}
      <label className="block">Uniform size: {Math.round(recipe.scale*100)}% <input disabled={busy} type="range" min="0.8" max="1.01" step="0.0025" value={recipe.scale} onChange={e => change({scale:Number(e.target.value)})} /></label>
      {(['x','y'] as const).map(axis => <label className="block" key={axis}>{axis === 'x' ? 'Horizontal' : 'Vertical'} position <input disabled={busy} type="range" min="-50" max="50" step="1" value={recipe[axis]} onChange={e => change({[axis]:Number(e.target.value)})} /></label>)}
      <label className="block"><input disabled={busy} type="checkbox" checked={recipe.vertical} onChange={e => change({vertical:e.target.checked})} /> Display vertically (square canvas)</label>
      <label className="block"><input disabled={busy || size === '2'} type="checkbox" checked={recipe.enabled} onChange={e => change({enabled:e.target.checked})} /> Reviewed: enable shared color preview for this size</label>
      <Text>Artwork is scaled uniformly, never stretched. Preview colors do not create purchasable variants.</Text>
      {size === '4' && Math.abs(recipe.width / recipe.height / (101.524414 / 37.523926) - 1) > 0.05 && <Text>The uploaded proportions differ from the 4-inch outline by more than 5%. Check the background removal and camera angle; scaling cannot correct perspective without distortion.</Text>}
    </>}
    <div className="flex gap-2"><Button disabled={busy || !dirty} onClick={save}>Save overlay</Button><Button variant="secondary" disabled={busy || !dirty} onClick={() => {setRecipe(settings.recipes[size] || null);setDirty(false)}}>Discard edits</Button><Button variant="secondary" disabled={busy || !recipe} onClick={() => {setRecipe(null);setDirty(true)}}>Remove overlay setting</Button></div>
  </Container>
}
