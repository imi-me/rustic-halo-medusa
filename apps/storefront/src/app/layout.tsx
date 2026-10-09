import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import "styles/globals.css"
import "styles/theme.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light">
      <head><link rel="preload" href="/fonts/CormorantGaramond-variable.ttf" as="font" type="font/ttf" crossOrigin="anonymous" /></head>
      <body>
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
