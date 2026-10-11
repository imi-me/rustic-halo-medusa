import { defineWidgetConfig } from '@medusajs/admin-sdk'
import type { AdminProduct, DetailWidgetProps } from '@medusajs/framework/types'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import '../styles/product-workspace.css'

const steps = [
  { id: 'basics', label: 'Basics & images', description: 'Start with the product story and photography.', actions: [['Edit product', 'edit'], ['Edit images', 'media?view=edit']] },
  { id: 'variants', label: 'Variants, pricing & stock', description: 'Manage SKUs, barcodes, prices and available inventory.', actions: [['Edit prices', 'prices'], ['Manage stock', 'stock'], ['Add variant', 'variants/create']] },
  { id: 'sales', label: 'Sales & shipping', description: 'Choose where this product is sold, how it ships and where it belongs.', actions: [] },
  { id: 'advanced', label: 'Advanced details', description: 'Additional product data and specialized tools.', actions: [] },
] as const
type Step = typeof steps[number]['id']
const sectionNames: Record<string, { id: string; step: Step }> = {
  Media: { id: 'media', step: 'basics' },
  Options: { id: 'options', step: 'variants' },
  Variants: { id: 'variants', step: 'variants' },
  'Sales Channels': { id: 'channels', step: 'sales' },
  'Shipping configuration': { id: 'shipping', step: 'sales' },
  Organize: { id: 'organization', step: 'sales' },
  Attributes: { id: 'attributes', step: 'sales' },
  Metadata: { id: 'metadata', step: 'advanced' },
  JSON: { id: 'json', step: 'advanced' },
}

