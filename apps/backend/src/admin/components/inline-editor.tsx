import { useEffect, useId, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useBlocker } from 'react-router-dom'
import { addressFields, adminRequest, hasChanges, inlineRecordUrl, isBasePrice, orderDraft, productDraft, saveInline, type Entity, type OrderDraft, type Price, type ProductDraft } from '../lib/inline-edit'
import '../styles/inline-editor.css'

const labels: Record<string, string> = { title: 'Title', subtitle: 'Subtitle', handle: 'Handle', material: 'Material', weight: 'Weight (g)', length: 'Length (mm)', width: 'Width (mm)', height: 'Height (mm)', origin_country: 'Origin country code', hs_code: 'HS code', mid_code: 'MID code', sku: 'SKU', barcode: 'Barcode', ean: 'EAN', upc: 'UPC', first_name: 'First name', last_name: 'Last name', company: 'Company', address_1: 'Street address', address_2: 'Apartment / suite', city: 'City', province: 'State / province', postal_code: 'Postal code', country_code: 'Country code', phone: 'Phone' }
const lookups = [
  { key: 'collection_id', label: 'Collection', path: 'collections', response: 'collections', name: 'title' },
  { key: 'type_id', label: 'Product type', path: 'product-types', response: 'product_types', name: 'value' },
  { key: 'shipping_profile_id', label: 'Shipping profile', path: 'shipping-profiles', response: 'shipping_profiles', name: 'name' },
  { key: 'categories', label: 'Categories', path: 'product-categories', response: 'product_categories', name: 'name', multiple: true },
  { key: 'tags', label: 'Tags', path: 'product-tags', response: 'product_tags', name: 'value', multiple: true },
  { key: 'sales_channels', label: 'Sales channels', path: 'sales-channels', response: 'sales_channels', name: 'name', multiple: true },
]
type Choice = { id: string; label: string }
type Props = { kind: 'products' | 'orders'; id: string; onEditingChange?: (value: boolean) => void; editRequest?: number }
const inputType = (key: string) => ['weight', 'length', 'width', 'height'].includes(key) ? 'number' : 'text'

async function loadChoices(lookup: typeof lookups[number]) {
  const choices: Choice[] = []
  let offset = 0
  for (;;) {
    const data = await adminRequest(`/admin/${lookup.path}?limit=100&offset=${offset}`)
    const rows = data[lookup.response] as Entity[]
    if (!Array.isArray(rows)) throw new Error('Options could not be loaded.')
    choices.push(...rows.map(row => ({ id: row.id, label: row[lookup.name] ?? row.id })))
    offset += rows.length
    if (rows.length < 100 || offset >= data.count) return choices
    if (offset >= 10000) throw new Error('Use the section editor to search this large option list.')
  }
}

// Mount the editor only while active so its route blocker does not compete with
// the blockers in Medusa's native edit dialogs.
const DraftGuard = ({ dirty, saving, onDiscard }: { dirty: boolean; saving: boolean; onDiscard: () => void }) => {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (dirty || saving) && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search))
  useEffect(() => {
    if (!dirty && !saving) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, saving])
  if (blocker.state !== 'blocked') return null
  return <div role="alert" className="rh-inline-leave"><strong>{saving ? 'Saving changes…' : 'You have unsaved changes.'}</strong><p>{saving ? 'Stay on this page until the save finishes.' : 'Stay to save your draft, or discard it and leave.'}</p><button type="button" onClick={() => blocker.reset()}>Stay on page</button>{!saving && <button type="button" onClick={() => { onDiscard(); blocker.proceed() }}>Discard and leave</button>}</div>
}

