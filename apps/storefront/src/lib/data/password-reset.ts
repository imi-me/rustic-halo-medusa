"use server"

import { sdk } from "@lib/config"

export type ResetState = { success?: boolean; message: string } | null
export async function requestPasswordReset(_state: ResetState, form: FormData): Promise<ResetState> {
 if (process.env.CUSTOMER_PASSWORD_RESET_ENABLED !== "true") return { message: "Password recovery is not available yet. Please contact hello@rustichalo.com for help." }
 const email = form.get("email")
 if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { message: "Enter a valid email address." }
 try { await sdk.auth.resetPassword("customer", "emailpass", { identifier: email.trim() }) }
 catch { /* Identical response prevents revealing which accounts exist. */ }
 return { success: true, message: "If an account uses that email, you will receive a password-reset link. Check your inbox and spam folder." }
}
export async function finishPasswordReset(_state: ResetState, form: FormData): Promise<ResetState> {
 const email = form.get("email"), token = form.get("token"), password = form.get("password"), confirm = form.get("confirm")
 if (typeof email !== "string" || typeof token !== "string" || !email || !token || token.length > 4096) return { message: "This reset link is invalid. Request a new one." }
 if (typeof password !== "string" || password.length < 12 || password.length > 128) return { message: "Use a password between 12 and 128 characters." }
 if (password !== confirm) return { message: "The passwords do not match." }
 try { await sdk.auth.updateProvider("customer", "emailpass", { email, password }, token) }
 catch { return { message: "This reset link could not be used. Request a new link and try again." } }
 return { success: true, message: "Your password has been updated. You can now sign in." }
}
