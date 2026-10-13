"use client"

import { createContext, ReactNode, useContext, useState } from "react"
import { createPortal } from "react-dom"

const GalleryControlsContext = createContext<{
  target: HTMLDivElement | null
  setTarget: (target: HTMLDivElement | null) => void
} | null>(null)

export function GalleryControlsProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)
  return <GalleryControlsContext.Provider value={{ target, setTarget }}>{children}</GalleryControlsContext.Provider>
}

export function GalleryControlsTarget() {
  const context = useContext(GalleryControlsContext)
  return <div className="rh-gallery-purchase-controls" ref={context?.setTarget} />
}

// Move only the controls; keep each gallery's preview state and renderer intact.
export default function GalleryControls({ children }: { children: ReactNode }) {
  const context = useContext(GalleryControlsContext)
  if (!context) return <>{children}</>
  return context.target ? createPortal(children, context.target) : null
}
