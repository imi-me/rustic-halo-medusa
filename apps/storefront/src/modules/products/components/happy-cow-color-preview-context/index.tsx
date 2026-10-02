"use client"

import { createContext, ReactNode, useContext, useState } from "react"

type HappyCowPreviewContextValue = {
  canPreviewFourInch: boolean
  setCanPreviewFourInch: (canPreview: boolean) => void
  previewColorSlug: string
  setPreviewColorSlug: (slug: string) => void
}

const HappyCowPreviewContext =
  createContext<HappyCowPreviewContextValue | null>(null)

export const HappyCowPreviewProvider = ({
  children,
}: {
  children: ReactNode
}) => {
  const [canPreviewFourInch, setCanPreviewFourInch] = useState(false)
  const [previewColorSlug, setPreviewColorSlug] = useState("black")

  return (
    <HappyCowPreviewContext.Provider
      value={{
        canPreviewFourInch,
        setCanPreviewFourInch,
        previewColorSlug,
        setPreviewColorSlug,
      }}
    >
      {children}
    </HappyCowPreviewContext.Provider>
  )
}

export const useHappyCowPreview = () => {
  const context = useContext(HappyCowPreviewContext)

  if (!context) {
    throw new Error("Happy Cow preview components require their provider")
  }

  return context
}
