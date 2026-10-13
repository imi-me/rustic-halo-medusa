import { useCallback, useRef, useState } from 'react'
import { FocusModal } from '@medusajs/ui'
import HairClawEditor from './hair-claw-editor'
import { FitIcon } from './hair-claw-ui'

export const HairClawImageDialog = ({ productId }: { productId: string }) => {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState({ dirty: false, busy: false })
  const [leaving, setLeaving] = useState(false)
  const close = useRef<HTMLButtonElement>(null)
  const saved = useRef(false)
  const refreshProduct = useCallback(() => {
    if (saved.current) window.dispatchEvent(new CustomEvent('rh-product-offer-saved', {detail:{productId}}))
    saved.current = false
  }, [productId])
  const stateChanged = useCallback((state: { dirty: boolean; busy: boolean }) => {
    setEditing(state)
    if (!state.dirty) setLeaving(false)
  }, [])
  const changeOpen = useCallback((next: boolean) => {
    if (!next && editing.busy) return
    if (!next && editing.dirty) { setLeaving(true); return }
    setLeaving(false); setOpen(next)
    if(next)saved.current=false
    else refreshProduct()
  }, [editing,refreshProduct])
  return <FocusModal open={open} onOpenChange={changeOpen}>
    <FocusModal.Trigger asChild><button type="button" className="rh-image-fitting-trigger" aria-haspopup="dialog"><FitIcon name="corners"/>Image fitting</button></FocusModal.Trigger>
    <FocusModal.Content className="rh-fit-dialog" onOpenAutoFocus={event => { event.preventDefault(); close.current?.focus() }}>
      <div className="rh-fit-sr"><FocusModal.Title>Image fitting</FocusModal.Title></div>
      <FocusModal.Description className="rh-fit-sr">Fit current product photos to the hair-claw outline. Save adjustments as a draft before closing.</FocusModal.Description>
      {leaving && <div className="rh-fit-dialog-leave" role="alert"><span>Unsaved adjustments</span><button type="button" onClick={() => setLeaving(false)}>Keep editing</button><button type="button" onClick={() => { setLeaving(false); setOpen(false); refreshProduct() }}>Discard and close</button></div>}
      <FocusModal.Body className="rh-fit-dialog-body"><HairClawEditor key={productId} productId={productId} onSaved={() => { saved.current = true }} onStateChange={stateChanged} onRequestClose={() => changeOpen(false)} headerAction={<FocusModal.Close asChild><button ref={close} type="button" className="rh-fit-dialog-close" aria-label="Close image fitting" disabled={editing.busy}>Close <span aria-hidden="true">×</span></button></FocusModal.Close>}/></FocusModal.Body>
    </FocusModal.Content>
  </FocusModal>
}
