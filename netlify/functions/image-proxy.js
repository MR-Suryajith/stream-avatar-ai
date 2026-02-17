// netlify/functions/image-proxy.js
// Fetches image from Pollinations server-side and streams it to the overlay
// This bypasses all CORS issues — overlay loads from same domain

exports.handler = async (event) => {
  const { url } = event.queryStringParameters || {};

  if (!url) {
    return { statusCode: 400, body: "Missing url parameter" };
  }

  try {
    // Fetch from Pollinations — server-side has no CORS restrictions
    // Give it up to 25 seconds (Netlify function limit)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(decodeURIComponent(url), {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; StreamOverlay/1.0)" },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        statusCode: 502,
        body: `Pollinations error: ${response.status}`,
      };
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Return image as base64
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
      body: base64,
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error("[image-proxy error]", err.message);
    // Return a placeholder SVG so overlay doesn't break
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="#1a0a2e"/>
      <text x="256" y="240" text-anchor="middle" fill="#a259ff" font-size="48">🎨</text>
      <text x="256" y="300" text-anchor="middle" fill="#ffffff" font-size="24" font-family="sans-serif">Generating...</text>
    </svg>`;
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Access-Control-Allow-Origin": "*",
      },
      body: svg,
    };
  }
};
