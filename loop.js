"use strict";

const { extractFormData, generateRequestBody, submitForm } = require("./assets");
const config = require("./config");

// Settings
const MIN_DELAY_SEC = 22;           // Minimum wait time between submissions
const MAX_DELAY_SEC = 45;           // Maximum wait time between submissions
const DURATION_MS = 30 * 60 * 1000; // Total runtime: 30 minutes

let runCount = 0;
const startTime = Date.now();

// Helper to pause execution
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper for random numbers in a range
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function runAutomation() {
    try {
        runCount++;
        console.log(`\n--- Starting submission run #${runCount} at ${new Date().toLocaleTimeString()} ---`);

        const formUrl = config.url;
        if (!formUrl) {
            console.error("Error: 'url' is missing in config.js");
            return;
        }

        console.log("Fetching form metadata...");
        const { fbzx, fbPublicLoadData } = await extractFormData(formUrl);

        // Simulate human "thinking/filling out" time (3 to 7 seconds)
        const thinkTimeMs = getRandomInt(3000, 7000);
        console.log(`Simulating form interaction time (${(thinkTimeMs / 1000).toFixed(1)}s)...`);
        await sleep(thinkTimeMs);

        console.log("Generating randomized answers...");
        const requestBody = generateRequestBody(fbzx, fbPublicLoadData);

        console.log("Submitting form response...");
        const response = await submitForm(formUrl, fbzx, requestBody);

        if (response.ok || response.status === 200 || response.status === 302) {
            console.log(`[SUCCESS] Submission #${runCount} completed! (Status: ${response.status})`);
        } else {
            console.log(`[WARNING] Received response status: ${response.status}`);
        }
    } catch (error) {
        console.error("[ERROR] Submission failed:", error.message);
    }
}

async function startLoop() {
    console.log(`====================================================`);
    console.log(`Starting randomized anti-bot submission loop.`);
    console.log(`- Dynamic delay: ${MIN_DELAY_SEC}s to ${MAX_DELAY_SEC}s + human think-time`);
    console.log(`- Runtime limit: 30 minutes`);
    console.log(`- Scheduled auto-stop: ${new Date(startTime + DURATION_MS).toLocaleTimeString()}`);
    console.log(`====================================================\n`);

    while (Date.now() - startTime < DURATION_MS) {
        await runAutomation();

        // Calculate remaining time before auto-shutdown
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime >= DURATION_MS) break;

        // Pick a random delay between MIN_DELAY_SEC and MAX_DELAY_SEC
        const nextDelaySec = getRandomInt(MIN_DELAY_SEC, MAX_DELAY_SEC);
        console.log(`Waiting ${nextDelaySec} seconds before the next run...`);
        
        // Wait before next loop iteration
        await sleep(nextDelaySec * 1000);
    }

    console.log(`\n====================================================`);
    console.log(`⏰ 30 minutes completed! Total successful submissions: ${runCount}`);
    console.log(`Script finished and exiting automatically.`);
    console.log(`====================================================`);
    process.exit(0);
}

startLoop();