# Lower-usage project workflow

Configured September 21, 2026:
- Staging Redis job-health automation: daily at 09:00 local time, with existing read-only scope and quiet-unless-actionable behavior preserved.
- Saved global service tier was already `default` (standard speed); no speed change made.
- Root AGENTS.md now requests milestone batching, narrow reads, focused checks, representative browser testing, fewer polls, and concise handoffs.
- No active model was changed. For routine Rustic Halo work, use GPT-5.6 Terra
  with low reasoning. Use GPT-5.6 Sol with medium reasoning only for a complex
  integration, deployment diagnosis, or consequential review. Keep Fast off for
  this project.

## Reconnecting staging after Mac sleep

The staging VM is `10.20.69.159`. From a **local Mac Terminal** window, start
the reusable connection below and leave that window open after entering the VM
password:

```bash
ssh -N -o ControlMaster=yes -o ControlPersist=8h -o ControlPath=$HOME/.ssh/rustic-halo.sock shawnhouse@10.20.69.159
```

Subsequent staging commands use `/Users/shawnhouse/.ssh/rustic-halo.sock` rather
than opening fresh SSH sessions. Do not run the command inside an existing SSH
session on the VM.

## Suggested next-task prompt

Read AGENTS.md and docs/catalog-review-checklist.md. Finish the currently authorized staging catalog milestone. Batch related work and verification; stop only for required credentials or a material business decision. Keep the live website unchanged. Report verified results and leave a concise handoff. Do not redo completed checks without a reason.

Start fresh tasks at major phase boundaries (catalog, Market Suite, Etsy, theme),
not for every small edit. Keep them in this project so the files remain available.
Do not copy the full previous conversation into each task.
