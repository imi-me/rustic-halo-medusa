import { ProductSection } from './product-section'
import { useState } from 'react'
import { descriptionText } from '../../lib/product-description'
import {
  emptyEtsyDraft,
  searchReadiness,
  isHairClaw,
  sellableColorVariants,
  type EtsyDraft,
} from '../../lib/product-admin'
import { HairClawPreviewExport } from './hair-claw-preview-export'
import type { CopyPhotoSelection } from '../lib/copy-photos'
import { ProductCopyHelper, type CopySuggestion } from './product-copy-helper'
import { adminRequest, type Entity } from '../lib/inline-edit'

export function EtsyListingEditor({
  value,
  change,
  product,
  title,
  description,
  material,
  photos,
  saved = false,
  addColorImage,
}: {
  value: EtsyDraft
  change: (value: EtsyDraft) => void
  product: Entity
  title: string
  description: string
  material: string
  photos: CopyPhotoSelection
  saved?: boolean
  addColorImage?: (variantId: string, url: string) => void
}) {
  const [locked, setLocked] = useState<string[]>([])
  const [undo, setUndo] = useState<EtsyDraft | null>(null)
  const [tag, setTag] = useState('')
  const [message, setMessage] = useState('')
  const [review, setReview] = useState<any>(null)
  const [imageReview, setImageReview] = useState<any>(null)
  const [colorReview, setColorReview] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const checks = searchReadiness(value)
  const apply = (action: string, suggestion: CopySuggestion) => {
    setUndo(value)
    change({
      ...value,
      ...(action === 'etsy-title'
        ? { title: suggestion.title }
        : action === 'etsy-description'
          ? { description: suggestion.description }
          : { tags: suggestion.tags.map((row) => row.tag) }),
    })
  }
  const colorVariants = isHairClaw(product) ? sellableColorVariants(product) : []
  const sameColorOffer = (left: string, right: string) => left === right || product.metadata?.hair_claw_template_v2?.color_mode === 'order' && colorVariants.find(v => v.id === left)?.metadata?.order_variant_id === colorVariants.find(v => v.id === right)?.metadata?.order_variant_id
  const request = async (
    action:
      | 'preview'
      | 'update-copy'
      | 'export'
      | 'review-colors'
      | 'share-colors'
      | 'review-images'
      | 'share-images',
  ) => {
    setBusy(true)
    setMessage('')
    try {
      const response = await adminRequest(`/admin/products/${product.id}/etsy-listing`, {
        action,
        draft: value,
        ...(action === 'update-copy'
          ? { expected: review?.current }
          : action === 'share-colors'
            ? { expected_inventory: colorReview?.expected_inventory }
            : action === 'share-images'
              ? { expected_links: imageReview?.existing }
              : {}),
      })
      if (action === 'review-images') setImageReview(response)
      else if (action === 'share-images') {
        setImageReview(null)
        setMessage(response.message)
      } else if (action === 'review-colors') setColorReview(response)
      else if (action === 'share-colors') {
        setColorReview(null)
        setMessage(response.message)
      } else if (action === 'preview') setReview(response)
      else if (action === 'export') {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(response.export, null, 2)], { type: 'application/json' }),
        )
        const link = document.createElement('a')
        link.href = url
        link.download = `${product.handle || 'hair-claw'}-etsy.json`
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        setMessage(
          'Etsy color package downloaded. Review allocations and images before applying it to Etsy.',
        )
      } else {
        setReview(null)
        setMessage(
          'Etsy title, description, tags and materials were saved and read back. Colors are shared through the export package.',
        )
      }
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <ProductSection title="Etsy listing" className="rh-etsy-card">
      <div className="rh-inline-section-heading">
        {value.listing_id && (
          <a
            href={`https://www.etsy.com/listing/${value.listing_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Etsy ↗
          </a>
        )}
      </div>
      <div className="rh-etsy-workspace">
        <p>
          Keep Etsy copy separate from the website. Save preserves this draft; Update Etsy is a
          separate action.
        </p>
        <label className="rh-inline-field">
          <span>Existing Etsy listing ID</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={value.listing_id}
            onChange={(event) => {
              change({ ...value, listing_id: event.target.value })
              setReview(null)
            }}
          />
        </label>
        <label className="rh-inline-field">
          <span>Etsy title · {value.title.length}/140</span>
          <input
            maxLength={140}
            value={value.title}
            onChange={(event) => change({ ...value, title: event.target.value })}
          />
        </label>
        <label className="rh-inline-field">
          <span>Etsy description</span>
          <textarea
            rows={5}
            value={value.description}
            onChange={(event) => change({ ...value, description: event.target.value })}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setUndo(value)
            change({ ...value, title: title.slice(0, 140), description: descriptionText(description) })
          }}
        >
          Start from website copy
        </button>
        <div className="rh-etsy-tags">
          <h3>Tags · {value.tags.length}/13</h3>
          {value.tags.map((text, index) => (
            <div key={index}>
              <input
                aria-label={`Etsy tag ${index + 1}`}
                maxLength={20}
                value={text}
                onChange={(event) => {
                  change({
                    ...value,
                    tags: value.tags.map((row, i) => (i === index ? event.target.value : row)),
                  })
                  setLocked(locked.filter((row) => row !== text))
                }}
              />
              <small>{text.length}/20</small>
              <button
                type="button"
                aria-pressed={locked.includes(text)}
                onClick={() =>
                  setLocked(
                    locked.includes(text)
                      ? locked.filter((row) => row !== text)
                      : [...locked, text],
                  )
                }
              >
                {locked.includes(text) ? 'Locked' : 'Lock'}
              </button>
              <button
                type="button"
                aria-label={`Remove tag ${text}`}
                onClick={() => {
                  change({ ...value, tags: value.tags.filter((_, i) => i !== index) })
                  setLocked(locked.filter((row) => row !== text))
                }}
              >
                ×
              </button>
            </div>
          ))}
          <div>
            <input
              aria-label="New Etsy tag"
              maxLength={20}
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              placeholder="Add a search phrase"
            />
            <button
              type="button"
              disabled={value.tags.length >= 13 || !tag.trim()}
              onClick={() => {
                change({ ...value, tags: [...value.tags, tag.trim()] })
                setTag('')
              }}
            >
              Add tag
            </button>
          </div>
        </div>
        <label className="rh-inline-field">
          <span>Materials · comma separated</span>
          <input
            value={value.materials.join(', ')}
            onChange={(event) =>
              change({
                ...value,
                materials: event.target.value
                  .split(',')
                  .map((row) => row.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <details>
          <summary>Category and attributes for search guidance</summary>
          <label className="rh-inline-field">
            <span>Etsy category</span>
            <input
              value={value.category}
              onChange={(event) => change({ ...value, category: event.target.value })}
            />
          </label>
          <label className="rh-inline-field">
            <span>Verified attributes</span>
            <textarea
              rows={2}
              value={value.attributes}
              onChange={(event) => change({ ...value, attributes: event.target.value })}
            />
          </label>
          <small>These notes guide AI. Select the actual category and attributes in Etsy.</small>
        </details>
        <ProductCopyHelper
          photos={photos}
          title={value.title || title}
          description={value.description || description}
          material={material}
          category={value.category}
          attributes={value.attributes}
          lockedTags={locked.filter((tag) => value.tags.includes(tag))}
          actions={['etsy-title', 'etsy-description', 'etsy-tags']}
          apply={apply}
        />
        {undo && (
          <button
            type="button"
            onClick={() => {
              change(undo)
              setUndo(null)
            }}
          >
            Undo last AI / copy change
          </button>
        )}
        <details>
          <summary>
            Search readiness · {checks.filter((row) => row.ok).length}/{checks.length} checks
          </summary>
          <ul>
            {checks.map((row, index) => (
              <li key={index}>
                {row.ok ? '✓' : '○'} {row.text}
              </li>
            ))}
          </ul>
          <p>
            These are guidance checks, not an Etsy ranking score. Photos, shopper response, shipping
            and shop service also matter. Search-volume and performance data are not connected.
          </p>
          <a
            href="https://www.etsy.com/seller-handbook/article/382774281517"
            target="_blank"
            rel="noopener noreferrer"
          >
            Etsy Keywords 101 ↗
          </a>
          <small>Guidance reviewed October 13, 2026.</small>
        </details>
        {isHairClaw(product) && (
          <details>
            <summary>Share hair-claw colors</summary>
            <label className="rh-inline-field">
              <span>Finish of existing Etsy variants (when adding Finish)</span>
              <select
                aria-label="Finish of existing Etsy variants"
                value={value.existing_finish}
                onChange={(event) => change({ ...value, existing_finish: event.target.value })}
              >
                <option value="">Choose after reviewing the existing listing…</option>
                <option>Natural</option>
                <option>Colors by Cate</option>
              </select>
            </label>
            <p>
              Select the colors customers can order. Each size/finish keeps its existing SKU; use the same Etsy allocation for its colors. Approved static photos can accompany the
              export. For a new Etsy listing, use Size / Finish for the actual offer pairs and Color for the buyer's choice.
            </p>
            {!colorVariants.length && (
              <p>Save the hair claw with its actual size and finish offers first. Available order colors will then appear here.</p>
            )}
            {colorVariants.map((variant: Entity) => {
              const selected = value.colors.find((row) => row.variant_id === variant.id)
              return (
                <div className="rh-etsy-color" key={variant.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(selected)}
                      onChange={(event) =>
                        change({
                          ...value,
                          colors: event.target.checked
                            ? [
                                ...value.colors,
                                { variant_id: variant.id, quantity: value.colors.find(row => sameColorOffer(row.variant_id, variant.id))?.quantity ?? 0, image_url: '' },
                              ]
                            : value.colors.filter((row) => row.variant_id !== variant.id),
                        })
                      }
                    />
                    {variant.title} · {variant.sku || 'SKU required'}
                  </label>
                  {selected && (
                    <>
                      {product.metadata?.hair_claw_template_v2?.color_mode !== 'order' && <label className="rh-inline-field"><span>Existing Etsy SKU to link (optional)</span><input value={selected.etsy_sku ?? ''} placeholder="Leave blank for the Medusa SKU" onChange={event => change({ ...value, colors: value.colors.map(row => row.variant_id === variant.id ? { ...row, etsy_sku: event.target.value } : row) })}/><small>Link an existing matching Etsy option without changing its SKU.</small></label>}
                      {addColorImage && (
                        <HairClawPreviewExport
                          product={product}
                          variant={variant}
                          accept={(url) => addColorImage(variant.id, url)}
                        />
                      )}
                      <label className="rh-inline-field">
                        <span>Etsy allocation</span>
                        <input
                          type="number"
                          min={0}
                          max={999}
                          step={1}
                          value={selected.quantity}
                          onChange={(event) =>
                            change({
                              ...value,
                              colors: value.colors.map((row) =>
                                sameColorOffer(row.variant_id, variant.id)
                                  ? { ...row, quantity: Number(event.target.value) }
                                  : row,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="rh-inline-field">
                        <span>Approved image for this color</span>
                        <select
                          aria-label={`Approved image — ${variant.title}`}
                          value={selected.image_url}
                          onChange={(event) =>
                            change({
                              ...value,
                              colors: value.colors.map((row) =>
                                row.variant_id === variant.id
                                  ? { ...row, image_url: event.target.value }
                                  : row,
                              ),
                            })
                          }
                        >
                          <option value="">No image selected</option>
                          {product.images?.map((image: Entity, index: number) => (
                            <option key={image.id ?? image.url} value={image.url}>
                              Product image {index + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                      {selected.image_url && (
                        <img src={selected.image_url} alt={`${variant.title} approved export`} />
                      )}
                    </>
                  )}
                </div>
              )
            })}
            <button
              type="button"
              disabled={!saved || busy || !value.colors.length}
              onClick={() => void request('export')}
            >
              Download Etsy color package
            </button>
            <button
              type="button"
              disabled={
                !saved || busy || !value.colors.some((row) => row.image_url) || !value.listing_id
              }
              onClick={() => void request('review-images')}
            >
              Review color images for Etsy
            </button>
            {imageReview && (
              <div className="rh-copy-proposal">
                <h3>Review color image sharing</h3>
                <p>{imageReview.note}</p>
                {imageReview.desired.map((row: Entity) => (
                  <div key={row.value_id}>
                    <strong>{row.color}</strong>
                    <img src={row.image_url} alt={`${row.color} preview to share`} />
                  </div>
                ))}
                <button
                  type="button"
                  disabled={busy || !saved || !imageReview.writesEnabled}
                  onClick={() => void request('share-images')}
                >
                  Share approved images to Etsy
                </button>
                <button type="button" onClick={() => setImageReview(null)}>
                  Cancel
                </button>
              </div>
            )}
            <button
              type="button"
              disabled={!saved || busy || !value.colors.length || !value.listing_id}
              onClick={() => void request('review-colors')}
            >
              Review color sharing to Etsy
            </button>
            {colorReview && (
              <div className="rh-copy-proposal">
                <h3>Review Etsy color changes</h3>
                <p>{colorReview.note}</p>
                <p>{colorReview.preserved} other Etsy variants preserved.</p>
                {colorReview.changes.map((row: Entity) => (
                  <p key={row.sku}>
                    {row.sku}:{' '}
                    {row.before
                      ? `$${row.before.price} / ${row.before.quantity} available`
                      : 'New option'}{' '}
                    → ${row.after.price} / {row.after.quantity} available
                  </p>
                ))}
                <button
                  type="button"
                  disabled={busy || !saved || !colorReview.writesEnabled}
                  onClick={() => void request('share-colors')}
                >
                  Share colors to Etsy
                </button>
                {!colorReview.writesEnabled && (
                  <p>
                    Live sharing requires verified Etsy write permissions and activation. Your
                    reviewed draft is retained.
                  </p>
                )}
                <button type="button" onClick={() => setColorReview(null)}>
                  Cancel
                </button>
              </div>
            )}
          </details>
        )}
        <div className="rh-inline-buttons">
          <button
            type="button"
            disabled={!saved || busy || !value.listing_id}
            onClick={() => void request('preview')}
          >
            Review Etsy copy update
          </button>
          <button
            type="button"
            onClick={() => {
              setUndo(value)
              change(emptyEtsyDraft())
              setReview(null)
            }}
          >
            Clear Etsy draft
          </button>
        </div>
        {!saved && <small>Save this product draft before exporting or updating Etsy.</small>}
        {review && (
          <div className="rh-copy-proposal">
            <h3>Review Etsy changes</h3>
            {(['title', 'description', 'tags', 'materials'] as const).map((key) => (
              <div key={key}>
                <strong>{key}</strong>
                <p>
                  Current:{' '}
                  {Array.isArray(review.current[key])
                    ? review.current[key].join(', ')
                    : review.current[key]}
                </p>
                <p>
                  Proposed:{' '}
                  {Array.isArray(value[key]) ? (value[key] as string[]).join(', ') : value[key]}
                </p>
              </div>
            ))}
            <button
              type="button"
              disabled={busy || !saved || !review.writesEnabled}
              onClick={() => void request('update-copy')}
            >
              Update Etsy copy
            </button>
            <button type="button" onClick={() => setReview(null)}>
              Cancel
            </button>
          </div>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </ProductSection>
  )
}
