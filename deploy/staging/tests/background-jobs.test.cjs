const test = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const source = fs.readFileSync(require('node:path').join(__dirname, '../background-jobs.cjs'), 'utf8')
async function run(args, state = 'failed', event = 'payment.refunded', failed = 0) {
  let retries = 0, closed = 0
  class Queue {
    async getJob(){ return { name: event, getState: async()=>state, retry: async()=>{retries++} } }
    async getJobCounts(){return {failed}}
    async getFailed(){return []}
    async close(){closed++}
  }
  class Redis { on(){} async quit(){closed++} }
  const nested = name => name === 'bullmq' ? { Queue } : Redis
  nested.resolve = ()=>'bus'
  const req = ()=>({createRequire:()=>nested}); req.resolve=()=> 'medusa'
  const process = {env:{APP_ENV:'staging',PERSISTENT_JOBS_ENABLED:'true',REDIS_URL:'redis://test'}, argv:['node','script',...args],exitCode:0}
  await vm.runInNewContext(source,{require:req,process,console:{log(){},error(){}},Date})
  return {retries,closed,exitCode:process.exitCode}
}
test('reports failed jobs with nonzero status',async()=>{assert.equal((await run(['status'],'failed','payment.refunded',1)).exitCode,2)})
test('retries exactly one reviewed failed job and closes connections',async()=>{assert.deepEqual(await run(['retry','job-1']),{retries:1,closed:2,exitCode:0})})
test('never replays completed jobs',async()=>{const r=await run(['retry','job-1'],'completed');assert.equal(r.retries,0);assert.equal(r.exitCode,1)})
test('rejects unsupported event recovery',async()=>{const r=await run(['retry','job-1'],'failed','unknown.event');assert.equal(r.retries,0);assert.equal(r.exitCode,1)})
test('requires exact ID',async()=>{assert.equal((await run(['retry'])).retries,0);assert.equal((await run(['retry','*'])).exitCode,1)})
