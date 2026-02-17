// debug-check.js
// Run this with: node debug-check.js
// Make sure your .env file is loaded or variables are set in your shell
require('dotenv').config();

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const HF_TOKEN = process.env.HF_TOKEN;

console.log("=== Environment Check ===");
console.log("UPSTASH_REDIS_REST_URL:", REDIS_URL ? "✅ Set" : "❌ Missing");
console.log("UPSTASH_REDIS_REST_TOKEN:", REDIS_TOKEN ? "✅ Set" : "❌ Missing");
console.log("HF_TOKEN:", HF_TOKEN ? "✅ Set" : "❌ Missing");

async function testRedis() {
  console.log("\n=== Testing Redis Connection ===");
  if (!REDIS_URL || !REDIS_TOKEN) {
    console.log("⚠️  Skipping Redis test due to missing variables.");
    return;
  }
  try {
    const response = await fetch(`${REDIS_URL}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${REDIS_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(["PING"]),
    });
    const data = await response.json();
    console.log("Redis Response:", JSON.stringify(data));
    if (data.result === 'PONG') {
        console.log("✅ Redis Connection Successful");
    } else {
        console.log("❌ Redis Connection Failed (Unexpected response)");
    }
  } catch (err) {
    console.error("❌ Redis Connection Error:", err.message);
  }
}

async function testHF() {
    console.log("\n=== Testing Hugging Face API ===");
    if (!HF_TOKEN) {
        console.log("⚠️  Skipping HF test due to missing token.");
        return;
    }
    try {
        const response = await fetch(
            "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${HF_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    inputs: "A cute robot giving a thumbs up, cartoon style",
                }),
            }
        );

        if (response.ok) {
            console.log("✅ HF Generation Successful (Status 200)");
            console.log("ContentType:", response.headers.get('content-type'));
        } else {
            console.log(`❌ HF Request Failed: ${response.status} ${response.statusText}`);
            console.log("Response Body:", await response.text());
        }
    } catch (err) {
        console.error("❌ HF Connection Error:", err.message);
    }
}

async function run() {
    await testRedis();
    await testHF();
    console.log("\n=== Done ===");
}

run();
