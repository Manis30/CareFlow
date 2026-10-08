import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import UserModel from "../src/model/user.js";
import DoctorModel from "../src/model/doctor.js";
import { runOrchestratedWorkflow } from "../src/service/ai/orchestrator/agentOrchestrator.js";

async function debug() {
    await mongoose.connect(process.env.DB_URL);
    const docUser = await UserModel.findOne({ name: /Senthil Kumar/i }).lean();
    const doctor = await DoctorModel.findOne({ userId: docUser._id }).lean();
    const docReqUser = { id: String(docUser._id), _id: docUser._id, role: "doctor", organizationId: String(doctor.organizationId) };

    const patDiscRes = await runOrchestratedWorkflow(
        docReqUser,
        { message: "What can you tell me about Patient Records?" }
    );
    console.log("patDiscRes keys:", Object.keys(patDiscRes));
    console.log("patDiscRes.agentState:", JSON.stringify(patDiscRes.agentState, null, 2));

    process.exit(0);
}

debug().catch(console.error);
