const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), ts=require('typescript')
const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/data/password-reset.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
function load({enabled=true,fail=false}={}){
 const calls=[]
 const auth={resetPassword:async(...args)=>{calls.push(args);if(fail)throw Error('private account error')},updateProvider:async(...args)=>{calls.push(args);if(fail)throw Error('private token error')}}
 const context={exports:{},process:{env:{CUSTOMER_PASSWORD_RESET_ENABLED:String(enabled)}},require:()=>({sdk:{auth}})}
 vm.runInNewContext(source,context)
 return {...context.exports,calls}
}
function form(values){const f=new FormData();for(const [k,v]of Object.entries(values))f.set(k,v);return f}
test('disabled delivery never requests a token',async()=>{const a=load({enabled:false});await a.requestPasswordReset(null,form({email:'test@example.com'}));assert.equal(a.calls.length,0)})
test('unknown account and accepted reset have identical public responses',async()=>{const a=load(),b=load({fail:true});const f=form({email:'test@example.com'});assert.equal(JSON.stringify(await a.requestPasswordReset(null,f)),JSON.stringify(await b.requestPasswordReset(null,f)))})
test('invalid email does not reach auth service',async()=>{const a=load();await a.requestPasswordReset(null,form({email:'bad'}));assert.equal(a.calls.length,0)})
test('mismatched passwords never consume a reset token',async()=>{const a=load();await a.finishPasswordReset(null,form({email:'test@example.com',token:'fixture',password:'long-password-1',confirm:'long-password-2'}));assert.equal(a.calls.length,0)})
test('reset supplies customer actor and token to provider',async()=>{const a=load();const result=await a.finishPasswordReset(null,form({email:'test@example.com',token:'fixture',password:'long-password-1',confirm:'long-password-1'}));assert.equal(result.success,true);assert.equal(a.calls[0][0],'customer');assert.equal(a.calls[0][3],'fixture')})
test('expired token produces a safe error',async()=>{const a=load({fail:true});const r=await a.finishPasswordReset(null,form({email:'test@example.com',token:'fixture',password:'long-password-1',confirm:'long-password-1'}));assert.match(r.message,/new link/);assert.doesNotMatch(r.message,/private/)})
