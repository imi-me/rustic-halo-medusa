import { defineRouteConfig } from '@medusajs/admin-sdk'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import '../../styles/blue-admin.css'
import '../../styles/social-media.css'

type Post = { id?: string; version?: number; title: string; product_id: string | null; product_title?: string | null; image_url: string | null; platform: string; caption: string; planned_date: string | null; status: string }
type Product = { id: string; title: string; thumbnail?: string; images?: { url: string }[] }
const empty = (): Post => ({ title: '', product_id: null, image_url: null, platform: 'instagram', caption: '', planned_date: null, status: 'draft' })
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
const monday = () => { const date = new Date(); date.setHours(12,0,0,0); date.setDate(date.getDate() - (date.getDay()+6)%7); return date }
const statusLabel = (value: string) => ({ draft: 'Draft', review: 'Needs review', approved: 'Approved' })[value] || value
const SocialIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 17h3"/></svg>
const request = async (url: string, body?: unknown, signal?: AbortSignal) => {
  const response = await fetch(url, { credentials: 'include', signal, ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || 'Could not load social media. Try again.')
  return result
}
const SocialMediaPage = () => {
  const [posts, setPosts] = useState<Post[]>([]), [post, setPost] = useState<Post>(empty), [products, setProducts] = useState<Product[]>([]), [product, setProduct] = useState<Product | null>(null)
  const [tab, setTab] = useState('Calendar'), [week, setWeek] = useState(monday), [query, setQuery] = useState(''), [direction, setDirection] = useState('Write a warm, casual caption for this handmade product. Include a few relevant hashtags.')
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [productError, setProductError] = useState('')
  const reload = async () => {
    setLoading(true); setError('')
    try {
      const all: Post[] = []
      for (let page=0; page<20; page++) { const result = await request(`/admin/social-media/posts?page=${page}`); all.push(...result.posts); if (!result.has_more) { setPosts(all); return } }
      throw new Error('More than 2,000 posts are saved. Calendar loading needs pagination before continuing.')
    } catch (cause) { setError((cause as Error).message) } finally { setLoading(false) }
  }
  useEffect(() => { void reload(); request('/admin/social-media').then(result => setReady(result.ai_ready)).catch(cause => setError(cause.message)) }, [])
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => { request(`/admin/products?limit=20&fields=id,title,thumbnail,images.url&q=${encodeURIComponent(query)}`, undefined, controller.signal).then(result => { setProducts(result.products); setProductError('') }).catch(cause => { if (!controller.signal.aborted) setProductError(cause.message) }) }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])
  useEffect(() => {
    setProduct(null)
    if (!post.product_id) return
    const controller = new AbortController()
    request(`/admin/products/${post.product_id}?fields=id,title,thumbnail,images.url`, undefined, controller.signal).then(result => { setProduct(result.product); setProductError('') }).catch(cause => { if (!controller.signal.aborted) setProductError(cause.message) })
    return () => controller.abort()
  }, [post.product_id])
  const change = (patch: Partial<Post>) => { setPost(current => ({ ...current, ...patch, status: patch.status || 'draft' })); setDirty(true); setNotice('') }
  const select = (next: Post) => { if (busy || dirty && !window.confirm('Discard unsaved post changes?')) return; setPost({ ...next }); setDirty(false); setNotice(''); setError('') }
  const save = async (status: string) => {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await request('/admin/social-media/posts', { id: post.id, version: post.version, title: post.title, product_id: post.product_id, image_url: post.image_url, platform: post.platform, caption: post.caption, planned_date: post.planned_date, status })
      setPost(result.post); setDirty(false); setPosts(current => [result.post, ...current.filter(item => item.id !== result.post.id)]); setNotice(status === 'approved' ? 'Approved and saved. Publishing is not connected.' : 'Post saved.')
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  const generate = async () => {
    if (post.caption && !window.confirm('Replace the current caption with a new AI draft?')) return
    setBusy(true); setError(''); setNotice('')
    try { const result = await request('/admin/social-media/generate', { product_id: post.product_id, platform: post.platform, direction }, AbortSignal.timeout(70000)); change({ caption: result.caption }); setNotice('Caption generated. Review it, then save your draft.') }
    catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  const days = Array.from({length:7},(_,index) => { const date = new Date(week); date.setDate(date.getDate()+index); return date })
  const images = Array.from(new Set([product?.thumbnail, ...(product?.images || []).map(image => image.url)].filter((url): url is string => Boolean(url && /^https?:\/\//.test(url)))))
  const moveWeek = (amount: number) => { const next = new Date(week); next.setDate(next.getDate()+amount*7); setWeek(next) }
  const tiles = (items: Post[]) => items.map(item => <button className={`sm-post ${post.id === item.id ? 'selected' : ''}`} key={item.id} disabled={busy} onClick={() => select(item)}>{item.image_url && <img src={item.image_url} alt="" loading="lazy"/>}<span className={`sm-badge ${item.status}`}>{statusLabel(item.status)}</span><strong>{item.title}</strong><small>{item.platform === 'instagram' ? 'Instagram' : 'Facebook'}</small><p>{item.caption || 'Caption pending'}</p></button>)
  return <div className="sm-workspace">
    <header className="sm-header"><div><span className="sm-eyebrow">RUSTIC HALO · MARKETING</span><h1>Social media</h1><p>Plan your content. Give every product a story.</p></div><div className="sm-actions"><button disabled={loading || busy} onClick={() => void reload()}>Refresh posts</button><button className="sm-primary" disabled={busy} onClick={() => select(empty())}>+ New post</button></div></header>
    <div className="sm-stats"><div><span>Saved drafts</span><strong>{loading ? '…' : posts.filter(item => item.status === 'draft').length}</strong></div><div><span>Needs review</span><strong>{loading ? '…' : posts.filter(item => item.status === 'review').length}</strong></div><div><span>Approved</span><strong>{loading ? '…' : posts.filter(item => item.status === 'approved').length}</strong></div><div><span>Publishing</span><strong className="sm-small-value">Not connected</strong></div></div>
    <div className="sm-tabs" role="tablist" aria-label="Social workspace">{['Calendar','Drafts','Media library','Accounts'].map(name => <button key={name} role="tab" aria-selected={tab === name} aria-controls="sm-content" id={`sm-tab-${name.replace(' ','-')}`} onClick={() => setTab(name)}>{name}</button>)}</div>
    {error && <div role="alert" className="sm-error">{error}</div>}{notice && <p role="status" className="sm-notice">{notice}</p>}
    <div className="sm-layout"><section id="sm-content" role="tabpanel" aria-labelledby={`sm-tab-${tab.replace(' ','-')}`}>
      {tab === 'Calendar' && <><div className="sm-section-title"><h2>{days[0].toLocaleDateString(undefined,{month:'short',day:'numeric'})} – {days[6].toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</h2><div className="sm-actions"><button aria-label="Previous week" onClick={() => moveWeek(-1)}>←</button><button onClick={() => setWeek(monday())}>This week</button><button aria-label="Next week" onClick={() => moveWeek(1)}>→</button></div></div><div className="sm-week">{days.map(date => <section key={dayKey(date)} className={dayKey(date) === dayKey(new Date()) ? 'today' : ''}><h3>{date.toLocaleDateString(undefined,{weekday:'short'})}<span>{date.getDate()}</span></h3>{tiles(posts.filter(item => item.planned_date === dayKey(date)))}<button className="sm-add" disabled={busy} aria-label={`Add post for ${dayKey(date)}`} onClick={() => select({...empty(),planned_date:dayKey(date)})}>+ Add post</button></section>)}</div><section className="sm-card sm-unscheduled"><h2>Unplanned posts</h2><div className="sm-drafts">{tiles(posts.filter(item => !item.planned_date))}</div>{!posts.some(item => !item.planned_date) && <p className="sm-muted">Save a draft without a date to keep it here.</p>}</section></>}
      {tab === 'Drafts' && <section className="sm-card"><h2>All saved posts</h2>{loading ? <p role="status">Loading posts…</p> : !posts.length ? <div className="sm-empty"><SocialIcon/><h3>Your first story starts here</h3><p>Select a product and write a caption, then save your draft.</p></div> : <div className="sm-drafts">{tiles(posts)}</div>}</section>}
      {tab === 'Media library' && <section className="sm-card"><h2>Product photos</h2><p className="sm-muted">Choose a product in the editor to browse its existing photos.</p>{product && <h3>{product.title}</h3>}<div className="sm-photos">{images.map(url => <button key={url} disabled={busy} aria-label="Use product photo" aria-pressed={post.image_url === url} onClick={() => change({ image_url: url })}><img src={url} alt={product?.title || 'Product photo'}/></button>)}</div>{product && !images.length && <p>No photos on this product yet. Add them in Products.</p>}</section>}
      {tab === 'Accounts' && <section className="sm-card"><h2>Social accounts</h2>{['Instagram','Facebook'].map(name => <div className="sm-account" key={name}><strong>{name}</strong><span className="sm-badge">Not connected</span></div>)}<p className="sm-muted">Drafts, planned dates and approvals are available. Account connection and automatic publishing are the next phase.</p></section>}
      <p className="sm-footnote">Dates are content plans, not automatic publishing times. Calendar uses your browser’s local date.</p>
    </section><section className="sm-card sm-editor"><div className="sm-section-title"><h2>{post.id ? 'Edit post' : 'Create a post'}</h2><span className={`sm-badge ${post.status}`}>{dirty ? 'Unsaved draft' : statusLabel(post.status)}</span></div>
      <fieldset disabled={busy}><label>Post title<input value={post.title} maxLength={160} onChange={event => change({title:event.target.value})} placeholder="Give this post a name"/></label>
      <label>Find a product<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search your catalog"/></label>
      <label>Product<select value={post.product_id || ''} onChange={event => { const found=products.find(item => item.id === event.target.value); change({product_id:found?.id || null,product_title:found?.title || null,title:found?.title || post.title,caption:'',image_url:found?.thumbnail && /^https?:\/\//.test(found.thumbnail) ? found.thumbnail : null}) }}><option value="">Choose a product</option>{product && !products.some(item => item.id === product.id) && <option value={product.id}>{product.title}</option>}{products.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      {productError && <p role="alert" className="sm-error">{productError}</p>}
      {post.product_id && <Link to={`/products/${post.product_id}`}>Open product details</Link>}
      <div className="sm-photos">{images.map(url => <button type="button" key={url} aria-label="Select product photo" aria-pressed={post.image_url === url} onClick={() => change({image_url:url})}><img src={url} alt=""/></button>)}</div>
      {post.image_url && <button className="sm-text-button" onClick={() => change({image_url:null})}>Remove selected photo</button>}
      <div className="sm-fields"><label>Platform<select value={post.platform} onChange={event => change({platform:event.target.value})}><option value="instagram">Instagram</option><option value="facebook">Facebook</option></select></label><label>Planned date<input type="date" value={post.planned_date || ''} onChange={event => change({planned_date:event.target.value || null})}/></label></div>
      <details className="sm-ai" open><summary>AI drafting assistant <span>{ready ? 'Ready' : 'Setup pending'}</span></summary><label>Your direction<textarea rows={3} value={direction} maxLength={1500} onChange={event => setDirection(event.target.value)}/></label><button disabled={!ready || !post.product_id || !direction.trim()} onClick={() => void generate()}>{busy ? 'Working…' : 'Generate caption'}</button>{!ready && <p>AI drafting becomes available when the admin assistant key and model are configured.</p>}</details>
      <label>Caption<textarea rows={5} value={post.caption} maxLength={post.platform === 'instagram' ? 2200 : 5000} onChange={event => change({caption:event.target.value})} placeholder="Write your story or generate a draft…"/><small>{post.caption.length} / {post.platform === 'instagram' ? '2,200' : '5,000'}</small></label>
      <details className="sm-preview" open><summary>Post preview</summary><div className="sm-preview-profile">rustic.halo <span>{post.platform === 'instagram' ? 'Instagram' : 'Facebook'}</span></div>{post.image_url ? <img className="sm-preview-photo" src={post.image_url} alt={post.product_title || 'Selected product photo'}/> : <div className="sm-preview-placeholder">Choose a product photo</div>}<p>{post.caption || 'Your caption appears here.'}</p></details>
      </fieldset><div className="sm-save"><button disabled={busy || !post.caption.trim()} onClick={() => { void navigator.clipboard.writeText(post.caption).then(() => setNotice('Caption copied.')).catch(() => setError('Clipboard unavailable. Select and copy the caption manually.')) }}>Copy caption</button><button className="sm-primary" disabled={busy || !post.title.trim()} onClick={() => void save('draft')}>{busy ? 'Working…' : 'Save draft'}</button><button disabled={busy || !post.title.trim() || !post.caption.trim()} onClick={() => void save('review')}>Request review</button><button disabled={busy || !post.title.trim() || !post.caption.trim()} onClick={() => void save('approved')}>Approve post</button></div><p className="sm-footnote">{dirty ? 'Unsaved changes. ' : ''}Approval saves your decision; it does not publish.</p>
    </section></div>
  </div>
}
export const config = defineRouteConfig({ label: 'Social media', icon: SocialIcon, rank: 2 })
export default SocialMediaPage
