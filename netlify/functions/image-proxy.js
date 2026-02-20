// netlify/functions/image-proxy.js
// Uses Leonardo.ai API (requires LEONARDO_API_KEY)
// Note: Leonardo generates images asynchronously, so we must poll until it is complete.

const LEONARDO_API_KEY = process.env.LEONARDO_API_KEY;

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

  if (!LEONARDO_API_KEY) {
    return placeholder(HEADERS, "Missing LEONARDO_API_KEY");
  }

  try {
    // 1. Trigger Generation Job
    const createRes = await fetch("https://cloud.leonardo.ai/api/rest/v1/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LEONARDO_API_KEY}`,
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
        guidance_scale: 7,   // Standard SD setting
      }),
    });

    if (!createRes.ok) {
       const err = await createRes.text();
       console.error("[image-proxy] Leonardo Create Error:", err);

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

    // 2. Poll for completion (try every 1.5 seconds, up to 12 times = 18s)
    let imageUrl = null;
    let attempts = 0;

    while (attempts < 12) {
      await sleep(1500);
      attempts++;

      const pollRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
        headers: {
          "Authorization": `Bearer ${LEONARDO_API_KEY}`,
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
        return placeholder(HEADERS, "Leonardo Generation Status FAILED");
      }
    }

    if (!imageUrl) {
       return placeholder(HEADERS, "Timeout waiting for Leonardo to finish");
    }

    console.log(`[image-proxy] Image generated successfully. Fetching to proxy...`);

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
  } catch (err) {
    console.error("[image-proxy error]", err.message);
    return placeholder(HEADERS, "Network or Timeout Error");
  }
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
