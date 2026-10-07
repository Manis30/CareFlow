# CareFlow Workspace Instructions & Agent Policy

All AI development and agent operations in this repository must strictly follow the standing engineering rules defined in:
[.agents/rules/ai-standing-rules.md](file:///.agents/rules/ai-standing-rules.md)

### Summary of Core Architectural Invariants:
1. **Roles:** Exactly 4 roles (`super_admin`, `admin`, `doctor`, `patient`). No receptionist role. Canonical org-admin role is `admin`.
2. **LLM Responsibility:** Semantic reasoning, intent, and conversational synthesis only. Zero authorization, zero tenant, zero direct DB access.
3. **Database Rule:** LLM never directly touches MongoDB; accesses data exclusively via trusted CareFlow service/tool layer.
4. **No Fabrication:** Grounding required for all clinical and operational facts.
5. **Safety:** Deterministic emergency screener runs first; prompt injection defense always active.
6. **Tenant Isolation:** Enforced on backend for admin and doctor; never trust client or LLM `organizationId`.
7. **Patient Booking:** AI booking is strictly `offline`, `cash` payment; never creates online checkout, video rooms, or Razorpay orders.
8. **Confirmation:** Persistent in MongoDB (never an in-memory Map). Single-use, server-validated.
9. **Agent Loop:** Bound max steps (`MAX_STEPS = 8`), avoid duplicate executions.
10. **Context & State:** Multi-turn conversational references and state machine persistence.
11. **Grounding:** Validated against structured tool results.
12. **Privacy:** PII minimization before model calls; structured metadata in audit logs.
13. **Clinical Data:** Backend authorization enforced. Never guess patient identity.
14. **Prescriptions:** AI prescriptions are draft-only. Doctor has final authority.
15. **Medication Reminders:** Doctor-approved. Never advise doubling missed doses.
16. **Providers:** Gemini primary, Groq fallback. Common abstraction and response contract.
17. **Streaming:** SSE with non-streaming fallback.
18. **Testing:** Assert tool, args, auth, responseType, and DB state, not free-form LLM prose.
19. **Real Tests Only:** Never fake test success.
20. **Feature Flags:** Guard major changes.
21. **Migrations:** Backward-compatible persisted models.
22. **Git:** Focused feature branches, clean commits.
23. **Real AI:** Full loop (understand → context → tool → observe → validate → ground).
