import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cloudinary from "../config/cloudinary.js";
import { hashPassword } from "./bcrypt.js";
import { generateBusinessId, resetIdRegistry } from "./idGenerator.js";

import OrganizationModel from "../model/organization.js";
import UserModel from "../model/user.js";
import DepartmentModel from "../model/department.js";
import DoctorModel from "../model/doctor.js";
import PatientModel from "../model/patient.js";
import AppointmentModel from "../model/appointment.js";
import MedicalRecordModel from "../model/medicalRecord.js";
import PrescriptionModel from "../model/prescription.js";
import PaymentModel from "../model/payment.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_URL = process.env.DB_URL;
if (!DB_URL) throw new Error("DB_URL is missing in environment");

// Production safety safeguard
if (process.env.NODE_ENV === "production" || process.env.IS_PRODUCTION === "true") {
  console.error("FATAL: Demo data seed script cannot be executed in production environment!");
  process.exit(1);
}

const DEMO_PASSWORD = "12345678";

// =========================================================================
// 1. ORGANIZATIONS DEFINITIONS (8 Clinics in 5 Tamil Nadu Districts)
// =========================================================================
const CLINICS = [
  {
    name: "Chennai Metropolitan Health Institute",
    slug: "cmhi",
    district: "Chennai",
    city: "Chennai",
    area: "Anna Nagar",
    street: "14, 2nd Avenue, Anna Nagar West",
    pincode: "600040",
    phone: "+91 44 4210 5001",
    email: "contact.cmhi@demo-careflow.in",
    latitude: 13.0850,
    longitude: 80.2101,
    departments: [
      ["Cardiology", "Comprehensive adult & pediatric heart care"],
      ["Neurology", "Brain, spine, and nervous system disorders"],
      ["Orthopedics", "Bone, joint, and musculoskeletal sports care"],
      ["Pediatrics", "Specialized infant, child, and adolescent medicine"],
      ["General Medicine", "Primary healthcare and chronic disease prevention"]
    ],
    logoConcept: "lotus_cross",
    primaryColor: "#0284c7"
  },
  {
    name: "Adyar Anbu Multispeciality Centre",
    slug: "adyar-anbu",
    district: "Chennai",
    city: "Chennai",
    area: "Adyar",
    street: "42, Sardar Patel Road, Adyar",
    pincode: "600020",
    phone: "+91 44 4350 6002",
    email: "contact.adyaranbu@demo-careflow.in",
    latitude: 13.0012,
    longitude: 80.2565,
    departments: [
      ["Dermatology", "Medical, cosmetic, and surgical skin care"],
      ["ENT", "Ear, nose, throat, head and neck surgery"],
      ["Gynecology", "Women's wellness, prenatal, and reproductive care"],
      ["Diabetology", "Endocrine and metabolic diabetes management"],
      ["General Medicine", "Family medicine and adult healthcare"]
    ],
    logoConcept: "human_heart",
    primaryColor: "#e11d48"
  },
  {
    name: "Kovai Lakshmi Medical Centre",
    slug: "kovai-lakshmi",
    district: "Coimbatore",
    city: "Coimbatore",
    area: "RS Puram",
    street: "76, DB Road, RS Puram",
    pincode: "641002",
    phone: "+91 422 439 1003",
    email: "contact.kovailakshmi@demo-careflow.in",
    latitude: 11.0089,
    longitude: 76.9507,
    departments: [
      ["Pulmonology", "Respiratory, asthma, and chest medicine"],
      ["Orthopedics", "Joint replacement, spine, and trauma surgery"],
      ["Gastroenterology", "Digestive health, liver, and endoscopy care"],
      ["Cardiology", "Cardiovascular interventions and diagnostics"],
      ["General Medicine", "Internal medicine and adult wellness"]
    ],
    logoConcept: "river_cross",
    primaryColor: "#0d9488"
  },
  {
    name: "Siruvani Premier Clinic",
    slug: "siruvani-premier",
    district: "Coimbatore",
    city: "Coimbatore",
    area: "Peelamedu",
    street: "112, Avinashi Road, Peelamedu",
    pincode: "641004",
    phone: "+91 422 455 2004",
    email: "contact.siruvani@demo-careflow.in",
    latitude: 11.0264,
    longitude: 77.0142,
    departments: [
      ["Pediatrics", "Neonatal and child healthcare center"],
      ["Dermatology", "Clinical dermatology and allergy therapy"],
      ["Ophthalmology", "Comprehensive eye care, cataract, and retina care"],
      ["Gynecology", "Maternal-fetal medicine and women's health"],
      ["General Medicine", "Preventative health and chronic disease review"]
    ],
    logoConcept: "health_leaf",
    primaryColor: "#16a34a"
  },
  {
    name: "Sri Vaigai Multispeciality Hospital",
    slug: "sri-vaigai",
    district: "Madurai",
    city: "Madurai",
    area: "KK Nagar",
    street: "28, Kuruvikaran Salai, KK Nagar",
    pincode: "625020",
    phone: "+91 452 431 3005",
    email: "contact.srivaigai@demo-careflow.in",
    latitude: 9.9252,
    longitude: 78.1458,
    departments: [
      ["Cardiology", "Clinical cardiology and echocardiography"],
      ["Orthopedics", "Arthroscopic surgery and fracture clinic"],
      ["Neurology", "Epilepsy, stroke, and neuromuscular therapy"],
      ["Diabetology", "Comprehensive diabetic care & foot clinic"],
      ["General Medicine", "Geriatric care and infectious disease treatment"]
    ],
    logoConcept: "temple_cross",
    primaryColor: "#7c3aed"
  },
  {
    name: "Meenakshi Care Hospital",
    slug: "meenakshi-care",
    district: "Madurai",
    city: "Madurai",
    area: "Tallakulam",
    street: "54, Alagar Kovil Road, Tallakulam",
    pincode: "625002",
    phone: "+91 452 429 4006",
    email: "contact.meenakshicare@demo-careflow.in",
    latitude: 9.9360,
    longitude: 78.1340,
    departments: [
      ["Gynecology", "Obstetrics, fertility, and gynecology"],
      ["Pediatrics", "Child immunization and pediatric wellness"],
      ["ENT", "Microsurgery of ear and sinus endoscopy"],
      ["Gastroenterology", "Hepatology and luminal gastroenterology"],
      ["General Medicine", "Primary healthcare and acute care"]
    ],
    logoConcept: "heartbeat_hands",
    primaryColor: "#d97706"
  },
  {
    name: "Salem Varam Healthcare Centre",
    slug: "salem-varam",
    district: "Salem",
    city: "Salem",
    area: "Fairlands",
    street: "19, Brindavan Road, Fairlands",
    pincode: "636016",
    phone: "+91 427 433 5007",
    email: "contact.salemvaram@demo-careflow.in",
    latitude: 11.6748,
    longitude: 78.1407,
    departments: [
      ["Orthopedics", "Joint preservation and trauma management"],
      ["Cardiology", "Preventive cardiology and cardiac rehabilitation"],
      ["Pulmonology", "Allergy, sleep medicine, and chest disorders"],
      ["Diabetology", "Metabolic lifestyle and endocrine care"],
      ["General Medicine", "Family practice and clinical consultations"]
    ],
    logoConcept: "medical_shield",
    primaryColor: "#2563eb"
  },
  {
    name: "Cauvery Medical Institute",
    slug: "cauvery-medical",
    district: "Tiruchirappalli",
    city: "Tiruchirappalli",
    area: "Thillai Nagar",
    street: "35, Salai Road, Thillai Nagar",
    pincode: "620018",
    phone: "+91 431 432 6008",
    email: "contact.cauvery@demo-careflow.in",
    latitude: 10.8285,
    longitude: 78.6868,
    departments: [
      ["Gastroenterology", "Interventional GI and liver sciences"],
      ["Pediatrics", "General pediatrics and developmental wellness"],
      ["Dermatology", "Medical trichology and skin therapy"],
      ["Ophthalmology", "Vision therapy and anterior segment care"],
      ["General Medicine", "Internal medicine and adult wellness"]
    ],
    logoConcept: "cauvery_flow",
    primaryColor: "#0891b2"
  }
];

