import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { adminRequest, type Entity, type ProductDraft } from '../../../lib/inline-edit'
import { emptyEtsyDraft, isHairClaw } from '../../../../lib/product-admin'
import { ProductTypeField } from '../../../components/product-type-field'
import { ProductImages, uploadProductImage } from '../../../components/product-images'
import { DescriptionEditor } from '../../../components/description-editor'
import { ProductCopyHelper } from '../../../components/product-copy-helper'
import { EtsyListingEditor } from '../../../components/etsy-listing-editor'
import '../../../styles/inline-editor.css'

type Variant = {
  key: string
  title: string
  sku: string
  barcode: string
  price: string
  options: Record<string, string>
  stock: Record<string, string>
}
const blank = (): ProductDraft => ({
  fields: {
    title: '',
    handle: '',
    description: '',
    material: '',
    weight: '',
    type_id: '',
    collection_id: '',
    shipping_profile_id: '',
  },
  relations: { sales_channels: [], categories: [], tags: [] },
  images: [],
  thumbnail: '',
  variants: [],
  etsy: emptyEtsyDraft(),
})
const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const NewProductPage = () => {
  const navigate = useNavigate()
  const [draft, setDraft] = useState(blank)
  const [choices, setChoices] = useState<Record<string, Entity[]>>({})
  const [requestId] = useState(() => crypto.randomUUID())
  const [inventoryMode, setInventoryMode] = useState('stocked')
  const [options, setOptions] = useState<Array<{ title: string; values: string }>>([])
  const [variants, setVariants] = useState<Variant[]>([
    {
      key: 'standard',
      title: 'Standard',
      sku: `RH-${requestId.slice(0, 8).toUpperCase()}`,
      barcode: '',
      price: '',
      options: { Style: 'Standard' },
      stock: {},
    },
  ])
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<string | false>(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [undo, setUndo] = useState<string | null>(null)
  const [handleEdited, setHandleEdited] = useState(false)
  const [frozen, setFrozen] = useState<any>(null)
  const files = useRef(new Map<string, { file: File; url: string; uploaded?: string }>())
  const dirty = Boolean(
    draft.fields.title ||
    draft.images.length ||
    draft.fields.description ||
    variants.some((row) => row.price || row.barcode),
  )
  const blocker = useBlocker(() => !created && (dirty || saving))
  useEffect(() => {
    const lists = [
      ['type_id', 'product-types', 'product_types'],
      ['collection_id', 'collections', 'collections'],
      ['shipping_profile_id', 'shipping-profiles', 'shipping_profiles'],
      ['sales_channels', 'sales-channels', 'sales_channels'],
      ['categories', 'product-categories', 'product_categories'],
      ['tags', 'product-tags', 'product_tags'],
      ['locations', 'stock-locations', 'stock_locations'],
    ]
    void Promise.all(
      lists.map(async ([key, path, response]) => {
        const rows: Entity[] = []
        for (let offset = 0; offset < 10000; offset += 100) {
          const data = await adminRequest(`/admin/${path}?limit=100&offset=${offset}`)
          rows.push(...data[response])
          if (data[response].length < 100 || rows.length >= data.count) return [key, rows] as const
        }
        throw new Error('Too many options to load safely.')
      }),
    )
      .then((rows) => {
        const next = Object.fromEntries(rows)
        setChoices(next)
        if (next.shipping_profile_id.length === 1)
          setDraft((previous) => ({
            ...previous,
            fields: { ...previous.fields, shipping_profile_id: next.shipping_profile_id[0].id },
          }))
      })
      .catch(() =>
        setError('Product options could not be loaded. Reload before creating a product.'),
      )
      .finally(() => setLoading(false))
    return () => {
      files.current.forEach((row) => URL.revokeObjectURL(row.url))
    }
  }, [])
  useEffect(() => {
    if (!dirty && !saving) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, saving])
  useEffect(() => {
    if (created) navigate(`/products/${created}`, { replace: true })
  }, [created, navigate])
  const change = (key: string, value: string) =>
    setDraft((previous) => ({
      ...previous,
      fields: {
        ...previous.fields,
        [key]: value,
        ...(key === 'title' && !handleEdited ? { handle: slug(value) } : {}),
      },
    }))
  const generateVariants = () => {
    const actual = options.length
      ? options.map((option) => ({
          title: option.title.trim(),
          values: option.values
            .split(',')
            .map((row) => row.trim())
            .filter(Boolean),
        }))
      : [{ title: 'Style', values: ['Standard'] }]
    if (
      actual.some(
        (row) => !row.title || !row.values.length || new Set(row.values).size !== row.values.length,
      ) ||
      new Set(actual.map((row) => row.title)).size !== actual.length
    ) {
      setError('Use unique option names and non-empty comma-separated values.')
      return
    }
    let combinations: Array<Record<string, string>> = [{}]
    for (const option of actual) {
      combinations = combinations.flatMap((row) =>
        option.values.map((value) => ({ ...row, [option.title]: value })),
      )
      if (combinations.length > 100) {
        setError('Limit this product to 100 variant combinations.')
        return
      }
    }
    setVariants(
      combinations.map((row) => {
        const key = JSON.stringify(row),
          existing = variants.find((variant) => JSON.stringify(variant.options) === key)
        return (
          existing ?? {
            key,
            options: row,
            title: Object.values(row).join(' / '),
            sku: `RH-${requestId.slice(0, 8).toUpperCase()}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
            barcode: '',
            price: variants[0]?.price || '',
            stock: {},
          }
        )
      }),
    )
    setError('')
  }
  const updateVariant = (key: string, patch: Partial<Variant>) =>
    setVariants((previous) => previous.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  const addImages = (selected: FileList) => {
    const images = Array.from(selected)
    if (
      images.some(
        (file) =>
          !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) ||
          file.size > 10 * 1024 * 1024,
      )
    ) {
      setError('Use supported images under 10 MB.')
      return
    }
    const rows = images.map((file) => {
      const key = crypto.randomUUID(),
        url = URL.createObjectURL(file)
      files.current.set(key, { file, url })
      return { key, url }
    })
    setDraft((previous) => ({
      ...previous,
      images: [...previous.images, ...rows],
      thumbnail: previous.thumbnail || rows[0]?.url || '',
    }))
  }
  const save = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      let input = frozen
      if (!input) {
        if (!draft.fields.shipping_profile_id) throw new Error('Choose a shipping profile.')
        if (
          variants.some(
            (row) =>
              !row.price.trim() || !Number.isFinite(Number(row.price)) || Number(row.price) < 0,
          )
        )
          throw new Error('Enter a price for every variant.')
        if (
          options.length &&
          variants.some(
            (row) =>
              options.some(
                (option) =>
                  !option.values
                    .split(',')
                    .map((value) => value.trim())
                    .includes(row.options[option.title.trim()]),
              ) || Object.keys(row.options).length !== options.length,
          )
        )
          throw new Error('Generate variants after changing the option names or values.')
        const images = [] as Array<{ url: string }>
        let thumbnail = draft.thumbnail
        for (const image of draft.images) {
          const pending = files.current.get(image.key)
          if (pending) {
            pending.uploaded ??= await uploadProductImage(pending.file)
            if (thumbnail === image.url) thumbnail = pending.uploaded
            images.push({ url: pending.uploaded })
          } else images.push({ url: image.url })
        }
        input = {
          inventory_mode: inventoryMode,
          request_id: requestId,
          title: String(draft.fields.title),
          description: String(draft.fields.description),
          handle: String(draft.fields.handle),
          material: String(draft.fields.material),
          weight: draft.fields.weight === '' ? null : Number(draft.fields.weight),
          type_id: draft.fields.type_id || null,
          collection_id: draft.fields.collection_id || null,
          shipping_profile_id: draft.fields.shipping_profile_id,
          sales_channels: draft.relations.sales_channels,
          categories: draft.relations.categories,
          tags: draft.relations.tags,
          images,
          thumbnail: thumbnail || null,
          options: options.length
            ? options.map((option) => ({
                title: option.title.trim(),
                values: option.values
                  .split(',')
                  .map((row) => row.trim())
                  .filter(Boolean),
              }))
            : [{ title: 'Style', values: ['Standard'] }],
          variants: variants.map((row) => ({
            title: row.title,
            sku: row.sku,
            barcode: row.barcode,
            price: Number(row.price),
            options: row.options,
            stock: Object.entries(row.stock).map(([location_id, quantity]) => ({
              location_id,
              quantity: Number(quantity),
            })),
          })),
          etsy: draft.etsy,
        }
        setFrozen(input)
      }
      const response = await adminRequest('/admin/product-workspace', input)
      setCreated(response.product.id)
    } catch (failure) {
      if ((failure as any).code === 'creation_preflight') setFrozen(null)
      setError((failure as Error).message)
    } finally {
      setSaving(false)
    }
  }
  const field = (key: string, label: string, type = 'text') => (
    <label className="rh-inline-field">
      <span>{label}</span>
      <input
        type={type}
        required={['title', 'handle'].includes(key)}
        min={type === 'number' ? 0 : undefined}
        value={String(draft.fields[key])}
        onChange={(event) => {
          if (key === 'handle') setHandleEdited(true)
          change(key, event.target.value)
        }}
      />
    </label>
  )
  const select = (key: string, label: string) => (
    <label className="rh-inline-field">
      <span>{label}</span>
      <select
        aria-label={label}
        required={key === 'shipping_profile_id'}
        value={String(draft.fields[key])}
        onChange={(event) => change(key, event.target.value)}
      >
        <option value="">Choose…</option>
        {choices[key]?.map((row) => (
          <option key={row.id} value={row.id}>
            {row.value || row.title || row.name}
          </option>
        ))}
      </select>
    </label>
  )
  return (
    <div className="rh-inline-editor rh-product-editor">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <div className="rh-inline-toolbar">
          <div className="rh-inline-identity">
            <div>
              <h1>Add product</h1>
              <span>Save as draft, then review availability and publishing.</span>
            </div>
          </div>
          <div className="rh-inline-buttons">
            <button type="button" disabled={saving} onClick={() => navigate('/products')}>
              Cancel
            </button>
            <button
              className="primary"
              type="submit"
              disabled={loading || saving || Boolean(created) || !choices.shipping_profile_id}
            >
              {saving ? 'Creating…' : frozen ? 'Retry unchanged request' : 'Save product'}
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="rh-inline-error">
            {error}
          </p>
        )}
        {frozen && !created && (
          <p>
            Creation was submitted. Your request is preserved for a safe retry. If validation
            failed, reload after checking the product list before entering a corrected draft.
          </p>
        )}
        {blocker.state === 'blocked' && (
          <div role="alert" className="rh-inline-leave">
            You have an unsaved or unconfirmed product draft.
            <button type="button" onClick={() => blocker.reset()}>
              Keep editing
            </button>
            <button type="button" disabled={saving} onClick={() => blocker.proceed()}>
              Discard and leave
            </button>
          </div>
        )}
        <fieldset disabled={loading || saving || Boolean(frozen)} className="rh-inline-body">
          <div className="rh-inline-column rh-product-main">
            <section className="rh-inline-card">
              <h2>Product details</h2>
              {field('title', 'Title')}
              <DescriptionEditor
                disabled={loading || saving || Boolean(frozen)}
                value={String(draft.fields.description)}
                onChange={(value) => change('description', value)}
              />
              <ProductCopyHelper
                title={String(draft.fields.title)}
                description={String(draft.fields.description)}
                material={String(draft.fields.material)}
                apply={(_, value) => {
                  setUndo(String(draft.fields.description))
                  change('description', value.description)
                }}
              />
              {undo !== null && (
                <button
                  type="button"
                  onClick={() => {
                    change('description', undo)
                    setUndo(null)
                  }}
                >
                  Undo description suggestion
                </button>
              )}
              <details>
                <summary>Search URL</summary>
                {field('handle', 'Handle')}
              </details>
            </section>
            <ProductImages productId="new" draft={draft} change={setDraft} add={addImages} />
            <section className="rh-inline-card">
              <h2>Pricing, variants & inventory</h2>
              <label className="rh-inline-field">
                <span>Inventory policy</span>
                <select
                  aria-label="Inventory policy"
                  value={inventoryMode}
                  onChange={(event) => setInventoryMode(event.target.value)}
                >
                  <option value="stocked">Sell stocked quantities only</option>
                  <option value="made_to_order">Made to order · allow backorders</option>
                </select>
              </label>
              <p>
                Stocked quantities require location inventory. Made-to-order color variants can be
                allocated to Etsy separately.
              </p>
              <details>
                <summary>Add options such as Size, Color or Finish</summary>
                {options.map((option, index) => (
                  <div className="rh-inline-grid" key={index}>
                    <label className="rh-inline-field">
                      <span>Option name</span>
                      <input
                        value={option.title}
                        onChange={(event) =>
                          setOptions(
                            options.map((row, i) =>
                              i === index ? { ...row, title: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="rh-inline-field">
                      <span>Values · comma separated</span>
                      <input
                        value={option.values}
                        onChange={(event) =>
                          setOptions(
                            options.map((row, i) =>
                              i === index ? { ...row, values: event.target.value } : row,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setOptions(options.filter((_, i) => i !== index))}
                    >
                      Remove option
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={options.length >= 3}
                  onClick={() => setOptions([...options, { title: '', values: '' }])}
                >
                  Add option
                </button>
                <button type="button" onClick={generateVariants}>
                  Generate variants
                </button>
              </details>
              {variants.map((row) => (
                <div className="rh-new-variant" key={row.key}>
                  <h3>{row.title}</h3>
                  <div className="rh-inline-grid">
                    <label className="rh-inline-field">
                      <span>Price (USD)</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        required
                        value={row.price}
                        onChange={(event) => updateVariant(row.key, { price: event.target.value })}
                      />
                    </label>
                    <label className="rh-inline-field">
                      <span>SKU</span>
                      <input
                        required
                        value={row.sku}
                        onChange={(event) => updateVariant(row.key, { sku: event.target.value })}
                      />
                    </label>
                    <label className="rh-inline-field">
                      <span>Barcode</span>
                      <input
                        aria-label={`Barcode — ${row.title}`}
                        value={row.barcode}
                        placeholder="Generate automatically on save"
                        onChange={(event) =>
                          updateVariant(row.key, { barcode: event.target.value })
                        }
                      />
                      <small>
                        Enter an existing barcode or leave blank for an internal scanner code.
                      </small>
                    </label>
                  </div>
                  <details>
                    <summary>Stock by location</summary>
                    <p>Enter on-hand quantities for this variant. Reservations start at zero.</p>
                    {choices.locations?.map((location) => (
                      <label className="rh-inline-field" key={location.id}>
                        <span>{location.name}</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={row.stock[location.id] ?? ''}
                          placeholder="Not stocked here"
                          onChange={(event) => {
                            const stock = { ...row.stock }
                            if (event.target.value === '') delete stock[location.id]
                            else stock[location.id] = event.target.value
                            updateVariant(row.key, { stock })
                          }}
                        />
                      </label>
                    ))}
                  </details>
                </div>
              ))}
            </section>
            <section className="rh-inline-card">
              <h2>Shipping</h2>
              {select('shipping_profile_id', 'Shipping profile')}
              {field('weight', 'Item weight (g)', 'number')}
              {field('material', 'Material')}
            </section>
          </div>
          <div className="rh-inline-column rh-product-sidebar">
            <section className="rh-inline-card">
              <h2>Organization</h2>
              <p>Status: Draft</p>
              <ProductTypeField
                value={String(draft.fields.type_id)}
                choices={choices.type_id?.map((row) => ({ id: row.id, label: row.value }))}
                change={(id) => change('type_id', id)}
                created={(type) =>
                  setChoices((previous) => ({
                    ...previous,
                    type_id: [...previous.type_id, { id: type.id, value: type.label }],
                  }))
                }
              />
              {select('collection_id', 'Collection')}
              {['sales_channels', 'categories', 'tags'].map((key) => (
                <details key={key}>
                  <summary>{key.replace('_', ' ')}</summary>
                  {choices[key]?.map((row) => (
                    <label className="rh-inline-check" key={row.id}>
                      <input
                        type="checkbox"
                        checked={draft.relations[key].includes(row.id)}
                        onChange={(event) =>
                          setDraft((previous) => ({
                            ...previous,
                            relations: {
                              ...previous.relations,
                              [key]: event.target.checked
                                ? [...previous.relations[key], row.id]
                                : previous.relations[key].filter((id) => id !== row.id),
                            },
                          }))
                        }
                      />
                      {row.name || row.title || row.value}
                    </label>
                  ))}
                </details>
              ))}
            </section>
            <EtsyListingEditor
              value={draft.etsy}
              change={(etsy) => setDraft((previous) => ({ ...previous, etsy }))}
              product={{
                id: 'new',
                type: choices.type_id?.find((row) => row.id === draft.fields.type_id),
                variants: [],
                images: [],
              }}
              title={String(draft.fields.title)}
              description={String(draft.fields.description)}
              material={String(draft.fields.material)}
            />
            {isHairClaw({
              type: choices.type_id?.find((row) => row.id === draft.fields.type_id),
            }) && (
              <section className="rh-inline-card">
                <h2>Hair-claw images</h2>
                <p>
                  Save the product first to fit approved artwork and share saved color variants with
                  Etsy.
                </p>
              </section>
            )}
          </div>
        </fieldset>
      </form>
    </div>
  )
}

export default NewProductPage
