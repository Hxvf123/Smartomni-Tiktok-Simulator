# PROGRESS

Working repo: this one (`Smartomni-Tiktok-Simulator`). The SmartOmni platform repo is **reference only** (user instruction); SmartOmni-side work is written as requirement documents in `docs/smartomni-requirements/` and marked BLOCKED here. Nothing in `spec/00-overview.md` is ticked: reviewers tick.

| Phase | Simulator side | SmartOmni side (reference-only repo) | Status |
|---|---|---|---|
| 01 Contracts | done (earlier) | n/a | DRAFT, awaiting review / Partner Center access |
| 02 Foundation | done | n/a | DRAFT, awaiting review |
| 03 Connection | done | done in platform working tree earlier (uncommitted there) | DRAFT |
| 04 Catalog | done | done in platform working tree earlier (uncommitted there) | DRAFT |
| 05 Orders/webhooks | backend + UI done | BLOCKED (steps 6-11, see docs/smartomni-requirements/phase-05.md) | PARTIAL |
| 06 Inventory/outbox | done (update API, faults, change log, UI) - commit `1acd209` (merged) | BLOCKED (debit receipt, outbox lease, RabbitMQ; docs/smartomni-requirements/phase-06.md) | PARTIAL |
| 07a Fulfillment (steps 1-4) | done (packages, tracking, PDF, ship) - commit `cb6b7cf` (merged) | BLOCKED (business API for tracking/label) | PARTIAL |
| 07b Returns/cancel (steps 5-9) | - | - | not started |
| 08 Conversations | done (API, webhooks, chat UI, faults) - commit `d535636` (merged) | BLOCKED (inbox, AI gateway test double, complaint lock) | PARTIAL |
| 09a Coupons (steps 1-5) | done (read API, checkout discount) - commit `e8ee868` (merged) | BLOCKED (voucher lock message, no success email) | PARTIAL |
| 09b Loyalty (steps 6-11) | done: boundary test data via business clock (`/test-admin/scenarios/loyalty-orders`) | BLOCKED (claim, points, tiers: docs/smartomni-requirements/phase-09.md) | PARTIAL |
| 10 Test/handover | - | - | not started |

## Outstanding for Phase 05
- Playwright e2e of Buyer checkout (pending, runs against the Docker stack).
- Evidence Buyer -> simulator -> SmartOmni -> inventory: BLOCKED (needs SmartOmni Order/Integration/Inventory changes in the reference-only repo and Phase 06).
