const fs=require('node:fs'),crypto=require('node:crypto');
const palette=['Black','Espresso','Mocha','Chocolate','Caramel','Khaki','Taupe','Sand','Ivory','Gray','Terracotta','Rose','Purple'];
const key='hair_claw_template_v2';
function sizeOf(value){if(['2','4'].includes(value?.trim()))return value.trim();const m=value?.match(/(?:^|\s)([24])\s*(?:["“”″]|in(?:ch(?:es)?)?\.?)(?=\s|$)/i);if(m)return m[1];if(value==="Colors by Cate 2'")return '2';}
function pricing(v){return v.price_set.prices.filter(p=>!p.price_list_id).map(p=>({currency_code:p.currency_code,amount:p.amount,...(p.min_quantity==null?{}:{min_quantity:p.min_quantity}),...(p.max_quantity==null?{}:{max_quantity:p.max_quantity}),...((p.price_rules||[]).length?{rules:Object.fromEntries(p.price_rules.map(r=>[r.attribute,r.value]))}:{})})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));}
function shape(product){return {id:product.id,metadata:product.metadata,options:product.options.map(o=>({id:o.id,title:o.title,values:o.values.map(v=>v.value).sort()})).sort((a,b)=>a.id.localeCompare(b.id)),variants:product.variants.map(v=>({id:v.id,sku:v.sku,title:v.title,options:v.options.map(o=>({option_id:o.option_id,value:o.value})).sort((a,b)=>a.option_id.localeCompare(b.option_id)),prices:pricing(v),allow_backorder:v.allow_backorder,manage_inventory:v.manage_inventory,metadata:v.metadata})).sort((a,b)=>a.id.localeCompare(b.id))};}
function hash(product){return crypto.createHash('sha256').update(JSON.stringify(shape(product))).digest('hex');}
function build(products){const plans=[],skus=new Set();for(const p of products){if(p.metadata?.[key])throw Error('Template already set '+p.id);
 const legacyColor=p.options.find(o=>['color','colour'].includes(o.title.toLowerCase())&&o.metadata?.purpose==='base_claw_color');
 const existingSize=p.options.find(o=>o.title.trim().toLowerCase()==='size');
 const mixedSize=existingSize?.values.some(v=>!['2','4','2”','4”','2"','4"','2″','4″'].includes(v.value));
 const newSizeTitle='Claw size';if(p.options.some(o=>['Claw size','Base color'].includes(o.title)))throw Error('Template option collision '+p.id);const finishTitle='Design finish';
 if(mixedSize&&p.options.some(o=>o.title===finishTitle))throw Error('Finish collision');
 const groups=new Map();
 for(const v of p.variants){const values=Object.fromEntries(v.options.map(o=>[o.option_id,o.value]));const size=existingSize?sizeOf(values[existingSize.id])||'4':sizeOf(p.title)||v.options.map(o=>sizeOf(o.value)).find(Boolean)||'4';
  const native=Object.fromEntries(v.options.map(o=>[p.options.find(x=>x.id===o.option_id).title,o.value]));
  const shown=p.options.filter(o=>o.id!==legacyColor?.id&&o.id!==existingSize?.id&&!(o.values.length===1&&o.values[0].value==='Default Title')).map(o=>o.id);
  native[newSizeTitle]=`${size} inch`;
  let finish;
  if(mixedSize){finish=(values[existingSize.id]||'').replace(/(?:^|\s)[24]\s*(?:["“”″']|in(?:ch(?:es)?)?\.?)/ig,'').trim()||'Natural';native[finishTitle]=finish;}
  native['Base color']='';
  const signature=JSON.stringify({size,finish,shown:shown.map(id=>[id,values[id]])});
  const g=groups.get(signature);
  if(g){if(JSON.stringify(pricing(g.source))!==JSON.stringify(pricing(v)))throw Error(`Conflicting source prices ${p.title}/${signature}`);continue;}
  if(!pricing(v).length)throw Error('Missing base prices');
  groups.set(signature,{size,finish,signature,source:v,native,shown});
 }
 const additions=[];const finishValues=[...new Set([...groups.values()].map(g=>g.finish).filter(Boolean))];
 for(const g of groups.values())for(const color of palette){const suffix=crypto.createHash('sha256').update(g.signature).digest('hex').slice(0,6);const sku=`RH-HC2-${p.id.slice(-10)}-${g.size}-${suffix}-${color.toUpperCase()}`;if(skus.has(sku))throw Error('SKU collision');skus.add(sku);
  additions.push({product_id:p.id,title:[`${g.size} inch`,g.finish,...g.shown.map(id=>g.source.options.find(o=>o.option_id===id).value),color].filter(Boolean).join(' / '),sku,options:{...g.native,'Base color':color},prices:pricing(g.source),manage_inventory:true,allow_backorder:true,requires_shipping:true,weight:g.source.weight,material:g.source.material,hs_code:g.source.hs_code,origin_country:g.source.origin_country,mid_code:g.source.mid_code,length:g.source.length,height:g.source.height,width:g.source.width,metadata:{hair_claw_template:'rustic_halo_hair_claw_v2',physical_size:g.size,base_claw_color:color,inventory_mode:'made_to_order_color_option',source_variant_id:g.source.id}});
 }
 plans.push({productId:p.id,title:p.title,fingerprint:hash(p),existingSizeId:existingSize?.id,sizeTitle:newSizeTitle,sizeValues:[...new Set([...groups.values()].map(g=>`${g.size} inch`))],finishTitle,finishValues,shownOptionIds:[...new Set([...groups.values()].flatMap(g=>g.shown))],optionTitles:Object.fromEntries(p.options.filter(o=>['color','colour','colors'].includes(o.title.toLowerCase())&&o.id!==legacyColor?.id).map(o=>[o.id,'Finish'])),additions});
 }
 return {version:2,template:'rustic_halo_hair_claw_v2',palette,policy:'made_to_order',unlabelledSize:'4',products:plans};}
module.exports={build,hash,shape,pricing,key};
if(require.main===module){const input=JSON.parse(fs.readFileSync('.local/claw-color-options-20261013/audit-before.json'));const plan=build(input.products);fs.writeFileSync('.local/claw-color-options-20261013/plan.json',JSON.stringify(plan,null,2));console.log(JSON.stringify({products:plan.products.length,newVariants:plan.products.reduce((s,p)=>s+p.additions.length,0),newSizeCounts:plan.products.flatMap(p=>p.additions).reduce((a,v)=>(a[v.metadata.physical_size]=(a[v.metadata.physical_size]||0)+1,a),{})}));}