// =========================================================================
// 2. VECTOR LOGO GENERATOR (Symbol / Icon Only, Zero Text)
// =========================================================================
function generateSymbolLogoSvg(concept, color) {
  const svgs = {
    lotus_cross: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <rect width="200" height="200" rx="40" fill="#f0f9ff"/>
        <path d="M100 40 C70 80 40 120 70 150 C90 170 100 150 100 140 C100 150 110 170 130 150 C160 120 130 80 100 40 Z" fill="${color}" opacity="0.85"/>
        <path d="M60 100 C30 130 40 160 80 155 C60 140 55 120 60 100 Z" fill="${color}" opacity="0.6"/>
        <path d="M140 100 C170 130 160 160 120 155 C140 140 145 120 140 100 Z" fill="${color}" opacity="0.6"/>
        <rect x="92" y="80" width="16" height="40" rx="4" fill="#ffffff"/>
        <rect x="80" y="92" width="40" height="16" rx="4" fill="#ffffff"/>
      </svg>
    `,
    human_heart: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <rect width="200" height="200" rx="40" fill="#fff1f2"/>
        <path d="M100 160 C50 120 30 80 55 55 C75 35 95 50 100 65 C105 50 125 35 145 55 C170 80 150 120 100 160 Z" fill="${color}"/>
        <circle cx="100" cy="80" r="18" fill="#ffffff"/>
        <path d="M70 160 C85 140 115 140 130 160" stroke="#ffffff" stroke-width="8" stroke-linecap="round" fill="none"/>
      </svg>
    `,
    river_cross: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <rect width="200" height="200" rx="40" fill="#f0fdfa"/>
        <path d="M30 120 Q65 80 100 120 T170 120" stroke="${color}" stroke-width="18" fill="none" stroke-linecap="round"/>
        <path d="M30 150 Q65 110 100 150 T170 150" stroke="${color}" stroke-width="14" opacity="0.6" fill="none" stroke-linecap="round"/>
        <circle cx="100" cy="70" r="32" fill="${color}"/>
        <rect x="94" y="52" width="12" height="36" rx="3" fill="#ffffff"/>
        <rect x="82" y="64" width="36" height="12" rx="3" fill="#ffffff"/>
      </svg>
    `,
    health_leaf: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <rect width="200" height="200" rx="40" fill="#f0fdf4"/>
        <path d="M100 35 C150 35 165 95 140 145 C110 170 60 165 45 130 C30 80 60 35 100 35 Z" fill="${color}"/>
        <path d="M70 145 Q100 100 135 65" stroke="#ffffff" stroke-width="7" stroke-linecap="round" fill="none"/>
        <rect x="92" y="85" width="16" height="32" rx="3" fill="#ffffff" opacity="0.9"/>
        <rect x="84" y="93" width="32" height="16" rx="3" fill="#ffffff" opacity="0.9"/>
      </svg>
    `,
    temple_cross: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <rect width="200" height="200" rx="40" fill="#f5f3ff"/>
        <polygon points="100,35 125,75 75,75" fill="${color}"/>
        <polygon points="100,65 140,115 60,115" fill="${color}" opacity="0.85"/>
        <polygon points="100,100 155,165 45,165" fill="${color}" opacity="0.7"/>
        <rect x="93" y="115" width="14" height="36" rx="3" fill="#ffffff"/>
        <rect x="82" y="126" width="36" height="14" rx="3" fill="#ffffff"/>
      </svg>
    `,
    heartbeat_hands: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <rect width="200" height="200" rx="40" fill="#fffbeb"/>
        <circle cx="100" cy="100" r="65" fill="${color}" opacity="0.15"/>
        <path d="M40 105 L70 105 L82 70 L95 135 L108 85 L118 115 L126 105 L160 105" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M65 145 C80 165 120 165 135 145" stroke="${color}" stroke-width="7" stroke-linecap="round" fill="none"/>
      </svg>
    `,
    medical_shield: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <rect width="200" height="200" rx="40" fill="#eff6ff"/>
        <path d="M100 35 L155 55 C155 110 135 150 100 170 C65 150 45 110 45 55 Z" fill="${color}"/>
        <rect x="92" y="70" width="16" height="55" rx="4" fill="#ffffff"/>
        <rect x="72" y="90" width="56" height="16" rx="4" fill="#ffffff"/>
      </svg>
    `,
    cauvery_flow: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <rect width="200" height="200" rx="40" fill="#ecfeff"/>
        <circle cx="100" cy="100" r="65" fill="${color}"/>
        <path d="M55 90 C75 60 125 60 145 90 C165 120 115 140 100 150" stroke="#ffffff" stroke-width="8" fill="none" stroke-linecap="round"/>
        <circle cx="100" cy="98" r="14" fill="#ffffff"/>
      </svg>
    `
  };

  return (svgs[concept] || svgs.lotus_cross).trim();
}

async function uploadLogoToCloudinary(svgString, slug) {
  try {
    const base64Data = `data:image/svg+xml;base64,${Buffer.from(svgString).toString("base64")}`;
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: "careflow/organizations/logos",
      public_id: `logo_${slug}`,
      overwrite: true,
      resource_type: "image"
    });
    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (err) {
    console.warn(`[Cloudinary Warning] Upload failed for ${slug}: ${err.message}. Using high-fidelity vector data URI fallback.`);
    return {
      url: `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`,
      publicId: `fallback_logo_${slug}`
    };
  }
}

// =========================================================================
// 3. DETERMINISTIC GENDER-SPECIFIC PHOTO POOLS
// =========================================================================
const MALE_DOCTOR_IMAGES = [
  "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=500&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=500&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=500&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=500&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&auto=format&fit=crop&q=85"
];

const FEMALE_DOCTOR_IMAGES = [
  "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=500&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=500&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=500&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=500&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=500&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=85"
];

const MALE_PATIENT_IMAGES = [
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=85"
];

const FEMALE_PATIENT_IMAGES = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&auto=format&fit=crop&q=85",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=85"
];

// =========================================================================
// 4. CLINICAL NAMES & BLUEPRINTS (48 Doctors: 28 Male, 20 Female)
// =========================================================================
const DOCTOR_BLUEPRINTS = [
  // Clinic 1 (CMHI - Chennai): 4M, 2F
  { name: "R. Karthikeyan", gender: "Male", spec: "Cardiology", qual: "MBBS, MD, DM (Cardiology)", fee: 900 },
  { name: "S. Priyadharshini", gender: "Female", spec: "General Medicine", qual: "MBBS, MD (General Medicine)", fee: 650 },
  { name: "V. Arun Prakash", gender: "Male", spec: "Orthopedics", qual: "MBBS, MS (Orthopedics), DNB", fee: 850 },
  { name: "K. Harini Devi", gender: "Female", spec: "Pediatrics", qual: "MBBS, DCH, MD (Pediatrics)", fee: 700 },
  { name: "N. Balasubramanian", gender: "Male", spec: "Neurology", qual: "MBBS, MD, DM (Neurology)", fee: 950 },
  { name: "S. Vijay Anand", gender: "Male", spec: "General", qual: "MBBS, DNB (Family Medicine)", fee: 600 },

  // Clinic 2 (Adyar Anbu - Chennai): 3M, 3F
  { name: "P. Balaji Venkat", gender: "Male", spec: "Dermatology", qual: "MBBS, MD (Dermatology, Venereology & Leprosy)", fee: 800 },
  { name: "M. Kavitha", gender: "Female", spec: "Gynecology", qual: "MBBS, MS (Obstetrics & Gynecology), DGO", fee: 850 },
  { name: "T. Aravind Swamy", gender: "Male", spec: "ENT", qual: "MBBS, MS (ENT)", fee: 750 },
  { name: "R. Meenakshi", gender: "Female", spec: "Diabetology", qual: "MBBS, MD, Post Graduate Diploma in Diabetology", fee: 700 },
  { name: "M. Suresh Kumar", gender: "Male", spec: "General Medicine", qual: "MBBS, MD (General Medicine)", fee: 650 },
  { name: "V. Keerthana", gender: "Female", spec: "General", qual: "MBBS, MRCGP", fee: 550 },

  // Clinic 3 (Kovai Lakshmi - Coimbatore): 4M, 2F
  { name: "G. Vigneshwaran", gender: "Male", spec: "Pulmonology", qual: "MBBS, MD (Pulmonary Medicine), DTCD", fee: 850 },
  { name: "P. Deepa Lakshmi", gender: "Female", spec: "Cardiology", qual: "MBBS, MD, DM (Cardiology)", fee: 900 },
  { name: "D. Praveen Raj", gender: "Male", spec: "Orthopedics", qual: "MBBS, MS (Orthopedics)", fee: 800 },
  { name: "K. Ramesh Babu", gender: "Male", spec: "Gastroenterology", qual: "MBBS, MD, DM (Medical Gastroenterology)", fee: 950 },
  { name: "S. Nandhini", gender: "Female", spec: "General Medicine", qual: "MBBS, MD (Internal Medicine)", fee: 650 },
  { name: "A. Muthukumar", gender: "Male", spec: "General", qual: "MBBS, DNB", fee: 600 },

  // Clinic 4 (Siruvani Premier - Coimbatore): 3M, 3F
  { name: "A. Bhuvana", gender: "Female", spec: "Pediatrics", qual: "MBBS, MD (Pediatrics), FIAP", fee: 750 },
  { name: "S. Dinesh Kumar", gender: "Male", spec: "Dermatology", qual: "MBBS, DVD, MD (Dermatology)", fee: 800 },
  { name: "B. Saravanan", gender: "Male", spec: "Ophthalmology", qual: "MBBS, MS (Ophthalmology), DO", fee: 750 },
  { name: "D. Revathi", gender: "Female", spec: "Gynecology", qual: "MBBS, DGO, DNB (OBG)", fee: 850 },
  { name: "M. Ilango", gender: "Male", spec: "General Medicine", qual: "MBBS, MD (General Medicine)", fee: 650 },
  { name: "M. Gayathri", gender: "Female", spec: "General", qual: "MBBS, Dip. Diab", fee: 550 },

  // Clinic 5 (Sri Vaigai - Madurai): 4M, 2F
  { name: "V. Rajesh Kanna", gender: "Male", spec: "Cardiology", qual: "MBBS, MD, DM (Cardiology)", fee: 900 },
  { name: "T. Sridhar", gender: "Male", spec: "Orthopedics", qual: "MBBS, MS (Ortho), M.Ch (Ortho)", fee: 900 },
  { name: "K. Anitha", gender: "Female", spec: "Neurology", qual: "MBBS, MD, DM (Neurology)", fee: 950 },
  { name: "R. Manickam", gender: "Male", spec: "Diabetology", qual: "MBBS, MD, Dip. Diabetology", fee: 700 },
  { name: "T. Subhashini", gender: "Female", spec: "General Medicine", qual: "MBBS, MD (Internal Medicine)", fee: 650 },
  { name: "K. Jayaprakash", gender: "Male", spec: "General", qual: "MBBS, DNB (Family Medicine)", fee: 600 },

  // Clinic 6 (Meenakshi Care - Madurai): 3M, 3F
  { name: "S. Vidhya", gender: "Female", spec: "Gynecology", qual: "MBBS, MS (OBG), MRCOG", fee: 900 },
  { name: "S. Manikandan", gender: "Male", spec: "ENT", qual: "MBBS, MS (Otorhinolaryngology), DLO", fee: 750 },
  { name: "R. Sharmila", gender: "Female", spec: "Pediatrics", qual: "MBBS, DCH, DNB (Pediatrics)", fee: 700 },
  { name: "N. Sivakumar", gender: "Male", spec: "Gastroenterology", qual: "MBBS, MD, DM (Gastroenterology)", fee: 950 },
  { name: "P. Thirunavukkarasu", gender: "Male", spec: "General Medicine", qual: "MBBS, MD (General Medicine)", fee: 650 },
  { name: "V. Malathi", gender: "Female", spec: "General", qual: "MBBS", fee: 550 },

  // Clinic 7 (Salem Varam - Salem): 4M, 2F
  { name: "M. Annamalai", gender: "Male", spec: "Orthopedics", qual: "MBBS, MS (Orthopedics), D.Ortho", fee: 850 },
  { name: "V. Senthil Murugan", gender: "Male", spec: "Cardiology", qual: "MBBS, MD, DM (Cardiology)", fee: 900 },
  { name: "P. Jayashree", gender: "Female", spec: "Pulmonology", qual: "MBBS, MD (Pulmonary Medicine)", fee: 800 },
  { name: "G. Mohanraj", gender: "Male", spec: "Diabetology", qual: "MBBS, C.Diab, MD", fee: 700 },
  { name: "N. Radhika", gender: "Female", spec: "General Medicine", qual: "MBBS, MD (Internal Medicine)", fee: 650 },
  { name: "C. Gunasekaran", gender: "Male", spec: "General", qual: "MBBS, Dip. Family Med", fee: 600 },

  // Clinic 8 (Cauvery Medical - Trichy): 3M, 3F
  { name: "R. Vetrivel", gender: "Male", spec: "Gastroenterology", qual: "MBBS, MD, DM (Gastroenterology)", fee: 950 },
  { name: "M. Soundarya", gender: "Female", spec: "Pediatrics", qual: "MBBS, MD (Pediatrics)", fee: 750 },
  { name: "K. Ramachandran", gender: "Male", spec: "Ophthalmology", qual: "MBBS, MS (Ophthalmology)", fee: 750 },
  { name: "S. Yamuna", gender: "Female", spec: "Dermatology", qual: "MBBS, MD (Dermatology)", fee: 800 },
  { name: "K. Senthil Kumar", gender: "Male", spec: "General Medicine", qual: "MBBS, MD (General Medicine)", fee: 650 },
  { name: "K. Kalpana", gender: "Female", spec: "General", qual: "MBBS, DNB", fee: 550 }
];

