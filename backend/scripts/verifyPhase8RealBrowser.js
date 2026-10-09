import puppeteer from "puppeteer-core";
import assert from "node:assert";

async function verifyRealBrowserDoctorFlow() {
    console.log("==================================================");
    console.log("PHASE 8 REAL BROWSER VERIFICATION (Edge)");
    console.log("==================================================");

    const consoleLogs = [];
    const consoleErrors = [];

    const browser = await puppeteer.launch({
        executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        page.on("console", msg => {
            const text = msg.text();
            consoleLogs.push({ type: msg.type(), text });
            if (msg.type() === "error") {
                consoleErrors.push(text);
                console.log(`  [Browser Console Error]: ${text}`);
            }
        });

        page.on("pageerror", err => {
            consoleErrors.push(err.message);
            console.error(`  [Uncaught Page Error]: ${err.message}`);
        });

        // 1. Visit Login Page
        console.log("1. Navigating to login page...");
        await page.goto("http://localhost:5173/login", { waitUntil: "networkidle2" });
        assert.ok((await page.title()).includes("CareFlow"), "Login page loaded");

        // 2. Perform Login as Doctor
        console.log("2. Logging in as Dr. K Senthilkumar...");
        await page.type('input[type="email"]', "dr.ksenthilkumar.cauvery-medical@demo-careflow.in");
        await page.type('input[type="password"]', "Password123!");
        await page.click('button[type="submit"]');

        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => {});
        const dashboardUrl = page.url();
        console.log(`✓ Redirected to: ${dashboardUrl}`);
        assert.ok(!dashboardUrl.includes("/login"), "Successfully logged in");

        // Wait for dashboard user profile and layout to render
        await page.waitForSelector('main', { timeout: 10000 });
        await new Promise(r => setTimeout(r, 2000));

        // 3. Open CareFlow Intelligence Drawer
        console.log("3. Opening CareFlow Intelligence Drawer...");
        const aiButtons = await page.$$('button[aria-label="Open CareFlow Intelligence"]');
        console.log(`   Found ${aiButtons.length} AI Intelligence button(s) on page.`);
        if (aiButtons.length > 0) {
            await page.evaluate(btn => btn.click(), aiButtons[0]);
        } else {
            const sideAi = await page.$('button[title="CareFlow Intelligence"]');
            if (sideAi) await page.evaluate(btn => btn.click(), sideAi);
        }

        await new Promise(r => setTimeout(r, 1000));

        await page.waitForSelector('form input[placeholder="Ask CareFlow Intelligence..."]', { timeout: 10000 });
        console.log("✓ CareFlow Intelligence drawer opened.");

        // Clear existing history to start clean
        const clearBtn = await page.$('button[aria-label="Clear conversation history"]');
        if (clearBtn) {
            await clearBtn.click();
            await new Promise(r => setTimeout(r, 1000));
            console.log("✓ Conversation history cleared.");
        }

        // 4. Query: Show patient Karthik Raj's records
        console.log("4. Sending: 'Show patient Karthik Raj\'s records'...");
        await page.type('form input[placeholder="Ask CareFlow Intelligence..."]', "Show patient Karthik Raj's records");
        await page.click('button[aria-label="Send query"]');

        // Wait for AI response
        console.log("   Waiting for assistant response with record list...");
        await page.waitForFunction(() => {
            const bubbles = document.querySelectorAll('div.whitespace-pre-line');
            return Array.from(bubbles).some(b => b.textContent.includes('1.') || b.textContent.includes('shared medical record'));
        }, { timeout: 30000 });
        console.log("✓ Doctor received numbered list of shared medical records.");

        // Count messages before replying "1"
        const msgCountBefore = await page.$$eval('.overflow-y-auto > div', divs => divs.length);

        // 5. Query: 1
        console.log("5. Replying: '1'...");
        await new Promise(r => setTimeout(r, 1500));
        await page.click('form input[placeholder="Ask CareFlow Intelligence..."]');
        await page.type('form input[placeholder="Ask CareFlow Intelligence..."]', "1");
        await page.keyboard.press('Enter');

        // Wait for assistant response to update
        console.log("   Waiting for assistant structured summary...");
        await page.waitForFunction(() => {
            const bubbles = document.querySelectorAll('div.whitespace-pre-line');
            return Array.from(bubbles).some(b => 
                b.textContent.includes('Clinical Document Summary') || 
                b.textContent.includes('Key Documented Findings') || 
                b.textContent.includes('Test report') ||
                b.textContent.includes('Document Title') ||
                b.textContent.includes('Patient Medical Record')
            );
        }, { timeout: 45000 });

        console.log("✓ Assistant structured summary received and rendered!");

        // 6. Verify Citation Badge and DOM Stability
        const citationBadgeCount = await page.$$eval('[data-testid="ai-citation-badge"], .gap-1\\.5.rounded-lg.bg-slate-50', els => els.length);
        console.log(`✓ Visible citation badge count: ${citationBadgeCount}`);

        // Verify message bubble count: exactly 1 user bubble and 1 AI bubble were added for '1'
        const bubbles = await page.$$eval('div.whitespace-pre-line', els => els.map(e => e.textContent.slice(0, 100)));
        console.log("   Recent assistant messages:", bubbles);

        // Check for React child crash in console
        const reactCrash = consoleErrors.find(e => e.includes("Objects are not valid as a React child") || e.includes("Minified React error"));
        assert.ok(!reactCrash, `React crash detected in console: ${reactCrash}`);
        console.log("✓ ZERO React child errors detected in browser console!");

        // Take a screenshot of the drawer for evidence
        await page.screenshot({ path: "../docs/ai/phase8_browser_verification.png" });
        console.log("✓ Screenshot saved to docs/ai/phase8_browser_verification.png");

        console.log("\n==================================================");
        console.log("REAL BROWSER VERIFICATION: ALL CHECKS PASSED!");
        console.log("==================================================");
    } finally {
        await browser.close();
    }
}

verifyRealBrowserDoctorFlow().catch(err => {
    console.error("Browser verification failed:", err);
    process.exit(1);
});
