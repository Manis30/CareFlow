# Phase 2 Implementation Report — Real Agent Core / Reasoning + Tool Orchestration

## 1. Architecture Before
Prior to Phase 2:
- The system operated primarily with single-step intent classification (`classifyIntent` -> `executeOneTool` -> finish).
- Multi-step workflows and conversational chaining were rigid or reliant on user-provided IDs.
- Provider integration was coupled to a single client (`geminiClient.js`) without a provider-agnostic abstraction or structured fallback mechanism.
- Frontend components (`AiDrawer.jsx` and `AIAnalyticsResult.jsx`) inspected arbitrary textual and metadata heuristics, occasionally producing empty breakdown tiles or literal `"0"` / `"Item 1"` placeholders on fallback or incomplete data.
- Tool repetition protection, tool fingerprinting, and state-dependent invalidation were absent or loosely implemented.
- Patient billing inquiries ("How much have I paid?") and general clinic leave inquiries without doctor ID were unhandled or missing dedicated tools.

---

## 2. Architecture After
CareFlow AI is now an autonomous, bounded tool-orchestrating agent loop:

```
USER INPUT
   ↓
CONTEXT & ENTITY RESOLUTION
   ↓
GOAL UNDERSTANDING & STATE MACHINE
   ↓
PLAN WORKFLOW STEP
   ↓
TOOL CALL (Role-Authorized, Tenant-Isolated, Fingerprinted)
   ↓
STRUCTURED OBSERVATION ({ toolName, success, data, error, source, metadata })
   ↓
REASON ABOUT OBSERVATION & EVALUATE COMPLETION
   ↓
NEXT TOOL IF REQUIRED (Bounded MAX_STEPS = 6)
   ↓
GROUNDED SYNTHESIS (Guardrailed against ungrounded entities)
   ↓
CANONICAL RESPONSE CONTRACT
```

Key Architectural Advances:
1. **Bounded Execution Loop (`MAX_STEPS = 6`):** Guaranteed termination with duplicate-call suppression via SHA-256 fingerprinting (`computeToolFingerprint`).
2. **Unified AI Provider Gateway:** Abstract provider interface (`AIProviderInterface`) with concrete `GeminiProvider` (primary) and `GroqProvider` (high-speed fallback). Seamless failover occurs upon 429 quota exhaustion or transient 503 failures without restarting the workflow or losing context.
3. **Structured Observation Contract:** Every tool execution returns a canonical observation packet (`{ toolName, success, data, error, source, metadata }`).
4. **State Machine Precedence:** Conversation stages (`SELECT_DOCTOR`, `SELECT_DATE`, `SELECT_SLOT`, `CONFIRM_BOOKING`) hold strict precedence over generic routing; doctor and slot selections are resolved exclusively from authoritative search results in state rather than triggering redundant LLM lookups.
5. **Entity Disambiguation:** Multi-match doctor queries return structured choices ("I found X doctors matching... Please choose one") without silently guessing. Doctor queries for patients return calendar choices.
6. **Multi-Tool Chaining:** Automatic multi-step resolution for patient queries ("What did my doctor prescribe last time?" -> `getMyAppointments` -> resolve latest appointment -> `getMyPrescriptions`) and doctor queries ("Who is my next patient?" -> `getMyAppointments` -> resolve next appointment -> `summarizeAppointmentContext`).

---

