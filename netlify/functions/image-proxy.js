// netlify/functions/image-proxy.js
// Uses Hugging Face Inference API — responds in 5-10s, within Netlify's 30s limit

const HF_TOKEN = process.env.HF_TOKEN; // your Hugging Face token

exports.handler = async (event) => {
  const HEADERS = { "Access-Control-Allow-Origin": "*" };
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: HEADERS, body: "" };

  const { prompt } = event.queryStringParameters || {};
  if (!prompt)
    return { statusCode: 400, headers: HEADERS, body: "Missing prompt" };

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
          inputs: decodeURIComponent(prompt),
          parameters: { width: 512, height: 512 },
        }),
      },
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("[HF error]", err);
      // Return placeholder
      return placeholder(HEADERS);
    }

    const ct = response.headers.get("content-type") || "image/jpeg";
    const buf = await response.arrayBuffer();
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
    return placeholder(HEADERS);
  }
};

function placeholder(HEADERS) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect width="512" height="512" fill="#1a0a2e"/>
    <text x="256" y="256" text-anchor="middle" fill="#a259ff" font-size="80">🎨</text>
  </svg>`;
  return {
    statusCode: 200,
    headers: { ...HEADERS, "Content-Type": "image/svg+xml" },
    body: svg,
  };
}
