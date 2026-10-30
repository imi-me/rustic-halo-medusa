const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');const {test}=require('node:test');const {join}=require('node:path');const brand={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(join(__dirname,'../src/lib/brand/healing-hearts-colors.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,brand);const c={exports:{},Set,require:name=>{assert.equal(name,'@lib/brand/healing-hearts-colors');return brand.exports}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(join(__dirname,'../src/lib/util/hair-claw-template.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,c);const{applyHairClawTemplate,initialProductOptions,productClawColors}=c.exports;
test('only size and finish offers with enabled overlays are purchasable',()=>{
const options=[{id:'size',title:'Claw size',values:[{value:'2 inch'},{value:'4 inch'}]},{id:'finish',title:'Claw finish',values:[{value:'Natural'},{value:'Colors by Cate'}]},{id:'color',title:'Base color',values:[{value:'Taupe'},{value:'Purple'}]}];
const make=(id,size,finish,color)=>({id,options:[{option_id:'size',value:size},{option_id:'finish',value:finish},{option_id:'color',value:color}],calculated_price:{calculated_amount:id==='painted'?18:15}});
const p={id:'p',options,variants:[make('natural','4 inch','Natural','Taupe'),make('painted','4 inch','Colors by Cate','Taupe'),make('two','2 inch','Natural','Purple')],metadata:{hair_claw_template_v2:{version:2,offer_mode:true,variant_ids:['natural','painted','two'],option_ids:['size','finish','color'],size_option_id:'size',finish_option_id:'finish',color_option_id:'color',default_variant_id:'two'},hair_claw_overlays_v1:{recipes:{'4':{enabled:true},'4-natural':{enabled:true},'4-cbc':{enabled:false}},offers:{'4-natural':{variant_ids:['natural']},'4-cbc':{variant_ids:['painted']},'2-natural':{variant_ids:['two']}}}}};
let out=applyHairClawTemplate(p);assert.deepEqual(JSON.parse(JSON.stringify(out.variants.map(v=>v.id))),['natural']);assert.equal(out.options.find(o=>o.title==='Size').values.length,1);assert.equal(out.options.find(o=>o.title==='Finish').values[0].value,'Natural');assert.equal(initialProductOptions(out,'two').finish,'Natural');
p.metadata.hair_claw_overlays_v1.recipes['4-cbc'].enabled=true;out=applyHairClawTemplate(p);assert.equal(out.variants.length,2);assert.equal(out.options.find(o=>o.title==='Finish').values.length,2);assert.equal(initialProductOptions(out,'painted').finish,'Colors by Cate');assert.equal(out.variants.find(v=>v.id==='painted').calculated_price.calculated_amount,18);
p.metadata.hair_claw_overlays_v1.recipes['4-natural'].enabled=false;p.metadata.hair_claw_overlays_v1.recipes['4-cbc'].enabled=false;out=applyHairClawTemplate(p);assert.equal(out.variants.length,0);assert.equal(out.options.length,0);

});

test('saved product exclusions and shared retirement remove actual variants and stale URL defaults',()=>{
 const config={version:2,variant_ids:['black','rose'],option_ids:['color'],color_option_id:'color',default_variant_id:'black'};
 const product={id:'p',metadata:{hair_claw_template_v2:config,hair_claw_colors_v1:{excluded:['Black']}},options:[{id:'color',values:[{value:'Black'},{value:'Rose'}]}],variants:['Black','Rose'].map(name=>({id:name.toLowerCase(),options:[{option_id:'color',value:name}]}))};
 let result=applyHairClawTemplate(product);assert.equal(result.variants.length,1);assert.equal(result.variants[0].id,'rose');assert.equal(initialProductOptions(result,'black').color,'Rose');
 product.metadata.hair_claw_colors_v1.excluded=[];product.metadata.hair_claw_palette_v1={colors:[{name:'Black',slug:'black',hex:'#222222',active:false},{name:'Rose',slug:'rose',hex:'#bd8582',active:true}]};
 result=applyHairClawTemplate(product);assert.equal(result.variants.length,1);assert.equal(result.variants[0].id,'rose');
 product.metadata.hair_claw_colors_v1.excluded=['Black','Rose'];assert.equal(applyHairClawTemplate(product).variants.length,0);
});
test('new shared color names and swatches work without changing the built-in palette',()=>{
 const product={metadata:{hair_claw_palette_v1:{colors:[{name:'Ocean Blue',slug:'ocean-blue',hex:'#123abc',active:true}]}}};
 const colors=productClawColors(product);assert.equal(colors[0].slug,'ocean-blue');assert.equal(colors[0].hex,'#123abc');assert.equal(productClawColors({metadata:{}}).length,13);
});

test('2-inch and 4-inch color choices filter real variants independently and preserve prices',()=>{
 const colors=[{name:'Black',slug:'black',hex:'#222222',active:true,sizes:['2','4']},{name:'Rose',slug:'rose',hex:'#bd8582',active:true,sizes:['4']}];
 const make=(size,color)=>({id:size+color,metadata:{physical_size:size,base_claw_color:color},options:[{option_id:'size',value:size+' inch'},{option_id:'color',value:color}],calculated_price:{calculated_amount:size==='2'?12:15}});
 const p={metadata:{hair_claw_template_v2:{version:2,variant_ids:['2Black','2Rose','4Black','4Rose'],option_ids:['size','color'],size_option_id:'size',color_option_id:'color'},hair_claw_palette_v1:{colors},hair_claw_colors_v1:{excluded_by_size:{'2':['Black'],'4':[]}}},options:[{id:'size',values:[{value:'2 inch'},{value:'4 inch'}]},{id:'color',values:[{value:'Black'},{value:'Rose'}]}],variants:[make('2','Black'),make('2','Rose'),make('4','Black'),make('4','Rose')]};
 let result=applyHairClawTemplate(p);assert.deepEqual(Array.from(result.variants,v=>v.id),['4Black','4Rose']);assert.equal(productClawColors(p,'2').length,0);assert.equal(productClawColors(p,'4').length,2);assert.equal(result.variants[0].calculated_price.calculated_amount,15);
 p.metadata.hair_claw_colors_v1.excluded_by_size['2']=[];result=applyHairClawTemplate(p);assert.deepEqual(Array.from(result.variants,v=>v.id),['2Black','4Black','4Rose']);assert.equal(result.variants[0].calculated_price.calculated_amount,12);assert.equal(productClawColors(p,'2')[0].name,'Black');assert.equal(productClawColors(p,'4').length,2);
});
test('finish-specific checkboxes hide only that finish and honor overrides of old size-wide settings',()=>{
 const make=(finish,color)=>({id:finish+color,metadata:{physical_size:'4',base_claw_color:color},options:[{option_id:'size',value:'4 inch'},{option_id:'finish',value:finish},{option_id:'color',value:color}],calculated_price:{calculated_amount:finish==='Natural'?12:14}});
 const p={metadata:{hair_claw_template_v2:{version:2,variant_ids:['NaturalBlack','NaturalRose','PaintedBlack','PaintedRose'],option_ids:['size','finish','color'],size_option_id:'size',color_option_id:'color',default_variant_id:'NaturalBlack'},hair_claw_colors_v1:{excluded_by_size:{'2':[],'4':['Black']},excluded_by_group:{}}},options:[{id:'size',values:[{value:'4 inch'}]},{id:'finish',values:[{value:'Natural'},{value:'Painted'}]},{id:'color',values:[{value:'Black'},{value:'Rose'}]}],variants:['Natural','Painted'].flatMap(f=>['Black','Rose'].map(color=>make(f,color)))};
 const key=c.exports.clawVariantGroupKey(p,p.variants[0]);p.metadata.hair_claw_colors_v1.excluded_by_group[key]=['Rose'];
 const out=applyHairClawTemplate(p);assert.deepEqual(Array.from(out.variants,v=>v.id),['NaturalBlack','PaintedRose']);assert.equal(out.variants[0].calculated_price.calculated_amount,12);assert.equal(out.variants[1].calculated_price.calculated_amount,14);assert.equal(initialProductOptions(out,'NaturalRose').color,'Black');assert.ok(productClawColors(p,'4').some(c=>c.name==='Black'));assert.ok(productClawColors(p,'4').some(c=>c.name==='Rose'));
 assert.equal(key,JSON.stringify(['4',[['finish','Natural'],['size','4 inch']]]));
 p.metadata.hair_claw_colors_v1.excluded_by_size['4']=[];p.metadata.hair_claw_colors_v1.excluded_by_group[key]=['Black','Rose'];const onlyPainted=applyHairClawTemplate(p);assert.equal(onlyPainted.variants.length,2);assert.equal(initialProductOptions(onlyPainted,'NaturalBlack').finish,'Painted');
});

test('order colors retain one original SKU and barcode, hide generated rows and expose only actual size/finish options',()=>{
 const p={metadata:{hair_claw_template_v2:{version:2,color_mode:'order',variant_ids:['original'],option_ids:['size'],size_option_id:'size',color_option_id:'color',default_variant_id:'original',order_choices:{original:{size:'4',options:[{option_id:'size',value:'4 inch'}],aliases:['old-black','old-rose']}}}},options:[{id:'size',title:'Size',values:[{id:'s2',value:'2 inch'},{id:'s4',value:'4 inch'}]},{id:'color',title:'Color',values:[{id:'black',value:'Black'}]}],variants:[{id:'original',sku:'HC38737',barcode:'INV386710259',options:[],calculated_price:{calculated_amount:15}},{id:'old-black',sku:'EXTRA-BLACK',options:[]}]}
 const out=applyHairClawTemplate(p)
 assert.equal(out.variants.length,1);assert.equal(out.variants[0].sku,'HC38737');assert.equal(out.variants[0].barcode,'INV386710259');assert.equal(out.variants[0].calculated_price.calculated_amount,15)
 assert.equal(out.options.length,1);assert.equal(out.options[0].values.length,1);assert.equal(out.options[0].values[0].value,'4 inch')
 assert.equal(initialProductOptions(out,'old-black').size,'4 inch')
 assert.ok(c.exports.orderClawColors(out,out.variants[0]).some(color=>color.name==='Rose'))
 p.metadata.hair_claw_colors_v1={excluded:['Rose']};assert.ok(!c.exports.orderClawColors(applyHairClawTemplate(p),out.variants[0]).some(color=>color.name==='Rose'))
})
