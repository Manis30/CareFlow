import axios from "axios";

async function testDoctorChatApi() {
    console.log("Testing Doctor Chat HTTP API...");
    const api = axios.create({ baseURL: "http://localhost:3000/api/v1" });

    // 1. Login
    const loginRes = await api.post("/auth/login", {
        email: "dr.ksenthilkumar.cauvery-medical@demo-careflow.in",
        password: "Password123!"
    });

    const cookies = loginRes.headers["set-cookie"];
    const cookieHeader = cookies ? cookies.join("; ") : "";
    console.log("✓ Logged in as Dr. K Senthilkumar");

    // Clear history first
    await api.delete("/ai/history", { headers: { Cookie: cookieHeader } });
    console.log("✓ Cleared AI chat history");

    // 2. Query: Show patient Karthik Raj's records
    console.log("\n2. Sending: \"Show patient Karthik Raj's records\"...");
    const r1 = await api.post("/ai/gateway", {
        message: "Show patient Karthik Raj's records"
    }, { headers: { Cookie: cookieHeader } });

    console.log("R1 responseType:", r1.data?.data?.responseType);
    console.log("R1 stage:", r1.data?.data?.agentState?.stage);
    console.log("R1 sharedRecords count:", r1.data?.data?.agentState?.sharedMedicalRecords?.length);
    console.log("R1 aiResponse:\n", r1.data?.data?.aiResponse);

    // 3. Query: 1
    console.log("\n3. Sending: \"1\"...");
    const r2 = await api.post("/ai/gateway", {
        message: "1"
    }, { headers: { Cookie: cookieHeader } });

    console.log("R2 responseType:", r2.data?.data?.responseType);
    console.log("R2 stage:", r2.data?.data?.agentState?.stage);
    console.log("R2 citations:", JSON.stringify(r2.data?.data?.citations, null, 2));
    console.log("R2 aiResponse:\n", r2.data?.data?.aiResponse);

    // 4. Query: all (in fresh discovery)
    await api.delete("/ai/history", { headers: { Cookie: cookieHeader } });
    await api.post("/ai/gateway", {
        message: "Show patient Karthik Raj's records"
    }, { headers: { Cookie: cookieHeader } });

    console.log("\n4. Sending: \"all\"...");
    const r3 = await api.post("/ai/gateway", {
        message: "all"
    }, { headers: { Cookie: cookieHeader } });

    console.log("R3 responseType:", r3.data?.data?.responseType);
    console.log("R3 citations count:", r3.data?.data?.citations?.length);
    console.log("R3 aiResponse:\n", r3.data?.data?.aiResponse?.slice(0, 300));
}

testDoctorChatApi().catch(err => {
    console.error("Test failed:", err.response?.data || err.message);
    process.exit(1);
});
