require('dotenv').config();
const fs = require('fs');
const HF_TOKEN = process.env.HF_TOKEN;

const urls = [
    "https://router.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0",
    "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0",
    "https://router.huggingface.co/models/runwayml/stable-diffusion-v1-5",
    "https://router.huggingface.co/models/CompVis/stable-diffusion-v1-4"
];

async function test() {
    let output = "";
    for (const url of urls) {
        output += `Checking: ${url}\n`;
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${HF_TOKEN}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ inputs: "cat" }),
            });
            output += `Status: ${response.status}\n`;
            if (response.status !== 200) {
                 const text = await response.text();
                 output += `Body: ${text.substring(0, 200)}\n`;
            } else {
                output += `Success!\n`;
            }
        } catch (e) {
            output += `Error: ${e.message}\n`;
        }
        output += "---\n";
    }
    fs.writeFileSync('router-test.txt', output);
    console.log("Done");
}
test();
