# Copper Mill kiosk

This directory is reserved for the personalization kiosk client.

The kiosk will select a base item and personalization options, then call authenticated backend endpoints. It must not process payment, create reusable catalog products, generate MarketSuite barcodes, or release work to production. See `docs/architecture.md` for the accepted workflow and state boundaries.

Implementation waits on the kiosk hardware/browser target, identity model, approved UI design, and MarketSuite sandbox contract.
