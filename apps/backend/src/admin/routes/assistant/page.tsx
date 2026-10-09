import { defineRouteConfig } from '@medusajs/admin-sdk'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import '../../styles/blue-admin.css'
import '../../styles/assistant.css'

type Proposal = { token: string; productId: string; before: { title: string; description: string | null }; after: { title: string; description: string | null } }
type Entry = { role: 'user' | 'assistant'; content: string; sources?: { label: string; path: string }[]; proposals?: Proposal[] }
const AssistantIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /></svg>
const prompts = ['What are price lists?', 'Find my hair claw products', 'Show recent orders', 'Explain available versus reserved inventory']
const AssistantPage = () => {
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [entries, setEntries] = useState<Entry[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [applied, setApplied] = useState<string[]>([])
  const [applying, setApplying] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/admin/assistant', { credentials: 'include', signal: controller.signal }).then(async response => { if (!response.ok) throw new Error(); const status = await response.json(); setReady(status.ready === true) }).catch(() => { if (!controller.signal.aborted) setError('Assistant status could not load. Refresh this page to try again.') }).finally(() => { if (!controller.signal.aborted) setChecking(false) })
    return () => controller.abort()
  }, [])
  const send = async () => {
    if (!ready || busy || !question.trim()) return
    const messages: Entry[] = [...entries, { role: 'user', content: question.trim() }]
    if (messages.length > 12 || messages.reduce((sum, entry) => sum + entry.content.length, 0) > 16000) { setError('Start a new conversation to continue.'); return }
    setBusy(true); setError(''); setQuestion(''); setEntries(messages)
    try {
      const response = await fetch('/admin/assistant', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })) }), signal: AbortSignal.timeout(85000) })
      const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Assistant unavailable.')
      setEntries([...messages, { role: 'assistant', content: result.answer, sources: result.sources, proposals: result.proposals }])
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Assistant unavailable.'); setEntries(messages.slice(0, -1)); setQuestion(messages[messages.length - 1].content) }
    finally { setBusy(false) }
  }
  const apply = async (proposal: Proposal) => {
    if (applying) return
    setApplying(proposal.token); setError('')
    try {
      const response = await fetch('/admin/assistant/apply', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: proposal.token }), signal: AbortSignal.timeout(30000) })
      const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Update unavailable.')
      setApplied(current => [...current, proposal.token])
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Update could not be confirmed. Check the product.') }
    finally { setApplying('') }
  }
  return <div className="rh-assistant">
    <header><p className="rh-assistant-eyebrow">RUSTIC HALO · ADMIN HELP</p><h1>Ask Rustic Halo</h1><p>Get help with your store, find records, and prepare product copy changes.</p><span className="rh-assistant-badge">{checking ? 'Checking connection…' : ready ? 'Connected · changes require review' : 'Waiting for setup'}</span></header>
    {!checking && !ready && <section className="rh-assistant-setup"><h2>Your assistant is ready for its own key</h2><p>Once the separate OpenAI project key and model are configured on the staging backend, you can start asking questions here.</p><p>Keep the key in backend configuration. Never paste it into this chat.</p><details><summary>Setup details</summary><p>Staging backend environment: ADMIN_ASSISTANT_OPENAI_API_KEY, ADMIN_ASSISTANT_MODEL, and ADMIN_ASSISTANT_ENABLED=true. Redeploy after setting them. Use a separate OpenAI project with spending controls.</p></details></section>}
    <section className="rh-assistant-chat" aria-label="Admin assistant conversation"><div className="rh-assistant-messages" role="log" aria-live="polite">
      {!entries.length && <div className="rh-assistant-welcome"><AssistantIcon /><h2>A little help, right where you work</h2><p>Ask about Medusa, look up products or orders, or ask for a better product description.</p><div className="rh-assistant-prompts">{prompts.map(prompt => <button key={prompt} disabled={!ready || busy} onClick={() => setQuestion(prompt)}>{prompt}</button>)}</div></div>}
      {entries.map((entry, index) => <article key={index} className={`rh-assistant-entry ${entry.role}`}><strong>{entry.role === 'user' ? 'You' : 'Ask Rustic Halo'}</strong><p>{entry.content}</p>{entry.sources && <div className="rh-assistant-sources">{entry.sources.map((source, i) => /^\/app\/(products|orders|inventory)\/[A-Za-z0-9_]+$/.test(source.path) && <Link key={i} to={source.path.slice(4)}>{source.label}</Link>)}</div>}{entry.proposals?.map(proposal => <section className="rh-assistant-proposal" key={proposal.token}><h3>Review product changes</h3><Link to={`/products/${proposal.productId}`}>Open product</Link><div className="rh-assistant-compare">{(['before', 'after'] as const).map(side => <div key={side}><h4>{side === 'before' ? 'Current copy' : 'Proposed copy'}</h4><strong>{proposal[side].title}</strong><p>{proposal[side].description || 'No description'}</p></div>)}</div><p>Applies only the title and description shown. Proposal expires after 15 minutes.</p><button disabled={busy || Boolean(applying) || applied.includes(proposal.token)} onClick={() => apply(proposal)}>{applied.includes(proposal.token) ? 'Changes applied' : applying === proposal.token ? 'Applying…' : 'Apply changes'}</button></section>)}</article>)}
      {busy && <p role="status">Checking your store and preparing an answer…</p>}
    </div><form onSubmit={event => { event.preventDefault(); void send() }}><label htmlFor="rh-assistant-question">Your question</label><textarea id="rh-assistant-question" placeholder={ready ? 'Ask about your store…' : 'Available after setup'} value={question} onChange={event => setQuestion(event.target.value)} maxLength={4000} disabled={!ready || busy} rows={3} /><div className="rh-assistant-actions"><button type="button" disabled={busy || Boolean(applying)} onClick={() => { setEntries([]); setApplied([]); setError(''); setQuestion('') }}>New conversation</button><button type="submit" disabled={!ready || busy || !question.trim()}>Ask assistant</button></div></form></section>
    {error && <p className="rh-assistant-error" role="alert">{error}</p>}
    <footer>Questions and selected store records are sent to OpenAI when enabled. Buyer contact details and addresses are excluded from tools. Chat stays in this page until you leave or start a new conversation. Check AI suggestions before applying. Inventory, publishing and payment changes are unavailable.</footer>
  </div>
}
export const config = defineRouteConfig({ label: 'Ask Rustic Halo', icon: AssistantIcon, rank: 1 })
export default AssistantPage
