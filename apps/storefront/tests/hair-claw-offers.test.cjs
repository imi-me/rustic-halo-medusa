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
