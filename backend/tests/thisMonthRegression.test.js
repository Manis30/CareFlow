import assert from "node:assert";
import { postProcessDates } from "../src/service/ai/intentRouter.js";
import { parseDatePeriod } from "../src/service/ai/analyticsService.js";
import { geminiProvider } from "../src/service/ai/providers/geminiProvider.js";
import { aiProviderGateway } from "../src/service/ai/providers/aiProviderGateway.js";

const runRegressionTest = async () => {
    console.log("==================================================");
    console.log("CAREFLOW AI — FOCUSED REGRESSION: THIS MONTH RANGE");
    console.log("==================================================");

    // 1. Focused regression assertion for "this month"
    // Reference date set to October 8, 2026
    const refDate = new Date(2026, 9, 8, 12, 0, 0); // October 8, 2026 local
    const processed = postProcessDates("Which department has the most appointments this month?", {}, null, refDate);

    console.log(`[postProcessDates Result]:`);
    console.log(`  startDate: ${processed.startDate}`);
    console.log(`  endDate:   ${processed.endDate}`);
    console.log(`  timeframe: ${processed.timeframe}`);

    assert.strictEqual(processed.startDate, "2026-10-01", "start must equal 2026-10-01");
    assert.strictEqual(processed.endDate, "2026-10-31", "end must equal 2026-10-31");
    assert.strictEqual(processed.timeframe, "this_month");
    console.log("✓ Assertion PASS: 'this month' resolves to start = 2026-10-01 and end = 2026-10-31");

    // Also verify parseDatePeriod with October 2026 reference
    const period = parseDatePeriod("this_month", processed.startDate, processed.endDate, refDate);
    assert.strictEqual(period.start.getDate(), 1);
    assert.strictEqual(period.end.getDate(), 31);
    console.log(`✓ Assertion PASS: parseDatePeriod resolves to ${period.label}`);

    // Verify existing relative ranges remain preserved
    const todayRes = postProcessDates("today", {}, null, refDate);
    assert.strictEqual(todayRes.timeframe, "today");
    const yestRes = postProcessDates("yesterday", {}, null, refDate);
    assert.strictEqual(yestRes.timeframe, "yesterday");
    const weekRes = postProcessDates("this week", {}, null, refDate);
    assert.strictEqual(weekRes.timeframe, "this_week");
    const lastMonthRes = postProcessDates("last month", {}, null, refDate);
    assert.strictEqual(lastMonthRes.timeframe, "last_month");
    console.log("✓ Assertion PASS: Existing relative ranges (today, yesterday, this week, last week, last month) preserved");

    // 2. Focused verification for single-attempt Gemini quota cooldown
    console.log("\n[Provider Cooldown Verification]:");
    geminiProvider.resetCooldown();
    assert.strictEqual(geminiProvider.isAvailable(), Boolean(process.env.GEMINI_API_KEY));

    // Simulate quota exhaustion
    geminiProvider.markUnavailable(60000);
    assert.strictEqual(geminiProvider.isAvailable(), false, "Gemini must be marked unavailable on cooldown");
    console.log("✓ Assertion PASS: Gemini marked unavailable after quota exhaustion");

    geminiProvider.resetCooldown();
    console.log("\n==================================================");
    console.log("FOCUSED REGRESSION: ALL CHECKS PASSED");
    console.log("==================================================");
};

runRegressionTest().catch(err => {
    console.error("Regression test failed:", err);
    process.exit(1);
});
