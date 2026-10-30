import { changeClawGroupPrice } from '../lib/product-group-prices'
import { Link } from 'react-router-dom'
import { type Entity, type ProductDraft } from '../lib/inline-edit'
import { baseRow } from '../lib/product-prices'
import { usesClawOrderColors, orderChoiceColors } from '../../lib/hair-claw-order-choices'
import { clawVariantGroups } from '../../lib/claw-variant-groups'
import { CLAW_COLORS_KEY, clawColorAvailable, colorSupportsSize, productColorExclusions, variantClawColor, type ClawColor } from '../../lib/hair-claw-colors'

export function ProductClawGroups({ product, draft, change }: { product: Entity; draft: ProductDraft; change: (value: ProductDraft) => void }) {
  const groups = clawVariantGroups(product), palette: ClawColor[] = product.metadata?.hair_claw_palette_v1?.colors ?? []
  const settings = draft.clawColors!, current = { ...product, metadata: { ...product.metadata, [CLAW_COLORS_KEY]: settings } }
  return <div className="rh-claw-groups">
    <p>Set one product price per size and finish. Color is included. Save changes applies prices and color availability together.</p>
    {groups.map(group => {
      const ids = new Set(group.variants.map(v => v.id)), rows = draft.variants.filter(v => ids.has(v.id))
      const currencies = [...new Set(rows.flatMap(v => v.priceRows.filter(baseRow).map(p => p.currency_code)))].sort()
      const excluded = settings.excluded_by_group[group.key] ?? (group.size ? productColorExclusions(current, group.size) : settings.excluded)
      const setExcluded = (names: string[]) => change({ ...draft, clawColors: { ...settings, excluded_by_group: { ...settings.excluded_by_group, [group.key]: names } } })
      const available = usesClawOrderColors(product) ? orderChoiceColors(current,group.variants[0],palette).length : group.variants.filter(v => clawColorAvailable(current, v, palette)).length
      return <details open={group.offered} className="rh-claw-group" key={group.key} aria-label={group.label}>
        <summary className="rh-claw-group-heading"><h3>{group.label}</h3><span>{group.offered ? `${available} colors available` : 'Not offered · setup retained'}</span></summary>
        <div className="rh-inline-buttons">{currencies.map(currency => {
          const prices = rows.map(v => v.priceRows.filter(p => baseRow(p) && p.currency_code === currency))
          const complete = prices.every(p => p.length === 1), amounts = complete ? rows.map((v, i) => v.prices[prices[i][0].key]) : []
          const same = complete && amounts.every(value => value === amounts[0])
          return <label className="rh-inline-field" key={currency}><span>Price ({currency.toUpperCase()}) · all colors</span><input aria-label={`Price ${currency.toUpperCase()} — ${group.label}`} type="number" min="0" step="any" disabled={!complete} placeholder={complete ? 'Mixed prices' : 'Review individual prices'} value={same ? amounts[0] : ''} onChange={event => change(changeClawGroupPrice(draft, ids, currency, event.target.value))}/></label>
        })}</div>
        {!currencies.length && <p role="status">Add a saved base price in Individual variants before using group pricing.</p>}
        <div className="rh-claw-color-checks">{palette.map(color => {
          const supported = color.active && colorSupportsSize(color, group.size), saved = usesClawOrderColors(product) || group.variants.some(v => variantClawColor(product, v) === color.name)
          return <label key={color.slug}><input type="checkbox" aria-label={`${group.label} available in ${color.name}`} disabled={!supported} checked={supported && !excluded.includes(color.name)} onChange={event => setExcluded(event.target.checked ? excluded.filter(name => name !== color.name) : [...excluded, color.name])}/><span className="rh-claw-color-swatch" style={{ backgroundColor: color.hex }}/><span>{color.name}{!supported ? <small> · unavailable</small> : !saved && <small> · setup pending</small>}</span></label>
        })}</div>
        <div className="rh-inline-buttons"><button type="button" aria-label={`Select all colors for ${group.label}`} onClick={() => setExcluded([])}>Select all</button><button type="button" aria-label={`Clear colors for ${group.label}`} onClick={() => setExcluded(palette.map(c => c.name))}>Clear all</button></div>
        {!group.offered && <small>Changing price or colors does not enable this size or its artwork.</small>}
      </details>
    })}
    <Link to="/hair-claw-colors">Manage shared hair-claw colors ↗</Link>
  </div>
}
