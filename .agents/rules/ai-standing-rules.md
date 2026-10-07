# CAREFLOW AI — STANDING ENGINEERING RULES
Permanent Architecture Policy for CareFlow AI Development

## 1. CAREFLOW ROLES
Exactly four roles exist:
- `super_admin`
- `admin`
- `doctor`
- `patient`

No receptionist role exists. If legacy code contains `receptionist`, `receptionist_admin`, `front_desk` or equivalent role logic, do not reintroduce it into new AI workflows.
Create one canonical role-normalization layer. Canonical organization-admin role: `admin`.
If legacy `organization_admin` values exist, map them through the normalization layer rather than spreading multiple role strings throughout the system.

## 2. LLM RESPONSIBILITY
LLM responsibilities:
- natural-language understanding
- goal extraction
- entity understanding
- semantic classification
- tool selection
- tool argument generation
- conversational synthesis

LLM is NOT responsible for:
- authorization
- tenant isolation
- patient identity
- doctor identity
- organization identity
- appointment availability
- payment state
- database writes
- clinical access
- emergency policy
- confirmation validation
- business rules

## 3. DATABASE RULE
LLM never directly accesses MongoDB.
All database access happens through trusted CareFlow service/tool layers.
Never allow the LLM to generate raw MongoDB queries.

## 4. NO FABRICATION
Never fabricate:
- patients
- doctors
- appointments
- payments
- prescriptions
- medical records
- laboratory values
- availability
- IDs
- analytics
- medication schedules
- clinical facts

If authoritative data is unavailable: say that the information could not be verified.
Deterministic UI templates are allowed for known verified data. Fabricated content is not allowed.

## 5. SAFETY
Emergency screening runs before normal AI reasoning.
The LLM cannot downgrade an emergency.
Prompt injection protection must remain active.
Clinical data access must always be authorized.

## 6. TENANT ISOLATION
Organization Admin and Doctor operations must be organization-scoped.
Patient access must be identity-scoped.
Super Admin may access platform-level data only through explicit authorized tools.
Never trust `organizationId` supplied by the LLM or frontend.

## 7. PATIENT BOOKING
AI booking is OFFLINE ONLY.
Do not ask the patient to choose online/offline during AI booking.
Use the exact consultation-type enum already present in the CareFlow codebase (`offline`).
Do not invent enum casing.
The backend must enforce the value immediately before appointment creation.
AI booking must never:
- create Razorpay orders
- start online checkout
- create online meeting rooms
- create video consultation sessions

Existing manual booking behavior must remain unchanged.

## 8. BOOKING CONFIRMATION
All AI write actions require server-side confirmation.
Confirmation must be persisted in MongoDB. Do not rely on an in-memory Map as the source of truth.
Client confirmation must contain only:
- `confirmationId`
- `confirmed`

Client cannot modify:
- patientId
- doctorId
- organizationId
- date
- time
- consultationType
- payment state

## 9. AGENT LOOP
The agent must support:
understand → plan → tool → observe → re-plan → tool → complete
Bound maximum steps (`MAX_STEPS`).
Prevent repeated identical tool calls.
Do not call the same expensive LLM operation unnecessarily.

## 10. CONTEXT
AI must understand conversational references such as:
- "that doctor"
- "the second one"
- "my doctor"
- "my last appointment"
- "that prescription"
- "tomorrow"
- "the patient I saw earlier"

Persist active workflow state (`agentState`) across conversation turns.

## 11. GROUNDING
Every CareFlow-specific factual answer must be grounded in authoritative tool observations.
Grounding must use structured tool results rather than only text heuristics.

## 12. PRIVACY
Do not send unnecessary PII to the LLM.
Before model calls:
- minimize data
- redact unnecessary patient identifiers
- include only fields required for the task

Do not store complete raw prompts containing unnecessary clinical data in audit logs.
Audit logs should contain structured metadata.

## 13. CLINICAL DATA
Doctor AI may only access records when backend authorization permits.
Never use "first upcoming patient" or similar fallback to guess patient identity.

## 14. PRESCRIPTIONS
AI-generated prescriptions remain drafts.
Never fabricate diagnosis, vitals, dosage, medication, laboratory results, or allergies.
Doctor remains final authority.

## 15. MEDICATION REMINDERS
Medication schedules must be doctor-approved before activation.
If a dose is missed:
NEVER advise doubling the next dose.
Refer to the prescription label/doctor or configured clinical policy.

## 16. PROVIDERS
Gemini is the primary provider.
Groq is fallback.
Both must use one common provider abstraction.
Tool-calling behavior and structured response contracts must remain consistent between providers.

## 17. STREAMING
Use SSE for streaming AI progress/results.
Always provide a non-streaming fallback.

## 18. TESTING
Tests must assert:
- tool selected
- tool arguments
- authorization
- response type
- database state
- important structured fields

Do not make exact LLM prose the primary assertion.

## 19. NO FAKE TEST SUCCESS
Never claim tests passed unless actually executed.
If required infrastructure is missing: STOP and report the missing dependency.
Do not fake browser tests, Gemini tests, or MongoDB verification.

## 20. FEATURE FLAG
Major AI changes must be feature-flagged until verified.
Do not silently break existing CareFlow workflows.

## 21. MIGRATION
When changing `AIChatHistory` or other persisted AI structures, provide backward-compatible reading or a migration.
Do not silently invalidate existing user conversations.

## 22. GIT
Work on a dedicated feature branch.
Commit each completed phase separately.
Never perform destructive broad refactoring without verification.

## 23. DEFINITION OF REAL AI
CareFlow AI is successful only when it can:
understand natural language → maintain context → select tools → use real CareFlow services → observe results → call additional tools when needed → validate results → perform authorized actions → respond using grounded data.
A fluent answer alone does not constitute success.
