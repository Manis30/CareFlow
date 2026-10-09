import puppeteer from "puppeteer-core";
import dotenv from "dotenv";
dotenv.config();

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function testLogin() {
    const browser = await puppeteer.launch({
        executablePath: EDGE_PATH,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
    });

    try {
        const page = await browser.newPage();
        page.on("console", msg => console.log("PAGE LOG:", msg.text()));
        page.on("pageerror", err => console.log("PAGE ERROR:", err.message));
        page.on("response", res => {
            if (res.url().includes("/api/")) {
                console.log(`API [${res.status()}]:`, res.url());
            }
        });

        await page.goto("http://localhost:5173/login", { waitUntil: "networkidle2" });
        await page.type('input[type="email"]', "dr.rkarthikeyan.cmhi@demo-careflow.in");
        await page.type('input[type="password"]', "Password123!");
        await page.click('button[type="submit"]');

        console.log("Submitted login, waiting 4s...");
        await new Promise(r => setTimeout(r, 4000));
        console.log("Current URL after 4s:", page.url());

        const user = await page.evaluate(() => localStorage.getItem("careflow_user"));
        console.log("User in localStorage:", user);
    } finally {
        await browser.close();
    }
}

testLogin().catch(console.error);
