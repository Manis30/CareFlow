import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import UserModel from "../src/model/user.js";
import { runOrchestratedWorkflow } from "../src/service/ai/orchestrator/agentOrchestrator.js";

async function main() {
    console.log("=== RUNNING PART 23 MINIMAL SMOKE CHECKS ===");
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to MongoDB.");

    const patUser = await UserModel.findOne({ role: "patient" }).lean();
    const docUser = await UserModel.findOne({ role: "doctor" }).lean();
    const adminUser = await UserModel.findOne({ role: "admin" }).lean();
    const superAdminUser = await UserModel.findOne({ role: "super_admin" }).lean();

    const results = [];

    // Check 1: Patient - Show my upcoming appointments
    console.log("\n[Check 1] Patient: 'Show my upcoming appointments.'");
    const res1 = await runOrchestratedWorkflow(
        { _id: patUser._id, id: patUser._id, role: "patient", organizationId: patUser.organizationId },
        { message: "Show my upcoming appointments." }
    );
    console.log("Check 1 Result:", {
        success: res1.success,
        responseType: res1.responseType,
        toolUsed: res1.toolUsed,
        snippet: (res1.aiResponse || "").slice(0, 150)
    });
    results.push({
        name: "Patient: Show upcoming appointments",
        pass: res1.success && res1.responseType !== "ERROR" && !res1.aiResponse.includes("unable to understand")
    });

    // Check 2: Doctor - What is my schedule today?
    console.log("\n[Check 2] Doctor: 'What is my schedule today?'");
    const res2 = await runOrchestratedWorkflow(
        { _id: docUser._id, id: docUser._id, role: "doctor", organizationId: docUser.organizationId },
        { message: "What is my schedule today?" }
    );
    console.log("Check 2 Result:", {
        success: res2.success,
        responseType: res2.responseType,
        toolUsed: res2.toolUsed,
        snippet: (res2.aiResponse || "").slice(0, 150)
    });
    results.push({
        name: "Doctor: What is my schedule today?",
        pass: res2.success && res2.responseType !== "ERROR" && !res2.aiResponse.includes("unable to understand")
    });

    // Check 3: Doctor - What can you tell me about Patient Records?
    console.log("\n[Check 3] Doctor: 'What can you tell me about Patient Records?'");
    const res3 = await runOrchestratedWorkflow(
        { _id: docUser._id, id: docUser._id, role: "doctor", organizationId: docUser.organizationId },
        { message: "What can you tell me about Patient Records?" }
    );
    console.log("Check 3 Result:", {
        success: res3.success,
        responseType: res3.responseType,
        toolUsed: res3.toolUsed,
        snippet: (res3.aiResponse || "").slice(0, 150)
    });
    results.push({
        name: "Doctor: Patient Records Discovery",
        pass: res3.success && res3.responseType !== "ERROR" && !res3.aiResponse.includes("unable to understand")
    });

    // Check 4: Admin - Which department has the most appointments this month?
    console.log("\n[Check 4] Admin: 'Which department has the most appointments this month?'");
    const res4 = await runOrchestratedWorkflow(
        { _id: adminUser._id, id: adminUser._id, role: "admin", organizationId: adminUser.organizationId },
        { message: "Which department has the most appointments this month?" }
    );
    console.log("Check 4 Result:", {
        success: res4.success,
        responseType: res4.responseType,
        toolUsed: res4.toolUsed,
        snippet: (res4.aiResponse || "").slice(0, 150)
    });
    results.push({
        name: "Admin: Department with most appointments",
        pass: res4.success && res4.responseType !== "ERROR" && !res4.aiResponse.includes("unable to understand")
    });

    // Check 5: Super Admin - How many organizations are active?
    console.log("\n[Check 5] Super Admin: 'How many organizations are active?'");
    const res5 = await runOrchestratedWorkflow(
        { _id: superAdminUser._id, id: superAdminUser._id, role: "super_admin", organizationId: superAdminUser.organizationId },
        { message: "How many organizations are active?" }
    );
    console.log("Check 5 Result:", {
        success: res5.success,
        responseType: res5.responseType,
        toolUsed: res5.toolUsed,
        snippet: (res5.aiResponse || "").slice(0, 150)
    });
    results.push({
        name: "Super Admin: How many organizations active",
        pass: res5.success && res5.responseType !== "ERROR" && !res5.aiResponse.includes("unable to understand")
    });

    console.log("\n=== SUMMARY OF SMOKE CHECKS ===");
    console.table(results);

    const allPassed = results.every(r => r.pass);
    if (!allPassed) {
        console.error("Some smoke checks failed!");
        process.exit(1);
    }
    console.log("All 5 role smoke checks passed successfully!");
    process.exit(0);
}

main().catch(err => {
    console.error("Error running smoke checks:", err);
    process.exit(1);
});
