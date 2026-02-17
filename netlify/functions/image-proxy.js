// netlify/functions/image-proxy.js
// Uses Hugging Face Inference API — responds in 5-10s, within Netlify's 30s limit

const HF_TOKEN = process.env.HF_TOKEN; // your Hugging Face token

exports.handler = async (event) => {
  const HEADERS = { "Access-Control-Allow-Origin": "*" };
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: HEADERS, body: "" };

  const { prompt } = event.queryStringParameters || {};
  console.log("[image-proxy] Request for prompt:", prompt);
  if (!prompt)
    return { statusCode: 400, headers: HEADERS, body: "Missing prompt" };

  try {
    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0",
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
    console.log("[image-proxy] HF Response Status:", response.status);

    if (!response.ok) {
      const err = await response.text();
      console.error("[image-proxy] HF Error Body:", err);
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
