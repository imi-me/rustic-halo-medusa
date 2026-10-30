import { copyPhotoSource, type CopyPhotoSelection } from '../lib/copy-photos'
import { useState } from 'react'
import { descriptionText } from '../../lib/product-description'
import { adminRequest } from '../lib/inline-edit'
export type CopySuggestion = {
  title: string
  description: string
  tags: Array<{ tag: string; reason: string }>
  explanation: string
}
export function ProductCopyHelper({
  title,
  description,
  material,
  category = '',
  attributes = '',
  lockedTags = [],
  photos,
  actions = ['description', 'shorten'],
  apply,
  label = 'Ask Rusty · AI writing help',
  contextRevision,
  productId,
  draftOptions,
}: {
  title: string
  description: string
  material: string
  category?: string
  attributes?: string
  lockedTags?: string[]
  photos?: CopyPhotoSelection
  label?: string
  contextRevision?: string
  productId?:string
  draftOptions?:Array<Record<string,string>>
  actions?: string[]
  apply: (action: string, value: CopySuggestion) => void
}) {
  const [facts, setFacts] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [proposal, setProposal] = useState<{ action: string; value: CopySuggestion; snapshot: string } | null>(null)
  const snapshot = JSON.stringify({contextRevision,facts,productId,draftOptions})
  const stale = contextRevision !== undefined && !!proposal && proposal.snapshot !== snapshot
  const invalidSeo = !!proposal && proposal.action === 'product-seo' && (!proposal.value.title.trim() || !proposal.value.description.trim() || proposal.value.title.length>100 || proposal.value.description.length>320)
  const labels: Record<string, string> = {
    'product-seo': 'Suggest search wording',
    description: 'Help me write',
    shorten: 'Shorten description',
    'etsy-title': 'Improve Etsy title',
    'etsy-description': 'Write Etsy description',
    'etsy-tags': 'Generate Etsy tags',
  }
  const generate = async (action: string) => {
    setBusy(true)
    setError('')
    setProposal(null)
    try {
      const sources = photos?.enabled ? await Promise.all(photos.selected.map(copyPhotoSource)) : []
      if (sources.reduce((size, source) => size + new TextEncoder().encode(source).length, 0) > 4_500_000) throw new Error('Selected photo previews are too large together. Use smaller photos or select fewer newly added images.')
      const response = await adminRequest('/admin/assistant/product-copy', {
        action,
        ...(action==='product-seo' ? (productId?{product_id:productId}:{draft_options:draftOptions||[]}) : {}),
        title,
        description: descriptionText(description),
        material,
        facts,
        category,
        attributes,
        locked_tags: lockedTags,
        photos: sources,
      })
      setProposal({ action, value: response.suggestion, snapshot })
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="rh-copy-helper">
      <summary>{label}</summary>
      <label className="rh-inline-field">
        <span>Facts or instructions for this draft</span>
        <textarea
          rows={2}
          value={facts}
          placeholder="Audience, style, verified size or material…"
          onChange={(event) => setFacts(event.target.value)}
        />
      </label>
      <p className="rh-copy-photo-status">{photos?.enabled && photos.selected.length ? `Using ${photos.selected.length} product photos` : 'Text-only draft'}{photos && <> · <a href={`#${photos.galleryId}`} onClick={() => { const gallery = document.getElementById(photos.galleryId); if (gallery instanceof HTMLDetailsElement) gallery.open = true }}>Choose in Images</a></>}</p>
      <div className="rh-inline-buttons">
        {actions.map((action) => (
          <button
            type="button"
            key={action}
            disabled={busy || !title.trim()}
            onClick={() => void generate(action)}
          >
            {busy ? 'Working…' : labels[action]}
          </button>
        ))}
      </div>
      <small>
        Product details, your brief and any selected photos are sent to your configured AI provider when you generate. Review before use; nothing saves automatically.
      </small>
      {error && (
        <p role="alert" className="rh-inline-error">
          {error}
        </p>
      )}
      {proposal && (
        <div className="rh-copy-proposal">
          <h3>Review suggestion</h3>
          {(proposal.value.title || proposal.action === 'product-seo') && (
            <label className="rh-inline-field">
              <span>{proposal.action === 'product-seo' ? 'Suggested search title' : 'Suggested title'}</span>
              <input
                aria-label={proposal.action === 'product-seo' ? 'Suggested search title' : 'Suggested title'}
                maxLength={proposal.action === 'product-seo' ? 100 : undefined}
                value={proposal.value.title}
                onChange={(event) =>
                  setProposal({
                    ...proposal,
                    value: { ...proposal.value, title: event.target.value },
                  })
                }
              />
            </label>
          )}
          {(proposal.value.description || proposal.action === 'product-seo') && (
            <label className="rh-inline-field">
              <span>{proposal.action === 'product-seo' ? 'Suggested search description' : 'Suggested description'}</span>
              <textarea
                rows={5}
                aria-label={proposal.action === 'product-seo' ? 'Suggested search description' : 'Suggested description'}
                maxLength={proposal.action === 'product-seo' ? 320 : undefined}
                value={proposal.value.description}
                onChange={(event) =>
                  setProposal({
                    ...proposal,
                    value: { ...proposal.value, description: event.target.value },
                  })
                }
              />
            </label>
          )}
          {proposal.value.tags.map((row, index) => (
            <label className="rh-inline-field" key={index}>
              <span>
                Tag {index + 1} · {row.tag.length}/20
              </span>
              <input
                value={row.tag}
                maxLength={20}
                onChange={(event) =>
                  setProposal({
                    ...proposal,
                    value: {
                      ...proposal.value,
                      tags: proposal.value.tags.map((tag, i) =>
                        i === index ? { ...tag, tag: event.target.value } : tag,
                      ),
                    },
                  })
                }
              />
              <small>{row.reason}</small>
            </label>
          ))}
          <p>{proposal.value.explanation}</p>
          {stale && <p role="status">Product details or search wording changed after Rusty started. Generate a fresh suggestion to keep your latest edits.</p>}
          <button
            disabled={stale || invalidSeo}
            type="button"
            onClick={() => {
              if (stale || invalidSeo) return
              apply(proposal.action, proposal.value)
              setProposal(null)
            }}
          >
            Use suggestion in draft
          </button>
          <button type="button" onClick={() => setProposal(null)}>
            Dismiss
          </button>
        </div>
      )}
    </details>
  )
}
