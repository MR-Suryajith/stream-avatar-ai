// netlify/functions/image-proxy.js
// Uses Leonardo.ai API with multi-key rotation
// Note: Leonardo generates images asynchronously, so we must poll until it is complete.

// Support multiple API keys separated by commas (e.g. KEY1,KEY2,KEY3)
const RAW_KEYS = process.env.LEONARDO_API_KEY || "";
const API_KEYS = RAW_KEYS.split(',').map(k => k.trim()).filter(k => k.length > 0);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

exports.handler = async (event) => {
  const HEADERS = { "Access-Control-Allow-Origin": "*" };
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: HEADERS, body: "" };

  const { prompt } = event.queryStringParameters || {};
  console.log("[image-proxy] Request for prompt:", prompt);

  if (!prompt)
    return { statusCode: 400, headers: HEADERS, body: "Missing prompt" };

  if (API_KEYS.length === 0) {
    return placeholder(HEADERS, "Missing LEONARDO_API_KEY");
  }

  // Try each API key in order
  for (let i = 0; i < API_KEYS.length; i++) {
    const currentKey = API_KEYS[i];
    console.log(`[image-proxy] Trying API Key ${i + 1}/${API_KEYS.length}`);

    try {
      // 1. Trigger Generation Job
      const createRes = await fetch("https://cloud.leonardo.ai/api/rest/v1/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${currentKey}`,
          "Content-Type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          prompt: decodeURIComponent(prompt),
          height: 512,
          width: 512,
          num_images: 1,
          alchemy: false,      // Forces premium features off
          promptMagic: false,  // Forces premium features off
          guidance_scale: 12,   // Standard SD setting
        }),
      });

      if (!createRes.ok) {
         const err = await createRes.text();
         console.error(`[image-proxy] Leonardo Create Error on Key ${i+1}:`, err);

         // If we are out of tokens (usually 402 or 429) or unauthorized, try the next key
         if (createRes.status === 402 || createRes.status === 401 || createRes.status === 429) {
            console.log(`[image-proxy] Key ${i+1} failed/exhausted. Falling back to next key if available...`);
            continue;
         }

         // For other catastrophic API errors, we abort entirely
         let errMsg = `Status ${createRes.status}`;
         try {
           const j = JSON.parse(err);
           if (j.error) errMsg = j.error;
         } catch(e) {}
         return placeholder(HEADERS, errMsg.slice(0, 50));
      }

      const createData = await createRes.json();
      const generationId = createData.sdGenerationJob?.generationId;

      if (!generationId) {
        return placeholder(HEADERS, "No generation ID returned by Leonardo");
      }

      // 2. Poll for completion (try every 1.5 seconds, up to 5 times = 7.5s)
      let imageUrl = null;
      let attempts = 0;

      while (attempts < 5) {
        await sleep(1500);
        attempts++;

        const pollRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
          headers: {
            "Authorization": `Bearer ${currentKey}`,
            "accept": "application/json"
          }
        });

        if (!pollRes.ok) continue;

        const pollData = await pollRes.json();
        const status = pollData.generations_by_pk?.status;

        console.log(`[image-proxy] Poll ${attempts}: Status = ${status}`);

        if (status === "COMPLETE") {
          const images = pollData.generations_by_pk.generated_images;
          if (images && images.length > 0) {
            imageUrl = images[0].url;
            break;
          }
        } else if (status === "FAILED") {
           console.log(`[image-proxy] Generation FAILED on Key ${i+1}. Trying next key...`);
           break;
        }
      }

      // If we got an image url, we fetch it and return it (Success path)
      if (imageUrl) {
        console.log(`[image-proxy] Image generated successfully on Key ${i+1}. Fetching to proxy...`);

        // 3. Fetch the actual image bits and proxy it as base64
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) {
           return placeholder(HEADERS, "Failed to download image from Leonardo CDN");
        }

        const ct = imgRes.headers.get("content-type") || "image/jpeg";
        const buf = await imgRes.arrayBuffer();
        const b64 = Buffer.from(buf).toString("base64");

        return {
          statusCode: 200,
          headers: {
            ...HEADERS,
            "Content-Type": ct,
            "Cache-Control": "public, max-age=3600",
          },
          body: b64,
          isBase64Encoded: true,
        };
      }

    } catch (err) {
      console.error(`[image-proxy] Exception on Key ${i+1}:`, err.message);
      // Let it loop and try the next key
    }
  } // end of for loop

  // If we made it all the way through the loop without successfully returning an image:
  return placeholder(HEADERS, "All API keys failed or ran out of quota");
};

function placeholder(HEADERS, errMessage = "Generation Failed") {
  // Sanitize the error message to safely embed in SVG
  const safeMsg = String(errMessage).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect width="512" height="512" fill="#1a0a2e"/>
    <text x="256" y="220" text-anchor="middle" fill="#a259ff" font-size="80">🎨</text>
    <text x="256" y="320" text-anchor="middle" fill="#ff5555" font-family="sans-serif" font-size="20">API Error:</text>
    <text x="256" y="360" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="16">${safeMsg}</text>
  </svg>`;
  return {
    statusCode: 200,
    headers: { ...HEADERS, "Content-Type": "image/svg+xml" },
    body: svg,
  };
}