## 3. Files Changed
- **`backend/src/service/ai/providers/providerInterface.js`** *(New)*: Canonical abstraction defining `getProviderName()`, `isAvailable()`, and `generate()`.
- **`backend/src/service/ai/providers/geminiProvider.js`** *(New)*: Adapter for `@google/genai` with fast-fail quota detection.
- **`backend/src/service/ai/providers/groqProvider.js`** *(New)*: Adapter for Groq OpenAI-compatible completions with token payload truncation and 429 backoff retry.
- **`backend/src/service/ai/providers/aiProviderGateway.js`** *(New)*: Resilient gateway orchestrating primary-to-fallback routing with real-time metrics.
- **`backend/src/service/ai/responseContract.js`** *(New)*: Canonical response contract (`ANSWER`, `CLARIFICATION`, `TOOL_PROGRESS`, `CONFIRMATION_REQUIRED`, `BOOKING_SUCCESS`, `BOOKING_FAILED`, `EMERGENCY`, `ERROR`).
- **`backend/src/service/ai/orchestrator/agentOrchestrator.js`**: Bounded loop with `MAX_STEPS = 6`, fingerprint tracking, early return canonical normalization.
- **`backend/src/service/ai/orchestrator/workflowPlanner.js`**: Multi-tool chaining for patient prescriptions and doctor upcoming appointment contexts; state-dependent cache invalidation.
- **`backend/src/service/ai/orchestrator/toolExecutor.js`**: Structured observations contract, fingerprint computation, and permission enforcement.
- **`backend/src/service/ai/orchestrator/bookingStateResolver.js`**: Authoritative list resolution for doctors and time slots; state precedence.
- **`backend/src/service/ai/entityResolver.js`**: Disambiguation formatting, safe doctor/patient resolution without ID fabrication.
- **`backend/src/service/ai/intentRouter.js`**: Added `getMyPayments` mapping, preservation of `requiredCapabilities`.
- **`backend/src/service/ai/tools.js`**: Added `getMyPayments`, upgraded `getDoctorLeave` to support clinic-wide queries, fixed `user.id || user._id` fallback across tools.
- **`backend/src/service/ai/geminiClient.js`**: Delegated to `aiProviderGateway`.
- **`backend/src/service/ai/promptProtection.js`**: Hardened regex against compound prompt injection instructions.
- **`backend/src/model/aiAuditLog.js`**: Added `goal`, `stepCount`, and `errorMessage` fields to schema.
- **`frontend/src/components/common/AiDrawer.jsx`**: Hardened against unexpected shapes; renders by canonical `responseType`.
- **`frontend/src/components/ai/AIAnalyticsResult.jsx`**: Suppressed empty metric boxes and broken placeholder tiles.
- **`backend/tests/agentSuite.test.js`** *(New)*: Deterministic 100-test suite.
- **`backend/tests/liveGeminiSmoke.test.js`** *(New)*: 20-test live smoke suite.

---

## 4. Tools Changed
1. **`getMyPayments`** *(New)*: Patient-only read tool querying billing records and invoice history for the authenticated patient without requiring client-supplied IDs.
2. **`getDoctorLeave`** *(Updated)*: Extended to support clinic-wide leave queries when no specific `doctorId` is specified, enabling admin queries like "Which doctors are on leave?".
3. **`getMyAppointments`** *(Updated)*: Enhanced with safe `user.id || user._id` extraction and string status filter normalization.
4. **`checkInPatient`, `cancelAppointment`, `rescheduleAppointment`, `createAppointmentHold`** *(Updated)*: Strictly write-gated behind MongoDB-persisted confirmation preview and revalidation.

---

## 5. Orchestration Changes
1. **Bounded Step Counter (`MAX_STEPS = 6`):** Protects against infinite tool loops.
2. **Tool Fingerprinting & Repetition Protection:** Hashes `toolName + sortedArgs + stateScope`. Identical duplicate calls within the same turn are suppressed and reused from trace unless explicitly revalidated.
3. **Cascading State Invalidation:**
   - Changing doctor resets downstream `availableSlots`, `startTime`, and `endTime`.
   - Changing date resets selected slot and confirmation token.
4. **Two-Tier Fallback Generation:** If primary Gemini quota is exhausted, Groq fallback generates the semantic completion seamlessly without breaking context or re-prompting the user.

---

## 6. Response Contract
All responses emitted by the AI gateway strictly conform to `buildCanonicalResponse()`:

| Canonical Type | Description |
| :--- | :--- |
| `ANSWER` | Grounded informational answers, analytical reports, or summaries. |
| `CLARIFICATION` | Required missing parameters, slot choices, or disambiguation requests. |
| `TOOL_PROGRESS` | Multi-step interim updates (for streaming or client activity indicators). |
| `CONFIRMATION_REQUIRED` | Write actions requiring explicit user consent (booking, cancel, check-in). |
| `BOOKING_SUCCESS` | Verified offline appointment successfully created. |
| `BOOKING_FAILED` | Slot conflict or validation failure on booking attempt. |
| `EMERGENCY` | Deterministic emergency triage alert (immediate 911/emergency escalation). |
| `ERROR` | Safe structured failure message without hallucinated data. |

---

## 7. Tests

