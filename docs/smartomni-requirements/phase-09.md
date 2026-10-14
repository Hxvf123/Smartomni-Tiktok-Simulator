# Phase 09 - SmartOmni-side requirements (not implemented here)

Status: **BLOCKED** for this work (the SmartOmni platform repo is reference only). The simulator side of steps 1-4 is Phase 09a (coupon data, read API, checkout discount). Steps 5-11 below belong to SmartOmni; 09b adds only the simulator-side data they rely on.

## Step 5 - lock the unverified voucher-creation API
- `promotion.coupon_create` is `unsupported` in `contracts/manifest.json`: no coupon-creation endpoint is verified for VN (the OAS has none; `/promotion/202309/activities` is a promotion-activity API and must NOT be substituted).
- SmartOmni must return a clear "not supported / not verified" message for "Admin issues a voucher through the API" and must never email a code as if it had been created. The simulator proves the other half: signed `POST/PUT/PATCH/DELETE` on any `/promotion/...` path other than coupon search returns the router's plain 404 (`tiktok-coupons.e2e-spec.ts`).
- Reading coupons (`POST /promotion/202406/coupons/search`, `GET /promotion/202406/coupons/{id}`, scope placeholder `sim.promotion.read`) proves nothing about the right to create or audit them.

## Steps 6-11 (loyalty / Customer Portal) - see 09b
Order data SmartOmni needs: shop/connection, source status, completion time, payable product amount after discount (`payment.sub_total`, with `seller_discount`, shipping and tax as separate components), tax and shipping excluded from points. Claim endpoint, 15-day rule, one-time claim by constraint, tiers (Standard <500, Silver >=500, Platinum >=1000, Diamond >=1500) and the Customer Portal account are SmartOmni work.

## Not supported by the simulator (do not assume)
- Coupon card in chat (Phase 09 step 4): it depends on Phase 08 Send Message supporting `COUPON_CARD`; until that is verified in a snapshot, nothing sends a coupon card.
- Audience `REPEAT_CUSTOMERS`, product-scoped coupons (`SPECIFIC_PRODUCTS`), claim limits and per-buyer claims: not modelled.
