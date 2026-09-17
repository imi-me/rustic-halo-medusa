# MarketSuite integration

Owns temporary kiosk POS items, MarketSuite-assigned barcodes, legacy-POS payment confirmation, refunds/cancellations, production release, webhook verification, and reconciliation.

Accepted barcodes match `^INV[0-9]{9}$`: `INV` plus nine digits, exactly 12 characters. Only a verified, idempotently accepted MarketSuite payment confirmation can release a kiosk order to production.

Implementation waits on MarketSuite API documentation, sandbox credentials, callback signing rules, and legacy POS identifiers.