const ProductWorkspace = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const [step, setStep] = useState<Step>('basics')
  const [expandedDescription, setExpandedDescription] = useState(false)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [descriptionHost, setDescriptionHost] = useState<HTMLElement | null>(null)
  const layout = useRef<HTMLElement | null>(null)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const panelId = useId()
  const current = steps.find(item => item.id === step)!
  const imageCount = new Set([product.thumbnail, ...(product.images ?? []).map(image => image.url)].filter(Boolean)).size

  useEffect(() => { setStep('basics'); setExpandedDescription(false) }, [product.id])

  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    let mount: HTMLElement | null = null
    let descriptionMount: HTMLElement | null = null
    const marked = new Set<HTMLElement>()
    const columns = new Set<HTMLElement>()
    const attach = () => {
      const root = main.querySelector<HTMLElement>('[class*="xl:grid-cols-"]')
      const heading = [...main.querySelectorAll('h1')].find(element => element.closest('.shadow-elevation-card-rest'))
      const general = heading?.closest<HTMLElement>('.shadow-elevation-card-rest')
      if (!root || !general || !root.contains(general)) return
      const nativeColumns = [...root.children].filter((child): child is HTMLElement => child instanceof HTMLElement)
      // Yield to Medusa's native layout customizer while it adds sortable wrappers.
      if (!nativeColumns.includes(general.parentElement!)) {
        root.classList.remove('rh-pd-layout')
        setHost(null)
        return
      }
      layout.current = root
      root.classList.add('rh-pd-layout')
      for (const column of nativeColumns) { column.classList.add('rh-pd-column'); columns.add(column) }
      if (!mount?.isConnected) {
        mount?.remove()
        mount = document.createElement('div')
        mount.className = 'rh-pd-workspace-host'
        root.parentElement?.insertBefore(mount, root)
      }
      setHost(previous => previous === mount ? previous : mount)
      for (const column of nativeColumns) {
        for (const card of [...column.children]) {
          if (!(card instanceof HTMLElement)) continue
          const title = card.querySelector('h1,h2')?.textContent?.trim() ?? ''
          const section = card === general ? { id: 'general', step: 'basics' } : sectionNames[title]
          // Specialized widgets remain available in Advanced. Unknown sections stay visible.
          const specialized = card.tagName === 'DETAILS' && card.querySelector('summary')?.textContent?.includes('hair-claw')
          if (!section && !specialized) continue
          card.dataset.rhProductSection = section?.id ?? 'specialized'
          card.dataset.rhProductStep = section?.step ?? 'advanced'
          marked.add(card)
        }
      }
      const description = [...general.children].find(child => child.querySelector('p')?.textContent === 'Description') as HTMLElement | undefined
      if (description) {
        description.dataset.rhProductDescription = ''
        marked.add(description)
        if (!descriptionMount?.isConnected) {
          descriptionMount?.remove()
          descriptionMount = document.createElement('div')
          description.appendChild(descriptionMount)
        }
        setDescriptionHost(previous => previous === descriptionMount ? previous : descriptionMount)
      }
    }
    const observer = new MutationObserver(attach)
    observer.observe(main, { childList: true, subtree: true })
    attach()
    return () => {
      observer.disconnect()
      mount?.remove(); descriptionMount?.remove()
      for (const element of marked) {
        delete element.dataset.rhProductSection; delete element.dataset.rhProductStep; delete element.dataset.rhProductDescription
      }
      for (const column of columns) column.classList.remove('rh-pd-column')
      const root = layout.current
      root?.classList.remove('rh-pd-layout')
      if (root) {
        delete root.dataset.rhProductView; delete root.dataset.rhProductExpanded
        root.removeAttribute('role'); root.removeAttribute('id'); root.removeAttribute('aria-labelledby')
      }
      layout.current = null
    }
  }, [product.id])

  useEffect(() => {
    const root = layout.current
    if (!root || !host) return
    root.dataset.rhProductView = step
    root.dataset.rhProductExpanded = String(expandedDescription)
    root.id = panelId
    root.setAttribute('role', 'tabpanel')
    root.setAttribute('aria-labelledby', `${panelId}-${step}`)
  }, [host, step, expandedDescription, panelId])

  if (!host) return null
  return <>
    {createPortal(<section className="rh-pd-workspace" aria-label="Product workspace">
      <div className="rh-pd-hero">
        {product.thumbnail ? <img src={product.thumbnail} alt=""/> : <div className="rh-pd-no-image" aria-hidden="true">◇</div>}
        <div className="rh-pd-identity"><span className="rh-pd-eyebrow">Product workspace</span><h1>{product.title}</h1>
          <div className="rh-pd-summary"><span className={`rh-pd-status ${product.status === 'published' ? 'published' : ''}`}>{product.status}</span><span>{imageCount} {imageCount === 1 ? 'image' : 'images'}</span><span>/{product.handle}</span></div>
        </div>
        <Link to="/products" className="rh-pd-back">← All products</Link>
      </div>
      <div className="rh-pd-tabs" role="tablist" aria-label="Product editing steps">
        {steps.map((item, index) => <button key={item.id} ref={element => { tabs.current[index] = element }} type="button" role="tab"
          id={`${panelId}-${item.id}`} aria-selected={step === item.id} aria-controls={panelId} tabIndex={step === item.id ? 0 : -1}
          onClick={() => setStep(item.id)} onKeyDown={event => {
            const next = event.key === 'ArrowRight' ? (index + 1) % steps.length : event.key === 'ArrowLeft' ? (index + steps.length - 1) % steps.length : event.key === 'Home' ? 0 : event.key === 'End' ? steps.length - 1 : null
            if (next !== null) { event.preventDefault(); setStep(steps[next].id); tabs.current[next]?.focus() }
          }}><span>{index + 1}</span>{item.label}</button>)}
      </div>
      <div className="rh-pd-stage"><div><h2>{current.label}</h2><p>{current.description}</p></div><div className="rh-pd-actions">
        {current.actions.map(([label, route], index) => <Link key={route} className={index === 0 ? 'rh-pd-action primary' : 'rh-pd-action'} to={`/products/${product.id}/${route}`}>{label}</Link>)}
      </div></div>
    </section>, host)}
    {descriptionHost && product.description && product.description.length > 240 && createPortal(<button className="rh-pd-description-toggle" type="button" aria-expanded={expandedDescription} onClick={() => setExpandedDescription(value => !value)}>{expandedDescription ? 'Show less' : 'Show full description'}</button>, descriptionHost)}
  </>
}

export const config = defineWidgetConfig({ zone: 'product.details.before', id: 'rustic-halo:product-workspace' })
export default ProductWorkspace
