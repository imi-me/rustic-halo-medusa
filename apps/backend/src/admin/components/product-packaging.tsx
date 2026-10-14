import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { adminRequest } from '../lib/inline-edit'
import { emptyAssignment, type PackageAssignment, type PackageConfig } from '../../lib/shipping-packages'
export function useShippingPackages() {
  return useQuery<PackageConfig>({ queryKey: ['rh-shipping-packages'], queryFn: () => adminRequest('/admin/shipping-packages'), staleTime: 60000 })
}
export function ProductPackaging({ value = emptyAssignment(), change, weight, setWeight, variant = false, label = '', typeId = '', applyDefault = false }: { value?: PackageAssignment; change: (value: PackageAssignment) => void; weight: string; setWeight: (value: string) => void; variant?: boolean; label?: string; typeId?: string; applyDefault?: boolean }) {
  const packages = useShippingPackages()
  const lastDefault = useRef('')
  useEffect(() => {
    const preferred = packages.data?.type_defaults[typeId] ?? ''
    if (applyDefault && preferred && (!value.package_id || value.package_id === lastDefault.current)) { change({ ...value, package_id: preferred }); lastDefault.current = preferred }
  }, [typeId, packages.data?.revision, applyDefault])
  const selected = packages.data?.packages.find(row => row.id === value.package_id)
  return <div className="rh-product-packaging">
    <label className="rh-inline-field"><span>{variant ? 'Package override' : 'Preferred shipping package'}</span><select aria-label={`${variant ? 'Package override' : 'Preferred shipping package'}${label}`} value={value.package_id} disabled={!packages.data} onChange={event => change({ ...value, package_id: event.target.value, packing_group: 'standard', units_per_box: null })}><option value="">{variant ? 'Use product package' : 'Not assigned · confirmed catalog rule if available'}</option>{packages.data?.packages.filter(row => row.active || row.id === value.package_id).map(row => <option value={row.id} key={row.id}>{row.name}{row.active ? '' : ' (archived)'} · {row.length} × {row.width} × {row.height} in</option>)}</select></label>
    <label className="rh-inline-field"><span>{variant ? 'Item weight override (g)' : 'Item weight (g) · excludes packaging'}</span><input aria-label={`${variant ? 'Item weight override (g)' : 'Item weight (g)'}${label}`} type="number" min={variant || value.package_id ? "0.001" : "0"} step="any" value={weight} placeholder={variant ? 'Use product weight' : 'Measured item weight'} onChange={event => setWeight(event.target.value)}/></label>
    {selected && <><small>Empty packaging: {selected.packaging_weight} oz. Added once per box; item weights are converted from grams.</small><label className="rh-inline-field"><span>Maximum items per box</span><input aria-label={`Maximum items per box${label}`} type="number" min="1" max={selected.capacity} value={value.units_per_box ?? ''} placeholder={`Package default: ${selected.capacity}`} onChange={event => change({ ...value, units_per_box: event.target.value === '' ? null : Number(event.target.value) })}/></label><label className="rh-inline-check"><input type="checkbox" checked={value.ships_alone} onChange={event => change({ ...value, ships_alone: event.target.checked })}/>Ship each item in its own box{label}</label>{selected.accessory_limits.length > 0 && <label className="rh-inline-field"><span>Packing group</span><select aria-label={`Packing group${label}`} value={value.packing_group} onChange={event => change({ ...value, packing_group: event.target.value as PackageAssignment['packing_group'] })}><option value="standard">Standard · package capacity</option><option value="hair_claws">Hair claws · confirmed combinations</option><option value="earrings">Earring pairs · confirmed combinations</option></select></label>}</>}
    {packages.error && <p role="status" className="rh-inline-error">Package choices could not load. Existing assignments are kept. {packages.error.message}</p>}
    <small><Link to="/shipping-packages">Manage shipping packages</Link> · A package choice supplies box dimensions; the shipping profile above controls shipping availability.</small>
  </div>
}
