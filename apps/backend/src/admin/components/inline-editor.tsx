import { useEffect, useId, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useBlocker } from 'react-router-dom'
import { addressFields, adminRequest, hasChanges, inlineRecordUrl, orderDraft, productDraft, productUpdate, saveInline, type Entity, type OrderDraft, type ProductDraft } from '../lib/inline-edit'
import { ProductPricing, type PricingOptions } from './product-pricing'
import { baseRow } from '../lib/product-prices'
import { useProductStock } from './product-stock'
import { DescriptionEditor } from './description-editor'
import { ProductImages, uploadProductImage } from './product-images'
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
type Props = { kind: 'products' | 'orders'; id: string; onEditingChange?: (value: boolean) => void; editRequest?: number; workspace?: { title: string; thumbnail?: string | null } }
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

export const InlineEditor = ({ kind, id, onEditingChange, editRequest = 0, workspace }: Props) => {
  const [record, setRecord] = useState<Entity | null>(null)
  const [draft, setDraft] = useState<ProductDraft | OrderDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [choices, setChoices] = useState<Record<string, Choice[]>>({})
  const [missingChoices, setMissingChoices] = useState<string[]>([])
  const [pricingOptions, setPricingOptions] = useState<PricingOptions>({ regions: [], currencies: [], error: '' })
  const [discard, setDiscard] = useState(false)
  const queryClient = useQueryClient()
  const formId = useId()
  const form = useRef<HTMLFormElement>(null)
  const generation = useRef(0)
  const normalizer = kind === 'products' ? productDraft : orderDraft
  const stock = useProductStock()
  const pendingImages = useRef(new Map<string, { file: File; preview: string; uploaded?: string }>())
  const clearImages = () => { pendingImages.current.forEach(image => URL.revokeObjectURL(image.preview)); pendingImages.current.clear() }
  useEffect(() => () => clearImages(), [])
  const dirty = stock.dirty || Boolean(record && draft && hasChanges(normalizer(record), draft))
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
    clearImages()
    setLoading(true); setError(''); setNotice(''); setDiscard(false)
    try {
      const data = await adminRequest(inlineRecordUrl(kind, id))
      if (token !== generation.current) return
      const next = data[kind === 'products' ? 'product' : 'order']
      if (!next) throw new Error('This record could not be loaded.')
      setRecord(next); setDraft(normalizer(next))
      if (kind === 'products') {
        const results = await Promise.allSettled(lookups.map(loadChoices))
        await Promise.all([stock.load(id), (async () => {
          try {
            const [regions, stores] = await Promise.all([adminRequest('/admin/regions?limit=9999&fields=id,name,currency_code'), adminRequest('/admin/stores')])
            if (token === generation.current) setPricingOptions({ regions: regions.regions, currencies: (stores.stores?.[0]?.supported_currencies ?? []).map((currency: Entity) => currency.currency_code), error: '' })
          } catch { if (token === generation.current) setPricingOptions({ regions: [], currencies: [], error: 'Could not load currencies and regions. Existing price amounts remain editable.' }) }
        })()])
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
  const persistent = Boolean(workspace && kind === 'products')
  useEffect(() => { if (persistent) void begin() }, [id, persistent])
  useEffect(() => { if (editRequest) void begin() }, [editRequest])
  const close = () => { generation.current++; setRecord(null); setDraft(null); setError(''); setDiscard(false); setLoading(false) }
  const openTool = () => { if (!dirty && !saving) close() }
  const save = async () => {
    if (!record || !draft || saving || !dirty) return
    setSaving(true); setError(''); setNotice('')
    try {
      let prepared = draft
      if (kind === 'products') {
        stock.validate((draft as ProductDraft).variants)
        const product = draft as ProductDraft
        // Validate common fields before uploading. Uploads are staged until the
        // product POST attaches them; retry reuses each confirmed upload URL.
        productUpdate(record, { ...product, images: productDraft(record).images, thumbnail: record.thumbnail ?? '' })
        prepared = { ...product, images: product.images.map(image => ({ ...image })) }
        for (const image of (prepared as ProductDraft).images) {
          const pending = pendingImages.current.get(image.key)
          if (!pending) continue
          pending.uploaded ??= await uploadProductImage(pending.file)
          if ((prepared as ProductDraft).thumbnail === image.url) (prepared as ProductDraft).thumbnail = pending.uploaded
          image.url = pending.uploaded
          setDraft({ ...(prepared as ProductDraft), images: (prepared as ProductDraft).images.map(row => ({ ...row })) })
        }
      }
      const saved = await saveInline(kind, record, prepared)
      if (persistent) { setRecord(saved); setDraft(normalizer(saved)); clearImages() }
      if (kind === 'products') {
        try { await stock.save(id, (prepared as ProductDraft).variants) }
        catch (failure) { throw new Error(`Product fields and images saved. Remaining stock changes need attention: ${(failure as Error).message}`) }
      }
      // Medusa's native sections and list caches use these shared prefixes.
      await Promise.all([kind, ...(kind === 'products' ? ['product_variants', 'rh-product-suggestions', 'inventory_items', 'inventory_levels'] : ['order_preview', 'rh-order-suggestions'])].map(key => queryClient.invalidateQueries({ queryKey: [key] })))
      if (persistent) { setRecord(saved); setDraft(normalizer(saved)); setDiscard(false) }
      else close()
      if (kind === 'products') await stock.load(id)
      setNotice('Changes saved.')
    } catch (failure) {
      const message = (failure as Error).message || 'Save could not be confirmed. Your draft is kept; check the record before retrying.'
      setError(persistent ? message.replace('cancel and reopen Edit all to load the latest values', 'discard your draft to load the latest values') : message)
    }
    finally { setSaving(false) }
  }
  const discardDraft = () => { if (persistent) void begin(); else close() }
  const addImages = (files: FileList) => {
    const selected = Array.from(files)
    if (selected.some(file => !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024)) { setError('Choose JPEG, PNG, WebP or GIF images under 10 MB each.'); return }
    const images = selected.map(file => {
      const key = `pending-${crypto.randomUUID()}`
      const url = URL.createObjectURL(file)
      pendingImages.current.set(key, { file, preview: url })
      return { key, url }
    })
    setDraft(previous => ({ ...(previous as ProductDraft), images: [...(previous as ProductDraft).images, ...images], thumbnail: (previous as ProductDraft).thumbnail || images[0]?.url || '' }))
    setError('')
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
    if (lookup.multiple) return <div className="rh-inline-field" key={lookup.key}><span>{lookup.label}</span><div className="rh-inline-multiple" role="group" aria-label={lookup.label}>{options.map(option => <label key={option.id}><input type="checkbox" aria-label={`${lookup.label}: ${option.label}`} disabled={!choices[lookup.key]} checked={(value as string[]).includes(option.id)} onChange={event => setDraft(previous => ({ ...(previous as ProductDraft), relations: { ...(previous as ProductDraft).relations, [lookup.key]: (event.target.checked ? [...(previous as ProductDraft).relations[lookup.key], option.id] : (previous as ProductDraft).relations[lookup.key].filter(id => id !== option.id)).sort() } }))}/>{option.label}</label>)}{!options.length && <small>No options available.</small>}</div></div>
    return <label className="rh-inline-field" key={lookup.key}><span>{lookup.label}</span><select aria-label={lookup.label} value={value} disabled={!choices[lookup.key]} onChange={event => setProductField(lookup.key, event.target.value)}><option value="">{lookup.key === 'shipping_profile_id' ? 'Choose a shipping profile' : 'None'}</option>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
  }
  return <div className={`rh-inline-editor ${active ? 'is-editing' : ''} ${persistent ? 'rh-product-editor' : ''}`}>
    <div className="rh-inline-toolbar">
      {persistent ? <div className="rh-inline-identity">{(record?.thumbnail ?? workspace?.thumbnail) && <img src={record?.thumbnail ?? workspace?.thumbnail} alt=""/>}<div><h1>{record?.title ?? workspace?.title}</h1><span role="status">{loading ? 'Loading product…' : saving ? 'Saving changes…' : dirty ? 'Unsaved changes' : notice || 'Edit fields below, then save your changes.'}</span></div></div> : <div><strong>{active ? kind === 'products' ? 'Edit all product fields' : 'Edit contact & addresses' : kind === 'products' ? 'Quick edit' : 'Order quick edit'}</strong><span>{loading ? 'Loading current values…' : active ? dirty ? 'Unsaved changes' : 'No changes yet' : kind === 'products' ? 'Review and edit the product together.' : 'Edit customer email and both addresses here.'}</span></div>}
      <div className="rh-inline-buttons">{persistent && record?.status === 'published' && <a className="rh-preview-button" href={`/us/products/${encodeURIComponent(record.handle)}`} target="_blank" rel="noopener noreferrer">Storefront preview ↗</a>}{persistent ? <><button type="button" disabled={saving || loading || !dirty} onClick={() => setDiscard(true)}>Discard</button><button type="submit" form={formId} className="primary" disabled={saving || loading || !dirty}>{saving ? 'Saving…' : 'Save changes'}</button>{!active && !loading && <button type="button" onClick={begin}>Retry loading</button>}</> : active ? <><button type="button" disabled={saving} onClick={() => dirty ? setDiscard(true) : close()}>Cancel</button><button type="submit" form={formId} className="primary" disabled={saving || loading || !dirty}>{saving ? 'Saving…' : 'Save changes'}</button></> : <button type="button" className="primary" onClick={begin}>Edit all</button>}</div>
    </div>
    {notice && !persistent && <p role="status" className="rh-inline-success">{notice}</p>}
    {error && <p role="alert" className="rh-inline-error">{error}</p>}
    {discard && <div role="alert" className="rh-inline-discard"><span>Discard your unsaved changes?</span><button type="button" onClick={() => setDiscard(false)}>Keep editing</button><button type="button" onClick={discardDraft}>Discard changes</button></div>}
    {record && draft && <><DraftGuard dirty={dirty} saving={saving} onDiscard={close}/><form id={formId} ref={form} onSubmit={event => { event.preventDefault(); void save() }} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); form.current?.requestSubmit() } }}><fieldset disabled={loading || saving} className="rh-inline-body">
      {kind === 'products' ? <>
        <section className="rh-inline-card"><h2>Product details</h2><div className="rh-inline-grid"><div className="wide">{textField('title', p.fields, setProductField)}</div>{['subtitle', 'material'].map(key => textField(key, p.fields, setProductField))}<DescriptionEditor value={String(p.fields.description)} onChange={value => setProductField('description', value)}/><div className="wide">{textField('handle', p.fields, setProductField)}</div></div></section>
        <ProductImages draft={p} change={value => setDraft(value)} add={addImages}/>
        <section className="rh-inline-card wide rh-variants-card"><div className="rh-inline-section-heading"><h2>Variants, pricing & stock</h2><Link onClick={openTool} to={`/products/${id}/variants/create`}>+ Add variant</Link></div>{stock.error && <p className="rh-inline-error" role="status">Stock could not be loaded. Other fields can still be saved. {stock.error}</p>}{!p.variants.length && <p>No variants yet. Add a variant to set a SKU and price.</p>}<div className="rh-variant-table" role="table" aria-label="Variants, pricing and stock">{p.variants.map((variant, index) => {
            const suffix = ` — variant ${index + 1}`
            const change = (key: string, value: string | boolean, price = false) => setDraft(previous => ({ ...(previous as ProductDraft), variants: (previous as ProductDraft).variants.map(item => item.id === variant.id ? price ? { ...item, prices: { ...item.prices, [key]: String(value) } } : { ...item, fields: { ...item.fields, [key]: value } } : item) }))
            return <div className="rh-variant-row" role="row" key={variant.id}><div role="cell">{textField('title', variant.fields, change, suffix)}<details><summary>Additional identifiers</summary>{['ean', 'upc'].map(key => textField(key, variant.fields, change, suffix))}</details></div><div role="cell">{textField('sku', variant.fields, change, suffix)}{textField('barcode', variant.fields, change, suffix)}</div><div role="cell">{(variant.priceRows ?? []).filter(baseRow).map(price => <label className="rh-inline-field" key={price.key}><span>Price ({price.currency_code.toUpperCase()})</span><input aria-label={`Price ${price.currency_code.toUpperCase()}${suffix}`} type="number" min="0" step="any" required value={variant.prices[price.key]} onChange={event => change(price.key, event.target.value, true)}/></label>)}{!variant.priceRows.some(baseRow) && <small>Add a price below.</small>}</div><div role="cell">{stock.fields(variant, (key, value) => change(key, value))}</div><div className="rh-price-rules-cell" role="cell"><ProductPricing variant={variant} options={pricingOptions} change={next => setDraft(previous => ({ ...(previous as ProductDraft), variants: (previous as ProductDraft).variants.map(row => row.id === variant.id ? next : row) }))}/></div></div>
          })}</div></section>
        <section className="rh-inline-card"><h2>Publishing & organization</h2>{missingChoices.length > 0 && <p className="rh-inline-error" role="status">Could not load {missingChoices.join(', ')} options. Those fields are kept unchanged.</p>}<div className="rh-inline-grid"><label className="rh-inline-field"><span>Status</span><select aria-label="Status" value={String(p.fields.status)} onChange={event => setProductField('status', event.target.value)}>{['draft', 'proposed', 'published', 'rejected'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label><label className="rh-inline-check"><input type="checkbox" checked={Boolean(p.fields.discountable)} onChange={event => setProductField('discountable', event.target.checked)}/>Allow discounts</label>{lookups.filter(lookup => lookup.key !== 'shipping_profile_id').map(relationField)}</div></section>
        <section className="rh-inline-card"><h2>Shipping</h2><div className="rh-inline-grid"><div className="wide">{relationField(lookups.find(lookup => lookup.key === 'shipping_profile_id')!)}</div>{['weight', 'length', 'width', 'height', 'origin_country', 'hs_code', 'mid_code'].map(key => textField(key, p.fields, setProductField))}</div></section>
      </> : <>
        <section className="rh-inline-card wide"><h2>Customer contact</h2><label className="rh-inline-field"><span>Email</span><input aria-label="Customer email" type="email" required value={o.email} onChange={event => setDraft(previous => ({ ...(previous as OrderDraft), email: event.target.value }))}/></label><p>Updates the contact email for this order.</p></section>
        {(['shipping_address', 'billing_address'] as const).map(key => <section className="rh-inline-card" key={key}><h2>{key === 'shipping_address' ? 'Shipping address' : 'Billing address'}</h2><div className="rh-inline-grid">{addressFields.map(field => textField(field, o[key], (name, value) => setDraft(previous => ({ ...(previous as OrderDraft), [key]: { ...(previous as OrderDraft)[key], [name]: value } })), ` — ${key === 'shipping_address' ? 'shipping' : 'billing'}`))}</div></section>)}
      </>}
    </fieldset></form></>}
  </div>
}
