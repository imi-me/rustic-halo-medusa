import { defineWidgetConfig } from '@medusajs/admin-sdk'
import type { AdminProduct, DetailWidgetProps } from '@medusajs/framework/types'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { InlineEditor } from '../components/inline-editor'
import '../styles/product-workspace.css'

const commonSections = new Set(['Media', 'Variants', 'Sales Channels', 'Shipping configuration', 'Organize', 'Attributes'])

const ProductWorkspace = ({ data: product }: DetailWidgetProps<AdminProduct>) => {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const [tools, setTools] = useState(false)
  const layout = useRef<HTMLElement | null>(null)
  const location = useLocation()
  const toolsId = useId()
  // Native image/stock/option dialogs own their forms and navigation blockers.
  const overview = location.pathname.replace(/\/$/, '') === `/products/${product.id}`

  useEffect(() => { setTools(false) }, [product.id])
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    let mount: HTMLElement | null = null
    const marked = new Set<HTMLElement>()
    const columns = new Set<HTMLElement>()
    const attach = () => {
      const root = main.querySelector<HTMLElement>('[class*="xl:grid-cols-"]')
      const general = [...main.querySelectorAll('h1')].find(element => element.closest('.shadow-elevation-card-rest'))?.closest<HTMLElement>('.shadow-elevation-card-rest')
      if (!root || !general || !root.contains(general)) return
      const nativeColumns = [...root.children].filter((child): child is HTMLElement => child instanceof HTMLElement)
      if (!nativeColumns.includes(general.parentElement!)) {
        root.classList.remove('rh-pd-layout')
        setHost(null)
        return
      }
      layout.current = root
      root.classList.add('rh-pd-layout')
      for (const column of nativeColumns) {
        column.classList.add('rh-pd-column'); columns.add(column)
        for (const card of [...column.children]) {
          if (!(card instanceof HTMLElement)) continue
          const title = card.querySelector('h1,h2')?.textContent?.trim() ?? ''
          // Keep options, metadata, JSON and third-party widgets below the form;
          // hide native copies of fields already edited in that form.
          card.dataset.rhProductCommon = String(card === general || commonSections.has(title))
          marked.add(card)
        }
      }
      if (!mount?.isConnected) {
        mount?.remove()
        mount = document.createElement('div')
        mount.className = 'rh-pd-workspace-host'
        root.parentElement?.insertBefore(mount, root)
      }
      setHost(previous => previous === mount ? previous : mount)
    }
    const observer = new MutationObserver(attach)
    observer.observe(main, { childList: true, subtree: true })
    attach()
    return () => {
      observer.disconnect(); mount?.remove()
      for (const card of marked) delete card.dataset.rhProductCommon
      for (const column of columns) column.classList.remove('rh-pd-column')
      const root = layout.current
      root?.classList.remove('rh-pd-layout')
      if (root) {
        delete root.dataset.rhProductOverview; delete root.dataset.rhProductTools
        root.removeAttribute('id')
      }
      layout.current = null
    }
  }, [product.id])

  useEffect(() => {
    const root = layout.current
    if (!root || !host) return
    root.dataset.rhProductOverview = String(overview)
    root.dataset.rhProductTools = String(tools)
    root.id = toolsId
  }, [host, overview, tools, toolsId])

  if (!host || !overview) return null
  return createPortal(<section className="rh-pd-workspace" aria-label="Product workspace">
    <InlineEditor key={product.id} kind="products" id={product.id} workspace={{ title: product.title, thumbnail: product.thumbnail }}/>
    <button type="button" className="rh-pd-tools-toggle" aria-expanded={tools} aria-controls={toolsId} onClick={() => setTools(value => !value)}>
      <strong>Additional tools <span aria-hidden="true">{tools ? '−' : '+'}</span></strong>
      <span>Product options, metadata and specialized tools</span>
    </button>
  </section>, host)
}

export const config = defineWidgetConfig({ zone: 'product.details.before', id: 'rustic-halo:product-workspace' })
export default ProductWorkspace
