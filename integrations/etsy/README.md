# Etsy integration

Owns Etsy listing mapping, order ingestion, shared Shop inventory synchronization, webhook handling, and reconciliation.

The adapter must use stable external IDs and idempotency keys. Etsy does not receive a separate inventory pool: its availability is derived from the same Shop stock used by the website, events, and direct sales.

Implementation waits on an approved Etsy application, credentials, listing policy, and sandbox/test strategy.
