import { useState } from 'react'
import { adminRequest } from '../lib/inline-edit'
export function ProductTypeField({
  value,
  choices,
  change,
  created,
}: {
  value: string
  choices?: Array<{ id: string; label: string }>
  change: (id: string) => void
  created: (type: { id: string; label: string }) => void
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async () => {
    const label = name.trim()
    if (!label) return
    const existing = choices?.find((row) => row.label.toLowerCase() === label.toLowerCase())
    if (existing) {
      change(existing.id)
      setAdding(false)
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await adminRequest('/admin/product-types', { value: label })
      const type = { id: response.product_type.id, label: response.product_type.value }
      created(type)
      change(type.id)
      setAdding(false)
      setName('')
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="rh-inline-field">
      <label className="rh-inline-field">
        <span>Product type</span>
        <select
          aria-label="Product type"
          value={value}
          disabled={!choices || busy}
          onChange={(event) => change(event.target.value)}
        >
          <option value="">None</option>
          {choices?.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
      </label>
      {!adding ? (
        <button type="button" disabled={!choices} onClick={() => setAdding(true)}>
          + New product type
        </button>
      ) : (
        <div>
          <label className="rh-inline-field">
            <span>New product type</span>
            <input
              maxLength={100}
              value={name}
              placeholder="For example, Hair Claw"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button type="button" disabled={busy || !name.trim()} onClick={() => void save()}>
            Add type
          </button>
          <button type="button" disabled={busy} onClick={() => setAdding(false)}>
            Cancel type
          </button>
        </div>
      )}
      {error && <small role="alert">{error}</small>}
    </div>
  )
}
