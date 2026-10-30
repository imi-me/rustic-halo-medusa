import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminRequest, type Entity } from '../lib/inline-edit'
import { productColorExclusions, colorSupportsSize, variantClawColor, variantClawSize, type ClawColor, type ClawSize } from '../../lib/hair-claw-colors'

export function ProductClawColors({ product, disabled, onDirty, saved }: { product: Entity; disabled: boolean; onDirty: (value: boolean) => void; saved: () => void }) {
  const original = { '2': productColorExclusions(product, '2'), '4': productColorExclusions(product, '4') }
  const actualSizes:ClawSize[] = product.metadata?.hair_claw_template_v2?.color_mode === 'order' ? [...new Set(Object.values(product.metadata.hair_claw_template_v2.order_choices).map((choice:any)=>choice.size))] as ClawSize[] : ['4','2']
  const [size, setSize] = useState<ClawSize>(actualSizes[0] ?? '4')
  const [excluded, setExcluded] = useState(original)
  const [palette, setPalette] = useState<{ colors: ClawColor[]; revision: string } | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const dirty = (['2', '4'] as const).some(key => JSON.stringify([...excluded[key]].sort()) !== JSON.stringify([...original[key]].sort()))
  useEffect(() => { onDirty(dirty || busy) }, [dirty, busy, onDirty])
  useEffect(() => () => onDirty(false), [onDirty])
  useEffect(() => { setExcluded(original) }, [product])
  useEffect(() => { if (product.metadata?.hair_claw_palette_v1) { setPalette(product.metadata.hair_claw_palette_v1); return }; let mounted = true; adminRequest('/admin/hair-claw-colors').then(data => { if (mounted) setPalette(data) }).catch(failure => { if (mounted) setError(failure.message) }); return () => { mounted = false } }, [product])
  const save = async () => {
    setBusy(true); setError('')
    try { await adminRequest(`/admin/products/${product.id}/workspace/colors`, { excluded_by_size: excluded, expected_palette_revision: palette?.revision, expected_updated_at: product.updated_at }); saved() }
    catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  return <div className="rh-product-claw-colors">
    <h3>Available base colors</h3>
    <p>Base color is included in the product price. Choose available colors separately for each size. Color is recorded on the order using the design’s existing SKU and barcode. Only existing size and finish offers are sold.</p>
    <div className="rh-inline-buttons" aria-label="Color availability size">{actualSizes.map(key => <button key={key} type="button" aria-pressed={size === key} onClick={() => setSize(key)}>{key}-inch colors</button>)}</div>
    {!product.metadata?.hair_claw_template_v2 && <p role="status">Apply shared colors to confirm the original product mapping before changing color availability.</p>}
    <fieldset disabled={disabled || busy || !palette || !product.metadata?.hair_claw_template_v2}>
      <div className="rh-claw-color-checks">{palette?.colors.map(color => <label key={color.slug} className={!color.active ? 'rh-claw-color-retired' : ''}>
        <input type="checkbox" aria-label={`${size}-inch available in ${color.name}`} disabled={!color.active || !colorSupportsSize(color, size)} checked={color.active && colorSupportsSize(color, size) && !excluded[size].includes(color.name)} onChange={event => setExcluded(previous => ({ ...previous, [size]: event.target.checked ? previous[size].filter(name => name !== color.name) : [...previous[size], color.name] }))}/>
        <span className="rh-claw-color-swatch" style={{ backgroundColor: color.hex }}/><span>{color.name}{!color.active ? <small> · retired</small> : !colorSupportsSize(color, size) ? <small> · unavailable in this size</small> : product.metadata?.hair_claw_template_v2?.color_mode !== 'order' && !(product.variants ?? []).some((v: Entity) => variantClawColor(product, v) === color.name && variantClawSize(product, v) === size) && <small> · setup pending</small>}</span>
      </label>)}</div>
      <div className="rh-inline-buttons"><button type="button" onClick={() => setExcluded(previous => ({ ...previous, [size]: [] }))}>Select all {size}-inch colors</button><button type="button" disabled={!dirty} onClick={() => void save()}>{busy ? 'Saving colors…' : 'Save color availability'}</button><button type="button" disabled={!dirty} onClick={() => setExcluded(original)}>Discard color changes</button></div>
    </fieldset>
    <Link to="/hair-claw-colors">Manage colors for all hair claws ↗</Link>
    {error && <p role="alert" className="rh-inline-error">{error}</p>}
  </div>
}
