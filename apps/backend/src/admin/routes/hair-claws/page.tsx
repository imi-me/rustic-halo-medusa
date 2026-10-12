import { defineRouteConfig } from '@medusajs/admin-sdk'
import { Button, Container, Heading, TooltipProvider } from '@medusajs/ui'
import { useEffect, useState } from 'react'
import HairClawEditor from '../../components/hair-claw-editor'
import { FitHelp, FitIcon } from '../../components/hair-claw-ui'

const HairClawsPage = () => {
  const [products, setProducts] = useState<{id:string;title:string}[]>([])
  const [selected, setSelected] = useState('')
  const [query, setQuery] = useState('claw')
  const [title, setTitle] = useState('')
  const [size, setSize] = useState('4')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      const all: {id:string;title:string}[] = []
      for (let offset = 0; ; offset += 100) {
        const response = await fetch(`/admin/products?limit=100&offset=${offset}&fields=id,title`, {credentials:'include',signal:controller.signal})
        const data = await response.json()
        if (!response.ok) throw Error(data.message || 'Catalog unavailable')
        all.push(...data.products)
        if (!data.products.length || all.length >= data.count) break
      }
      setProducts(all)
    }
    load().catch(error => {if (error.name !== 'AbortError') setNotice(error.message)})
    return () => controller.abort()
  }, [])
  async function create() {
    setBusy(true)
    try {
      const sizes = size === 'both' ? ['2"','4"'] : [`${size}"`]
      const response = await fetch('/admin/products', {method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title.trim(),status:'draft',options:[{title:'Size',values:sizes}],metadata:{product_template:'rustic_halo_hair_claw_v1',hair_claw_sizes:sizes}})})
      const data = await response.json()
      if (!response.ok) throw Error(data.message || 'Could not create draft')
      setProducts(p => [...p,data.product]); setSelected(data.product.id); setTitle(''); setQuery('')
      setNotice('Draft created with size choices. Add actual variants, prices and inventory in Products before publishing; no saleable variants were invented.')
    } catch (error) {setNotice((error as Error).message)} finally {setBusy(false)}
  }
  return <TooltipProvider><div className="space-y-4"><Container className="space-y-4">
    <div className="rh-fit-catalog-heading"><Heading>Hair-claw overlays</Heading><FitHelp label="Hair-claw overlays">Choose a product and a current photo, then adjust its fit. Each physical size has its own settings. The existing gallery stays in place until you enable a reviewed preview.</FitHelp></div>
    <div className="rh-fit-catalog-search"><label className="rh-fit-catalog-field">Find product<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by product name"/></label><label className="rh-fit-catalog-field">Product<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a product</option>{products.filter(p => p.id === selected || p.title.toLowerCase().includes(query.toLowerCase())).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label></div>
    <details className="rh-fit-catalog-new"><summary><FitIcon name="image"/>New hair-claw product<FitHelp label="New hair-claw product">Create a draft with size choices. Add actual variants, prices and inventory in Products before publishing.</FitHelp></summary><div><label className="rh-fit-catalog-field">Product name<input value={title} onChange={e=>setTitle(e.target.value)} /></label><label className="rh-fit-catalog-field">Size<select value={size} onChange={e=>setSize(e.target.value)}><option value="2">2 inches</option><option value="4">4 inches</option><option value="both">Both sizes</option></select></label><Button disabled={busy || !title.trim()} onClick={create}>Create draft</Button></div></details>
    {notice && <div className="rh-fit-catalog-notice">Notice<FitHelp label="Catalog status">{notice}</FitHelp><span className="rh-fit-sr" role="status">{notice}</span></div>}
    </Container>{selected && <HairClawEditor key={selected} productId={selected} />}</div></TooltipProvider>
}
export const config = defineRouteConfig({label:'Hair-claw overlays'})
export default HairClawsPage
