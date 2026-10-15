import { defineRouteConfig } from '@medusajs/admin-sdk'
import { useEffect, useState } from 'react'
import { Link, useBlocker } from 'react-router-dom'
import { adminRequest } from '../../lib/inline-edit'
import { clawPaletteSchema, colorSlug, type ClawColor, type ClawSize } from '../../../lib/hair-claw-colors'
import '../../styles/inline-editor.css'

const HairClawColorsPage = () => {
  const [saved, setSaved] = useState<{ colors: ClawColor[]; revision: string } | null>(null)
  const [draft, setDraft] = useState<ClawColor[]>([]), [name, setName] = useState(''), [hex, setHex] = useState('#927f6f'), [sizes, setSizes] = useState<ClawSize[]>(['2', '4'])
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [results, setResults] = useState<any[]>([])
  const dirty = Boolean(saved && JSON.stringify(draft) !== JSON.stringify(saved.colors)), blocker = useBlocker(() => dirty || busy)
  const load = async () => { try { const data = await adminRequest('/admin/hair-claw-colors'); setSaved(data); setDraft(data.colors); setError('') } catch (failure) { setError((failure as Error).message) } }
  useEffect(() => { void load() }, [])
  useEffect(() => { if (!dirty && !busy) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn) }, [dirty, busy])
  const apply = async (save: boolean) => {
    if (!saved || busy) return
    setBusy(true); setError(''); setResults([])
    try {
      let current = saved
      if (save) { const colors = clawPaletteSchema.parse(draft); current = await adminRequest('/admin/hair-claw-colors', { colors, expected_revision: saved.revision }); setSaved(current); setDraft(current.colors) }
      let offset: number | null = 0, all: any[] = []
      do {
        setNotice(`Applying shared colors… ${all.length} products checked.`)
        const response = await adminRequest('/admin/hair-claw-colors/sync', { offset, expected_revision: current.revision })
        all = [...all, ...response.results]; setResults(all); offset = response.next_offset
      } while (offset !== null)
      const review = all.filter(row => row.status === 'review').length
      setNotice(`Shared colors saved. ${all.length - review} products are up to date.${review ? ` ${review} need review below.` : ''}`)
    } catch (failure) { setError((failure as Error).message); setNotice('Existing changes are kept. Use Apply to hair claws to resume safely without creating duplicates.') }
    finally { setBusy(false) }
  }
  const update = (slug: string, patch: Partial<ClawColor>) => setDraft(previous => previous.map(row => row.slug === slug ? { ...row, ...patch } : row))
  return <div className="rh-inline-shell rh-claw-palette-page">
    <div className="rh-inline-header"><div><h1>Hair-claw colors</h1><p>Shared base colors for every hair claw. Product-specific availability lives under Options.</p></div><div className="rh-inline-buttons"><button type="button" disabled={!dirty || busy} onClick={() => void apply(true)}>Save shared colors</button><button type="button" disabled={!dirty || busy} onClick={() => { setDraft(saved!.colors); setError('') }}>Discard changes</button></div></div>
    <p>Base color is included in the product price. Choose which colors exist for 2-inch and 4-inch claws. Adding a color creates variants only for its selected sizes at each existing size-and-finish price, with no color surcharge. Retiring a color removes it from storefront purchase choices while preserving SKUs, inventory and past orders. Products with different color prices or missing color setup are listed for review.</p>
    {notice && <p role="status">{notice}</p>}{error && <p role="alert" className="rh-inline-error">{error}</p>}
    {!saved && <button type="button" onClick={() => void load()}>Load shared colors</button>}
    <fieldset disabled={busy || !saved}>
      <div className="rh-claw-palette-grid">{draft.map(color => <div key={color.slug} className="rh-inline-card">
        <span className="rh-claw-color-swatch" style={{ backgroundColor: color.hex }}/><strong>{color.name}</strong>
        <label><input type="checkbox" aria-label={`Shared ${color.name} available`} checked={color.active} onChange={event => update(color.slug, { active: event.target.checked })}/> Available across hair claws</label>
        <div className="rh-inline-buttons">{(['2', '4'] as const).map(size => <label key={size}><input type="checkbox" aria-label={`${color.name} available for ${size}-inch claws`} checked={(color.sizes ?? ['2', '4']).includes(size)} onChange={event => update(color.slug, { sizes: event.target.checked ? [...(color.sizes ?? ['2', '4']), size] : (color.sizes ?? ['2', '4']).filter(value => value !== size) })}/>{size}-inch</label>)}</div>
        <label className="rh-inline-field"><span>Swatch color</span><input aria-label={`${color.name} swatch color`} type="color" value={color.hex} onChange={event => update(color.slug, { hex: event.target.value })}/></label>
        <button type="button" onClick={() => saved!.colors.some(c => c.slug === color.slug) ? update(color.slug, { active: !color.active }) : setDraft(previous => previous.filter(c => c.slug !== color.slug))}>{saved?.colors.some(c => c.slug === color.slug) ? color.active ? 'Retire color' : 'Restore color' : 'Remove new color'}</button>
      </div>)}</div>
      <div className="rh-inline-card"><h2>Add a shared color</h2><label className="rh-inline-field"><span>Color name</span><input aria-label="New shared color name" maxLength={40} value={name} onChange={event => setName(event.target.value)}/></label><label className="rh-inline-field"><span>Swatch color</span><input aria-label="New shared color swatch" type="color" value={hex} onChange={event => setHex(event.target.value)}/></label><div className="rh-inline-buttons">{(['2', '4'] as const).map(size => <label key={size}><input type="checkbox" aria-label={`New color available for ${size}-inch claws`} checked={sizes.includes(size)} onChange={event => setSizes(previous => event.target.checked ? [...previous, size] : previous.filter(value => value !== size))}/>{size}-inch</label>)}</div><button type="button" disabled={!name.trim() || !sizes.length} onClick={() => { try { const colors = clawPaletteSchema.parse([...draft, { name: name.trim(), slug: colorSlug(name), hex, active: true, sizes }]); setDraft(colors); setName(''); setSizes(['2', '4']); setError('') } catch (failure) { setError((failure as Error).message) } }}>Add color</button></div>
      <button type="button" disabled={dirty} onClick={() => void apply(false)}>Apply to hair claws / retry pending products</button>
    </fieldset>
    {results.some(row => row.status === 'review') && <div className="rh-inline-card"><h2>Products needing review</h2>{results.filter(row => row.status === 'review').map(row => <p key={row.id}><Link to={`/products/${row.id}`}>{row.title}</Link>: {row.message}</p>)}</div>}
    {blocker.state === 'blocked' && <div className="rh-inline-confirm" role="alertdialog" aria-modal="true" aria-label="Unsaved shared colors"><h2>{busy ? 'Colors are still being applied' : 'Leave unsaved shared colors?'}</h2><button type="button" onClick={() => blocker.reset()}>Keep editing</button><button type="button" disabled={busy} onClick={() => blocker.proceed()}>Discard and leave</button></div>}
  </div>
}
export const config = defineRouteConfig({ label: 'Hair-claw colors', rank: 6 })
export default HairClawColorsPage
