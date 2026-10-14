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
  actions = ['description', 'shorten'],
  apply,
}: {
  title: string
  description: string
  material: string
  category?: string
  attributes?: string
  lockedTags?: string[]
  actions?: string[]
  apply: (action: string, value: CopySuggestion) => void
}) {
  const [facts, setFacts] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [proposal, setProposal] = useState<{ action: string; value: CopySuggestion } | null>(null)
  const labels: Record<string, string> = {
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
      const response = await adminRequest('/admin/assistant/product-copy', {
        action,
        title,
        description: descriptionText(description),
        material,
        facts,
        category,
        attributes,
        locked_tags: lockedTags,
      })
      setProposal({ action, value: response.suggestion })
    } catch (failure) {
      setError((failure as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <details className="rh-copy-helper">
      <summary>Ask Rusty · AI writing help</summary>
      <label className="rh-inline-field">
        <span>Facts or instructions for this draft</span>
        <textarea
          rows={2}
          value={facts}
          placeholder="Audience, style, verified size or material…"
          onChange={(event) => setFacts(event.target.value)}
        />
      </label>
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
        Selected product facts are sent to OpenAI. Review before use; nothing saves automatically.
      </small>
      {error && (
        <p role="alert" className="rh-inline-error">
          {error}
        </p>
      )}
      {proposal && (
        <div className="rh-copy-proposal">
          <h3>Review suggestion</h3>
          {proposal.value.title && (
            <label className="rh-inline-field">
              <span>Suggested title</span>
              <input
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
          {proposal.value.description && (
            <label className="rh-inline-field">
              <span>Suggested description</span>
              <textarea
                rows={5}
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
          <button
            type="button"
            onClick={() => {
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
