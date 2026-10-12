import { GET as read, POST as save } from '../../api/admin/products/[id]/hair-claw-media/route'
import { POST as upload } from '../../api/admin/hair-claw-media/upload/route'
import { Modules } from '@medusajs/framework/utils'
import sharp from 'sharp'

const recipe = { file_id:'test',width:300,height:110,scale:1,x:0,y:0,vertical:false,enabled:true }
function setup(body: unknown, metadata: Record<string, unknown> = { unrelated:'keep me' }) {
  const products = { retrieveProduct:jest.fn().mockResolvedValue({metadata,images:[{id:'image_owned',url:'https://cdn.example.com/original.jpg'}]}),updateProducts:jest.fn().mockResolvedValue({}) }
  const files = { retrieveFile:jest.fn().mockResolvedValue({url:'https://cdn.example.com/overlay.png'}),createFiles:jest.fn().mockResolvedValue({id:'new-file',url:'https://cdn.example.com/normalized.png'}) }
  const req = { body,params:{id:'prod_test'},scope:{resolve:(name:string) => name === Modules.PRODUCT ? products : name === Modules.FILE ? files : {execute:(_key:string,fn:()=>unknown)=>fn()} } }
  const res = {json:jest.fn(),setHeader:jest.fn()}
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
  for(const bad of [{...recipe,scale:3.01},{...recipe,x:Infinity},{...recipe,url:'http://localhost'}]) {
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

it('lists current product photos without downloading or changing them',async()=>{
  const x=setup({})
  await read(x.req,x.res)
  expect(x.products.retrieveProduct).toHaveBeenCalledWith('prod_test',{relations:['images']})
  expect(x.res.json.mock.calls[0][0].images).toEqual([{id:'image_owned',url:'https://cdn.example.com/original.jpg'}])
  expect(x.products.updateProducts).not.toHaveBeenCalled()
})
it('saves skew, rotation and crop from an owned photo without replacing media',async()=>{
  const {file_id,...imageRecipe}=recipe
  const x=setup({size:'4',revision:null,recipe:{...imageRecipe,image_id:'image_owned',editor_version:2,skew_x:12.5,skew_y:-4,rotation:8,source_rotation:90,crop:{top:15,bottom:10,left:25,right:20}}})
  await save(x.req,x.res)
  expect(x.files.retrieveFile).not.toHaveBeenCalled()
  const update=x.products.updateProducts.mock.calls[0][1]
  expect(Object.keys(update)).toEqual(['metadata'])
  expect(update.metadata.hair_claw_overlays_v1.recipes['4']).toMatchObject({image_id:'image_owned',url:'https://cdn.example.com/original.jpg',skew_x:12.5,skew_y:-4,rotation:8})
})
it('rejects foreign photos, ambiguous sources and invalid edit values',async()=>{
  const {file_id,...rest}=recipe
  const imageRecipe={...rest,image_id:'image_owned',editor_version:2}
  for(const bad of [{...imageRecipe,image_id:'foreign'}, {...imageRecipe,file_id:'test'}, {...imageRecipe,skew_x:36}, {...imageRecipe,rotation:181}, {...imageRecipe,crop:{top:50,bottom:50,left:0,right:0}}, {...imageRecipe,image_id:undefined}]) {
    const x=setup({size:'4',revision:null,recipe:bad})
    await expect(save(x.req,x.res)).rejects.toThrow()
    expect(x.products.updateProducts).not.toHaveBeenCalled()
  }
})
it('keeps the enabled fit while saving a separate draft and replaces it only on review',async()=>{
  const published={...recipe,editor_version:2,skew_x:0,url:'https://cdn.example.com/overlay.png'}
  const x=setup({size:'4',revision:'published',recipe:{...recipe,editor_version:2,skew_x:12,enabled:false}},{hair_claw_overlays_v1:{revision:'published',recipes:{'4':published}}})
  await save(x.req,x.res)
  const draft=x.res.json.mock.calls[0][0].settings
  expect(draft.recipes['4']).toEqual(published)
  expect(draft.drafts['4']).toMatchObject({skew_x:12,enabled:false})
  const y=setup({size:'4',revision:draft.revision,recipe:{...recipe,editor_version:2,skew_x:12,enabled:true}},{hair_claw_overlays_v1:draft})
  await save(y.req,y.res)
  const enabled=y.res.json.mock.calls[0][0].settings
  expect(enabled.recipes['4']).toMatchObject({skew_x:12,enabled:true})
  expect(enabled.drafts['4']).toBeUndefined()
})
it('persists independent corners and artwork mirrors without changing the source or handle',async()=>{
  const corners=[{x:2,y:3},{x:35,y:1},{x:37,y:100},{x:0,y:98}]
  const fit={...recipe,editor_version:2,corners,mirror_x:true,mirror_y:false,side:'left',enabled:false}
  const x=setup({size:'4',revision:null,recipe:fit})
  await save(x.req,x.res)
  const draft=x.res.json.mock.calls[0][0].settings
  expect(draft.drafts['4']).toMatchObject({...fit,url:'https://cdn.example.com/overlay.png'})
  const y=setup({size:'4',revision:draft.revision,recipe:{...fit,enabled:true}},{hair_claw_overlays_v1:draft})
  await save(y.req,y.res)
  const settings=y.res.json.mock.calls[0][0].settings
  expect(settings.recipes['4']).toMatchObject({corners,mirror_x:true,mirror_y:false,side:'left'})
  expect(settings.drafts['4']).toBeUndefined()
  expect(Object.keys(y.products.updateProducts.mock.calls[0][1])).toEqual(['metadata'])
})
it('rejects folded, missing, collapsed and unbounded corners before saving',async()=>{
  const corners=[{x:0,y:0},{x:37,y:0},{x:37,y:100},{x:0,y:100}]
  const fit={...recipe,editor_version:2,corners}
  for(const bad of [
    {...fit,corners:corners.slice(0,3)},
    {...fit,corners:[corners[0],corners[2],corners[1],corners[3]]},
    {...fit,corners:[corners[0],corners[0],corners[2],corners[3]]},
    {...fit,corners:[corners[0],{x:241,y:0},corners[2],corners[3]]},
    {...fit,corners:[corners[0],{x:NaN,y:0},corners[2],corners[3]]},
    {...fit,mirror_x:'yes'},
    {...fit,editor_version:undefined},
  ]) {
    const x=setup({size:'4',revision:null,recipe:bad})
    await expect(save(x.req,x.res)).rejects.toThrow('Invalid overlay')
    expect(x.products.updateProducts).not.toHaveBeenCalled()
  }
})
