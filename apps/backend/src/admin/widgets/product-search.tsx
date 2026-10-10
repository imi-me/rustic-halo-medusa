import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { productSearchDetail, productSearchParams, type SearchProduct } from '../lib/product-search'
import '../styles/product-search.css'

const SearchIcon = () => <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="m15 15 5 5" stroke="currentColor" strokeWidth="1.5"/></svg>

const ProductSearch = () => {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const currentQuery = params.get('q') ?? ''
  const [value, setValue] = useState(currentQuery)
  const [term, setTerm] = useState(value.trim())
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()

  useEffect(() => { setValue(currentQuery) }, [currentQuery])
  useEffect(() => {
    setActive(-1)
    const timer = window.setTimeout(() => setTerm(value.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [value])

  // Medusa exposes a list widget zone, but no slot inside the native heading.
  // Mount only this search into its header; retain the native table and actions.
  useEffect(() => {
    let header: HTMLElement | null = null
    let mount: HTMLElement | null = null
    let nativeSearch: HTMLElement | null = null
    const attach = () => {
      const nextHeader = document.querySelector('main h1')?.parentElement ?? null
      if (!nextHeader || !nextHeader.querySelector('a[href$="/create"], a[href="create"]')) return
      if (nextHeader !== header || !mount?.isConnected) {
        header?.classList.remove('rh-products-search-header')
        mount?.remove()
        header = nextHeader
        header.classList.add('rh-products-search-header')
        mount = document.createElement('div')
        mount.className = 'rh-products-search-host'
        header.appendChild(mount)
        setHost(mount)
      }
      const nativeInput = header.parentElement?.querySelector<HTMLInputElement>('input[type="search"]:not(.rh-products-search-input)')
      const wrapper = nativeInput?.parentElement ?? null
      if (wrapper && wrapper !== nativeSearch) {
        nativeSearch?.removeAttribute('data-rh-native-product-search')
        nativeSearch = wrapper
        nativeSearch.setAttribute('data-rh-native-product-search', '')
      }
    }
    const observer = new MutationObserver(attach)
    observer.observe(document.querySelector('main') ?? document.body, { childList: true, subtree: true })
    attach()
    return () => {
      observer.disconnect()
      header?.classList.remove('rh-products-search-header')
      nativeSearch?.removeAttribute('data-rh-native-product-search')
      mount?.remove()
    }
  }, [])

  const { data, isFetching, isError } = useQuery<{ products: SearchProduct[]; count: number }>({
    queryKey: ['rh-product-suggestions', term],
    enabled: open && term.length > 0,
    staleTime: 30_000,
    gcTime: 120_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/admin/products?${productSearchParams(term)}`, { credentials: 'include', signal })
      if (!response.ok) throw new Error('Search could not be loaded.')
      return response.json()
    },
  })
  const current = term === value.trim()
  const results = current ? data?.products ?? [] : []
  const expanded = open && value.trim().length > 0
  const showAll = (query = value.trim()) => {
    const next = new URLSearchParams(params)
    if (query) next.set('q', query)
    else next.delete('q')
    next.delete('offset')
    setParams(next)
    setOpen(false)
    setActive(-1)
  }
  const openProduct = (product: SearchProduct) => {
    setOpen(false)
    navigate(`/products/${product.id}`)
  }
  const search = <div className="rh-products-search" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }}>
    <form className="rh-products-search-field" role="search" aria-label="Search catalog" onSubmit={event => { event.preventDefault(); showAll() }}>
      <label className="sr-only" htmlFor={`${listId}-input`}>Search products by title, SKU or barcode</label>
      <input ref={input} id={`${listId}-input`} className="rh-products-search-input" type="search" role="combobox"
        aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
        aria-activedescendant={expanded && active >= 0 && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off" maxLength={160} placeholder="Search products by title, SKU or barcode…" value={value}
        onFocus={() => setOpen(true)} onChange={event => { setValue(event.target.value); setOpen(true) }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'Escape') { setOpen(false); setActive(-1); event.stopPropagation() }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true)
            if (results.length) setActive(index => event.key === 'ArrowDown' ? (index + 1) % results.length : (index <= 0 ? results.length - 1 : index - 1))
          }
          if (event.key === 'Enter' && expanded && active >= 0 && results[active]) { event.preventDefault(); openProduct(results[active]) }
        }}/>
      {value && <button type="button" className="rh-products-search-clear" aria-label="Clear product search" onClick={() => { setValue(''); setTerm(''); showAll(''); input.current?.focus() }}>×</button>}
      <button type="submit" className="rh-products-search-submit" aria-label="Search all matching products"><SearchIcon/></button>
    </form>
    <p className="rh-products-search-hint">Find products by title, SKU or barcode</p>
    {expanded && <div className="rh-products-search-dropdown">
      <div className="rh-products-search-caption" role="status" aria-live="polite">
        {!current || isFetching ? 'Searching…' : isError ? 'Search unavailable. Try again or press Enter to search the list.' : results.length ? `${data?.count} matching products` : 'No matching products. Try a title, SKU or barcode.'}
      </div>
      <div id={listId} role="listbox" aria-label="Product suggestions">
        {results.map((product, index) => <a key={product.id} id={`${listId}-${index}`} role="option" aria-selected={active === index}
          className="rh-products-search-option" href={`/app/products/${product.id}`} tabIndex={-1}
          onMouseMove={() => setActive(index)} onMouseDown={event => event.preventDefault()}
          onClick={event => { event.preventDefault(); openProduct(product) }}>
          {product.thumbnail ? <img src={product.thumbnail} alt=""/> : <span className="rh-products-search-image" aria-hidden="true"><SearchIcon/></span>}
          <span><strong>{product.title}</strong><small>{productSearchDetail(product, term)}</small></span>
          <span className="rh-products-search-arrow" aria-hidden="true">↗</span>
        </a>)}
      </div>
      {current && data && !isError && data.count > 0 && <button type="button" className="rh-products-search-all" onMouseDown={event => event.preventDefault()} onClick={() => showAll()}>View all {data.count} matching products <span aria-hidden="true">→</span></button>}
    </div>}
  </div>
  return host ? createPortal(search, host) : null
}

export const config = defineWidgetConfig({ zone: 'product.list.before' })
export default ProductSearch
