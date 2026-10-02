import sharp from 'sharp'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MedusaError } from '@medusajs/framework/utils'
import { z } from 'zod'

const exec = promisify(execFile)
export const photoOptions = z.object({
  tolerance:z.number().min(10).max(100).default(40),
  rotation:z.number().min(-15).max(15).default(0),
  crop:z.object({top:z.number().min(0).max(45),bottom:z.number().min(0).max(45),left:z.number().min(0).max(45),right:z.number().min(0).max(45)}).default({top:0,bottom:0,left:0,right:0}),
  size:z.enum(['2','4']).default('4'),
}).strict()
export type PhotoOptions = z.infer<typeof photoOptions>
export const badPhoto = (message:string) => new MedusaError(MedusaError.Types.INVALID_DATA,message)
export function imageBytes(content:unknown, maxBytes=24_000_000) {
  if(typeof content !== 'string' || content.length > Math.ceil(maxBytes/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(content)) throw badPhoto('Choose a HEIC, JPG or PNG image under 24 MB.')
  const input=Buffer.from(content,'base64')
  if(!input.length || input.length > maxBytes) throw badPhoto('Image exceeds the upload limit.')
  return input
}
export function photoFormat(input:Buffer) {
  if(input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'png'
  if(input[0]===255 && input[1]===216 && input[2]===255) return 'jpeg'
  if(input.toString('ascii',4,8)==='ftyp' && /heic|heix|hevc|hevx|mif1/.test(input.toString('ascii',8,64))) return 'heic'
  throw badPhoto('This file is not a supported still HEIC, JPG or PNG photo. Export a still image from Live Photos.')
}
export async function decodePhoto(input:Buffer) {
  const format=photoFormat(input)
  let decoded=input
  if(format==='heic') {
    const dir=await mkdtemp(join(tmpdir(),'rh-overlay-'))
    try {
      await writeFile(join(dir,'input.heic'),input,{mode:0o600})
      // Fixed command/arguments, bounded CPU, address space, output size and wall time.
      await exec('/usr/bin/prlimit',['--as=2147483648','--cpu=30','--fsize=300000000','--','/usr/bin/heif-convert',join(dir,'input.heic'),join(dir,'output.png')],{timeout:40_000,killSignal:'SIGKILL',maxBuffer:1_000_000})
      decoded=await readFile(join(dir,'output.png'))
    } catch {
      throw badPhoto('This HEIC could not be decoded. Try exporting JPEG from Photos, or use Camera → Formats → Most Compatible.')
    } finally { await rm(dir,{recursive:true,force:true}) }
  }
  try {
    const image=sharp(decoded,{limitInputPixels:60_000_000,failOn:'error'})
    const meta=await image.metadata()
    if(!meta.width || !meta.height || (meta.pages || 1)!==1) throw badPhoto('Use one still photograph.')
    return await image.rotate().toColourspace('srgb').resize({width:2048,height:2048,fit:'inside',withoutEnlargement:true}).ensureAlpha().png().toBuffer()
  } catch { throw badPhoto('The photo is damaged, animated, or larger than 60 megapixels.') }
}

// Border-connected color keying: do not erase matching engraving inside the wood.
export function removePlainBackground(data:Buffer,width:number,height:number,tolerance:number) {
  const n=width*height, queue=new Int32Array(n), removed=new Uint8Array(n)
  const corners=[0,width-1,(height-1)*width,n-1]
  const background=[0,1,2].map(c=>corners.map(p=>data[p*4+c]).sort((a,b)=>a-b).slice(1,3).reduce((a,b)=>a+b,0)/2)
  const distance=(p:number)=>Math.sqrt(background.reduce((sum,c,i)=>sum+(data[p*4+i]-c)**2,0))
  let head=0,tail=0
  const visit=(p:number)=>{if(!removed[p] && (data[p*4+3]<16 || distance(p)<=tolerance)){removed[p]=1;queue[tail++]=p}}
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x)}
  for(let y=1;y<height-1;y++){visit(y*width);visit(y*width+width-1)}
  while(head<tail){const p=queue[head++],x=p%width;if(x>0)visit(p-1);if(x<width-1)visit(p+1);if(p>=width)visit(p-width);if(p<n-width)visit(p+width)}
  let minX=width,minY=height,maxX=-1,maxY=-1,foreground=0
  for(let p=0;p<n;p++) {
    if(removed[p]){data[p*4+3]=0;continue}
    const x=p%width,y=Math.floor(p/width)
    const boundary=(x>0&&removed[p-1])||(x<width-1&&removed[p+1])||(y>0&&removed[p-width])||(y<height-1&&removed[p+width])
    if(boundary) data[p*4+3]=Math.min(data[p*4+3],Math.round(255*Math.min(1,Math.max(0,(distance(p)-tolerance)/12))))
    if(data[p*4+3]>32){foreground++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
  }
  if(foreground<n*.01 || tail<n*.01) throw badPhoto('Could not separate the wood from the background. Crop closer, adjust cleanup strength, or retake on a plain contrasting surface.')
  return {touchesEdge:minX<2||minY<2||maxX>width-3||maxY>height-3,backgroundUneven:corners.some(p=>distance(p)>25)}
}

let processing=0
export async function preparePhoto(input:Buffer,options:PhotoOptions) {
  if(processing>=2) throw badPhoto('Two photos are already processing. Please try again shortly.')
  processing++
  try {
    const normalized=await decodePhoto(input)
    const meta=await sharp(normalized).metadata(),w=meta.width!,h=meta.height!
    const c=options.crop,left=Math.floor(w*c.left/100),top=Math.floor(h*c.top/100)
    const cropped=await sharp(normalized).extract({left,top,width:Math.max(1,w-left-Math.floor(w*c.right/100)),height:Math.max(1,h-top-Math.floor(h*c.bottom/100))}).png().toBuffer()
    const originalPreview=await sharp(cropped).resize({width:800,height:800,fit:'inside'}).png().toBuffer()
    const {data,info}=await sharp(cropped).ensureAlpha().raw().toBuffer({resolveWithObject:true})
    const warnings:string[]=[]
    const hasTransparency=data.some((v,i)=>i%4===3&&v<16)
    if(!data.some((v,i)=>i%4===3&&v>32))throw badPhoto('The photo is completely transparent. Choose a photo with visible wood.')
    if(!hasTransparency) {
      const result=removePlainBackground(data,info.width,info.height,options.tolerance)
      if(result.touchesEdge) warnings.push('The cutout reaches the photo edge. Check that none of the wood is cut off.')
      if(result.backgroundUneven) warnings.push('The background is uneven. Inspect all edges, or retake on a plain surface.')
    }
    let result=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).rotate(options.rotation,{background:{r:0,g:0,b:0,alpha:0}}).trim({threshold:1}).png().toBuffer({resolveWithObject:true})
    const vertical=result.info.height>result.info.width
    if(vertical)result=await sharp(result.data).rotate(90).png().toBuffer({resolveWithObject:true})
    // Keep a transparent guard band even for rectangular wood; upload validation
    // then trims it away without mistaking the result for an opaque photograph.
    const guarded=await sharp(result.data).extend({top:2,bottom:2,left:2,right:2,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer()
    const ratio=options.size==='4'?101.524414/37.523926:48/30
    if(Math.abs(result.info.width/result.info.height/ratio-1)>.06) warnings.push('Proportions differ from the wood outline. Check crop, tilt, and size. Artwork has not been stretched.')
    if(guarded.length>8_000_000)throw badPhoto('Prepared image is too large; try a smaller photograph.')
    return {content:guarded.toString('base64'),original_preview:originalPreview.toString('base64'),width:result.info.width+4,height:result.info.height+4,vertical,warnings}
  } finally {processing--}
}
