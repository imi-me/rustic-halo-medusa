import sharp from 'sharp'
import {imageBytes,photoFormat,photoOptions,preparePhoto,removePlainBackground} from '../hair-claw-photo'

async function fixture(format:'png'|'jpeg'='jpeg',portrait=false) {
  const width=portrait?140:300,height=portrait?300:140
  const pixels=Buffer.alloc(width*height*3,245)
  for(let y=20;y<height-20;y++)for(let x=20;x<width-20;x++)pixels.set([170,110,55],(y*width+x)*3)
  // Light engraved details match the background but are enclosed by the wood.
  pixels.set([245,245,245],(70*width+70)*3)
  return sharp(pixels,{raw:{width,height,channels:3}}).toFormat(format).toBuffer()
}
it('accepts JPEG camera bytes and removes only connected background',async()=>{
  const result=await preparePhoto(await fixture('png'),photoOptions.parse({}))
  expect(result.width).toBe(264);expect(result.height).toBe(104)
  const {data,info}=await sharp(Buffer.from(result.content,'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true})
  expect(data[(52*info.width+52)*4+3]).toBe(255)
  expect(data[(52*info.width+52)*4]).toBe(245)
})
it('handles JPEG and keeps portrait art proportions while rotating the cutout',async()=>{
  const result=await preparePhoto(await fixture('jpeg',true),photoOptions.parse({}))
  expect(result.vertical).toBe(true)
  expect(result.width/result.height).toBeGreaterThan(2.4)
})
it('preserves existing transparency and strips camera metadata',async()=>{
  const photo=await sharp({create:{width:260,height:100,channels:4,background:'#af7850'}}).extend({top:20,bottom:20,left:20,right:20,background:{r:0,g:0,b:0,alpha:0}}).withMetadata().png().toBuffer()
  const result=await preparePhoto(photo,photoOptions.parse({}))
  const meta=await sharp(Buffer.from(result.content,'base64')).metadata()
  expect(meta.width).toBe(264);expect(meta.height).toBe(104);expect(meta.exif).toBeUndefined()
})
it('rejects an empty or indistinguishable foreground',async()=>{
  const photo=await sharp({create:{width:30,height:30,channels:3,background:'#fff'}}).jpeg().toBuffer()
  await expect(preparePhoto(photo,photoOptions.parse({}))).rejects.toThrow('Could not separate')
})
it('rejects unsafe types, malformed base64 and excessive controls',()=>{
  expect(()=>imageBytes('file:///etc/passwd')).toThrow()
  expect(()=>imageBytes('a'.repeat(20),4)).toThrow()
  expect(()=>photoFormat(Buffer.from('<svg/>'))).toThrow('not a supported')
  expect(()=>photoOptions.parse({tolerance:200})).toThrow()
  expect(()=>photoOptions.parse({crop:{top:90,bottom:0,left:0,right:0}})).toThrow()
})
it('reports outline mismatch without stretching art',async()=>{
  const result=await preparePhoto(await fixture(),photoOptions.parse({size:'2'}))
  expect(result.warnings.some(w=>w.includes('Proportions'))).toBe(true)
})
it('works with dark backgrounds and leaves enclosed same-color marks opaque',()=>{
  const pixels=Buffer.alloc(30*20*4)
  for(let p=0;p<600;p++)pixels[p*4+3]=255
  for(let y=5;y<15;y++)for(let x=5;x<25;x++)pixels.set([210,170,110,255],(y*30+x)*4)
  pixels.set([0,0,0,255],(10*30+10)*4)
  removePlainBackground(pixels,30,20,40)
  expect(pixels[3]).toBe(0);expect(pixels[(10*30+10)*4+3]).toBe(255)
})
