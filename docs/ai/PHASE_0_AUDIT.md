# Phase 0 Baseline Audit — CareFlow AI Architecture

## 1. Initial State Assessment
- **Role Inventory:** Pre-Phase 1 codebase contained ambiguous roles (`organization_admin`, `admin`, legacy references to front-desk concepts).
- **Confirmation Model:** Confirmations were handled via an in-memory JavaScript `Map` inside `pendingConfirmation.js`, which was vulnerable to restarts and multi-instance concurrency issues.
- **Booking Rules:** AI booking needed strict validation to guarantee offline-only (`consultationType: "offline"`, `paymentMethod: "cash"`) without creating Razorpay orders or telehealth rooms.
- **Provider Layer:** Gemini was used directly with ad-hoc Groq fallbacks in `geminiClient.js`.
- **Response Format:** Mixed ad-hoc payloads returned across tools without a strict canonical contract.

## 2. Invariants Established
1. Exactly four roles: `super_admin`, `admin`, `doctor`, `patient`.
2. Offline-only AI booking.
3. Server-side MongoDB persisted confirmations.
4. Deterministic emergency screening runs before LLM calls.
5. Strict tenant isolation for doctor and admin roles.
