# 🏥 CareFlow — Full-Stack Healthcare Consultation & Clinic Management Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-care--flow.vercel.app-7C3AED?style=for-the-badge&logo=vercel)](https://care-flow-eosin.vercel.app)
[![React 19](https://img.shields.io/badge/React%2019-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![Google GenAI](https://img.shields.io/badge/Google%20Gemini%20AI-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![Razorpay](https://img.shields.io/badge/Razorpay-02042B?style=for-the-badge&logo=razorpay&logoColor=3395FF)](https://razorpay.com/)

> **CareFlow** is an enterprise-grade, multi-tenant healthcare consultation and clinic operations platform engineered with **React 19, Node.js, Express, MongoDB, Socket.IO, and Google Gemini AI**. It connects patients, medical practitioners, receptionists, organization administrators, and platform administrators through a centralized, deterministic state machine.

🌐 **Frontend Deployment:** [https://care-flow-eosin.vercel.app](https://care-flow-eosin.vercel.app)  
⚙️ **Backend Deployment:** Deployed on [Render](https://render.com)  

---

## 📑 Table of Contents
1. [Executive Summary](#-executive-summary)
2. [Problem Statement & Purpose](#-problem-statement--purpose)
3. [Comprehensive Role-Based Use Cases](#-comprehensive-role-based-use-cases)
   - [Patient Use Cases](#1-patient-use-cases)
   - [Doctor Use Cases](#2-doctor-use-cases)
   - [Receptionist / Front Desk Use Cases](#3-receptionist--front-desk-use-cases)
   - [Organization Administrator Use Cases](#4-organization-administrator-use-cases)
   - [Super Administrator Use Cases](#5-super-administrator-use-cases)
4. [Deterministic 10-Stage Appointment Lifecycle](#-deterministic-10-stage-appointment-lifecycle)
5. [System Architecture & Data Pipelines](#-system-architecture--data-pipelines)
6. [Core Technical Capabilities & Security](#-core-technical-capabilities--security)
7. [Technology Stack](#-technology-stack)
8. [Installation & Local Setup](#-installation--local-setup)

---

## 💡 Executive Summary
Modern clinical practices suffer from severe workflow fragmentation between patient scheduling, receptionist queues, physician consultation records, pharmacy fulfillment, and administrative billing. **CareFlow** resolves this by consolidating all hospital operations into a role-governed ecosystem supporting real-time WebSockets communication, multi-tenant RBAC, automated OCR document parsing, Gemini AI-assisted clinical diagnosis support, and automated Razorpay transactions.

---

## 🎯 Problem Statement & Purpose

### The Problems in Traditional Clinic Workflows:
- **Scheduling Conflicts & Waiting Delays:** Manual booking leads to double-booking, opaque practitioner availability, and frustrating waiting room queues.
- **Siloed Patient Records & Lost History:** Paper prescriptions and isolated spreadsheets risk missing allergy alerts, recurring chronic conditions, and previous diagnoses.
- **Security & Authorization Vulnerabilities:** Multi-role platforms often lack granular access controls, exposing sensitive HIPAA/PHI records to unauthorized personnel.
- **Manual Document Processing Bottlenecks:** Intake staff spend hours re-typing scanned patient records, insurance cards, and medical histories.

### The CareFlow Engineering Solution:
- **Deterministic State-Machine Lifecycle:** Every appointment transitions through 10 explicit states (from specialty selection to digital prescription archiving) with automated audit logging.
- **Granular Multi-Role RBAC:** 5 isolated persona dashboards (Patient, Doctor, Receptionist, Org Admin, Super Admin) with HTTP-only cookie JWT security.
- **AI-Assisted Diagnostics & OCR:** Integration with Google Gemini (`@google/genai`) for clinical insight generation and Tesseract.js for instant optical character recognition from medical uploads.
- **Integrated Payments & Telehealth:** Seamless Razorpay payment gateway verification, WebSockets messaging, and video consultation capabilities.

---

## 👥 Comprehensive Role-Based Use Cases

### 1. Patient Use Cases
| Use Case ID | Name | Description & Workflow |
| :--- | :--- | :--- |
| **UC-PAT-01** | **Patient Onboarding & Auth** | Register account with email, phone, and secure password. Authenticate via dual-token JWT stored in HTTP-only cookies. Maintain emergency contacts and blood group demographics. |
| **UC-PAT-02** | **Doctor & Department Discovery** | Search and filter clinical specialists by department (Cardiology, Neurology, Pediatrics, etc.), experience, languages, consultation fee, and available calendar days. |
| **UC-PAT-03** | **Interactive Slot Booking** | View live availability slots for a selected practitioner, lock a reservation slot, and transition the booking to the payment queue. |
| **UC-PAT-04** | **Payment & Invoice Settlement** | Pay consultation fees online via integrated Razorpay gateway (Credit/Debit Card, UPI, NetBanking) with automated digital receipt generation. |
| **UC-PAT-05** | **Consultation Participation** | Access in-person queue verification or join real-time telehealth video consultation directly within the browser. |
| **UC-PAT-06** | **Medical History & E-Prescriptions** | Access complete longitudinal health record: past consultation notes, lab orders, prescribed medications with dosages, and downloadable PDF prescriptions. |

---

### 2. Doctor Use Cases
| Use Case ID | Name | Description & Workflow |
| :--- | :--- | :--- |
| **UC-DOC-01** | **Physician Operations Dashboard** | Real-time overview of daily scheduled appointments, pending consultations, completed visits, and active patient queue metrics. |
| **UC-DOC-02** | **Availability & Schedule Control** | Configure weekly working hours, slot durations (e.g. 15, 30 mins), lunch breaks, and emergency leaves with instant slot recalculation. |
| **UC-DOC-03** | **Patient 360 & Medical History** | Review patient vitals, previous clinical encounters, known allergies, chronic conditions, and uploaded laboratory documents prior to consultation. |
| **UC-DOC-04** | **Consultation & Telehealth Engine** | Conduct high-definition video/audio consultation or document in-person clinical examination notes in real time. |
| **UC-DOC-05** | **AI-Assisted Diagnostic Insights** | Leverage Google Gemini AI to analyze clinical symptom summaries, cross-reference drug interactions, and format clinical notes. |
| **UC-DOC-06** | **Digital Prescription Generation** | Issue structured e-prescriptions specifying drug name, dosage, frequency, duration, and instructions. Automatically generate branded PDF prescriptions via Puppeteer. |
| **UC-DOC-07** | **Appointment Status Transition** | Advance appointment state from `Checked In` → `In Consultation` → `Prescription Issued` → `Completed`. |

---

### 3. Receptionist / Front Desk Use Cases
| Use Case ID | Name | Description & Workflow |
| :--- | :--- | :--- |
| **UC-REC-01** | **Physical Check-In & Queue Verification** | Verify arriving patients at the clinic front desk, confirm identity, and transition status to `Receptionist Verified / Checked In`. |
| **UC-REC-02** | **Walk-in Booking Coordination** | Schedule on-the-spot appointments for walk-in patients based on real-time doctor availability and emergency room priorities. |
| **UC-REC-03** | **Payment Verification & Cash Settlement** | Validate online payment status or record offline cash/POS settlements, updating the ledger instantly. |
| **UC-REC-04** | **Doctor Queue Monitoring** | Monitor wait times across consulting rooms and notify patients of any operational delays via live dashboard. |

---

### 4. Organization Administrator Use Cases
| Use Case ID | Name | Description & Workflow |
| :--- | :--- | :--- |
| **UC-ORG-01** | **Clinical Staff Management** | Onboard, verify credentials, and manage profiles for doctors, receptionists, and nursing personnel across branches. |
| **UC-ORG-02** | **Department & Specialty Setup** | Create and configure clinical departments, assign department heads, and allocate operational consultation suites. |
| **UC-ORG-03** | **Operational Policy & Fees** | Define clinic-wide appointment cancellation windows, refund policies, and consultation fee tiers. |
| **UC-ORG-04** | **Clinic Analytics & KPI Dashboard** | Access visual BI reports (powered by amCharts 5 & Recharts) tracking patient footfall, department revenue, doctor utilization rates, and average wait times. |

---

### 5. Super Administrator Use Cases
| Use Case ID | Name | Description & Workflow |
| :--- | :--- | :--- |
| **UC-ADM-01** | **Multi-Organization Governance** | Review, approve, and verify new clinic or hospital organization onboardings onto the CareFlow network. |
| **UC-ADM-02** | **Platform-Wide User Directory** | Global user oversight with permission audit logs, account suspensions, and role elevation controls. |
| **UC-ADM-03** | **Platform Financial Analytics** | Aggregate transaction volume, platform commission, active subscriptions, and payout settlement reports. |
| **UC-ADM-04** | **System Health & Rate Limiting** | Monitor API throughput, error logs, rate limiting thresholds (via `express-rate-limit`), and cloud storage quotas. |

---

## 📅 Deterministic 10-Stage Appointment Lifecycle

CareFlow models clinical appointments as a deterministic, audited state machine:

```text
┌──────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│  1. Patient  │ ──> │ 2. Department Select│ ──> │ 3. Doctor Select │
└──────────────┘     └─────────────────────┘     └──────────────────┘
                                                           │
                                                           ▼
┌──────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│6. Razorpay Tx│ <── │ 5. Book Appointment │ <── │4. Avail Slot Pick│
└──────────────┘     └─────────────────────┘     └──────────────────┘
       │
       ▼
┌──────────────────────────┐     ┌────────────────────────┐
│7. Front-Desk Verification│ ──> │ 8. Doctor Consultation │
└──────────────────────────┘     └────────────────────────┘
                                              │
                                              ▼
┌──────────────────────────┐     ┌────────────────────────┐
│ 10. Completed & Archived │ <── │ 9. E-Prescription / PDF│
└──────────────────────────┘     └────────────────────────┘
```

1. **Patient Registration/Login:** Authenticated session verified with protected client routing.
2. **Select Medical Department:** Filters doctors by clinical taxonomy (Cardiology, Dermatology, etc.).
3. **Select Doctor:** Profile review with credentials, consultation charges, and patient ratings.
4. **Select Available Slot:** Real-time query prevents double-booking and locks provisional slot.
5. **Book Appointment:** Creates pending reservation with deterministic expiration timer.
6. **Payment Processing:** Integrated Razorpay checkout verifying signature and settlement status.
7. **Receptionist Verification:** Clinic check-in confirming patient arrival and room assignment.
8. **Doctor Consultation:** In-person or WebRTC video consultation with live clinical note taking.
9. **Prescription / Medical Record:** Doctor inputs structured medications, lab orders, and advice; generates signed PDF.
10. **Appointment Completed:** Case archived into patient longitudinal record; triggers feedback and follow-up reminders.

---

## 🏗️ System Architecture & Data Pipelines

```text
[ Client Applications ]
├── Patient Portal (React 19 + Tailwind CSS v4 + Vite)
├── Doctor Workspace (Consultation Suite + Calendar)
├── Receptionist Desk (Queue Dispatcher)
└── Admin Dashboards (amCharts 5 + Recharts Analytics)
               │
               ▼ HTTPS (REST + JSON) & WSS (Socket.IO)
[ API Gateway & Security Layer (Express 5 + Helmet) ]
├── Rate Limiting (express-rate-limit)
├── CORS & Cookie Parser (HTTP-Only Refresh Tokens)
├── JWT Verification & RBAC Middleware
└── Input Validation & Sanitization (Zod)
               │
   ┌───────────┴───────────────────────────────┐
   ▼                                           ▼
[ Micro-Service Controllers ]         [ AI & Media Pipelines ]
├── Auth & User Controller             ├── Google Gemini AI Service
├── Appointment State Engine           ├── Tesseract OCR Document Parser
├── Department & Doctor Service        ├── Cloudinary Media Bucket
├── Prescription Generator (Puppeteer) └── Socket.IO Real-Time Dispatcher
└── Razorpay Payment Service                   │
   │                                           │
   └───────────────────┬───────────────────────┘
                       ▼
            [ MongoDB Database Layer ]
            ├── Users & Roles
            ├── Organizations & Clinics
            ├── Departments & Doctor Slots
            ├── Appointments (State Machine)
            └── Prescriptions & Health Records
```

---

## 🔒 Core Technical Capabilities & Security

- **Dual-Token Authentication Architecture:** Short-lived access tokens paired with cryptographically secure, rotating refresh tokens stored exclusively in `httpOnly`, `secure`, `sameSite=strict` cookies to prevent XSS and CSRF vectors.
- **Strict Role-Based Access Control (RBAC):** Middleware-level permission enforcement ensuring patients cannot inspect unauthorized records, and doctors are restricted to their assigned organizational scope.
- **Enterprise Defense & Rate Limiting:** Helmet HTTP security headers, CORS origin whitelisting, and `express-rate-limit` DDoS/brute-force defense.
- **OCR Document Extraction:** Embedded Tesseract.js engine parsing uploaded diagnostic scans and lab sheets directly into structured text.
- **Google Gemini Generative AI Integration:** Automated summarization of complex clinical records, assisting physicians in rapid consultation synthesis.
- **High-Fidelity PDF Generation:** Automated prescription document rendering via Puppeteer Core for pharmacy-ready exports.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Core** | React 19, Vite 8, React Router DOM 7 |
| **Styling & UI** | Tailwind CSS v4, Framer Motion, Lucide React, SweetAlert2 |
| **Data Visualization**| amCharts 5, Recharts |
| **Real-Time Layer** | Socket.IO Client, WebSockets |
| **Backend Runtime** | Node.js (ES Modules), Express 5 |
| **Database & ODM** | MongoDB, Mongoose 9 |
| **AI & Vision** | Google GenAI SDK (`@google/genai`), Tesseract.js (OCR) |
| **Security & Auth** | JSON Web Tokens (jsonwebtoken), bcrypt, Helmet, Cookie-Parser |
| **Payments** | Razorpay Node.js SDK |
| **Media & Documents**| Cloudinary, Puppeteer Core, Multer, Streamifier |
| **Validation** | Zod Schema Validation |
| **Deployment** | Vercel (Frontend), Render (Backend), MongoDB Atlas |

---

## 🚀 Installation & Local Setup

### Prerequisites
- Node.js 20+ installed
- MongoDB instance (local or MongoDB Atlas URI)
- Cloudinary account credentials
- Razorpay test API keys
- Google Gemini API key

### 1. Clone the Repository
```bash
git clone https://github.com/Manis30/CareFlow.git
cd CareFlow
```

### 2. Configure Backend
```bash
cd backend
npm install
```
Create a `.env` file in the `backend/` directory:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_ACCESS_SECRET=your_jwt_access_secret
JWT_REFRESH_SECRET=your_jwt_refresh_secret
CLIENT_URL=http://localhost:5173
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
GEMINI_API_KEY=your_gemini_api_key
```
Start the backend development server:
```bash
npm run dev
```

### 3. Configure Frontend
```bash
cd ../frontend
npm install
```
Start the frontend development server:
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 👤 Author
**MANI S** — *Full Stack MERN Developer*
- **Portfolio:** [manideveloper.vercel.app](https://manideveloper.vercel.app/)
- **GitHub:** [@Manis30](https://github.com/Manis30)
- **LinkedIn:** [linkedin.com/in/mani-s-515606376](https://www.linkedin.com/in/mani-s-515606376)
- **Email:** [mani30saravanan@gmail.com](mailto:mani30saravanan@gmail.com)

---

## 📄 License
This project is licensed under the ISC License.
