#!/usr/bin/env node
// Run inside the backend container; never prints event payloads or credentials.
const { createRequire } = require('node:module')
async function main() {
  if (process.env.APP_ENV !== 'staging' || process.env.PERSISTENT_JOBS_ENABLED !== 'true' || !process.env.REDIS_URL) throw Error('Requires persistent staging jobs')
  const medusaRequire = createRequire(require.resolve('@medusajs/medusa'))
  const busRequire = createRequire(medusaRequire.resolve('@medusajs/event-bus-redis'))
  const { Queue } = busRequire('bullmq')
  const Redis = busRequire('ioredis')
  const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 5000 })
  connection.on('error', () => {})
  const queue = new Queue('events-queue', { prefix: 'RedisEventBusService', connection })
  try {
    const [command = 'status', id, extra] = process.argv.slice(2)
    if (extra || !['status', 'retry'].includes(command) || (command === 'status' && id)) throw Error('Usage: background-jobs.cjs status | retry JOB_ID')
    if (command === 'retry') {
      if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) throw Error('Provide one exact reviewed job ID')
      const job = await queue.getJob(id)
      if (!job || await job.getState() !== 'failed') throw Error('Job must exist and be failed; nothing retried')
      if (!['order.placed', 'payment.captured', 'payment.refunded'].includes(job.name)) throw Error('This event requires separate recovery review')
      await job.retry('failed')
      console.log(JSON.stringify({ retriedJobId: id, event: job.name }))
      return
    }
    const counts = await queue.getJobCounts('failed', 'waiting', 'active', 'delayed', 'completed')
    const jobs = await queue.getFailed(0, 49)
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), counts, failedJobs: jobs.map(j => ({ id: j.id, event: j.name, attempts: j.attemptsMade, failedAt: j.finishedOn ? new Date(j.finishedOn).toISOString() : null })), truncated: counts.failed > jobs.length }, null, 2))
    if (counts.failed) process.exitCode = 2
  } finally { await queue.close(); await connection.quit() }
}
main().catch(() => { console.error('Background job check failed. Verify staging configuration, connection, and the requested job state.'); process.exitCode = 1 })
