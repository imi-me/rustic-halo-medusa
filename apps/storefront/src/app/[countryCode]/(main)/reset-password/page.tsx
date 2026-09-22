import type { Metadata } from "next"
import PasswordReset from "@modules/account/components/password-reset"
export const metadata: Metadata = { title: "Reset your password", robots: { index: false, follow: false }, referrer: "no-referrer" }
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; email?: string }> }) {
 const params = await searchParams
 return <PasswordReset token={typeof params.token === "string" ? params.token : ""} email={typeof params.email === "string" ? params.email : ""} />
}
