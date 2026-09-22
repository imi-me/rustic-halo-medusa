"use client"
import { useActionState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { requestPasswordReset, finishPasswordReset } from "@lib/data/password-reset"

export default function PasswordReset({ token, email }: { token: string; email: string }) {
 const { countryCode } = useParams()
 const resetting = Boolean(token && email)
 const [state, action, pending] = useActionState(resetting ? finishPasswordReset : requestPasswordReset, null)
 const field = "w-full rounded border border-gray-300 p-3 mt-1"
 return <section className="mx-auto max-w-md px-6 py-16">
  <h1 className="text-2xl mb-4">{resetting ? "Choose a new password" : "Forgot your password?"}</h1>
  {!state?.success && <form action={action} className="space-y-5">
   {resetting ? <>
    <input type="hidden" name="token" value={token} />
    <input type="hidden" name="email" value={email} />
    <label className="block">New password<input className={field} name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
    <label className="block">Confirm password<input className={field} name="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
    <p className="text-sm">Use at least 12 characters.</p>
   </> : <label className="block">Email<input className={field} name="email" type="email" autoComplete="email" maxLength={254} required /></label>}
   <button disabled={pending} className="w-full rounded bg-stone-800 text-white p-3 disabled:opacity-50">{pending ? "Please wait…" : resetting ? "Save password" : "Send reset link"}</button>
  </form>}
  {state?.message && <p role="status" className="my-5">{state.message}</p>}
  <Link className="inline-block underline mt-5" href={`/${countryCode}/account`}>Back to sign in</Link>
  {resetting && !state?.success && <Link className="block underline mt-3" href={`/${countryCode}/reset-password`}>Request a new reset link</Link>}
 </section>
}
