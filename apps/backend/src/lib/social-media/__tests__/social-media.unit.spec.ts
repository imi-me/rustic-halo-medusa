import { generateCaption, productSnapshot, savePost, validatePost } from '..'
const draft = () => ({ title:'Hair claw story', product_id:null, image_url:null, platform:'instagram', caption:'Hello', planned_date:'2026-10-12', status:'draft' })
describe('social media draft boundaries', () => {
  it('rejects publishing, unexpected fields, oversized captions and impossible dates', () => {
    expect(() => validatePost({...draft(),status:'published'})).toThrow()
    expect(() => validatePost({...draft(),publish:true})).toThrow()
    expect(() => validatePost({...draft(),caption:'x'.repeat(2201)})).toThrow()
    expect(() => validatePost({...draft(),planned_date:'2026-02-30'})).toThrow()
    expect(() => validatePost({...draft(),caption:'',status:'approved'})).toThrow()
    expect(validatePost({...draft(),caption:''}).status).toBe('draft')
  })
  it('uses only an existing photo belonging to the selected product', async () => {
    const query={graph:jest.fn().mockResolvedValue({data:[{title:'Cow',images:[{url:'https://cdn.example/cow.png'}]}]})}
    await expect(productSnapshot(query,'prod_123','https://evil.example/photo')).rejects.toThrow()
    await expect(productSnapshot(query,null,'https://cdn.example/cow.png')).rejects.toThrow()
    expect((await productSnapshot(query,'prod_123','https://cdn.example/cow.png')).product_title).toBe('Cow')
    expect(query.graph.mock.calls[0][0].fields).not.toContain('variants')
  })
  it('updates only the expected revision and rejects stale edits', async () => {
    const returning=jest.fn().mockResolvedValue([]), update=jest.fn().mockReturnValue({returning}), whereNull=jest.fn().mockReturnValue({update}), where=jest.fn().mockReturnValue({whereNull}), db=jest.fn().mockReturnValue({where})
    await expect(savePost(db,{},'user_123',{...draft(),id:'social_12345678-1234-1234-1234-123456789012',version:2})).rejects.toMatchObject({status:409})
    expect(where).toHaveBeenCalledWith({id:'social_12345678-1234-1234-1234-123456789012',version:2})
    expect(update.mock.calls[0][0].version).toBe(3)
  })
  it('uses the gated Responses API without tools or persisted provider state', async () => {
    process.env.ADMIN_ASSISTANT_ENABLED='true';process.env.ADMIN_ASSISTANT_OPENAI_API_KEY='test-only';process.env.ADMIN_ASSISTANT_MODEL='test-model';process.env.COOKIE_SECRET='test'
    const mock=jest.fn().mockResolvedValue({ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'A handmade touch. #RusticHalo'}]}]})})
    expect(await generateCaption({product_title:'Cow'},'instagram','Keep it casual',mock)).toContain('#RusticHalo')
    const body=JSON.parse(mock.mock.calls[0][1].body)
    expect(body.store).toBe(false);expect(body.tools).toBeUndefined();expect(body.max_output_tokens).toBe(1200)
    process.env.ADMIN_ASSISTANT_ENABLED='false'
    await expect(generateCaption({product_title:'Cow'},'instagram','Hello',mock)).rejects.toMatchObject({status:503})
    expect(mock).toHaveBeenCalledTimes(1)
  })
  it('rejects provider failures and empty or oversized outputs', async () => {
    process.env.ADMIN_ASSISTANT_ENABLED='true';process.env.ADMIN_ASSISTANT_OPENAI_API_KEY='test-only';process.env.ADMIN_ASSISTANT_MODEL='test-model';process.env.COOKIE_SECRET='test'
    const bad=jest.fn().mockResolvedValue({ok:false})
    await expect(generateCaption({product_title:'Cow'},'instagram','Hello',bad)).rejects.toMatchObject({status:502})
    const empty=jest.fn().mockResolvedValue({ok:true,json:async()=>({output:[]})})
    await expect(generateCaption({product_title:'Cow'},'instagram','Hello',empty)).rejects.toMatchObject({status:502})
  })
})