export const InlineEditor = ({ kind, id, onEditingChange, editRequest = 0 }: Props) => {
  const [record, setRecord] = useState<Entity | null>(null)
  const [draft, setDraft] = useState<ProductDraft | OrderDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [choices, setChoices] = useState<Record<string, Choice[]>>({})
  const [missingChoices, setMissingChoices] = useState<string[]>([])
  const [discard, setDiscard] = useState(false)
  const queryClient = useQueryClient()
  const formId = useId()
  const form = useRef<HTMLFormElement>(null)
  const generation = useRef(0)
  const normalizer = kind === 'products' ? productDraft : orderDraft
  const dirty = Boolean(record && draft && hasChanges(normalizer(record), draft))
  const active = loading || Boolean(record && draft)
  useEffect(() => { onEditingChange?.(active) }, [active, onEditingChange])
  useEffect(() => { setRecord(null); setDraft(null); setLoading(false); setError(''); setNotice(''); setDiscard(false) }, [id])
  useEffect(() => () => { generation.current++; onEditingChange?.(false) }, [id, onEditingChange])
  useEffect(() => {
    if (!active) return
    const customizer = document.querySelector<HTMLButtonElement>('button[aria-label="Customize layout"]')
    if (!customizer) return
    const disabled = customizer.disabled
    customizer.disabled = true
    return () => { customizer.disabled = disabled }
  }, [active])

  const begin = async () => {
    const token = ++generation.current
    setLoading(true); setError(''); setNotice(''); setDiscard(false)
    try {
      const data = await adminRequest(inlineRecordUrl(kind, id))
      if (token !== generation.current) return
      const next = data[kind === 'products' ? 'product' : 'order']
      if (!next) throw new Error('This record could not be loaded.')
      setRecord(next); setDraft(normalizer(next))
      if (kind === 'products') {
        const results = await Promise.allSettled(lookups.map(loadChoices))
        if (token !== generation.current) return
        const options: Record<string, Choice[]> = {}
        const missing: string[] = []
        results.forEach((result, index) => {
          const lookup = lookups[index]
          if (result.status === 'fulfilled') options[lookup.key] = result.value
          else missing.push(lookup.label)
        })
        setChoices(options); setMissingChoices(missing)
      }
    } catch (failure) { if (token === generation.current) setError((failure as Error).message) }
    finally { if (token === generation.current) setLoading(false) }
  }
  useEffect(() => { if (editRequest) void begin() }, [editRequest])
  const close = () => { generation.current++; setRecord(null); setDraft(null); setError(''); setDiscard(false); setLoading(false) }
  const openTool = () => { if (!dirty && !saving) close() }
  const save = async () => {
    if (!record || !draft || saving || !dirty) return
    setSaving(true); setError(''); setNotice('')
    try {
      await saveInline(kind, record, draft)
      // Medusa's native sections and list caches use these shared prefixes.
      await Promise.all([kind, ...(kind === 'products' ? ['product_variants', 'rh-product-suggestions'] : ['order_preview', 'rh-order-suggestions'])].map(key => queryClient.invalidateQueries({ queryKey: [key] })))
      close(); setNotice('Changes saved.')
    } catch (failure) { setError((failure as Error).message || 'Save could not be confirmed. Your draft is kept; check the record before retrying.') }
    finally { setSaving(false) }
  }
  const p = draft as ProductDraft
  const o = draft as OrderDraft
  const setProductField = (key: string, value: string | boolean) => setDraft(previous => ({ ...(previous as ProductDraft), fields: { ...(previous as ProductDraft).fields, [key]: value } }))
  const textField = (key: string, values: Record<string, string | boolean>, change: (key: string, value: string) => void, suffix = '') => <label className="rh-inline-field" key={key}><span>{labels[key] ?? key}</span><input aria-label={`${labels[key] ?? key}${suffix}`} type={inputType(key)} min={inputType(key) === 'number' ? 0 : undefined} step="any" value={String(values[key] ?? '')} onChange={event => change(key, event.target.value)} required={key === 'title' || key === 'handle'} autoComplete="off" /></label>
  const relationField = (lookup: typeof lookups[number]) => {
    const value = lookup.multiple ? p.relations[lookup.key] : String(p.fields[lookup.key])
    const options = [...choices[lookup.key] ?? []]
    // Keep selected relations visible even if a list is unavailable or filtered.
    for (const selected of Array.isArray(value) ? value : [value]) {
      if (!selected || options.some(item => item.id === selected)) continue
      const current = lookup.multiple ? record?.[lookup.key]?.find((item: Entity) => item.id === selected) : record?.[lookup.key.replace('_id', '')]
      options.push({ id: selected, label: current?.[lookup.name] ?? selected })
    }
    if (lookup.multiple) return <div className="rh-inline-field" key={lookup.key}><span>{lookup.label}</span><details className="rh-inline-multiple"><summary>{options.filter(option => (value as string[]).includes(option.id)).map(option => option.label).join(', ') || 'None selected'}</summary><div role="group" aria-label={lookup.label}>{options.map(option => <label key={option.id}><input type="checkbox" aria-label={`${lookup.label}: ${option.label}`} disabled={!choices[lookup.key]} checked={(value as string[]).includes(option.id)} onChange={event => setDraft(previous => ({ ...(previous as ProductDraft), relations: { ...(previous as ProductDraft).relations, [lookup.key]: (event.target.checked ? [...(previous as ProductDraft).relations[lookup.key], option.id] : (previous as ProductDraft).relations[lookup.key].filter(id => id !== option.id)).sort() } }))}/>{option.label}</label>)}{!options.length && <small>No options available.</small>}</div></details></div>
    return <label className="rh-inline-field" key={lookup.key}><span>{lookup.label}</span><select aria-label={lookup.label} value={value} disabled={!choices[lookup.key]} onChange={event => setProductField(lookup.key, event.target.value)}><option value="">{lookup.key === 'shipping_profile_id' ? 'Choose a shipping profile' : 'None'}</option>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
  }
  return <div className={`rh-inline-editor ${active ? 'is-editing' : ''}`}>
    <div className="rh-inline-toolbar">
      <div><strong>{active ? kind === 'products' ? 'Edit all product fields' : 'Edit contact & addresses' : kind === 'products' ? 'Quick edit' : 'Order quick edit'}</strong><span>{loading ? 'Loading current values…' : active ? dirty ? 'Unsaved changes' : 'No changes yet' : kind === 'products' ? 'Review and edit the product together.' : 'Edit customer email and both addresses here.'}</span></div>
      <div className="rh-inline-buttons">{active ? <><button type="button" disabled={saving} onClick={() => dirty ? setDiscard(true) : close()}>Cancel</button><button type="submit" form={formId} className="primary" disabled={saving || loading || !dirty}>{saving ? 'Saving…' : 'Save changes'}</button></> : <button type="button" className="primary" onClick={begin}>Edit all</button>}</div>
    </div>
    {notice && <p role="status" className="rh-inline-success">{notice}</p>}
    {error && <p role="alert" className="rh-inline-error">{error}</p>}
    {discard && <div role="alert" className="rh-inline-discard"><span>Discard your unsaved changes?</span><button type="button" onClick={() => setDiscard(false)}>Keep editing</button><button type="button" onClick={close}>Discard changes</button></div>}
    {record && draft && <><DraftGuard dirty={dirty} saving={saving} onDiscard={close}/><form id={formId} ref={form} onSubmit={event => { event.preventDefault(); void save() }} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); form.current?.requestSubmit() } }}><fieldset disabled={loading || saving} className="rh-inline-body">
      {kind === 'products' ? <>
        <section className="rh-inline-card"><h2>Product details</h2><div className="rh-inline-grid">{['title', 'subtitle', 'handle', 'material'].map(key => textField(key, p.fields, setProductField))}<label className="rh-inline-field"><span>Status</span><select aria-label="Status" value={String(p.fields.status)} onChange={event => setProductField('status', event.target.value)}>{['draft', 'proposed', 'published', 'rejected'].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="rh-inline-check"><input type="checkbox" checked={Boolean(p.fields.discountable)} onChange={event => setProductField('discountable', event.target.checked)}/>Allow discounts</label><label className="rh-inline-field wide"><span>Description</span><textarea aria-label="Description" rows={9} value={String(p.fields.description)} onChange={event => setProductField('description', event.target.value)}/></label></div></section>
        <section className="rh-inline-card"><h2>Images & inventory</h2><div className="rh-inline-photos">{(record.images ?? []).map((image: Entity) => <img key={image.id ?? image.url} src={image.url} alt={record.title}/>)}</div><p>Image uploads and stock adjustments have their own tools.</p><div className="rh-inline-links"><Link onClick={openTool} to={`/products/${id}/media?view=edit`}>Manage images</Link><Link onClick={openTool} to={`/products/${id}/stock`}>Manage stock</Link></div></section>
        <section className="rh-inline-card wide"><h2>Variants & prices</h2><p>Update existing SKUs, barcodes and base prices. Regional and quantity prices are preserved.</p>{p.variants.map((variant, index) => {
          const source = record.variants.find((item: Entity) => item.id === variant.id)
          const suffix = ` — variant ${index + 1}`
          const change = (key: string, value: string, price = false) => setDraft(previous => ({ ...(previous as ProductDraft), variants: (previous as ProductDraft).variants.map(item => item.id === variant.id ? { ...item, [price ? 'prices' : 'fields']: { ...item[price ? 'prices' : 'fields'], [key]: value } } : item) }))
          return <div className="rh-inline-variant" key={variant.id}><h3>{source.title || `Variant ${index + 1}`}<small> {source.manage_inventory ? 'Inventory tracked' : 'Inventory not tracked'}</small></h3><div className="rh-inline-grid">{['title', 'sku', 'barcode', 'ean', 'upc'].map(key => textField(key, variant.fields, change, suffix))}{(source.prices ?? []).filter(isBasePrice).map((price: Price) => <label className="rh-inline-field" key={price.id}><span>Price ({price.currency_code.toUpperCase()})</span><input aria-label={`Price ${price.currency_code.toUpperCase()}${suffix}`} type="number" min="0" step="any" required value={variant.prices[price.id]} onChange={event => change(price.id, event.target.value, true)}/></label>)}</div></div>
        })}<Link onClick={openTool} to={`/products/${id}/prices`}>More pricing options</Link></section>
        <section className="rh-inline-card"><h2>Organization & selling</h2>{missingChoices.length > 0 && <p className="rh-inline-error" role="status">Could not load {missingChoices.join(', ')} options. Those fields are kept unchanged.</p>}<div className="rh-inline-grid">{lookups.map(relationField)}</div></section>
        <section className="rh-inline-card"><h2>Shipping attributes</h2><div className="rh-inline-grid">{['weight', 'length', 'width', 'height', 'origin_country', 'hs_code', 'mid_code'].map(key => textField(key, p.fields, setProductField))}</div></section>
      </> : <>
        <section className="rh-inline-card wide"><h2>Customer contact</h2><label className="rh-inline-field"><span>Email</span><input aria-label="Customer email" type="email" required value={o.email} onChange={event => setDraft(previous => ({ ...(previous as OrderDraft), email: event.target.value }))}/></label><p>Updates the contact email for this order.</p></section>
        {(['shipping_address', 'billing_address'] as const).map(key => <section className="rh-inline-card" key={key}><h2>{key === 'shipping_address' ? 'Shipping address' : 'Billing address'}</h2><div className="rh-inline-grid">{addressFields.map(field => textField(field, o[key], (name, value) => setDraft(previous => ({ ...(previous as OrderDraft), [key]: { ...(previous as OrderDraft)[key], [name]: value } })), ` — ${key === 'shipping_address' ? 'shipping' : 'billing'}`))}</div></section>)}
      </>}
    </fieldset></form></>}
  </div>
}
