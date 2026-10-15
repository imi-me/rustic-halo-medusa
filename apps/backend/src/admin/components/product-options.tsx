import { useEffect, useState } from 'react'
import { adminRequest, type Entity } from '../lib/inline-edit'
import { optionsChanges, optionsSnapshot, type WorkspaceOption } from '../../lib/product-options-edit'
import { ProductSection } from './product-section'
import { ProductClawColors } from './product-claw-colors'
import { isHairClaw } from '../../lib/product-admin'

export function ProductOptions({ product, disabled, onDirty, saved }: { product: Entity; disabled: boolean; onDirty: (dirty: boolean) => void; saved: () => void }) {
  const original: WorkspaceOption[] = (product.options ?? []).map((option: any) => ({ id: option.id, title: option.title, is_exclusive: option.is_exclusive, values: (option.values ?? []).map((value: any) => ({ id: value.id, value: value.value })) }))
  const [draft, setDraft] = useState(original)
  const [catalog, setCatalog] = useState<WorkspaceOption[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [colorDirty, setColorDirty] = useState(false)
  const dirty = optionsSnapshot(original) !== optionsSnapshot(draft)
  useEffect(() => { onDirty(dirty || busy || colorDirty) }, [dirty, busy, colorDirty, onDirty])
  useEffect(() => () => onDirty(false), [onDirty])
  useEffect(() => { setDraft(original); setError('') }, [product])
  const loadCatalog = async () => {
    try { const data = await adminRequest('/admin/product-options?is_exclusive=false&limit=100&fields=id,title,is_exclusive,*values'); setCatalog(data.product_options) }
    catch (failure) { setError((failure as Error).message) }
  }
  const save = async () => {
    setBusy(true); setError('')
    try {
      const changes = optionsChanges(original, draft)
      await adminRequest(`/admin/products/${product.id}/workspace/options`, { changes, expected_options: optionsSnapshot(original), expected_updated_at: new Date(product.updated_at).toISOString() })
      saved()
    } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  const update = (index: number, option: WorkspaceOption) => setDraft(previous => previous.map((row, i) => i === index ? option : row))
  return <ProductSection title="Options" open={false} className="rh-options-card">
    {isHairClaw(product) && <ProductClawColors product={product} disabled={disabled || dirty || busy} onDirty={setColorDirty} saved={saved}/>}
    <p>Choose sizes, colors and other variant options here. Save option changes before editing the rest of the product.</p>
    {disabled && <p role="status">Save or discard product edits to manage options.</p>}
    <fieldset disabled={disabled || busy || colorDirty}>
      {draft.map((option, index) => option.id === product.metadata?.hair_claw_template_v2?.color_option_id ? null : <div className="rh-option-row" key={option.id ?? `new-${index}`}>
        <label className="rh-inline-field"><span>Option name</span><input aria-label={`Option ${index + 1} name`} readOnly={!!option.id} value={option.title} onChange={event => update(index, { ...option, title: event.target.value })}/></label>
        <div className="rh-options-values">{option.values.map((value, i) => <span key={value.id ?? `new-${i}`}><span>{value.value}</span><button type="button" aria-label={`Remove ${value.value} from ${option.title}`} onClick={() => update(index, { ...option, values: option.values.filter((_, n) => n !== i) })}>×</button></span>)}</div>
        {(option.is_exclusive || !option.id) && <label className="rh-inline-field"><span>Add a value (press Enter)</span><input aria-label={`Add value to option ${index + 1}`} onKeyDown={event => { if (event.key !== 'Enter') return; event.preventDefault(); const value = event.currentTarget.value.trim(); if (value) { update(index, { ...option, values: [...option.values, { value }] }); event.currentTarget.value = '' } }}/></label>}
        {!option.is_exclusive && option.id && <select aria-label={`Add shared value to option ${index + 1}`} value="" onChange={event => { const value = catalog.find(row => row.id === option.id)?.values.find(row => row.id === event.target.value); if (value) update(index, { ...option, values: [...option.values, value] }) }} onFocus={() => { if (!catalog.length) void loadCatalog() }}><option value="">Choose a shared value</option>{catalog.find(row => row.id === option.id)?.values.filter(value => !option.values.some(row => row.id === value.id)).map(value => <option key={value.id} value={value.id}>{value.value}</option>)}</select>}
        <button type="button" onClick={() => setDraft(previous => previous.filter((_, i) => i !== index))}>Remove option</button>
      </div>)}
      <div className="rh-inline-buttons"><button type="button" onClick={() => setDraft(previous => [...previous, { title: '', is_exclusive: true, values: [] }])}>+ Add option</button><button type="button" onClick={() => void loadCatalog()}>Choose shared options</button></div>
      {catalog.length > 0 && <select aria-label="Link shared option" value="" onChange={event => { const option = catalog.find(row => row.id === event.target.value); if (option) setDraft(previous => [...previous, option]) }}><option value="">Choose an existing option</option>{catalog.filter(option => !draft.some(row => row.id === option.id)).map(option => <option key={option.id} value={option.id}>{option.title}</option>)}</select>}
      <small>Values in use by variants are protected. Shared option names are managed in the option catalog.</small>
      <div className="rh-inline-buttons"><button type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? 'Saving options…' : 'Save options'}</button><button type="button" disabled={!dirty || busy} onClick={() => { setDraft(original); setError('') }}>Discard option changes</button></div>
    </fieldset>
    {error && <p role="alert" className="rh-inline-error">{error}</p>}
  </ProductSection>
}
