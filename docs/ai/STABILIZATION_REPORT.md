# CareFlow AI — Focused Stabilization Sprint Report

**Sprint Date:** October 9, 2026  
**Status:** Completed & Ground-Truth Verified  
**Scope:** Priority Bug Fixes (Doctor AI, Medical Records, Routing, Orchestration, Doctor Appointments, Document Viewer, Frontend Response Rendering)

---

## 1. Executive Summary

During this stabilization sprint, we traced each failure across the full execution chain (**frontend → gateway → orchestrator → tool → database → response rendering**) and addressed the root causes of all reported stabilization defects.

All fixes were implemented in existing files, using real database models, respecting role-based access control (exactly 4 roles: `super_admin`, `admin`, `doctor`, `patient`), offline-only AI booking constraints, and zero direct database access for LLMs.

---

## 2. Confirmed Root Causes & Fixes Implemented

### Priority 1 & 3: Doctor AI Patient Resolution, Shared Medical Records & Routing
* **Root Cause 1 (`intentRouter.js`):** In `backend/src/service/ai/intentRouter.js`, the deterministic pattern `isPatientRecordsDiscovery` (`/\b(?:patient\s+records?|show\s+my\s+patients|my\s+patients|patient\s+information|patient\s+history)\b/i`) matched any query containing the words "patient records" (e.g., *"Show patient Aarav Sharma's records"* or *"records for Rajasekaran"*), routing directly to `getDoctorAuthorizedPatients` with empty arguments (`toolArgs: {}`), discarding the patient's name and presenting the entire patient list instead of looking up the specified patient.
* **Root Cause 2 (`doctorCopilot.js`):** In `resolveDoctorPatientSelection`, the regex `!selLower.match(/^\s*(?:\d+|first|second|third|fourth|fifth|[a-z\s]+)\s*$/i)` included `[a-z\s]+`, which matched any alphabetic sentence with spaces. As a result, requests like *"Rajasekaran records"* evaluated to false, preventing `wantsSharedRecords` from ever executing and falling back to a generic prompt. Additionally, `getDoctorSharedMedicalRecords` did not receive `params.patientName`.
* **Fix Implemented:**
  - In `backend/src/service/ai/intentRouter.js`: Implemented `extractDoctorPatient` to detect patient names in doctor queries. If a specific patient is named and records/history are requested, it routes to `getSharedMedicalRecords` with `{ patientName, query: promptMessage }`. Generic discovery (`getDoctorAuthorizedPatients`) now only triggers when no specific patient name is present.
  - In `backend/src/service/doctorCopilot.js`: Fixed `resolveDoctorPatientSelection` to correctly distinguish pure patient selection vs. record queries. Enhanced `resolveDoctorPatientContext` with robust name extraction. Updated `getDoctorSharedMedicalRecords` to resolve `params.patientName`, handle ambiguous matches with clarification questions, and return formatted numbered record lists asking which record to review or whether to review all.

### Priority 2: Medical Records (Summarize, Extract Findings, QA)
* **Root Cause (`documentQaService.js`):**
  - Summarize, Extract Findings, and Q&A operations were not explicitly distinguished; all passed through a generic Q&A prompt.
  - In error or fallback mode, line 512 returned raw truncated OCR text: `synthesizedAnswer = \`Retrieved matching medical record information:\n${sanitizedContext.substring(0, 350)}...\`;`, violating the standing invariant that summaries must never dump raw OCR text.
  - When summarizing a single record (`recordId`), vector embedding search or single-chunk slicing was used instead of retrieving all chunks in sequential order (`chunkIndex: 1`) to cover the full document.
  - The relevancy guardrail evaluated specific search keywords (e.g. "summarize") against the document text; if the word "summarize" was not literally in the document, it falsely returned "I couldn't find that information in the records available to you."
* **Fix Implemented:**
  - Implemented `detectDocumentTaskType(query)` returning `"SUMMARIZE"`, `"EXTRACT_FINDINGS"`, or `"QA"`.
  - When `recordId` is provided, all document chunks for that record are retrieved sorted by `chunkIndex: 1`, guaranteeing full document coverage.
  - Dedicated system instructions and prompts were authored for each task type:
    - **Summarize:** Mandates structured clinical sections (Document Title & Date, Clinical Indication / Overview, Key Clinical Findings & Values with exact units and reference ranges, Impression / Conclusion).
    - **Extract Findings:** Structures all laboratory results, vital signs, and diagnostic findings into categorized key-value listings with units.
    - **QA:** Grounded direct answers, returning `"I couldn't find that information in the records available to you."` when information is absent.
  - Relevancy keyword gating only runs for `"QA"` queries; `"SUMMARIZE"` and `"EXTRACT_FINDINGS"` operate over the whole document.
  - Fallback and error catches now construct clean, structured summaries and findings tables, **never dumping raw OCR strings or unformatted text chunks**.
  - In `backend/src/service/ai/groundingGuardrail.js`: Added document structure headers (`title`, `date`, `values`, `conclusion`, `impression`, `lipoprotein`, etc.) to `PARAPHRASE_WHITELIST` to prevent false entity rejections.

