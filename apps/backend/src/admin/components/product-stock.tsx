import { useState } from 'react'
import { adminRequest, type Entity } from '../lib/inline-edit'
export type StockLevel = { id: string; item: string; location: string; name: string; stocked_quantity: number; reserved_quantity: number; updated_at: string }
export function useProductStock() {
  const [variants, setVariants] = useState<Entity[]>([])
  const [levels, setLevels] = useState<Record<string, StockLevel>>({})
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const dirty = Object.keys(values).some(key => values[key] !== String(levels[key]?.stocked_quantity))
  const load = async (id: string) => {
    setError(''); setValues({}); setLevels({}); setVariants([])
    try {
      const rows: Entity[] = []
      for (let offset = 0;; offset += 100) {
        const page = await adminRequest(`/admin/products/${id}/variants?${new URLSearchParams({ limit: '100', offset: String(offset), fields: 'id,title,manage_inventory,inventory_items.*,inventory_items.inventory.id,inventory_items.inventory.title,*inventory_items.inventory.location_levels' })}`)
        rows.push(...page.variants)
        if (rows.length >= page.count || page.variants.length < 100) break
        if (rows.length >= 10000) throw new Error('Use the inventory tools for this large product.')
      }
      const { stock_locations: locations } = await adminRequest('/admin/stock-locations?limit=9999&fields=id,name')
      const all: Record<string, StockLevel> = {}
      rows.forEach(variant => (variant.inventory_items ?? []).forEach((link: Entity) => (link.inventory?.location_levels ?? []).forEach((level: Entity) => {
        all[level.id] = { ...level, id: level.id, updated_at: level.updated_at, stocked_quantity: Number(level.stocked_quantity), reserved_quantity: Number(level.reserved_quantity), item: link.inventory.id, location: level.location_id, name: locations.find((location: Entity) => location.id === level.location_id)?.name ?? level.location_id }
      })))
      setVariants(rows); setLevels(all); setValues(Object.fromEntries(Object.values(all).map(level => [level.id, String(level.stocked_quantity)])))
    } catch (failure) { setError((failure as Error).message) }
  }
  const validate = () => Object.keys(values).filter(key => values[key] !== String(levels[key].stocked_quantity)).map(key => {
    const value = values[key].trim()
    const quantity = Number(value)
    if (!value || !Number.isSafeInteger(quantity) || quantity < levels[key].reserved_quantity || quantity < 0) throw new Error('On-hand stock must be a whole number at least as large as reserved stock.')
    return { level: levels[key], quantity }
  })
  const save = async () => {
    for (const { level, quantity } of validate()) {
      try {
        const data = await adminRequest(`/admin/inventory-items/${level.item}/inline-level/${level.location}`, { stocked_quantity: quantity, expected: { stocked_quantity: level.stocked_quantity, reserved_quantity: level.reserved_quantity, updated_at: level.updated_at } })
        const next = { ...level, ...data.level, stocked_quantity: Number(data.level.stocked_quantity), reserved_quantity: Number(data.level.reserved_quantity) }
        setLevels(previous => ({ ...previous, [level.id]: next }))
        setValues(previous => ({ ...previous, [level.id]: String(next.stocked_quantity) }))
      } catch (failure) {
        // A lost response must not replay an adjustment. Reconcile an absolute
        // target with a fresh protected read; ambiguous outcomes remain a draft.
        try {
          const { inventory_item } = await adminRequest(`/admin/inventory-items/${level.item}?fields=*location_levels`)
          const fresh = inventory_item.location_levels.find((row: Entity) => row.id === level.id)
          if (fresh && Number(fresh.stocked_quantity) === quantity && Number(fresh.reserved_quantity) === level.reserved_quantity) {
            setLevels(previous => ({ ...previous, [level.id]: { ...level, ...fresh, stocked_quantity: Number(fresh.stocked_quantity), reserved_quantity: Number(fresh.reserved_quantity) } }))
            setValues(previous => ({ ...previous, [level.id]: String(quantity) }))
            continue
          }
        } catch { /* Keep the unconfirmed draft. */ }
        throw failure
      }
    }
  }
  const fields = (id: string) => {
    const variant = variants.find(row => row.id === id)
    if (!variant) return <small>{error ? 'Stock unavailable' : 'Loading stock…'}</small>
    if (!variant.manage_inventory) return <small>Not tracked</small>
    const links = variant.inventory_items ?? []
    if (!links.length) return <small>No inventory item linked. Use inventory tools.</small>
    return <div className="rh-stock-fields">{links.map((link: Entity) => <div key={link.inventory_item_id ?? link.inventory.id}>{links.length > 1 && <strong>{link.inventory.title}</strong>}{Number(link.required_quantity) > 1 && <small>{link.required_quantity} units per variant</small>}{(link.inventory?.location_levels ?? []).map((row: Entity) => {
      const level = levels[row.id]
      if (!level) return null
      return <label key={row.id}><span>{level.name} · On hand</span><input aria-label={`On-hand stock — ${variant.title} — ${level.name}`} type="number" min={level.reserved_quantity} step="1" value={values[row.id]} onChange={event => setValues(previous => ({ ...previous, [row.id]: event.target.value }))}/><small>{level.reserved_quantity} reserved · {Number(values[row.id]) - level.reserved_quantity} available{links.length > 1 ? ' units' : ''}</small></label>
    })}{!link.inventory?.location_levels?.length && <small>No stocked location. Use inventory tools.</small>}</div>)}</div>
  }
  return { dirty, load, save, validate, fields, error }
}
