import type { ReactNode, SyntheticEvent } from 'react'

export function ProductSection({ title, children, actions, className = '', id, open = true }: { title: string; children: ReactNode; actions?: ReactNode; className?: string; id?: string; open?: boolean }) {
  return <details id={id} open={open} className={`rh-inline-card rh-product-section ${className}`}>
    <summary><h2>{title}</h2></summary>
    {actions && <div className="rh-section-actions">{actions}</div>}
    {children}
  </details>
}
export function revealInvalidField(event: SyntheticEvent) {
  let ancestor = (event.target as HTMLElement).parentElement
  while (ancestor) { if (ancestor instanceof HTMLDetailsElement) ancestor.open = true; ancestor = ancestor.parentElement }
}
