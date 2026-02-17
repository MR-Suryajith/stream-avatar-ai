require('dotenv').config();
const HF_TOKEN = process.env.HF_TOKEN;

const fs = require('fs');

async function test() {
    try {
        const response = await fetch(
            "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${HF_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ inputs: "cat" }),
            }
        );
        const text = await response.text();
        fs.writeFileSync('result.txt', `Status: ${response.status}\nBody: ${text}`);
    } catch (e) {
        fs.writeFileSync('result.txt', `Error: ${e.message}`);
    }
}
test();
