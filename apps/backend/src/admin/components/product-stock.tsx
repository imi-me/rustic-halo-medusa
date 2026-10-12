import { useEffect, useState } from 'react'
import { adminRequest, type Entity, type ProductDraft } from '../lib/inline-edit'
export type StockLevel = { id: string; item: string; location: string; name: string; stocked_quantity: number; reserved_quantity: number; incoming_quantity: number; updated_at: string; pending?: boolean }
type Location = { id: string; name: string }
type Link = { variant: string; item: Entity; required_quantity: string }
function InventorySearch({ onSelect }: { onSelect: (id: string) => void }) {
  const [query, setQuery] = useState(''), [items, setItems] = useState<Entity[]>([]), [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setItems([]); setError('')
    if (query.trim().length < 2) return
    const timer = setTimeout(() => { adminRequest(`/admin/inventory-items?${new URLSearchParams({ q: query.trim(), limit: '8', fields: 'id,title,sku' })}`).then(data => { if (active) setItems(data.inventory_items) }).catch(() => { if (active) setError('Inventory search could not load.') }) }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [query])
  return <div className="rh-stock-search"><label className="rh-inline-field"><span>Link inventory item</span><input aria-label="Search inventory item by title or SKU" value={query} placeholder="Search title or SKU…" onChange={event => setQuery(event.target.value)}/></label>{error && <small>{error}</small>}{items.map(item => <button type="button" key={item.id} onClick={() => onSelect(item.id)}>{item.title || item.sku || item.id}{item.sku && <small>SKU {item.sku}</small>}</button>)}</div>
}
export function useProductStock() {
  const [variants, setVariants] = useState<Entity[]>([]), [locations, setLocations] = useState<Location[]>([])
  const [levels, setLevels] = useState<Record<string, StockLevel>>({}), [values, setValues] = useState<Record<string, string>>({})
  const [removed, setRemoved] = useState<string[]>([]), [links, setLinks] = useState<Link[]>([]), [error, setError] = useState('')
  const dirty = links.length > 0 || removed.length > 0 || Object.keys(values).some(key => levels[key].pending || values[key] !== String(levels[key].stocked_quantity))
  const levelValue = (level: Entity, item: string, allLocations: Location[]) => ({ ...level, id: level.id, item, location: level.location_id, name: allLocations.find(location => location.id === level.location_id)?.name ?? level.location_id, stocked_quantity: Number(level.stocked_quantity), reserved_quantity: Number(level.reserved_quantity), incoming_quantity: Number(level.incoming_quantity ?? 0), updated_at: level.updated_at }) as StockLevel
  const load = async (id: string) => {
    setError(''); setValues({}); setLevels({}); setVariants([]); setLinks([]); setRemoved([])
    try {
      const rows: Entity[] = []
      for (let offset = 0;; offset += 100) {
        const page = await adminRequest(`/admin/products/${id}/variants?${new URLSearchParams({ limit: '100', offset: String(offset), fields: 'id,title,manage_inventory,allow_backorder,inventory_items.*,inventory_items.inventory.id,inventory_items.inventory.title,*inventory_items.inventory.location_levels' })}`)
        rows.push(...page.variants)
        if (rows.length >= page.count || page.variants.length < 100) break
        if (rows.length >= 10000) throw new Error('This product has too many variants to load stock together.')
      }
      const { stock_locations: allLocations } = await adminRequest('/admin/stock-locations?limit=9999&fields=id,name')
      const all: Record<string, StockLevel> = {}
      rows.forEach(variant => (variant.inventory_items ?? []).forEach((link: Entity) => (link.inventory?.location_levels ?? []).forEach((level: Entity) => { all[level.id] = levelValue(level, link.inventory.id, allLocations) })))
      setLocations(allLocations); setVariants(rows); setLevels(all); setValues(Object.fromEntries(Object.values(all).map(level => [level.id, String(level.stocked_quantity)])))
    } catch (failure) { setError((failure as Error).message) }
  }
  const addLink = async (variant: string, id: string) => {
    try {
      const { inventory_item: item } = await adminRequest(`/admin/inventory-items/${id}?fields=*location_levels`)
      setLinks(previous => [...previous.filter(link => link.variant !== variant), { variant, item, required_quantity: '1' }])
      const extra = Object.fromEntries((item.location_levels ?? []).map((level: Entity) => [level.id, levelValue(level, item.id, locations)])) as Record<string, StockLevel>
      setLevels(previous => ({ ...extra, ...previous })); setValues(previous => ({ ...Object.fromEntries(Object.values(extra).map(level => [level.id, String(level.stocked_quantity)])), ...previous }))
    } catch (failure) { setError((failure as Error).message) }
  }
  const validate = (draftVariants?: ProductDraft['variants']) => {
    for (const link of links) if (!Number.isSafeInteger(Number(link.required_quantity)) || Number(link.required_quantity) < 1) throw new Error('Units required per variant must be a positive whole number.')
    const edits = Object.keys(values).filter(key => levels[key].pending || removed.includes(key) || values[key] !== String(levels[key].stocked_quantity)).map(key => {
      const quantity = Number(values[key])
      if (!values[key].trim() || !Number.isSafeInteger(quantity) || quantity < levels[key].reserved_quantity || quantity < 0) throw new Error('On-hand stock must be a whole number at least as large as reserved stock.')
      return { level: levels[key], quantity, remove: removed.includes(key) }
    })
    if (draftVariants) for (const variant of draftVariants) {
      if (variant.fields.manage_inventory) continue
      const itemIds = (variants.find(row => row.id === variant.id)?.inventory_items ?? []).map((link: Entity) => link.inventory_item_id)
      if (links.some(link => link.variant === variant.id) || edits.some(edit => itemIds.includes(edit.level.item))) throw new Error('Save stock changes while tracking is enabled. Turn tracking off separately.')
      if (Object.values(levels).some(level => itemIds.includes(level.item) && level.reserved_quantity > 0)) throw new Error('Stock tracking cannot be turned off while linked inventory has reservations.')
    }
    return edits
  }
  const freshItem = async (item: string) => (await adminRequest(`/admin/inventory-items/${item}?fields=*location_levels`)).inventory_item
  const confirmed = (level: StockLevel, fresh: Entity) => {
    const next = levelValue(fresh, level.item, locations)
    setLevels(previous => { const rest = { ...previous }; delete rest[level.id]; rest[next.id] = next; return rest })
    setValues(previous => { const rest = { ...previous }; delete rest[level.id]; rest[next.id] = String(next.stocked_quantity); return rest })
  }
  const forget = (id: string) => { setLevels(previous => { const next = { ...previous }; delete next[id]; return next }); setValues(previous => { const next = { ...previous }; delete next[id]; return next }); setRemoved(previous => previous.filter(key => key !== id)) }
  const save = async (product: string, draftVariants: ProductDraft['variants']) => {
    const edits = validate(draftVariants)
    for (const link of links) {
      const url = `/admin/products/${product}/variants/${link.variant}/inventory-items`
      try { await adminRequest(url, { inventory_item_id: link.item.id, required_quantity: Number(link.required_quantity) }) }
      catch (failure) {
        const { variant } = await adminRequest(`/admin/products/${product}/variants/${link.variant}?fields=inventory_items.*`)
        if (!variant.inventory_items?.some((row: Entity) => row.inventory_item_id === link.item.id && Number(row.required_quantity) === Number(link.required_quantity))) throw failure
      }
      setVariants(previous => previous.map(row => row.id === link.variant ? { ...row, manage_inventory: true, inventory_items: [...(row.inventory_items ?? []).filter((item: Entity) => item.inventory_item_id !== link.item.id), { inventory_item_id: link.item.id, inventory: link.item, required_quantity: Number(link.required_quantity) }] } : row))
      setLinks(previous => previous.filter(row => row.variant !== link.variant))
    }
    // Recheck item membership after the product update, before changing levels.
    if (edits.length) {
      const linked: string[] = []
      for (let offset = 0;; offset += 100) {
        const { variants: fresh, count } = await adminRequest(`/admin/products/${product}/variants?limit=100&offset=${offset}&fields=id,inventory_items.*`)
        linked.push(...fresh.flatMap((variant: Entity) => (variant.inventory_items ?? []).map((link: Entity) => link.inventory_item_id)))
        if (fresh.length < 100 || offset + fresh.length >= count) break
        if (offset >= 10000) throw new Error('Inventory links could not all be checked. Your stock draft is kept.')
      }
      if (edits.some(edit => !linked.includes(edit.level.item))) throw new Error('Inventory links changed. Your stock draft is kept; discard to reload current links.')
    }
    for (const { level, quantity, remove } of edits) {
      try {
        if (remove) {
          await adminRequest(`/admin/inventory-items/${level.item}/inline-level/${level.location}`, { expected: { stocked_quantity: level.stocked_quantity, reserved_quantity: level.reserved_quantity, updated_at: level.updated_at } }, 'DELETE')
          forget(level.id)
        } else if (level.pending) {
          await adminRequest(`/admin/inventory-items/${level.item}/location-levels`, { location_id: level.location, stocked_quantity: quantity })
          const item = await freshItem(level.item)
          const fresh = item.location_levels.find((row: Entity) => row.location_id === level.location)
          if (!fresh) throw new Error('New stock location could not be confirmed. Your draft is kept.')
          confirmed(level, fresh)
        } else {
          const { level: fresh } = await adminRequest(`/admin/inventory-items/${level.item}/inline-level/${level.location}`, { stocked_quantity: quantity, expected: { stocked_quantity: level.stocked_quantity, reserved_quantity: level.reserved_quantity, updated_at: level.updated_at } })
          confirmed(level, fresh)
        }
      } catch (failure) {
        try {
          const item = await freshItem(level.item), fresh = item.location_levels.find((row: Entity) => row.location_id === level.location)
          if (remove && !fresh) { forget(level.id); continue }
          if (!remove && fresh && Number(fresh.stocked_quantity) === quantity && Number(fresh.reserved_quantity) === level.reserved_quantity) { confirmed(level, fresh); continue }
        } catch { /* Keep unconfirmed changes. */ }
        throw failure
      }
    }
  }
  const fields = (draft: ProductDraft['variants'][number], change: (key: string, value: boolean) => void) => {
    const variant = variants.find(row => row.id === draft.id), tracking = Boolean(draft.fields.manage_inventory)
    const items = [...variant?.inventory_items ?? [], ...links.filter(link => link.variant === draft.id).map(link => ({ inventory_item_id: link.item.id, inventory: link.item, required_quantity: link.required_quantity, pending: true }))]
    return <div className="rh-stock-fields"><label className="rh-stock-check"><input type="checkbox" checked={tracking} onChange={event => change('manage_inventory', event.target.checked)}/>Track inventory</label><label className="rh-stock-check"><input type="checkbox" checked={Boolean(draft.fields.allow_backorder)} onChange={event => change('allow_backorder', event.target.checked)}/>Allow backorders</label>{!tracking && variant?.manage_inventory && <small className="rh-inline-error">Turning tracking off unlinks this variant from its inventory items when saved.</small>}{!variant && <small>{error ? 'Stock unavailable' : 'Loading stock…'}</small>}<fieldset disabled={!tracking}>
    {items.map((link: Entity) => {
      const item = link.inventory_item_id, current = Object.values(levels).filter(level => level.item === item)
      return <div className="rh-stock-item" key={item}><strong>{link.inventory?.title || 'Linked inventory'}</strong>{Number(link.required_quantity) > 1 && <small>{link.required_quantity} units per variant</small>}{current.map(level => <div className={removed.includes(level.id) ? 'rh-stock-removing' : ''} key={level.id}><label><span>{level.name} · On hand</span><input aria-label={`On-hand stock — ${variant?.title || draft.fields.title} — ${level.name}`} type="number" min={level.reserved_quantity} step="1" disabled={removed.includes(level.id)} value={values[level.id]} onChange={event => setValues(previous => ({ ...previous, [level.id]: event.target.value }))}/><small>{level.reserved_quantity} reserved · {Number(values[level.id]) - level.reserved_quantity} available · {level.incoming_quantity} incoming</small></label>{removed.includes(level.id) ? <><small>Location will be removed when saved.</small><button type="button" onClick={() => setRemoved(previous => previous.filter(id => id !== level.id))}>Keep location</button></> : <button type="button" disabled={!level.pending && (level.stocked_quantity !== 0 || level.reserved_quantity !== 0 || level.incoming_quantity !== 0 || values[level.id] !== '0')} onClick={() => level.pending ? forget(level.id) : setRemoved(previous => [...previous, level.id])}>Remove location</button>}</div>)}<label className="rh-inline-field"><span>Stock at another location</span><select aria-label={`Add stock location — ${draft.fields.title}`} value="" onChange={event => {
        const location = locations.find(location => location.id === event.target.value)
        if (!location) return
        const id = `new:${item}:${location.id}`, level = { id, item, location: location.id, name: location.name, stocked_quantity: 0, reserved_quantity: 0, incoming_quantity: 0, updated_at: '', pending: true }
        setLevels(previous => ({ ...previous, [id]: level })); setValues(previous => ({ ...previous, [id]: '0' }))
      }}><option value="">Choose a location…</option>{locations.filter(location => !current.some(level => level.location === location.id)).map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>{current.some(level => level.stocked_quantity || level.reserved_quantity || level.incoming_quantity) && <small>Save zero stock first to remove a location. Reserved and incoming stock must also be zero.</small>}</div>
    })}
    {tracking && variant && !items.length && <InventorySearch onSelect={id => { void addLink(draft.id, id) }}/>}
    {links.filter(link => link.variant === draft.id).map(link => <label className="rh-inline-field" key={link.item.id}><span>Units required per variant</span><input type="number" min="1" step="1" value={link.required_quantity} onChange={event => setLinks(previous => previous.map(row => row.variant === draft.id ? { ...row, required_quantity: event.target.value } : row))}/><button type="button" onClick={() => { setLinks(previous => previous.filter(row => row.variant !== draft.id)); if (!variants.some(row => row.inventory_items?.some((item: Entity) => item.inventory_item_id === link.item.id)) && !links.some(row => row.variant !== draft.id && row.item.id === link.item.id)) Object.values(levels).filter(level => level.item === link.item.id).forEach(level => forget(level.id)) }}>Cancel inventory link</button></label>)}
    </fieldset></div>
  }
  return { dirty, load, save, validate, fields, error }
}
