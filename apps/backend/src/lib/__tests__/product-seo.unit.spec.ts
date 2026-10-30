const update = jest.fn()
jest.mock('@medusajs/medusa/core-flows', () => ({ updateProductsWorkflow: () => ({ run: update }) }))
import { PRODUCT_SEO_KEY, emptyProductSeo, productSeoValues, seoText } from '../product-seo-values'
import { productSeoSchema } from '../product-seo'
import { productDraft, productUpdate } from '../../admin/lib/inline-edit'
import { POST } from '../../api/admin/products/[id]/workspace/route'
const product = () => ({ id:'prod_fixture',title:'Wood & flowers',description:'<p>Wooden earrings &amp; a floral design.</p><p>Light and simple.</p>',handle:'wood-flowers',status:'published',updated_at:'2026-10-29T12:00:00.000Z',metadata:{source_shopify_id:'preserve',unrelated:{keep:true}},variants:[],images:[],thumbnail:null })
beforeEach(()=>update.mockReset())
it('uses clean text and a concise description as automatic defaults',()=>{
 const seo=productSeoValues(product());expect(seo.title).toBe('Wood & flowers | Rustic Halo');expect(seo.description).toBe('Wooden earrings & a floral design. Light and simple.')
 expect(seoText('<h2>Care &copy; &eacute;</h2><script>bad()</script>\n- **Wipe clean**')).toBe('Care © é Wipe clean')
 expect(productSeoValues({title:'Rustic Halo Gift',description:''}).title).toBe('Rustic Halo Gift')
})
it('keeps independent optional overrides and safely falls back on malformed metadata',()=>{
 const p=product();expect(productSeoValues({...p,metadata:{[PRODUCT_SEO_KEY]:{title:'  Custom & clear  ',description:''}}})).toEqual({title:'Custom & clear',description:'Wooden earrings & a floral design. Light and simple.'})
 expect(productSeoValues({...p,metadata:{[PRODUCT_SEO_KEY]:null}})).toEqual(productSeoValues(p))
 expect(productSeoValues({...p,metadata:{[PRODUCT_SEO_KEY]:{title:[],description:24}}})).toEqual(productSeoValues(p))
 const long=productSeoValues({title:'A'.repeat(200),description:('Long words 🌻 ').repeat(100)});expect(Array.from(long.title).length).toBeLessThanOrEqual(100);expect(Array.from(long.description).length).toBeLessThanOrEqual(160);expect(long.description.endsWith('…')).toBe(true)
})
it('validates bounded metadata and does not change unrelated product fields or variants',()=>{
 expect(productSeoSchema.safeParse({title:'x'.repeat(101),description:''}).success).toBe(false);expect(productSeoSchema.safeParse({title:'',description:'',keywords:[]}).success).toBe(false)
 const p=product(),draft=productDraft(p);draft.seo={title:'Search title',description:'A specific summary.'};const patch=productUpdate(p,draft)
 expect(Object.keys(patch)).toEqual(['metadata']);expect(patch.metadata).toEqual({[PRODUCT_SEO_KEY]:draft.seo});expect(p.metadata).not.toHaveProperty(PRODUCT_SEO_KEY)
 const custom={...p,metadata:{...p.metadata,[PRODUCT_SEO_KEY]:draft.seo}};const clear=productDraft(custom);clear.seo=emptyProductSeo();expect(productUpdate(custom,clear).metadata).toEqual({[PRODUCT_SEO_KEY]:null})
 expect(productUpdate(p,productDraft(p))).toEqual({})
})
function response(){const res:any={};res.setHeader=jest.fn();res.status=jest.fn(()=>res);res.json=jest.fn(()=>res);res.sendStatus=jest.fn(()=>res);return res}
function request(p:any,seo:any){return{auth_context:{actor_id:'user_fixture',actor_type:'user'},headers:{origin:'https://staging.rustichalo.com'},params:{id:p.id},body:{expected_updated_at:p.updated_at,update:{metadata:{[PRODUCT_SEO_KEY]:seo,unrelated:'do not overwrite'}}},scope:{resolve:(key:string)=>key==='product'?{retrieveProduct:async()=>structuredClone(p)}:{execute:async(_key:string,fn:any)=>fn()}}}as any}
it('the guarded workspace save merges only SEO and preserves existing metadata',async()=>{
 const prior=process.env.ADMIN_CORS;process.env.ADMIN_CORS='https://staging.rustichalo.com';try{const p=product(),res=response();await POST(request(p,{title:'Specific title',description:'Specific description.'}),res);expect(update).toHaveBeenCalledTimes(1);expect(update.mock.calls[0][0].input.update.metadata).toEqual({...p.metadata,[PRODUCT_SEO_KEY]:{title:'Specific title',description:'Specific description.'}});expect(Object.keys(update.mock.calls[0][0].input.update)).toEqual(['metadata'])}finally{process.env.ADMIN_CORS=prior}
})
it('stale and invalid saves cannot reach the product workflow; explicit clearing is allowed',async()=>{
 const prior=process.env.ADMIN_CORS;process.env.ADMIN_CORS='https://staging.rustichalo.com';try{const p=product(),stale=request(p,{title:'Title',description:''});stale.body.expected_updated_at='2020-01-01T00:00:00Z';const res=response();await POST(stale,res);expect(res.status).toHaveBeenCalledWith(409);expect(update).not.toHaveBeenCalled();await POST(request(p,{title:'x'.repeat(101),description:''}),response());expect(update).not.toHaveBeenCalled();await POST(request(p,null),response());expect(update.mock.calls[0][0].input.update.metadata[PRODUCT_SEO_KEY]).toBe('')}finally{process.env.ADMIN_CORS=prior}
})
