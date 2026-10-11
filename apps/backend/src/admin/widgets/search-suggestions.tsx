import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { searchSources, suggestionParams, type SearchSuggestion } from '../lib/search-suggestions'
import '../styles/search-suggestions.css'

const SearchSuggestions = () => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const source = searchSources[pathname.replace(/\/$/, '')]
  const [input, setInput] = useState<HTMLInputElement | null>(null)
  const [value, setValue] = useState('')
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const id = useId()

  useEffect(() => {
    setOpen(false)
    setInput(null)
    if (!source) return
    const attach = () => {
      // Augment only the list's search; leave native input/filter state intact.
      const next = document.querySelector<HTMLInputElement>(source.selector ?? 'main input[type="search"]')
      setInput(current => current === next ? current : next)
    }
    const observer = new MutationObserver(attach)
    observer.observe(document.querySelector('main') ?? document.body, { childList: true, subtree: true })
    attach()
    return () => observer.disconnect()
  }, [source])

  useEffect(() => {
    setActive(-1)
    const timer = window.setTimeout(() => setTerm(value.trim()), 200)
    return () => window.clearTimeout(timer)
  }, [value])

  const { data, isFetching, isError } = useQuery<SearchSuggestion[]>({
    queryKey: ['rh-admin-suggestions', source?.collection, term],
    enabled: !!source && !!input && open && term.length > 0,
    staleTime: 30_000, gcTime: 120_000, retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(`${source.endpoint}?${suggestionParams(source, term)}`, { credentials: 'include', signal })
      if (!response.ok) throw new Error('Suggestions unavailable')
      const body = await response.json()
      return (body[source.collection] ?? []).map(source.describe)
    },
  })
  const current = term === value.trim()
  const results = current ? data ?? [] : []
  const expanded = !!source && open && value.trim().length > 0
  const choose = (item: SearchSuggestion) => {
    setOpen(false)
    navigate(`${source.route}/${item.id}`)
  }
  const state = useRef({ expanded, results, active, choose })
  state.current = { expanded, results, active, choose }

  useEffect(() => {
    if (!input) return
    const host = input.parentElement
    host?.classList.add('rh-suggestions-host')
    const attrs = ['role', 'aria-autocomplete', 'aria-haspopup', 'aria-expanded', 'aria-controls', 'aria-activedescendant']
    const original = attrs.map(name => [name, input.getAttribute(name)] as const)
    setValue(input.value)
    const change = () => { setValue(input.value); setActive(-1); setOpen(true) }
    const focus = () => { setValue(input.value); setOpen(true) }
    const blur = (event: FocusEvent) => {
      if (!host?.contains(event.relatedTarget as Node | null)) setOpen(false)
    }
    const key = (event: KeyboardEvent) => {
      if (event.isComposing) return
      const latest = state.current
      if (event.key === 'Escape' && latest.expanded) {
        setOpen(false); setActive(-1); event.stopPropagation()
      }
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && input.value.trim()) {
        event.preventDefault(); event.stopPropagation(); setOpen(true)
        if (latest.results.length) setActive(index => event.key === 'ArrowDown' ? (index + 1) % latest.results.length : (index <= 0 ? latest.results.length - 1 : index - 1))
      }
      if (event.key === 'Enter') {
        const item = latest.results[latest.active]
        if (latest.expanded && item) { event.preventDefault(); event.stopPropagation(); latest.choose(item) }
        else setOpen(false)
      }
    }
    input.addEventListener('input', change)
    input.addEventListener('focus', focus)
    input.addEventListener('blur', blur)
    input.addEventListener('keydown', key, true)
    return () => {
      input.removeEventListener('input', change)
      input.removeEventListener('focus', focus)
      input.removeEventListener('blur', blur)
      input.removeEventListener('keydown', key, true)
      host?.classList.remove('rh-suggestions-host')
      for (const [name, previous] of original) {
        if (previous === null) input.removeAttribute(name)
        else input.setAttribute(name, previous)
      }
    }
  }, [input])

  useEffect(() => {
    if (!input) return
    input.setAttribute('role', 'combobox')
    input.setAttribute('aria-autocomplete', 'list')
    input.setAttribute('aria-haspopup', 'listbox')
    input.setAttribute('aria-expanded', String(expanded))
    if (expanded) input.setAttribute('aria-controls', id)
    else input.removeAttribute('aria-controls')
    if (expanded && results[active]) input.setAttribute('aria-activedescendant', `${id}-${active}`)
    else input.removeAttribute('aria-activedescendant')
  }, [input, expanded, active, results, id])

  if (!expanded || !input?.parentElement) return null
  return createPortal(<div className="rh-search-suggestions">
    <div className="rh-suggestions-caption" role="status" aria-live="polite">
      {!current || isFetching ? 'Searching…' : isError ? 'Suggestions unavailable. You can still search the list.' : results.length ? `${source.label} suggestions` : `No matching ${source.label.toLowerCase()}.`}
    </div>
    <div id={id} role="listbox" aria-label={`${source.label} suggestions`}>
      {results.map((item, index) => <a key={item.id} id={`${id}-${index}`} role="option" aria-selected={active === index}
        href={`/app${source.route}/${item.id}`} tabIndex={-1} className="rh-suggestion"
        onMouseMove={() => setActive(index)} onMouseDown={event => event.preventDefault()}
        onClick={event => { event.preventDefault(); choose(item) }}>
        {item.thumbnail && <img src={item.thumbnail} alt=""/>}
        <span><strong>{item.title}</strong><small>{item.detail}</small></span><span aria-hidden="true">↗</span>
      </a>)}
    </div>
    <div className="rh-suggestions-help">↑ ↓ to choose · Enter to open · Esc to dismiss</div>
  </div>, input.parentElement)
}

export const config = defineWidgetConfig({ zone: 'topbar' })
export default SearchSuggestions