### Priority 4: Agent Orchestration (Multi-Turn Context & Clarifications)
* **Root Cause (`agentOrchestrator.js`):**
  - When shared medical records were retrieved, `agentState.patientName` was not persisted alongside `patientId`, leading to missing name context in subsequent turns.
* **Fix Implemented:**
  - Updated `agentOrchestrator.js` to persist both `patientId` and `patientName` in `agentState` upon `getSharedMedicalRecords` discovery.
  - Verified that multi-turn conversational selection ("1", "2", "all") resolves against `agentState.sharedMedicalRecords` and executes record-scoped summarization.

### Priority 5: Doctor Appointments (Inflated Counts, Date Boundaries, Channel Filters)
* **Root Cause 1 (`appointment.js`):** `getDoctorTodayAppointmentsService` queried `{ appointmentDate: { $gte: today, $lt: tomorrow } }` with **no status filtering**. Cancelled appointments were included, inflating the today's appointments count on both the Doctor Dashboard and Doctor Appointments pages.
* **Root Cause 2 (`appointment.js`):** `getDoctorUpcomingAppointmentsService`, `getDoctorTodayAppointmentsService`, and related functions did not accept `query.consultationType` or `query.status` parameters, preventing accurate channel filtering (`online` vs `offline`).
* **Root Cause 3 (`controller/appointment.js`):** In `getMyAppointmentsController`, the controller invoked `getMyAppointmentsService(req.user.id, req.query.status)`, omitting `req.user.role`. This caused `getMyAppointmentsService` to default `role` to `'patient'`, failing doctor lookups with a 404 error ("Patient profile not found").
* **Fix Implemented:**
  - In `backend/src/service/appointment.js`:
    - `getDoctorTodayAppointmentsService`: Excludes cancelled appointments by default: `{ status: { $nin: ["cancelled", "CANCELLED"] } }`. Supports `query.status` and `query.consultationType`.
    - `getDoctorUpcomingAppointmentsService`: Starts from `today` (`$gte: today`) and supports `query.status` and `query.consultationType`.
    - `getDoctorCompletedAppointmentsService` & `getDoctorCancelledAppointmentsService`: Added `consultationType` filtering.
  - In `backend/src/controller/appointment.js`:
    - `getMyAppointmentsController`: Passes `req.user.role` as second argument and `req.query` as options.
    - Updated all doctor appointment controllers to pass `req.query` to service methods.

### Priority 6 & 7: Document Viewer & Frontend Response Rendering
* **Verified:**
  - Verified `previewMedicalRecordController` delivers verified MIME (`application/pdf`, `image/*`) with `inline` disposition, proper size headers, and private cache control.
  - Verified `downloadMedicalRecordController` delivers verified MIME with `attachment` disposition and sanitized filenames.
  - Verified `RecordPreviewModal.jsx` handles responsive layout, zoom (50% to 250%), full-page PDF rendering via iframe (`#view=FitH&toolbar=1`), image zoom, and raw text extraction toggle.
  - Verified `AiDrawer.jsx` safely parses and renders all canonical AI response types (`CONFIRMATION_REQUIRED`, `BOOKING_SUCCESS`, `BOOKING_FAILED`, `ERROR`, `ANALYTICS`, `DRAFT_REQUIRING_REVIEW`, `PRE_VISIT_BRIEF`, and `GROUNDED_RECORD`) with citations and warning banners.

---

## 3. Files Changed and Rationale

