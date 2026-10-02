import { POST as save } from '../../api/admin/products/[id]/hair-claw-media/route'
import { POST as upload } from '../../api/admin/hair-claw-media/upload/route'
import { Modules } from '@medusajs/framework/utils'
import sharp from 'sharp'

const recipe = { file_id:'test',width:300,height:110,scale:1,x:0,y:0,vertical:false,enabled:true }
function setup(body: unknown, metadata: Record<string, unknown> = { unrelated:'keep me' }) {
  const products = { retrieveProduct:jest.fn().mockResolvedValue({metadata}),updateProducts:jest.fn().mockResolvedValue({}) }
  const files = { retrieveFile:jest.fn().mockResolvedValue({url:'https://cdn.example.com/overlay.png'}),createFiles:jest.fn().mockResolvedValue({id:'new-file',url:'https://cdn.example.com/normalized.png'}) }
  const req = { body,params:{id:'prod_test'},scope:{resolve:(name:string) => name === Modules.PRODUCT ? products : name === Modules.FILE ? files : {execute:(_key:string,fn:()=>unknown)=>fn()} } }
  const res = {json:jest.fn()}
  return {req:req as any,res:res as any,products,files}
}
it('saves a size-scoped recipe without changing commerce or unrelated metadata',async()=>{
  const x = setup({size:'4',revision:null,recipe})
  await save(x.req,x.res)
  const update = x.products.updateProducts.mock.calls[0][1]
  expect(Object.keys(update)).toEqual(['metadata'])
  expect(update.metadata.unrelated).toBe('keep me')
  expect(update.metadata.hair_claw_overlays_v1.recipes['4'].enabled).toBe(true)
})
it('keeps the other physical size and rejects stale edits',async()=>{
  const metadata = {hair_claw_overlays_v1:{revision:'old',recipes:{'2':{...recipe,enabled:false}}}}
  const x=setup({size:'4',revision:'old',recipe},metadata)
  await save(x.req,x.res)
  expect(x.products.updateProducts.mock.calls[0][1].metadata.hair_claw_overlays_v1.recipes['2']).toEqual({...recipe,enabled:false})
  const stale=setup({size:'4',revision:null,recipe},metadata)
  await expect(save(stale.req,stale.res)).rejects.toThrow('another editor')
  expect(stale.products.updateProducts).not.toHaveBeenCalled()
})
it('allows a 2-inch draft but never enables unmeasured geometry',async()=>{
  const x=setup({size:'2',revision:null,recipe})
  await expect(save(x.req,x.res)).rejects.toThrow('physical template')
  x.req.body.recipe={...recipe,enabled:false}
  await save(x.req,x.res)
})
it('rejects out of bounds transforms and arbitrary URL inputs',async()=>{
  for(const bad of [{...recipe,scale:2},{...recipe,x:Infinity},{...recipe,url:'http://localhost'}]) {
    const x=setup({size:'4',revision:null,recipe:bad})
    await expect(save(x.req,x.res)).rejects.toThrow('Invalid overlay')
  }
})
it('removes only the selected size setting, never original images/files',async()=>{
  const x=setup({size:'4',revision:'r',recipe:null},{hair_claw_overlays_v1:{revision:'r',recipes:{'4':recipe,'2':recipe}}})
  await save(x.req,x.res)
  expect(Object.keys(x.products.updateProducts.mock.calls[0][1].metadata.hair_claw_overlays_v1.recipes)).toEqual(['2'])
})
it('rejects opaque photographs',async()=>{
  const content=(await sharp({create:{width:20,height:20,channels:3,background:'#aaa'}}).png().toBuffer()).toString('base64')
  const x=setup({content})
  await expect(upload(x.req,x.res)).rejects.toThrow('transparent PNG')
  expect(x.files.createFiles).not.toHaveBeenCalled()
})
it('normalizes transparent padding before storing a single wood image',async()=>{
  const content=(await sharp({create:{width:20,height:10,channels:4,background:'#bca'}}).extend({top:5,bottom:5,left:5,right:5,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer()).toString('base64')
  const x=setup({content})
  await upload(x.req,x.res)
  expect(x.res.json.mock.calls[0][0]).toMatchObject({width:20,height:10,file_id:'new-file'})
  expect(x.files.createFiles).toHaveBeenCalledTimes(1)
})
