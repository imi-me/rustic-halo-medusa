# Rustic Halo working preferences

## Usage-conscious workflow
- Work toward one clearly bounded milestone per task. Batch related edits and focused validation, then deploy once when authorized. Do not rebuild/deploy for each small cosmetic change.
- Treat `k` as continue within the agreed milestone. Do not end each tiny step merely to solicit another `k`. Stop for genuinely necessary user input, credentials, or consequential decisions.
- Read the relevant project status document first. Search narrowly; do not repeatedly scan the entire repository or reread unchanged logs.
- Prefer direct APIs, scripts, and compact reports for repetitive verification. Use browser testing for representative user journeys and visual checks; avoid inspecting every equivalent product.
- Run checks appropriate to the changed behavior. Repeat or broaden them only for new failures, changes, or unresolved risk. Preserve payment, inventory, security, and deployment verification.
- Avoid frequent model-driven polling. Use bounded waits/completion reports. Staging queue monitoring is daily; read the current report after relevant deployments when useful.
- Use one agent unless explicitly requested otherwise. Keep tool output and final reports concise.
- Recommend GPT-5.6 Terra with low reasoning for routine catalog, copy, and UI work; reserve GPT-5.6 Sol with medium reasoning for complex integration, payments, migrations, or difficult debugging. Do not claim to change the active model without a verified settings action.
- At milestone completion, leave a short handoff in the relevant existing documentation: completed and verified, remaining work, blockers, exact files/reports. A new phase should use a fresh task in this same project, with that handoff instead of copied chat history. Create a task only when the user explicitly requests one.

## Scope and safety
- Preserve existing project work and the live Shopify store. Keep staging and production actions distinct.
- Never weaken permissions or password requirements to reduce interaction overhead. Prepare one short, reviewable command for the user when administrator authentication is required.
- Never treat an issued command as a completed deployment. Verify the result, and distinguish local checks from deployed behavior.