| File | Rationale |
| :--- | :--- |
| `backend/src/service/doctorCopilot.js` | Fixed `wantsSharedRecords` selection regex, enhanced `resolveDoctorPatientContext` name matching, and updated `getDoctorSharedMedicalRecords` to resolve patient by name and handle ambiguity. |
| `backend/src/service/ai/intentRouter.js` | Added doctor patient name extraction (`extractDoctorPatient`) so queries for specific patients route to `getSharedMedicalRecords` with `patientName` rather than generic discovery. |
| `backend/src/service/ai/orchestrator/agentOrchestrator.js` | Preserved `patientName` in `agentState` upon discovering shared medical records. |
| `backend/src/service/ai/documentQaService.js` | Added `detectDocumentTaskType`; loaded full sequential chunks for single-record review; tailored summarization, extraction, and Q&A prompts; and removed raw OCR fallback dumps. |
| `backend/src/service/ai/groundingGuardrail.js` | Added clinical document structure terms and `lipoprotein` to `PARAPHRASE_WHITELIST` to prevent false guardrail rejections on structured summaries. |
| `backend/src/service/appointment.js` | Fixed inflated today's appointments count by excluding cancelled appointments by default; added `consultationType` (`online`/`offline`) and `status` query filtering. |
| `backend/src/controller/appointment.js` | Fixed `getMyAppointmentsController` to pass `req.user.role` and `req.query`; passed `req.query` in doctor appointment controllers. |
| `backend/tests/stabilizationFocusedVerification.test.js` | Added regression test suite verifying appointment count fix, channel filters, doctor role lookup, patient name query routing, and structured record summarization. |

---

## 4. Focused Verification Checks Executed & Results

### Suite 1: `backend/tests/stabilizationFocusedVerification.test.js`
* **Command:** `node --env-file=.env tests/stabilizationFocusedVerification.test.js`
* **Result:** Exit code 0 (All 5 Checks Passed)
  - `[CHECK A]`: Today's active appointments count is 1 (cancelled appointment excluded). **PASS**
  - `[CHECK B]`: Doctor appointment channel filtering (`online` vs `offline`) resolves accurately. **PASS**
  - `[CHECK C]`: `getMyAppointmentsService` handles doctor role without 404 patient error. **PASS**
  - `[CHECK D]`: Doctor AI query *"Show patient Aarav Sharma's records"* resolves patient Aarav Sharma, discovers shared records, and prompts for selection. **PASS**
  - `[CHECK E]`: Doctor selection *"1"* summarizes full record with clinical findings without raw OCR dump. **PASS**

### Suite 2: `backend/tests/doctorPatientDiscoverySmoke.test.js`
* **Command:** `node --env-file=.env tests/doctorPatientDiscoverySmoke.test.js`
* **Result:** Exit code 0 (All 6 Checks + Live Conversation Passed)
  - `[CHECK 1]`: Generic query routes to `getDoctorAuthorizedPatients` and sets `SELECT_PATIENT` stage. **PASS**
  - `[CHECK 2]`: Returns real authorized patient names without exposing MongoDB IDs. **PASS**
  - `[CHECK 3]`: Selection *"Rajasekaran"* resolves patient without asking for internal IDs. **PASS**
  - `[CHECK 4]`: *"Show shared medical records"* discovers 2 records and presents numbered options. **PASS**
  - `[CHECK 5]`: *"2"* resolves record #2 (Echocardiogram) with structured grounded clinical summary. **PASS**
  - `[CHECK 6]`: *"all"* summarizes all authorized shared records. **PASS**
  - `[LIVE CONVERSATION]`: Full 4-turn end-to-end conversation executed successfully against MongoDB and LLM. **PASS**

### Suite 3: `backend/scripts/testRecordViewerSmoke.js`
* **Command:** `node --env-file=.env scripts/testRecordViewerSmoke.js`
* **Result:** Exit code 0 (All 13 Checks Passed)
  - PDF preview buffer delivery with `%PDF-` header: **PASS**
  - PDF scroll and page markers: **PASS**
  - PDF download headers and size match: **PASS**
  - OCR extraction with caching: **PASS**
  - Full structured summary (no raw OCR text dump): **PASS**
  - Structured clinical findings extraction: **PASS**
  - Grounded Q&A (Blood pressure found vs blood group absent safe unknown): **PASS**
  - Doctor shared record access: **PASS**
  - Unauthorized patient access denial: **PASS**
  - Repeated OCR prevention: **PASS**

---

## 5. Remaining Issues & Environment Blockers

* **Quota Observation:** `gemini-3.5-flash` occasionally hits project rate limits during rapid consecutive test runs, triggering the built-in model fallback ladder to candidate models (`gemini-2.5-flash` / Groq fallback). All fallbacks executed cleanly without user-facing failures.
* **Environment Status:**
  - Frontend development server running on Vite (`localhost:5173`).
  - Backend development server running on Express (`localhost:5000`).
  - Database connectivity active and verified via MongoDB Atlas.
* **Sprint Complete:** All priority stabilization defects resolved, verified with focused regression tests, and confirmed against standing architectural rules. No new feature phase initiated.
