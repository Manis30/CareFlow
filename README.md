# 🏥 CareFlow

> A full-stack healthcare consultation and clinic management platform built with React, Node.js, Express, and MongoDB.

CareFlow is a role-based healthcare management platform designed to connect patients, doctors, receptionists, organization administrators, and platform administrators through a centralized system.

The platform supports appointment management, patient records, doctor workflows, payments, real-time communication, authentication, AI-assisted healthcare features, and administrative operations.

---

## 🌐 Live Demo

### Frontend
https://care-flow-eosin.vercel.app


> The backend is deployed on Render and the frontend is deployed on Vercel.

---

## ✨ Features

### 🔐 Authentication & Authorization

- JWT-based authentication
- Access token and refresh token mechanism
- HTTP-only authentication cookies
- Secure password hashing
- Role-based access control
- Protected routes
- Session verification
- Password reset workflow
- Profile management

### 👥 Role-Based Platform

CareFlow supports multiple user roles:

- **Super Admin**
- **Organization Admin**
- **Receptionist**
- **Doctor**
- **Patient**

Each role has its own permissions, workflows, dashboards, and responsibilities.

---

## 👨‍⚕️ Doctor Features

- Doctor dashboard
- Appointment management
- Patient information
- Medical records
- Prescription management
- Availability management
- Appointment status updates
- Doctor-patient communication
- Video consultation support

---

## 🧑‍💼 Receptionist Features

- Appointment queue management
- Patient registration
- Appointment scheduling
- Payment verification
- Appointment completion
- Doctor availability management
- Patient assistance

---

## 🏢 Organization Admin

Organization administrators can manage:

- Doctors
- Receptionists
- Departments
- Appointments
- Organization operations
- Clinic-level analytics

---

## 👑 Super Admin

Platform administrators can manage:

- Organizations
- Users
- Platform operations
- Approvals
- Analytics
- Revenue-related information
- System-level administration

---

## 🧑‍🦽 Patient Features

Patients can:

- Register and sign in
- Browse doctors
- Select departments
- Book appointments
- View appointments
- Manage their profile
- View medical information
- Access prescriptions
- Make payments
- Participate in consultations

---

## 📅 Appointment Management

CareFlow provides an appointment workflow for managing the complete appointment lifecycle.

```text
Patient
   ↓
Select Department
   ↓
Select Doctor
   ↓
Select Available Slot
   ↓
Book Appointment
   ↓
Payment
   ↓
Receptionist Verification
   ↓
Doctor Consultation
   ↓
Prescription / Medical Record
   ↓
Appointment Completed