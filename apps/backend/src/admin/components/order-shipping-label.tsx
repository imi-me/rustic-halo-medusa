import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { adminRequest } from '../lib/inline-edit'
export function OrderShippingLabel({ id, disabled = false }: { id: string; disabled?: boolean }) {
  const [state, setState] = useState<any>(null)
  const [quote, setQuote] = useState<any>(null)
  const [rateId, setRateId] = useState('')
  const [parcel, setParcel] = useState({ weight: '', length: '', width: '', height: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [notice, setNotice] = useState('')
  const queryClient = useQueryClient()
  const load = async () => {
    const response = await adminRequest(`/admin/orders/${id}/shipping-label`)
    setState(response)
    if (response.packing?.length === 1) {
      const planned = response.packing[0]
      setParcel({ weight: String(planned.weight), length: String(planned.length), width: String(planned.width), height: String(planned.height) })
    }
  }
  useEffect(() => {
    void load().catch((failure) => setError(failure.message))
  }, [id])
  const action = async (name: string) => {
    if (disabled) { setError('Save or close order address editing before preparing a label.'); return }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await adminRequest(`/admin/orders/${id}/shipping-label`, {
        action: name,
        ...(name === 'quote'
          ? {
              parcel: Object.fromEntries(
                Object.entries(parcel).map(([key, value]) => [key, Number(value)]),
              ),
            }
          : name === 'purchase'
            ? { quote_id: quote.quote_id, rate_id: rateId, confirm_purchase: true }
            : name === 'dispatch'
              ? { confirm_handoff: true }
              : {}),
      })
      if (name === 'quote') {
        setQuote(response)
        setRateId('')
        setConfirm(false)
      } else {
        setConfirm(false)
        await load()
        void queryClient.invalidateQueries({ queryKey: ['orders'] })
        void queryClient.invalidateQueries({ queryKey: ['order_preview'] })
        setNotice(
          response.status === 'failed'
            ? 'Shippo confirmed the purchase failed without creating a label. Request fresh rates.'
            : name === 'fulfill'
              ? 'Label attached to fulfillment. Mark shipped when handed to the carrier.'
              : name === 'dispatch'
                ? 'Shipment recorded.'
                : 'Label purchase confirmed. You can print or reprint it below.',
        )
      }
    } catch (failure) {
      setError((failure as Error).message)
      if (name === 'purchase') {
        await load().catch(() => {})
        setQuote(null)
        setConfirm(false)
      }
    } finally {
      setBusy(false)
    }
  }
  const rate = quote?.rates.find((row: any) => row.id === rateId)
  return (
    <section className="rh-inline-editor">
      <div className="rh-inline-card">
        <div className="rh-inline-section-heading">
          <h2>Shipping label · website order</h2>
          <a href="https://apps.goshippo.com/shipments" target="_blank" rel="noopener noreferrer">
            Open Shippo ↗
          </a>
        </div>
        {state?.test && <p className="rh-inline-error">TEST LABELS · not valid postage</p>}
        {state?.message && <p>{state.message}</p>}
        {disabled && <p>Save or close order address editing before preparing a label.</p>}
        {error && (
          <p className="rh-inline-error" role="alert">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {state?.label ? (
          <div>
            <p>
              Tracking:{' '}
              <a href={state.label.tracking_url} target="_blank" rel="noopener noreferrer">
                {state.label.tracking_number}
              </a>
            </p>
            <div className="rh-inline-buttons">
              <a
                className="rh-preview-button"
                href={state.label.label_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Print / reprint 4 × 6 label
              </a>
              <button
                type="button"
                disabled={disabled || busy || !state.enabled}
                onClick={() => void action('fulfill')}
              >
                Attach label to fulfillment
              </button>
              <button
                type="button"
                disabled={disabled || busy || !state.enabled || !state.label.fulfillment_id}
                onClick={() => setConfirm(true)}
              >
                Mark shipped
              </button>
              <button type="button" disabled={busy} onClick={() => void action('reconcile')}>
                Check purchase status
              </button>
            </div>
            {confirm && (
              <div className="rh-inline-discard">
                <span>
                  Confirm the package is ready for carrier handoff.{' '}
                  {state.label.test
                    ? 'This is a test shipment.'
                    : 'The normal shipment notification may be sent.'}
                </span>
                <button type="button" disabled={busy} onClick={() => void action('dispatch')}>
                  Confirm carrier handoff
                </button>
                <button type="button" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : state?.status && state.status !== 'failed' ? (
          <div>
            <p>A purchase is pending or unconfirmed. Buying another label is blocked.</p>
            <button
              type="button"
              disabled={disabled || busy || !state.enabled}
              onClick={() => void action('reconcile')}
            >
              Check purchase status
            </button>
          </div>
        ) : (
          <>
            <fieldset disabled={disabled || !state?.enabled || busy}>
              <p>
                One package containing all unfulfilled physical items. Enter measured packed weight
                and package dimensions.
              </p>
              {state?.packingMessage && <p role="status">{state.packingMessage} Enter measured packing details below.</p>}
              {state?.packing?.length > 0 && <div><strong>Suggested packing</strong>{state.packing.map((box: any, index: number) => <p key={index}>Box {index + 1}: {box.package_name} · {box.item_count} item{box.item_count === 1 ? '' : 's'} · {box.weight} oz</p>)}{state.packing.length > 1 && <p>This plan needs multiple boxes. This label tool supports one box; review split fulfillment or confirm a larger box that safely holds all items.</p>}</div>}
              <label className="rh-inline-field"><span>Use a saved package</span><select aria-label="Use a saved package" defaultValue="" onChange={event => { const box = state.packages.find((row: any) => row.id === event.target.value); if (box) { setParcel(previous => ({ ...previous, length: String(box.length), width: String(box.width), height: String(box.height), weight: '' })); setQuote(null); setConfirm(false) } }}><option value="">Measured package / suggested packing</option>{state?.packages?.map((box: any) => <option key={box.id} value={box.id}>{box.name} · {box.length} × {box.width} × {box.height} in</option>)}</select></label>
              <small>Confirm the actual packed weight before requesting rates. Choosing a different box clears the weight so it must be remeasured.</small>
              <div className="rh-inline-grid">
                {Object.entries(parcel).map(([key, value]) => (
                  <label className="rh-inline-field" key={key}>
                    <span>
                      {key[0].toUpperCase() + key.slice(1)} ({key === 'weight' ? 'oz' : 'in'})
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={value}
                      onChange={(event) => {
                        { setParcel({ ...parcel, [key]: event.target.value }); setQuote(null); setConfirm(false) }
                        setQuote(null)
                        setRateId('')
                        setConfirm(false)
                      }}
                    />
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => void action('quote')}>
                Compare shipping rates
              </button>
              {quote && (
                <div>
                  <label className="rh-inline-field">
                    <span>Carrier service</span>
                    <select
                      aria-label="Carrier service"
                      value={rateId}
                      onChange={(event) => {
                        setRateId(event.target.value)
                        setConfirm(false)
                      }}
                    >
                      <option value="">Select a rate…</option>
                      {quote.rates.map((row: any) => (
                        <option key={row.id} value={row.id}>
                          {row.carrier} · {row.service} · ${row.amount}
                          {row.days ? ` · estimated ${row.days} days` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" disabled={!rate} onClick={() => setConfirm(true)}>
                    {quote.test ? 'Create test label' : 'Buy label'}
                  </button>
                  {confirm && rate && (
                    <div className="rh-inline-discard">
                      <span>
                        {quote.test
                          ? 'Create a test label'
                          : `Purchase postage for $${rate.amount} USD`}{' '}
                        · {rate.carrier} {rate.service} · {quote.parcel.weight} oz ·{' '}
                        {quote.parcel.length} × {quote.parcel.width} × {quote.parcel.height} in
                      </span>
                      <button type="button" onClick={() => void action('purchase')}>
                        {quote.test ? 'Confirm test label' : 'Confirm purchase'}
                      </button>
                      <button type="button" onClick={() => setConfirm(false)}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </fieldset>
          </>
        )}
        <p>Etsy orders: buy and print labels in Etsy Shop Manager.</p>
      </div>
    </section>
  )
}
