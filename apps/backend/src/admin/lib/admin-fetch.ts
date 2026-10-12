// Bound both headers and body reads. Keep uncertain writes for reconciliation.
export async function adminFetch(url: string, options: RequestInit = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(url, { credentials: 'include', ...options, signal: controller.signal })
    const data = await response.json().catch(error => {
      if (controller.signal.aborted) throw error
      return {}
    })
    if (!response.ok) throw new Error(data.message ?? 'Request failed. Your draft is kept.')
    return data
  } catch (error) {
    if (controller.signal.aborted) throw new Error(options.method && options.method !== 'GET'
      ? 'Save response timed out. Your draft is kept. Reload to check whether changes saved before trying again.'
      : 'Loading took too long. Try again; your draft is kept.')
    throw error
  } finally { clearTimeout(timer) }
}
