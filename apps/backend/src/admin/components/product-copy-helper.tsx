import { copyPhotoChoices, copyPhotoSource, type CopyPhoto } from '../lib/copy-photos'
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
  images = [],
  thumbnail = '',
  actions = ['description', 'shorten'],
  apply,
}: {
  title: string
  description: string
  material: string
  category?: string
  attributes?: string
  lockedTags?: string[]
  images?: CopyPhoto[]
  thumbnail?: string
  actions?: string[]
  apply: (action: string, value: CopySuggestion) => void
}) {
  const photoChoices = copyPhotoChoices(images, thumbnail)
  const [usePhotos, setUsePhotos] = useState(true)
  const [selection, setSelection] = useState<string[] | null>(null)
  const selectedPhotos = selection === null ? photoChoices.slice(0, 3) : selection.filter(url => photoChoices.includes(url))
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
      if (usePhotos && photoChoices.length && !selectedPhotos.length) throw new Error('Choose up to three photos, or turn off Use product photos.')
      const photos = usePhotos ? await Promise.all(selectedPhotos.map(copyPhotoSource)) : []
      const response = await adminRequest('/admin/assistant/product-copy', {
        action,
        title,
        description: descriptionText(description),
        material,
        facts,
        category,
        attributes,
        locked_tags: lockedTags,
        photos,
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
      <div className="rh-copy-photo-picker">
        <label className="rh-copy-photo-toggle"><input type="checkbox" checked={usePhotos && photoChoices.length > 0} disabled={busy || !photoChoices.length} onChange={event => setUsePhotos(event.target.checked)}/>Use product photos</label>
        {photoChoices.length ? <>
          <small>{usePhotos ? `${selectedPhotos.length}/3 photos selected · cover first` : 'Text-only draft'}</small>
          {usePhotos && <div className="rh-copy-photo-options" role="group" aria-label="Product photos for AI">
            {photoChoices.map((url, index) => <label className="rh-copy-photo-option" key={url}>
              <input type="checkbox" aria-label={`Use photo ${index + 1} for AI`} checked={selectedPhotos.includes(url)} disabled={busy || (!selectedPhotos.includes(url) && selectedPhotos.length >= 3)} onChange={event => setSelection(event.target.checked ? [...selectedPhotos, url] : selectedPhotos.filter(selected => selected !== url))}/>
              <img src={url} alt={`AI product photo ${index + 1}`} loading="lazy"/>
              <span>{url === thumbnail ? 'Cover' : `Photo ${index + 1}`}</span>
            </label>)}
          </div>}
        </> : <small>Add product photos to include visual details.</small>}
      </div>
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
        Selected product facts and photos are sent to your configured AI provider when you generate. Review before use; nothing saves automatically.
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
