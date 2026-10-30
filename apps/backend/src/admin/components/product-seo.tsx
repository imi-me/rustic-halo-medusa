import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ProductSection } from './product-section'
import { ProductCopyHelper } from './product-copy-helper'
import { PRODUCT_SEO_KEY, emptyProductSeo, hasProductSeo, productSeoValues, seoText, type ProductSeo } from '../../lib/product-seo-values'
import './product-seo.css'
export const ProductSeoEditor = ({ value, change, title, description, material = '', handle = '' }: { value?: ProductSeo; change: (value: ProductSeo) => void; title: string; description: string; material?: string; handle?: string }) => {
  const id = useId(), current = value || emptyProductSeo(), automatic = productSeoValues({ title, description }), preview = productSeoValues({ title, description, metadata: { [PRODUCT_SEO_KEY]: current } })
  return <ProductSection title="Search engine preview" className="rh-product-seo">
    <p>These fields are optional. Leave them blank to use the product name and a short summary of its description.</p>
    <label className="rh-inline-field" htmlFor={id + '-title'}><span>Search title <small>Optional</small></span><input aria-label="Search title" id={id + '-title'} value={current.title} placeholder={automatic.title} maxLength={100} onChange={e => change({ ...current, title: e.target.value })}/><small>{current.title.length} / 100 characters · {current.title.trim() ? 'Custom wording' : 'Automatic wording'}</small></label>
    <label className="rh-inline-field" htmlFor={id + '-description'}><span>Search description <small>Optional</small></span><textarea aria-label="Search description" id={id + '-description'} rows={4} value={current.description} placeholder={automatic.description} maxLength={320} onChange={e => change({ ...current, description: e.target.value })}/><small>{current.description.length} / 320 characters · {current.description.trim() ? 'Custom wording' : 'Automatic wording'}</small></label>
    <button type="button" disabled={!hasProductSeo(current)} onClick={() => change(emptyProductSeo())}>Use automatic wording</button>
    <div className="rh-product-search-preview" aria-label="Product search result preview"><small>rustichalo.com/us/products/{handle || 'product-name'}</small><strong>{preview.title}</strong><p>{preview.description}</p></div>
    <small>Preview only. Search engines may display different wording. Changes save with the product.</small>
    <p><Link to="/product-seo">Let Rusty help with your whole catalog ↗</Link></p>
    <ProductCopyHelper label="Ask Rusty · Help with search wording" actions={['product-seo']} title={title} description={seoText(description)} material={material} contextRevision={JSON.stringify({ title, description, material, seo: current })} apply={(_, suggestion) => change({ title: suggestion.title, description: suggestion.description })}/>
  </ProductSection>
}