// =========================================================================
// 5. PATIENT DIRECTORY SEED POOL (90 Patients: 48 Male, 42 Female)
// =========================================================================
const RAW_PATIENTS_DATA = [
  // 48 Males
  { name: "Arun Kumar", gender: "male", district: "Chennai", city: "Chennai", pincode: "600042", blood: "O+", age: 34 },
  { name: "Karthik Raj", gender: "male", district: "Coimbatore", city: "Coimbatore", pincode: "641018", blood: "A+", age: 41 },
  { name: "Vignesh R", gender: "male", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620021", blood: "B+", age: 29 },
  { name: "Sathish Kumar", gender: "male", district: "Salem", city: "Salem", pincode: "636007", blood: "AB+", age: 52 },
  { name: "Naveen Prakash", gender: "male", district: "Madurai", city: "Madurai", pincode: "625010", blood: "O-", age: 38 },
  { name: "Sanjay Kumar", gender: "male", district: "Chennai", city: "Chennai", pincode: "600091", blood: "A-", age: 45 },
  { name: "Dinesh B", gender: "male", district: "Madurai", city: "Madurai", pincode: "625003", blood: "B+", age: 26 },
  { name: "Mohan Raj", gender: "male", district: "Salem", city: "Salem", pincode: "636004", blood: "O+", age: 60 },
  { name: "Rahul S", gender: "male", district: "Chennai", city: "Chennai", pincode: "600083", blood: "AB-", age: 31 },
  { name: "Praveen Kumar", gender: "male", district: "Coimbatore", city: "Coimbatore", pincode: "641002", blood: "A+", age: 48 },
  { name: "Suresh Babu", gender: "male", district: "Coimbatore", city: "Coimbatore", pincode: "641035", blood: "B+", age: 55 },
  { name: "Ashok Kumar", gender: "male", district: "Salem", city: "Salem", pincode: "636009", blood: "O+", age: 39 },
  { name: "Gokul S", gender: "male", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620018", blood: "A+", age: 24 },
  { name: "Vijay Narayanan", gender: "male", district: "Chennai", city: "Chennai", pincode: "600028", blood: "O+", age: 63 },
  { name: "Muthuvel K", gender: "male", district: "Madurai", city: "Madurai", pincode: "625020", blood: "B+", age: 44 },
  { name: "Balakrishnan R", gender: "male", district: "Coimbatore", city: "Coimbatore", pincode: "641044", blood: "AB+", age: 58 },
  { name: "Saravana Perumal", gender: "male", district: "Salem", city: "Salem", pincode: "636016", blood: "A-", age: 36 },
  { name: "Rangarajan M", gender: "male", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620001", blood: "O+", age: 67 },
  { name: "Kishore Kumar", gender: "male", district: "Chennai", city: "Chennai", pincode: "600040", blood: "B-", age: 28 },
  { name: "Jayachandran P", gender: "male", district: "Madurai", city: "Madurai", pincode: "625002", blood: "A+", age: 51 },
  { name: "Sridharan V", gender: "male", district: "Coimbatore", city: "Coimbatore", pincode: "641012", blood: "O+", age: 43 },
  { name: "Manoharan T", gender: "male", district: "Salem", city: "Salem", pincode: "636001", blood: "B+", age: 62 },
  { name: "Pradeep Raj", gender: "male", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620005", blood: "O-", age: 33 },
  { name: "Velmurugan S", gender: "male", district: "Madurai", city: "Madurai", pincode: "625016", blood: "A+", age: 49 },
  { name: "Hariharan R", gender: "male", district: "Chennai", city: "Chennai", pincode: "600017", blood: "B+", age: 27 },
  { name: "Chandrasekar K", gender: "male", district: "Coimbatore", city: "Coimbatore", pincode: "641004", blood: "AB+", age: 56 },
  { name: "Ganesan P", gender: "male", district: "Salem", city: "Salem", pincode: "636008", blood: "O+", age: 65 },
  { name: "Subramanian V", gender: "male", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620015", blood: "A-", age: 70 },
  { name: "Shankar Ganesh", gender: "male", district: "Chennai", city: "Chennai", pincode: "600100", blood: "B+", age: 37 },
  { name: "Anandharaj M", gender: "male", district: "Madurai", city: "Madurai", pincode: "625009", blood: "O+", age: 42 },
  { name: "Elango N", gender: "male", district: "Salem", city: "Salem", pincode: "636002", blood: "A+", age: 50 },
  { name: "Balamurugan C", gender: "male", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620020", blood: "B-", age: 35 },
  { name: "Gajendran S", gender: "male", district: "Chennai", city: "Chennai", pincode: "600034", blood: "O+", age: 59 },
  { name: "Muruganandam K", gender: "male", district: "Coimbatore", city: "Coimbatore", pincode: "641006", blood: "AB-", age: 46 },
  { name: "Rameshkumar A", gender: "male", district: "Madurai", city: "Madurai", pincode: "625014", blood: "A+", age: 32 },
  { name: "Selvaraj P", gender: "male", district: "Salem", city: "Salem", pincode: "636015", blood: "B+", age: 61 },
  { name: "Kannan V", gender: "male", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620008", blood: "O-", age: 40 },
  { name: "Gurunathan M", gender: "male", district: "Chennai", city: "Chennai", pincode: "600020", blood: "A+", age: 54 },
  { name: "Rajasekaran T", gender: "male", district: "Coimbatore", city: "Coimbatore", pincode: "641014", blood: "O+", age: 68 },
  { name: "Vinoth Kumar", gender: "male", district: "Madurai", city: "Madurai", pincode: "625005", blood: "B+", age: 30 },
  { name: "Arivazhagan S", gender: "male", district: "Salem", city: "Salem", pincode: "636005", blood: "A-", age: 47 },
  { name: "Thirumalai N", gender: "male", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620017", blood: "AB+", age: 53 },
  { name: "Jaganathan R", gender: "male", district: "Chennai", city: "Chennai", pincode: "600045", blood: "O+", age: 64 },
  { name: "Ravi Shankar", gender: "male", district: "Coimbatore", city: "Coimbatore", pincode: "641028", blood: "B+", age: 38 },
  { name: "Sivakumar P", gender: "male", district: "Madurai", city: "Madurai", pincode: "625012", blood: "A+", age: 43 },
  { name: "Nagarajan M", gender: "male", district: "Salem", city: "Salem", pincode: "636003", blood: "O-", age: 57 },
  { name: "Senthil Nathan", gender: "male", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620003", blood: "B-", age: 36 },
  { name: "Dhanasekaran K", gender: "male", district: "Chennai", city: "Chennai", pincode: "600085", blood: "A+", age: 49 },

  // 42 Females
  { name: "Priya S", gender: "female", district: "Chennai", city: "Chennai", pincode: "600034", blood: "B+", age: 32 },
  { name: "Keerthana M", gender: "female", district: "Madurai", city: "Madurai", pincode: "625016", blood: "O+", age: 28 },
  { name: "Harini S", gender: "female", district: "Salem", city: "Salem", pincode: "636007", blood: "A+", age: 35 },
  { name: "Divya Lakshmi", gender: "female", district: "Coimbatore", city: "Coimbatore", pincode: "641002", blood: "AB+", age: 40 },
  { name: "Aishwarya R", gender: "female", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620018", blood: "O-", age: 25 },
  { name: "Nithya Devi", gender: "female", district: "Coimbatore", city: "Coimbatore", pincode: "641012", blood: "A-", age: 47 },
  { name: "Swetha R", gender: "female", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620008", blood: "B+", age: 29 },
  { name: "Anitha P", gender: "female", district: "Madurai", city: "Madurai", pincode: "625020", blood: "O+", age: 51 },
  { name: "Deepa K", gender: "female", district: "Salem", city: "Salem", pincode: "636016", blood: "A+", age: 38 },
  { name: "Janani M", gender: "female", district: "Chennai", city: "Chennai", pincode: "600040", blood: "AB-", age: 33 },
  { name: "Lavanya S", gender: "female", district: "Madurai", city: "Madurai", pincode: "625003", blood: "O+", age: 42 },
  { name: "Meena R", gender: "female", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620006", blood: "B+", age: 58 },
  { name: "Sangeetha N", gender: "female", district: "Coimbatore", city: "Coimbatore", pincode: "641018", blood: "A+", age: 36 },
  { name: "Kavitha R", gender: "female", district: "Salem", city: "Salem", pincode: "636004", blood: "O-", age: 44 },
  { name: "Pavithra M", gender: "female", district: "Chennai", city: "Chennai", pincode: "600091", blood: "B-", age: 27 },
  { name: "Gayathri S", gender: "female", district: "Madurai", city: "Madurai", pincode: "625010", blood: "A+", age: 49 },
  { name: "Malathi K", gender: "female", district: "Coimbatore", city: "Coimbatore", pincode: "641035", blood: "O+", age: 62 },
  { name: "Saranya V", gender: "female", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620021", blood: "AB+", age: 30 },
  { name: "Shanthi P", gender: "female", district: "Salem", city: "Salem", pincode: "636009", blood: "B+", age: 56 },
  { name: "Revathi T", gender: "female", district: "Chennai", city: "Chennai", pincode: "600083", blood: "O+", age: 65 },
  { name: "Yamuna Devi", gender: "female", district: "Madurai", city: "Madurai", pincode: "625002", blood: "A-", age: 39 },
  { name: "Suganya R", gender: "female", district: "Coimbatore", city: "Coimbatore", pincode: "641044", blood: "B+", age: 34 },
  { name: "Bhavani S", gender: "female", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620001", blood: "O+", age: 53 },
  { name: "Geetha M", gender: "female", district: "Salem", city: "Salem", pincode: "636014", blood: "A+", age: 48 },
  { name: "Menaka K", gender: "female", district: "Chennai", city: "Chennai", pincode: "600028", blood: "AB-", age: 31 },
  { name: "Subhashini V", gender: "female", district: "Madurai", city: "Madurai", pincode: "625008", blood: "O-", age: 46 },
  { name: "Vanitha R", gender: "female", district: "Coimbatore", city: "Coimbatore", pincode: "641008", blood: "B+", age: 57 },
  { name: "Uma Maheswari", gender: "female", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620011", blood: "A+", age: 66 },
  { name: "Indhumathi S", gender: "female", district: "Salem", city: "Salem", pincode: "636006", blood: "O+", age: 29 },
  { name: "Karpagam P", gender: "female", district: "Chennai", city: "Chennai", pincode: "600018", blood: "B+", age: 61 },
  { name: "Radha Lakshmi", gender: "female", district: "Madurai", city: "Madurai", pincode: "625018", blood: "A-", age: 54 },
  { name: "Hemalatha T", gender: "female", district: "Coimbatore", city: "Coimbatore", pincode: "641020", blood: "AB+", age: 43 },
  { name: "Soundarya R", gender: "female", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620014", blood: "O+", age: 26 },
  { name: "Vijaya Kumari", gender: "female", district: "Salem", city: "Salem", pincode: "636011", blood: "B-", age: 69 },
  { name: "Dharani M", gender: "female", district: "Chennai", city: "Chennai", pincode: "600042", blood: "A+", age: 28 },
  { name: "Nandhitha S", gender: "female", district: "Madurai", city: "Madurai", pincode: "625006", blood: "O-", age: 35 },
  { name: "Brindha K", gender: "female", district: "Coimbatore", city: "Coimbatore", pincode: "641030", blood: "B+", age: 50 },
  { name: "Chitra Devi", gender: "female", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620004", blood: "A+", age: 63 },
  { name: "Gomathi V", gender: "female", district: "Salem", city: "Salem", pincode: "636012", blood: "O+", age: 45 },
  { name: "Archana P", gender: "female", district: "Chennai", city: "Chennai", pincode: "600096", blood: "AB+", age: 33 },
  { name: "Kaviyarasu S", gender: "female", district: "Madurai", city: "Madurai", pincode: "625015", blood: "B+", age: 37 },
  { name: "Lalitha M", gender: "female", district: "Tiruchirappalli", city: "Tiruchirappalli", pincode: "620009", blood: "O+", age: 71 }
];

// =========================================================================
// 6. CLINICAL CATALOG (Departments -> Symptoms, Diagnoses, Medications)
// =========================================================================
const CLINICAL_CATALOG = {
  Cardiology: {
    reasons: [
      { text: "Hypertension periodic review", mode: "online", complaint: "Follow-up for essential blood pressure control", obs: "BP: 136/84 mmHg, HR: 74 bpm, S1 S2 heard normal", diag: "Essential Hypertension (Stage 1)", plan: "Continue current antihypertensive therapy, low sodium diet", meds: [{ name: "Telmisartan", dose: "40 mg", freq: "Once daily morning", dur: "30 days", inst: "Take before breakfast" }] },
      { text: "Exertional palpitations evaluation", mode: "offline", complaint: "Intermittent fluttering sensation in chest on brisk walking", obs: "BP: 128/82 mmHg, HR: 82 bpm, regular rhythm, ECG normal sinus", diag: "Sinus Tachycardia - Anxiety/Exertional", plan: "Electrolyte profile, thyroid panel, 24h Holter if persistent", meds: [{ name: "Metoprolol Succinate", dose: "25 mg", freq: "Once daily morning", dur: "15 days", inst: "Monitor resting pulse" }] },
      { text: "Cardiovascular risk screening", mode: "offline", complaint: "Family history of early coronary artery disease", obs: "BP: 130/86 mmHg, BMI: 26.2, Lipid profile reviewed", diag: "Dyslipidemia with Moderate CV Risk", plan: "Lifestyle modification, 30 min daily brisk walking", meds: [{ name: "Atorvastatin", dose: "10 mg", freq: "Once daily at bedtime", dur: "30 days", inst: "Lipid profile repeat in 3 months" }] }
    ]
  },
  Orthopedics: {
    reasons: [
      { text: "Bilateral knee joint pain", mode: "offline", complaint: "Stiffness and crepitus in both knees while climbing stairs", obs: "Mild joint effusion right knee, range of motion 0-115 deg, no ligament laxity", diag: "Primary Osteoarthritis of Bilateral Knees", plan: "Quadriceps strengthening exercises, avoid deep squatting", meds: [{ name: "Aceclofenac + Paracetamol", dose: "100mg/325mg", freq: "Twice daily after meals", dur: "7 days", inst: "Take with food" }, { name: "Calcium + Vitamin D3", dose: "500mg/400IU", freq: "Once daily after dinner", dur: "30 days", inst: "Daily supplementation" }] },
      { text: "Mechanical low back strain", mode: "offline", complaint: "Aching pain in lumbosacral region after lifting weight", obs: "Paravertebral lumbar muscle spasm, straight leg raise negative bilaterally", diag: "Acute Lumbar Muscular Strain", plan: "Core stabilization physiotherapy, lumbar support belt during travel", meds: [{ name: "Thiocolchicoside + Paracetamol", dose: "4mg/325mg", freq: "Twice daily", dur: "5 days", inst: "Muscle relaxant, avoid driving" }] },
      { text: "Post-fracture rehabilitation review", mode: "online", complaint: "Progress check for right wrist range of motion", obs: "Surgical scar well healed, grip strength 80% recovered", diag: "Healed Distal Radius Fracture - Rehab Phase", plan: "Active wrist flexion-extension drills, stress ball therapy", meds: [] }
    ]
  },
  Pediatrics: {
    reasons: [
      { text: "Acute febrile illness", mode: "offline", complaint: "High fever and runny nose for 2 days in child", obs: "Temp: 101.2 F, Throat congested, chest clear, no rashes", diag: "Acute Viral Upper Respiratory Infection", plan: "Frequent oral fluids, fever sponging if temp > 100 F", meds: [{ name: "Paracetamol Oral Suspension", dose: "250mg/5ml (5 ml)", freq: "Every 6 hours SOS for fever", dur: "3 days", inst: "Shake well before use" }] },
      { text: "Childhood bronchial wheeze review", mode: "offline", complaint: "Nocturnal dry cough and wheezing triggered by dust", obs: "Bilateral expiratory rhonchi, RR: 24/min, SpO2: 98% on room air", diag: "Mild Intermittent Asthma / Reactive Airway", plan: "Metered dose inhaler with spacer demo provided to parents", meds: [{ name: "Salbutamol Inhaler (100mcg)", dose: "2 puffs", freq: "As needed during wheeze", dur: "10 days", inst: "Use with aerochamber spacer" }] },
      { text: "Routine growth assessment & vaccination", mode: "offline", complaint: "Scheduled developmental milestones review", obs: "Weight: 50th percentile, height: 60th percentile, developmental milestones age-appropriate", diag: "Well-Child Health Assessment", plan: "Age-specific immunization administered according to TN schedule", meds: [] }
    ]
  },
  Dermatology: {
    reasons: [
      { text: "Facial acne vulgaris follow-up", mode: "online", complaint: "Inflammatory papules on forehead and cheeks", obs: "Moderate comedones and pustules, post-inflammatory erythema", diag: "Moderate Inflammatory Acne Vulgaris", plan: "Gentle non-comedogenic cleanser twice daily, strict sunscreen use", meds: [{ name: "Adapalene + Benzoyl Peroxide Gel", dose: "0.1%/2.5%", freq: "Once daily at night", dur: "30 days", inst: "Apply pea-sized amount on dry skin" }] },
      { text: "Acute allergic urticaria / skin allergy", mode: "offline", complaint: "Pruritic erythematous wheals over torso and limbs", obs: "Raised evanescent wheals, dermographism positive, no lip swelling", diag: "Acute Idiopathic Urticaria", plan: "Avoid known dietary triggers, cool water compress", meds: [{ name: "Levocetirizine", dose: "5 mg", freq: "Once daily night", dur: "10 days", inst: "Non-sedating antihistamine" }] },
      { text: "Chronic eczema lesion evaluation", mode: "offline", complaint: "Dry, lichenified scaly patches over flexural creases", obs: "Erythema and excoriation in antecubital fossa bilaterally", diag: "Subacute Atopic Dermatitis", plan: "Liberal emollient application within 3 mins of bathing", meds: [{ name: "Hydrocortisone Cream 1%", dose: "Topical", freq: "Twice daily", dur: "7 days", inst: "Apply thin layer to affected patches" }] }
    ]
  },
  Neurology: {
    reasons: [
      { text: "Chronic migraine management", mode: "online", complaint: "Unilateral throbbing headache with photophobia 3 times a month", obs: "Neurological exam normal, fundus examination normal", diag: "Migraine without Aura", plan: "Headache diary maintenance, sleep hygiene, avoid skipping meals", meds: [{ name: "Naproxen", dose: "500 mg", freq: "At onset of headache", dur: "10 days", inst: "Take with meal at earliest symptom" }, { name: "Propranolol", dose: "40 mg", freq: "Once daily", dur: "30 days", inst: "Prophylaxis therapy" }] },
      { text: "Peripheral diabetic neuropathy review", mode: "offline", complaint: "Burning sensation and tingling in bilateral soles at night", obs: "Impaired vibration sense at great toes, ankle jerks diminished", diag: "Distal Symmetrical Sensory Polyneuropathy", plan: "Strict glycemic control, protective diabetic footwear", meds: [{ name: "Pregabalin + Methylcobalamin", dose: "75mg/1500mcg", freq: "Once daily at bedtime", dur: "30 days", inst: "Helps nocturnal tingling pain" }] }
    ]
  },
  Gynecology: {
    reasons: [
      { text: "Routine antenatal trimester checkup", mode: "offline", complaint: "Second trimester routine screening and fetal wellness", obs: "Fundal height corresponds to gestational age, FHS: 142 bpm, BP: 116/74 mmHg", diag: "Intrauterine Gestation 22 Weeks - Stable", plan: "Anomaly scan reviewed normal, maintain hydration", meds: [{ name: "Ferrous Ascorbate + Folic Acid", dose: "100mg/1.5mg", freq: "Once daily after food", dur: "30 days", inst: "Iron supplementation" }, { name: "Calcium Carbonate", dose: "500 mg", freq: "Once daily", dur: "30 days", inst: "Do not take along with iron" }] },
      { text: "Menstrual irregularity & PCOS evaluation", mode: "online", complaint: "Oligomenorrhea and facial hair growth over past 6 months", obs: "BMI: 25.4, USG pelvis findings consistent with polycystic ovarian morphology", diag: "Polycystic Ovarian Syndrome (PCOS)", plan: "Dietary glycemic control, regular cardiovascular exercise 45 mins", meds: [{ name: "Myo-Inositol + D-Chiro Inositol", dose: "2000mg/50mg", freq: "Once daily morning", dur: "60 days", inst: "Metabolic support" }] }
    ]
  },
  ENT: {
    reasons: [
      { text: "Chronic maxillary sinusitis review", mode: "offline", complaint: "Facial pressure, postnasal drip, and nasal blockage", obs: "Mucosal congestion in middle meatus, tender over maxillary sinuses", diag: "Chronic Maxillary Sinusitis", plan: "Steam inhalation twice daily, saline nasal rinse", meds: [{ name: "Amoxicillin + Clavulanic Acid", dose: "625 mg", freq: "Twice daily after food", dur: "7 days", inst: "Complete full antibiotic course" }, { name: "Fluticasone Furoate Nasal Spray", dose: "27.5 mcg", freq: "2 sprays each nostril daily", dur: "30 days", inst: "Shake before use" }] },
      { text: "Acute pharyngitis & odynophagia", mode: "offline", complaint: "Severe throat pain and difficulty swallowing for 3 days", obs: "Posterior pharyngeal wall congested, uvula midline, no peritonsillar bulge", diag: "Acute Viral Pharyngitis", plan: "Warm saline gargle 4 times daily, soft warm diet", meds: [{ name: "Paracetamol", dose: "650 mg", freq: "Thrice daily after meals", dur: "5 days", inst: "For throat pain relief" }] }
    ]
  },
  Gastroenterology: {
    reasons: [
      { text: "Gastroesophageal reflux & heartburn", mode: "online", complaint: "Retrosternal burning sensation worsening on lying down", obs: "Abdomen soft, epigastric tenderness mild, bowel sounds normal", diag: "Gastroesophageal Reflux Disease (GERD)", plan: "Avoid spicy food, dinner 3 hours prior to sleep, elevate head end", meds: [{ name: "Pantoprazole + Domperidone", dose: "40mg/30mg", freq: "Once daily before breakfast", dur: "14 days", inst: "Take 30 mins before first meal" }] },
      { text: "Dyspepsia and functional bloating review", mode: "offline", complaint: "Early satiety, epigastric fullness after modest meals", obs: "No organomegaly, negative for alarm features", diag: "Non-Ulcer Functional Dyspepsia", plan: "Small frequent meals, high fiber intake", meds: [{ name: "Itopride Hydrochloride", dose: "50 mg", freq: "Thrice daily before meals", dur: "10 days", inst: "Prokinetic agent" }] }
    ]
  },
  Pulmonology: {
    reasons: [
      { text: "Bronchial asthma seasonal monitoring", mode: "online", complaint: "Morning chest tightness and cough during winter changes", obs: "Chest clear on auscultation, SpO2: 99% on ambient air", diag: "Persistent Bronchial Asthma - Controlled", plan: "Continue inhaler compliance, avoid cold mist exposure", meds: [{ name: "Budesonide + Formoterol Inhaler", dose: "200mcg/6mcg", freq: "2 puffs twice daily", dur: "30 days", inst: "Rinse mouth thoroughly after inhalation" }] },
      { text: "Post-viral persistent dry cough", mode: "offline", complaint: "Tickling dry cough persisting 3 weeks after viral fever", obs: "Bilateral vesicular breath sounds, no focal crepitations", diag: "Post-Infectious Airway Hyper-reactivity", plan: "Avoid cold beverages, warm hydration", meds: [{ name: "Montelukast + Levocetirizine", dose: "10mg/5mg", freq: "Once daily at bedtime", dur: "10 days", inst: "Nightly tablet" }] }
    ]
  },
  Diabetology: {
    reasons: [
      { text: "Type 2 diabetes HbA1c review", mode: "online", complaint: "Quarterly follow-up for blood glucose assessment", obs: "Fasting BG: 122 mg/dL, Postprandial BG: 168 mg/dL, HbA1c: 7.1%", diag: "Type 2 Diabetes Mellitus - Moderate Control", plan: "Strict low-carb diabetic diet, 40 mins brisk walking daily", meds: [{ name: "Metformin Hydrochloride", dose: "500 mg", freq: "Twice daily after meals", dur: "30 days", inst: "Take with breakfast and dinner" }, { name: "Teneligliptin", dose: "20 mg", freq: "Once daily morning", dur: "30 days", inst: "DPP-4 inhibitor" }] },
      { text: "Diabetic neuropathy & foot screening", mode: "offline", complaint: "Routine annual foot examination in long-standing diabetic", obs: "Pedal pulses palpable, monofilament 10g intact in all 10 sites", diag: "Type 2 Diabetes - Healthy Foot Screen", plan: "Annual podiatric review, daily self-inspection of feet", meds: [] }
    ]
  },
  Ophthalmology: {
    reasons: [
      { text: "Computer vision syndrome & asthenopia", mode: "offline", complaint: "Dry eyes, burning sensation, and headache after screen work", obs: "Visual acuity 6/6 bilaterally, tear breakup time reduced at 7s", diag: "Bilateral Dry Eye Syndrome & Digital Eye Strain", plan: "Follow 20-20-20 rule, adjust workstation screen glare", meds: [{ name: "Carboxymethylcellulose Eye Drops 0.5%", dose: "1 drop", freq: "4 times daily in both eyes", dur: "30 days", inst: "Preservative-free lubricating tears" }] },
      { text: "Annual diabetic retinopathy fundus screening", mode: "offline", complaint: "Dilated fundus evaluation for diabetic microvascular changes", obs: "Macula flat, clear media, no microaneurysms, no hard exudates", diag: "Diabetes Mellitus without Retinopathy", plan: "Repeat dilated fundus examination in 12 months", meds: [] }
    ]
  },
  GeneralMedicine: {
    reasons: [
      { text: "Seasonal viral fever follow-up", mode: "online", complaint: "Recovery assessment following acute febrile episode", obs: "Afebril, vitals stable, appetite restored", diag: "Convalescent Viral Fever", plan: "Nutritious balanced diet, adequate hydration", meds: [{ name: "Multivitamin with Zinc Capsule", dose: "1 capsule", freq: "Once daily after lunch", dur: "15 days", inst: "General convalescence support" }] },
      { text: "General fatigue & wellness evaluation", mode: "offline", complaint: "Tiredness, lethargy, and mild unrefreshing sleep", obs: "Mild pallor, heart sounds normal, thyroid gland normal size", diag: "Nutritional Anemia / Generalized Fatigue", plan: "Diet rich in green leafy vegetables, dates, and legumes", meds: [{ name: "Ferrous Ascorbate + Folic Acid", dose: "100mg/1.5mg", freq: "Once daily night", dur: "30 days", inst: "Take with orange juice / water" }] },
      { text: "Acute gastrointestinal discomfort", mode: "offline", complaint: "Nausea, cramping abdominal pain after outside food", obs: "Diffuse abdominal tenderness, hyperactive bowel sounds", diag: "Acute Gastroenteritis - Resolving", plan: "Oral rehydration solution (ORS), light curd rice diet", meds: [{ name: "Oral Rehydration Salts (ORS)", dose: "1 sachet in 1L water", freq: "Sip throughout the day", dur: "3 days", inst: "Hydration replacement" }] }
    ]
  }
};

// Map department names to catalog keys
function getCatalogKeyForDept(deptName) {
  const clean = (deptName || "").replace(/\s+/g, "");
  if (clean.toLowerCase().includes("general")) return "GeneralMedicine";
  return clean;
}

// =========================================================================
// 7. TIME SLOTS & WORKING HOURS HELPERS
// =========================================================================
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const DAILY_TIME_SLOTS = [
  { startTime: "09:00", endTime: "09:30" },
  { startTime: "09:30", endTime: "10:00" },
  { startTime: "10:00", endTime: "10:30" },
  { startTime: "10:30", endTime: "11:00" },
  { startTime: "11:00", endTime: "11:30" },
  { startTime: "11:30", endTime: "12:00" },
  { startTime: "14:00", endTime: "14:30" },
  { startTime: "14:30", endTime: "15:00" },
  { startTime: "15:00", endTime: "15:30" },
  { startTime: "15:30", endTime: "16:00" },
  { startTime: "16:00", endTime: "16:30" },
  { startTime: "16:30", endTime: "17:00" }
];

function generateClinicWorkingHours() {
  return WEEKDAYS.map(day => ({
    day,
    status: day === "sunday" ? "CLOSED" : "OPEN",
    isOpen: day !== "sunday",
    open: "08:00 AM",
    close: "08:00 PM"
  }));
}

function generateDoctorAvailability() {
  return WEEKDAYS.map(day => ({
    day,
    isAvailable: day !== "sunday",
    open: "09:00",
    close: "17:00"
  }));
}

// =========================================================================
// 8. MASTER SEEDING FUNCTION
// =========================================================================
export async function seedTamilNaduDemoData() {
  console.log("============================================================");
  console.log("CAREFLOW — MASTER TAMIL NADU HEALTHCARE DATA SEEDING");
  console.log("============================================================");

  resetIdRegistry();
  await mongoose.connect(DB_URL);
  console.log("Connected to database:", mongoose.connection.name);

  // Clear development collections in dependency order
  console.log("\n[1/7] Purging development data collections safely...");
  await Promise.all([
    OrganizationModel.deleteMany({}),
    UserModel.deleteMany({}),
    DepartmentModel.deleteMany({}),
    DoctorModel.deleteMany({}),
    PatientModel.deleteMany({}),
    AppointmentModel.deleteMany({}),
    MedicalRecordModel.deleteMany({}),
    PrescriptionModel.deleteMany({}),
    PaymentModel.deleteMany({})
  ]);
  console.log("✓ Collections cleared.");

  const globalPasswordHash = await hashPassword(DEMO_PASSWORD);

  // 1. Super Admin Account
  console.log("\n[2/7] Creating Super Admin platform governance account...");
  const superAdmin = await UserModel.create({
    name: "CareFlow Platform Governance",
    email: "superadmin@demo-careflow.in",
    phone: "+91 94440 00001",
    passwordHash: globalPasswordHash,
    role: "super_admin",
    organizationId: null,
    isActive: true,
    mustResetPassword: false,
    profileImage: {
      url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=85",
      publicId: "careflow_superadmin_avatar"
    }
  });
  console.log("✓ Super Admin initialized: superadmin@demo-careflow.in");

  // 2. Organizations & Departments
  console.log("\n[3/7] Creating 8 Tamil Nadu healthcare organizations & departments...");
  const createdOrgs = [];

  for (let i = 0; i < CLINICS.length; i++) {
    const clinic = CLINICS[i];
    const orgBusinessId = generateBusinessId("ORG");
    
    // Generate & upload distinct symbol logo
    const logoSvg = generateSymbolLogoSvg(clinic.logoConcept, clinic.primaryColor);
    const logoAsset = await uploadLogoToCloudinary(logoSvg, clinic.slug);

    const org = await OrganizationModel.create({
      businessId: orgBusinessId,
      name: clinic.name,
      email: clinic.email,
      phone: clinic.phone,
      address: {
        street: clinic.street,
        city: clinic.city,
        district: clinic.district,
        state: "Tamil Nadu",
        country: "India",
        pincode: clinic.pincode,
        latitude: clinic.latitude,
        longitude: clinic.longitude
      },
      organizationLogo: logoAsset,
      status: "approved",
      workingHours: generateClinicWorkingHours()
    });

    // Create default General department
    const generalDept = await DepartmentModel.create({
      name: "General",
      description: "Default primary clinic triage and family consultation discipline",
      organizationId: org._id,
      isActive: true,
      isDefault: true
    });

    const orgDepts = [generalDept];

    // Create additional departments
    for (const [deptName, deptDesc] of clinic.departments) {
      const d = await DepartmentModel.create({
        name: deptName,
        description: deptDesc,
        organizationId: org._id,
        isActive: true,
        isDefault: false
      });
      orgDepts.push(d);
    }

    // Organization Admin Account
    const adminUser = await UserModel.create({
      name: `${clinic.name} Admin`,
      email: `admin.${clinic.slug}@demo-careflow.in`,
      phone: `+91 9444${String(i + 1).padStart(2, "0")} 10001`,
      passwordHash: globalPasswordHash,
      role: "admin",
      organizationId: org._id,
      isActive: true,
      mustResetPassword: false,
      profileImage: {
        url: MALE_DOCTOR_IMAGES[i % MALE_DOCTOR_IMAGES.length],
        publicId: null
      }
    });

    createdOrgs.push({
      org,
      adminUser,
      departments: orgDepts,
      meta: clinic
    });

    console.log(`  ✓ Created: ${clinic.name} (${clinic.district}) [${orgBusinessId}]`);
  }

  // 3. Doctors (Exactly 48 Doctors across 8 Clinics: 6 per clinic, 28 Male, 20 Female)
  console.log("\n[4/7] Registering 48 licensed clinicians with gender-aligned headshots & schedules...");
  const createdDoctors = [];
  let maleDocIndex = 0;
  let femaleDocIndex = 0;

  for (let orgIdx = 0; orgIdx < createdOrgs.length; orgIdx++) {
    const orgObj = createdOrgs[orgIdx];
    const bpStart = orgIdx * 6;
    const orgBlueprints = DOCTOR_BLUEPRINTS.slice(bpStart, bpStart + 6);

    for (let docIdx = 0; docIdx < orgBlueprints.length; docIdx++) {
      const bp = orgBlueprints[docIdx];
      const docBusinessId = generateBusinessId("DOC");

      // Match department
      let targetDept = orgObj.departments.find(d => d.name.toLowerCase() === bp.spec.toLowerCase());
      if (!targetDept) {
        targetDept = orgObj.departments.find(d => d.isDefault) || orgObj.departments[0];
      }

      // Gender-specific profile photo
      const isMale = bp.gender === "Male";
      const photoUrl = isMale
        ? MALE_DOCTOR_IMAGES[maleDocIndex++ % MALE_DOCTOR_IMAGES.length]
        : FEMALE_DOCTOR_IMAGES[femaleDocIndex++ % FEMALE_DOCTOR_IMAGES.length];

      const cleanNameSlug = bp.name.replace(/[^a-zA-Z]/g, "").toLowerCase();
      const docEmail = `dr.${cleanNameSlug}.${orgObj.meta.slug}@demo-careflow.in`;

      const user = await UserModel.create({
        name: `Dr. ${bp.name}`,
        email: docEmail,
        phone: `+91 9840${String(orgIdx + 1)}${String(docIdx + 1).padStart(2, "0")} 123`,
        passwordHash: globalPasswordHash,
        role: "doctor",
        organizationId: orgObj.org._id,
        isActive: true,
        mustResetPassword: false,
        profileImage: {
          url: photoUrl,
          publicId: `careflow_doc_${docBusinessId}`
        }
      });

      // Give 3 doctors in the system a future leave schedule (for leave test validation)
      const hasLeave = (orgIdx === 0 && docIdx === 0) || (orgIdx === 2 && docIdx === 1) || (orgIdx === 5 && docIdx === 2);
      const leaveRecords = [];
      if (hasLeave) {
        const leaveStart = new Date();
        leaveStart.setDate(leaveStart.getDate() + 9);
        leaveStart.setUTCHours(0, 0, 0, 0);

        const leaveEnd = new Date(leaveStart);
        leaveEnd.setDate(leaveStart.getDate() + 2);
        leaveEnd.setUTCHours(23, 59, 59, 999);

        leaveRecords.push({
          startDate: leaveStart,
          endDate: leaveEnd,
          reason: "Attending Annual South Indian Clinical Symposium"
        });
      }

      const doctor = await DoctorModel.create({
        businessId: docBusinessId,
        userId: user._id,
        organizationId: orgObj.org._id,
        departmentId: targetDept._id,
        departmentIds: [targetDept._id],
        departments: [targetDept.name],
        gender: bp.gender,
        specialization: bp.spec,
        qualification: bp.qual,
        consultationFee: bp.fee,
        available: generateDoctorAvailability(),
        leave: leaveRecords
      });

      createdDoctors.push({
        doctor,
        user,
        org: orgObj.org,
        department: targetDept,
        blueprint: bp,
        leaveRecords
      });
    }
  }
  console.log(`✓ 48 Doctors registered (28 Male, 20 Female).`);

  // 4. Patients (90 Patients: 48 Male, 42 Female)
  console.log("\n[5/7] Registering 90 diverse Tamil Nadu patients across districts...");
  const createdPatients = [];
  let malePatIndex = 0;
  let femalePatIndex = 0;

  for (let pIdx = 0; pIdx < RAW_PATIENTS_DATA.length; pIdx++) {
    const rawP = RAW_PATIENTS_DATA[pIdx];
    const patBusinessId = generateBusinessId("PAT");
    const isMale = rawP.gender === "male";
    const assignedOrg = createdOrgs[pIdx % createdOrgs.length].org;

    const photoUrl = isMale
      ? MALE_PATIENT_IMAGES[malePatIndex++ % MALE_PATIENT_IMAGES.length]
      : FEMALE_PATIENT_IMAGES[femalePatIndex++ % FEMALE_PATIENT_IMAGES.length];

    const cleanName = rawP.name.toLowerCase().replace(/\s+/g, ".");
    const email = `${cleanName}.${String(pIdx + 1).padStart(2, "0")}@demo-careflow.in`;

    const user = await UserModel.create({
      name: rawP.name,
      email,
      phone: `+91 9790${String(pIdx + 1).padStart(2, "0")} ${String(1000 + pIdx).slice(0, 4)}`,
      passwordHash: globalPasswordHash,
      role: "patient",
      organizationId: assignedOrg._id,
      isActive: true,
      mustResetPassword: false,
      profileImage: {
        url: photoUrl,
        publicId: `careflow_pat_${patBusinessId}`
      }
    });

    const currentYear = new Date().getFullYear();
    const dobYear = currentYear - rawP.age;
    const dob = new Date(dobYear, (pIdx * 2) % 12, 1 + ((pIdx * 3) % 27));

    const patient = await PatientModel.create({
      businessId: patBusinessId,
      userId: user._id,
      dateOfBirth: dob,
      gender: rawP.gender,
      bloodGroup: rawP.blood,
      address: {
        street: `${15 + pIdx}, Cross Street, ${rawP.city} Central`,
        city: rawP.city,
        district: rawP.district,
        state: "Tamil Nadu",
        pincode: rawP.pincode,
        country: "India"
      },
      emergencyContact: {
        name: `${rawP.name.split(" ")[0]}'s Family Contact`,
        phone: `+91 99400 ${String(10000 + pIdx).slice(0, 5)}`,
        relationship: "Family"
      },
      allergies: pIdx % 9 === 0 ? ["Penicillin"] : (pIdx % 15 === 0 ? ["Sulfa drugs"] : [])
    });

    createdPatients.push({
      patient,
      user,
      raw: rawP
    });
  }
  console.log(`✓ 90 Patients created with complete profiles (48 Male, 42 Female).`);

  // 5. Appointments & Healthcare Ecosystem (Target: Exactly 460 Appointments)
  // - 400 Completed (in past 60 days)
  // - 25 Booked / Scheduled (in future current month)
  // - 20 Confirmed Future (in future current month, pre-paid online)
  // - 15 Cancelled (in past 45 days)
  console.log("\n[6/7] Generating 460 appointments with verified slot & relationship integrity...");

  const createdAppointments = [];
  const createdMedicalRecords = [];
  const createdPrescriptions = [];
  const createdPayments = [];

  // Tracking sets to guarantee 0 doctor double bookings and 0 patient overlaps
  const doctorBookedSlots = new Set();
  const patientBookedSlots = new Set();

  function formatDateStr(d) {
    return d.toISOString().split("T")[0];
  }

  function findFreeSlot(docId, patId, dateCandidates, doctorLeaveDates = [], startIndex = 0) {
    const totalDates = dateCandidates.length;
    for (let offset = 0; offset < totalDates; offset++) {
      const d = dateCandidates[(startIndex + offset) % totalDates];
      const dateStr = formatDateStr(d);
      
      // Do not schedule on doctor leave date
      if (doctorLeaveDates.includes(dateStr)) continue;

      // Do not schedule on Sunday
      if (d.getDay() === 0) continue;

      for (const slot of DAILY_TIME_SLOTS) {
        const docSlotKey = `${docId}__${dateStr}__${slot.startTime}`;
        const patSlotKey = `${patId}__${dateStr}__${slot.startTime}`;

        if (!doctorBookedSlots.has(docSlotKey) && !patientBookedSlots.has(patSlotKey)) {
          doctorBookedSlots.add(docSlotKey);
          patientBookedSlots.add(patSlotKey);
          return {
            appointmentDate: d,
            startTime: slot.startTime,
            endTime: slot.endTime
          };
        }
      }
    }
    // Fallback safe slot if exhausted
    const fallbackD = new Date(dateCandidates[0]);
    fallbackD.setDate(fallbackD.getDate() - 1);
    return {
      appointmentDate: fallbackD,
      startTime: "12:00",
      endTime: "12:30"
    };
  }

  // Pre-generate past dates array (days -65 to -2)
  const now = new Date();
  const pastDatesPool = [];
  for (let daysAgo = 2; daysAgo <= 65; daysAgo++) {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setUTCHours(12, 0, 0, 0);
    if (d.getUTCDay() !== 0) { // Exclude Sundays
      pastDatesPool.push(d);
    }
  }

  // Pre-generate future dates array (days +2 to +25 in future)
  const futureDatesPool = [];
  for (let daysAhead = 2; daysAhead <= 25; daysAhead++) {
    const d = new Date(now);
    d.setDate(d.getDate() + daysAhead);
    d.setUTCHours(12, 0, 0, 0);
    if (d.getUTCDay() !== 0) { // Exclude Sundays
      futureDatesPool.push(d);
    }
  }

  // Distribution quotas per organization (8 orgs total)
  // Total Target: 400 completed, 25 booked, 20 confirmed, 15 cancelled = 460
  // Distribution across 8 orgs:
  // Completed: 50 * 8 = 400
  // Booked: 3 for orgs 0-6, 4 for org 7 = 25
  // Confirmed: 3 for orgs 0-3, 2 for orgs 4-7 = 20
  // Cancelled: 2 for orgs 0-6, 1 for org 7 = 15
  const completedTargetPerOrg = [50, 50, 50, 50, 50, 50, 50, 50]; // = 400
  const bookedTargetPerOrg = [3, 3, 3, 3, 3, 3, 3, 4];          // = 25
  const confirmedTargetPerOrg = [3, 3, 3, 3, 2, 2, 2, 2];       // = 20
  const cancelledTargetPerOrg = [2, 2, 2, 2, 2, 2, 2, 1];       // = 15

  let totalCompletedCount = 0;
  let totalBookedCount = 0;
  let totalConfirmedCount = 0;
  let totalCancelledCount = 0;

  for (let orgIdx = 0; orgIdx < createdOrgs.length; orgIdx++) {
    const orgObj = createdOrgs[orgIdx];
    const orgDocs = createdDoctors.filter(d => d.org._id.equals(orgObj.org._id));
    const orgCompletedTarget = completedTargetPerOrg[orgIdx];
    const orgBookedTarget = bookedTargetPerOrg[orgIdx];
    const orgConfirmedTarget = confirmedTargetPerOrg[orgIdx];
    const orgCancelledTarget = cancelledTargetPerOrg[orgIdx];

    // -------------------------------------------------------------
    // A. 50 Completed Appointments per Org (Total = 400)
    // -------------------------------------------------------------
    for (let c = 0; c < orgCompletedTarget; c++) {
      const doctorObj = orgDocs[c % orgDocs.length];
      const patientObj = createdPatients[(c * 7 + orgIdx * 11) % createdPatients.length];
      
      const slot = findFreeSlot(doctorObj.doctor._id, patientObj.patient._id, pastDatesPool, [], (c * 3 + orgIdx * 7) % pastDatesPool.length);

      // Clinical scenario
      const catalogKey = getCatalogKeyForDept(doctorObj.blueprint.spec);
      const catalog = CLINICAL_CATALOG[catalogKey] || CLINICAL_CATALOG.GeneralMedicine;
      const scenario = catalog.reasons[c % catalog.reasons.length];

      const aptBusinessId = generateBusinessId("APT");
      const completedAt = new Date(slot.appointmentDate);
      const [sh, sm] = slot.startTime.split(":").map(Number);
      completedAt.setHours(sh, sm + 25, 0, 0);

      const appt = await AppointmentModel.create({
        businessId: aptBusinessId,
        organizationId: orgObj.org._id,
        doctorId: doctorObj.doctor._id,
        patientId: patientObj.patient._id,
        departmentId: doctorObj.department._id,
        consultationType: scenario.mode,
        appointmentDate: slot.appointmentDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: "completed",
        consultationStatus: "completed",
        paymentStatus: "paid",
        completedAt,
        reason: scenario.text,
        reasonForVisit: scenario.text,
        triageInfo: {
          chiefComplaint: scenario.complaint,
          severity: c % 6 === 0 ? "moderate" : "low",
          recommendedDepartment: doctorObj.department.name,
          isEmergency: false
        }
      });

      createdAppointments.push(appt);
      totalCompletedCount++;

      // Medical Record for EVERY completed appointment
      const medBusinessId = generateBusinessId("MED");
      const medRecord = await MedicalRecordModel.create({
        businessId: medBusinessId,
        organizationId: orgObj.org._id,
        patientId: patientObj.patient._id,
        appointmentId: appt._id,
        uploadedBy: doctorObj.user._id,
        uploadedByRole: "doctor",
        recordType: c % 4 === 0 ? "consultation_summary" : "clinical_note",
        title: `Clinical Consultation Summary — ${doctorObj.department.name}`,
        description: `Chief Complaint: ${scenario.complaint}. Observations: ${scenario.obs}. Assessment: ${scenario.diag}. Treatment Plan: ${scenario.plan}.`,
        file: {
          url: `https://res.cloudinary.com/careflow-demo/raw/upload/clinical_reports/record_${medBusinessId}.pdf`,
          publicId: `record_${medBusinessId}`,
          resourceType: "raw"
        },
        visibility: "appointment",
        sharedWith: [{ doctorId: doctorObj.doctor._id, sharedAt: completedAt }]
      });
      createdMedicalRecords.push(medRecord);

      // Prescription for ~320 completed appointments (80%)
      if (scenario.meds && scenario.meds.length > 0 && c % 5 !== 0) {
        const rxBusinessId = generateBusinessId("RX");
        const rx = await PrescriptionModel.create({
          businessId: rxBusinessId,
          organizationId: orgObj.org._id,
          appointmentId: appt._id,
          doctorId: doctorObj.doctor._id,
          patientId: patientObj.patient._id,
          diagnosis: scenario.diag,
          medicines: scenario.meds.map(m => ({
            medicineName: m.name,
            dosage: m.dose,
            frequency: m.freq,
            duration: m.dur,
            instructions: m.inst
          })),
          notes: `Follow-up in 4 weeks. Review if symptoms worsen. Generated by Dr. ${doctorObj.blueprint.name}.`
        });
        createdPrescriptions.push(rx);
      }

      // Paid Payment record for EVERY completed appointment
      const payBusinessId = generateBusinessId("PAY");
      const isOnline = scenario.mode === "online" || c % 2 === 0;
      const payment = await PaymentModel.create({
        businessId: payBusinessId,
        appointmentId: appt._id,
        organizationId: orgObj.org._id,
        patientId: patientObj.patient._id,
        doctorId: doctorObj.doctor._id,
        amount: doctorObj.doctor.consultationFee,
        paymentMethod: isOnline ? "online" : "cash",
        status: "paid",
        transactionId: payBusinessId,
        razorpayPaymentId: isOnline ? `pay_demo_${payBusinessId.slice(-8)}` : null,
        paidAt: completedAt
      });
      createdPayments.push(payment);
    }

    // -------------------------------------------------------------
    // B. Booked / Scheduled Appointments per Org (Total = 25)
    // -------------------------------------------------------------
    for (let b = 0; b < orgBookedTarget; b++) {
      const doctorObj = orgDocs[(b + 2) % orgDocs.length];
      const patientObj = createdPatients[(b * 5 + orgIdx * 7) % createdPatients.length];
      
      const leaveDates = (doctorObj.leaveRecords || []).map(l => formatDateStr(l.startDate));
      const slot = findFreeSlot(doctorObj.doctor._id, patientObj.patient._id, futureDatesPool, leaveDates, (b * 2 + orgIdx * 3) % futureDatesPool.length);

      const catalogKey = getCatalogKeyForDept(doctorObj.blueprint.spec);
      const catalog = CLINICAL_CATALOG[catalogKey] || CLINICAL_CATALOG.GeneralMedicine;
      const scenario = catalog.reasons[b % catalog.reasons.length];

      const aptBusinessId = generateBusinessId("APT");
      const appt = await AppointmentModel.create({
        businessId: aptBusinessId,
        organizationId: orgObj.org._id,
        doctorId: doctorObj.doctor._id,
        patientId: patientObj.patient._id,
        departmentId: doctorObj.department._id,
        consultationType: scenario.mode,
        appointmentDate: slot.appointmentDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: "booked",
        consultationStatus: "scheduled",
        paymentStatus: "pending",
        reason: scenario.text,
        reasonForVisit: scenario.text,
        triageInfo: {
          chiefComplaint: scenario.complaint,
          severity: "low",
          recommendedDepartment: doctorObj.department.name,
          isEmergency: false
        }
      });

      createdAppointments.push(appt);
      totalBookedCount++;
      // Booked appointments in pending state: NO payment record created (pay at desk flow)
    }

    // -------------------------------------------------------------
    // C. Confirmed Future Appointments per Org (Total = 20, Pre-paid)
    // -------------------------------------------------------------
    for (let cf = 0; cf < orgConfirmedTarget; cf++) {
      const doctorObj = orgDocs[(cf + 3) % orgDocs.length];
      const patientObj = createdPatients[(cf * 4 + orgIdx * 5 + 20) % createdPatients.length];

      const leaveDates = (doctorObj.leaveRecords || []).map(l => formatDateStr(l.startDate));
      const slot = findFreeSlot(doctorObj.doctor._id, patientObj.patient._id, futureDatesPool, leaveDates, (cf * 2 + orgIdx * 4 + 7) % futureDatesPool.length);

      const catalogKey = getCatalogKeyForDept(doctorObj.blueprint.spec);
      const catalog = CLINICAL_CATALOG[catalogKey] || CLINICAL_CATALOG.GeneralMedicine;
      const scenario = catalog.reasons[(cf + 1) % catalog.reasons.length];

      const aptBusinessId = generateBusinessId("APT");
      const appt = await AppointmentModel.create({
        businessId: aptBusinessId,
        organizationId: orgObj.org._id,
        doctorId: doctorObj.doctor._id,
        patientId: patientObj.patient._id,
        departmentId: doctorObj.department._id,
        consultationType: scenario.mode,
        appointmentDate: slot.appointmentDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: "booked",
        consultationStatus: "scheduled",
        paymentStatus: "paid",
        reason: `${scenario.text} (Prepaid Confirmed)`,
        reasonForVisit: scenario.text,
        triageInfo: {
          chiefComplaint: scenario.complaint,
          severity: "low",
          recommendedDepartment: doctorObj.department.name,
          isEmergency: false
        }
      });

      createdAppointments.push(appt);
      totalConfirmedCount++;

      // Prepaid Payment record for Confirmed Future Consultations
      const payBusinessId = generateBusinessId("PAY");
      const bookingPayment = await PaymentModel.create({
        businessId: payBusinessId,
        appointmentId: appt._id,
        organizationId: orgObj.org._id,
        patientId: patientObj.patient._id,
        doctorId: doctorObj.doctor._id,
        amount: doctorObj.doctor.consultationFee,
        paymentMethod: "online",
        status: "paid",
        transactionId: payBusinessId,
        razorpayPaymentId: `pay_prepaid_${payBusinessId.slice(-8)}`,
        paidAt: new Date(now.getTime() - 2 * 60 * 60 * 1000)
      });
      createdPayments.push(bookingPayment);
    }

    // -------------------------------------------------------------
    // D. Cancelled Appointments per Org (Total = 15, Zero Payments)
    // -------------------------------------------------------------
    for (let cx = 0; cx < orgCancelledTarget; cx++) {
      const doctorObj = orgDocs[(cx + 4) % orgDocs.length];
      const patientObj = createdPatients[(cx * 3 + orgIdx * 4 + 40) % createdPatients.length];
      
      const slot = findFreeSlot(doctorObj.doctor._id, patientObj.patient._id, pastDatesPool, [], (cx * 5 + orgIdx * 7 + 13) % pastDatesPool.length);

      const cancelReasons = [
        "Patient had sudden personal scheduling conflict",
        "Physician called for emergency hospital surgery",
        "Mild symptoms resolved spontaneously prior to appointment",
        "Requested reschedule to next calendar month"
      ];
      const cancelActors = ["patient", "doctor", "admin"];

      const aptBusinessId = generateBusinessId("APT");
      const cancelledAt = new Date(slot.appointmentDate);
      cancelledAt.setHours(7, 30, 0, 0); // Cancelled before session

      const appt = await AppointmentModel.create({
        businessId: aptBusinessId,
        organizationId: orgObj.org._id,
        doctorId: doctorObj.doctor._id,
        patientId: patientObj.patient._id,
        departmentId: doctorObj.department._id,
        consultationType: cx % 2 === 0 ? "offline" : "online",
        appointmentDate: slot.appointmentDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: "cancelled",
        consultationStatus: "cancelled",
        paymentStatus: "pending",
        cancelledBy: cancelActors[cx % cancelActors.length],
        cancelledAt,
        cancelReason: cancelReasons[(cx + orgIdx) % cancelReasons.length],
        reason: "Clinical consultation cancelled prior to visit"
      });

      createdAppointments.push(appt);
      totalCancelledCount++;
      // STRICT RULE: CANCELLED APPOINTMENTS HAVE ZERO PAYMENT DOCUMENT
    }
  }

  console.log(`✓ 460 Appointments generated:`);
  console.log(`    - Completed: ${totalCompletedCount}`);
  console.log(`    - Booked/Upcoming: ${totalBookedCount}`);
  console.log(`    - Confirmed/Upcoming: ${totalConfirmedCount}`);
  console.log(`    - Cancelled: ${totalCancelledCount}`);
  console.log(`✓ Medical Records generated: ${createdMedicalRecords.length}`);
  console.log(`✓ Prescriptions generated: ${createdPrescriptions.length}`);
  console.log(`✓ Paid Payments generated: ${createdPayments.length} (400 completed + 20 prepaid)`);

  // 6. Write Demo Credentials File
  console.log("\n[7/7] Generating development credentials reference file...");
  const demoDataDir = path.resolve(__dirname, "../../demo-data");
  if (!fs.existsSync(demoDataDir)) {
    fs.mkdirSync(demoDataDir, { recursive: true });
  }

  const credentialsPath = path.join(demoDataDir, "demoCredentials.txt");
  let credContent = `========================================================================\n`;
  credContent += `CAREFLOW TAMIL NADU MASTER DEMO DATASET CREDENTIALS\n`;
  credContent += `Generated At: ${new Date().toISOString()}\n`;
  credContent += `Default Password For All Accounts: ${DEMO_PASSWORD}\n`;
  credContent += `========================================================================\n\n`;

  credContent += `------------------------------------------------------------------------\n`;
  credContent += `1. SUPER ADMIN (Platform Governance)\n`;
  credContent += `------------------------------------------------------------------------\n`;
  credContent += `Email:    superadmin@demo-careflow.in\n`;
  credContent += `Password: ${DEMO_PASSWORD}\n`;
  credContent += `Role:     super_admin\n\n`;

  credContent += `------------------------------------------------------------------------\n`;
  credContent += `2. CLINIC ADMINS (8 Organization Admins)\n`;
  credContent += `------------------------------------------------------------------------\n`;
  createdOrgs.forEach((o, idx) => {
    credContent += `${idx + 1}. Clinic:   ${o.meta.name} (${o.meta.district} - ${o.meta.area})\n`;
    credContent += `   Email:    admin.${o.meta.slug}@demo-careflow.in\n`;
    credContent += `   Password: ${DEMO_PASSWORD}\n`;
    credContent += `   Role:     admin\n\n`;
  });

  credContent += `------------------------------------------------------------------------\n`;
  credContent += `3. SAMPLE DOCTOR ACCOUNTS (48 Doctors)\n`;
  credContent += `------------------------------------------------------------------------\n`;
  createdDoctors.slice(0, 16).forEach((d, idx) => {
    credContent += `${idx + 1}. Dr. ${d.blueprint.name} [${d.blueprint.spec}] - ${d.org.name}\n`;
    credContent += `   Email:    ${d.user.email}\n`;
    credContent += `   Password: ${DEMO_PASSWORD}\n`;
    credContent += `   Role:     doctor\n\n`;
  });
  credContent += `... (Total 48 Doctor Accounts generated with pattern: dr.<name>.<clinic-slug>@demo-careflow.in)\n\n`;

  credContent += `------------------------------------------------------------------------\n`;
  credContent += `4. SAMPLE PATIENT ACCOUNTS (90 Patients)\n`;
  credContent += `------------------------------------------------------------------------\n`;
  createdPatients.slice(0, 10).forEach((p, idx) => {
    credContent += `${idx + 1}. ${p.raw.name} (${p.raw.gender}, Age: ${p.raw.age}, ${p.raw.district})\n`;
    credContent += `   Email:    ${p.user.email}\n`;
    credContent += `   Password: ${DEMO_PASSWORD}\n`;
    credContent += `   Role:     patient\n\n`;
  });
  credContent += `... (Total 90 Patient Accounts generated with password: ${DEMO_PASSWORD})\n`;

  fs.writeFileSync(credentialsPath, credContent, "utf8");
  console.log(`✓ Credentials catalog saved to: backend/demo-data/demoCredentials.txt`);

  console.log("\n============================================================");
  console.log("CAREFLOW TAMIL NADU DEMO DATA SEEDING COMPLETE!");
  console.log("============================================================");
}

// Auto-run when executed directly
if (process.argv[1] && process.argv[1].endsWith("seedDemoDataTamilNadu.js")) {
  seedTamilNaduDemoData()
    .then(() => {
      console.log("\nProcess completed successfully. Exiting.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n[SEED ERROR] Seeding aborted due to exception:", err);
      process.exit(1);
    });
}
