# PROGRESS

Working repo: this one (`Smartomni-Tiktok-Simulator`). The SmartOmni platform repo is **reference only** (user instruction); SmartOmni-side work is written as requirement documents in `docs/smartomni-requirements/` and marked BLOCKED here. Nothing in `spec/00-overview.md` is ticked: reviewers tick.

| Phase | Simulator side | SmartOmni side (reference-only repo) | Status |
|---|---|---|---|
| 01 Contracts | done (earlier) | n/a | DRAFT, awaiting review / Partner Center access |
| 02 Foundation | done | n/a | DRAFT, awaiting review |
| 03 Connection | done | done in platform working tree earlier (uncommitted there) | DRAFT |
| 04 Catalog | done | done in platform working tree earlier (uncommitted there) | DRAFT |
| 05 Orders/webhooks | backend + UI done | BLOCKED (steps 6-11, see docs/smartomni-requirements/phase-05.md) | PARTIAL |
| 06 Inventory/outbox | - | - | not started |
| 07 Fulfillment/returns | - | - | not started |
| 08 Conversations | - | - | not started |
| 09 Coupons/loyalty | - | - | not started |
| 10 Test/handover | - | - | not started |

## Outstanding for Phase 05
- Playwright e2e of Buyer checkout (pending, runs against the Docker stack).
- Evidence Buyer -> simulator -> SmartOmni -> inventory: BLOCKED (needs SmartOmni Order/Integration/Inventory changes in the reference-only repo and Phase 06).
