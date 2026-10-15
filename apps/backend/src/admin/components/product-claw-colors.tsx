import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminRequest, type Entity } from '../lib/inline-edit'
import { CLAW_COLORS_KEY, type ClawColor } from '../../lib/hair-claw-colors'

export function ProductClawColors({ product, disabled, onDirty, saved }: { product: Entity; disabled: boolean; onDirty: (value: boolean) => void; saved: () => void }) {
  const original: string[] = product.metadata?.[CLAW_COLORS_KEY]?.excluded ?? []
  const [excluded, setExcluded] = useState(original)
  const [palette, setPalette] = useState<{ colors: ClawColor[]; revision: string } | null>(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const dirty = JSON.stringify([...excluded].sort()) !== JSON.stringify([...original].sort())
  useEffect(() => { onDirty(dirty || busy) }, [dirty, busy, onDirty])
  useEffect(() => () => onDirty(false), [onDirty])
  useEffect(() => { setExcluded(original) }, [product])
  useEffect(() => { if (product.metadata?.hair_claw_palette_v1) { setPalette(product.metadata.hair_claw_palette_v1); return }; let mounted = true; adminRequest('/admin/hair-claw-colors').then(data => { if (mounted) setPalette(data) }).catch(failure => { if (mounted) setError(failure.message) }); return () => { mounted = false } }, [product])
  const save = async () => {
    setBusy(true); setError('')
    try { await adminRequest(`/admin/products/${product.id}/workspace/colors`, { excluded, expected_palette_revision: palette?.revision, expected_updated_at: product.updated_at }); saved() }
    catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  return <div className="rh-product-claw-colors">
    <h3>Available base colors</h3>
    <p>Checked colors can be purchased on the storefront. All shared colors are selected by default.</p>
    {!product.metadata?.hair_claw_template_v2 && <p role="status">This legacy product needs purchasable color variants before color availability can be changed.</p>}
    <fieldset disabled={disabled || busy || !palette || !product.metadata?.hair_claw_template_v2}>
      <div className="rh-claw-color-checks">{palette?.colors.map(color => <label key={color.slug} className={!color.active ? 'rh-claw-color-retired' : ''}>
        <input type="checkbox" aria-label={`Available in ${color.name}`} disabled={!color.active} checked={color.active && !excluded.includes(color.name)} onChange={event => setExcluded(previous => event.target.checked ? previous.filter(name => name !== color.name) : [...previous, color.name])}/>
        <span className="rh-claw-color-swatch" style={{ backgroundColor: color.hex }}/><span>{color.name}{!color.active && <small> · retired</small>}</span>
      </label>)}</div>
      <div className="rh-inline-buttons"><button type="button" onClick={() => setExcluded([])}>Select all colors</button><button type="button" disabled={!dirty} onClick={() => void save()}>{busy ? 'Saving colors…' : 'Save color availability'}</button><button type="button" disabled={!dirty} onClick={() => setExcluded(original)}>Discard color changes</button></div>
    </fieldset>
    <Link to="/hair-claw-colors">Manage colors for all hair claws ↗</Link>
    {error && <p role="alert" className="rh-inline-error">{error}</p>}
  </div>
}