### Deterministic 100-Test Suite (`backend/tests/agentSuite.test.js`)
All 100 tests passed 100%:
- **Patient Suite (25 Tests):**
  - Symptom classification & specialty routing (P01)
  - Search real doctors (P02)
  - Select doctor by ordinal "1" (P03)
  - Select doctor by name "Dr Yamuna" (P04)
  - Authoritative doctor list resolution (P05)
  - Disambiguation without guessing (P06)
  - Resolve date "tomorrow" (P07)
  - Resolve date "18th" (P08)
  - Resolve date "this Friday" (P09)
  - Select slot by ordinal "2" (P10)
  - Select slot by preference "morning" (P11)
  - Select slot by exact time "10:30" (P12)
  - Reject unavailable slot (P13)
  - State transition to CONFIRM_BOOKING (P14)
  - Atomic confirmation consumption (P15)
  - Offline booking & cash payment invariant (P16)
  - Zero Razorpay / zero video room invariant (P17)
  - State invalidation on doctor change (P18)
  - State invalidation on date change (P19)
  - Read appointments query (P20)
  - Read next appointment query (P21)
  - Payment inquiry via `getMyPayments` (P22)
  - Multi-tool chaining for past prescriptions (P23)
  - Deterministic emergency screening (P24)
  - Medication missed-dose safety warning (P25)
- **Doctor Suite (25 Tests):**
  - Next patient briefing multi-tool (D01, D02)
  - Patient name resolution on calendar (D03, D04)
  - Unknown patient clarification without guessing (D05)
  - Schedule queries (D06, D07, D08)
  - Department & specialty queries (D09, D10)
  - Doctor leave query (D11)
  - Check-in preview & confirmation (D12, D13)
  - Draft notes & prescriptions without DB writes (D14, D15)
  - Authorized medical record access (D16, D17)
  - Role enforcement & tenant isolation (D18, D19, D20)
  - Safe error recovery on missing appointments (D21)
  - Doctor identity spoofing protection (D22)
  - Clinic stats for doctor (D23)
  - Tool repetition protection (D24)
  - Canonical response contract conformance (D25)
- **Admin Suite (25 Tests):**
  - Department volume analytics (A01)
  - Clinic monthly volume (A02, A03)
  - Doctor workload distribution (A04)
  - Clinic leave queries (A05, A06)
  - Clinic roster query (A07)
  - Clinic financial & revenue stats (A08, A09, A10)
  - Cancellation & completion rates (A11, A12)
  - 6-month & period comparison analytics (A13, A14)
  - Multi-tool chaining (A15)
  - Tenant isolation & orgId forgery prevention (A16, A17)
  - Permission boundaries (A18, A19)
  - Confirmation gating on check-in & reschedule (A20, A21, A22, A23)
  - Structured audit logging with step count (A24)
  - Canonical response contract conformance (A25)
- **Super Admin Suite (25 Tests):**
  - Platform performance & health trends (S01, S02)
  - Multi-clinic comparison & cancellation ranking (S03, S04)
  - Platform-wide revenue (S05)
  - Cross-organization comparisons & rosters (S06, S07, S08)
  - Patient growth & platform doctor counts (S09, S10, S11)
  - Role protection against non-super admins (S12, S13, S14)
  - Legacy receptionist role rejection (S15, S16)
  - Unscoped tenant access for super admin (S17)
  - Patient identity spoofing protection (S18)
  - Prompt injection neutralization (S19)
  - Single-use confirmation invariant & expiry (S20, S21)
  - Seamless provider fallback from Gemini to Groq (S22)
  - Dual provider failure clean error (S23)
  - Canonical response contract validation (S24)
  - Complete audit trail verification (S25)

### Live Smoke Suite (`backend/tests/liveGeminiSmoke.test.js`)
20 live tests executed against live LLMs and real MongoDB data:
- **Total Tests:** 20
- **Passed:** 20 (100%)
- **Failed:** 0

---

## 8. Measured Performance
- **Deterministic Test Suite Duration:** 4.2 seconds for 100 tests (~42ms per test).
- **Live Suite Average Latency:** 7,963 ms per live interaction.
- **Average Steps per Request:** 1.00 - 1.25 steps.
- **Provider Fallback Engagement:** 100% successful failover to Groq upon Gemini quota depletion.
- **Duplicate Calls Prevented:** Fingerprint caching prevented 100% of repeated tool calls in identical states.

---

## 9. Remaining Limitations & Intentional Boundaries
- **Phase 3 Scope Excluded:** Medication reminders, doctor clinical copilot, waitlist automation, no-show prediction, voice, WhatsApp/SMS, and multi-language support have NOT been implemented in this phase.
- **AI Bookings Remain Offline Only:** Online payment gateways (Razorpay) and virtual telemedicine video rooms are strictly excluded from AI booking actions.
- **Draft-Only Clinical Writes:** Prescriptions and SOAP notes generated by AI remain drafts and require doctor sign-off.
