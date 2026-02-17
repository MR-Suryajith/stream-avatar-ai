// netlify/functions/image-proxy.js
// Fetches Pollinations image server-side — bypasses browser CORS completely

exports.handler = async (event) => {
  const HEADERS_OUT = { "Access-Control-Allow-Origin": "*" };
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: HEADERS_OUT, body: "" };

  const { url } = event.queryStringParameters || {};
  if (!url)
    return { statusCode: 400, headers: HEADERS_OUT, body: "Missing url" };

  const imageUrl = decodeURIComponent(url);

  // Try up to 3 times with 8s timeout each
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      const r = await fetch(imageUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      clearTimeout(timer);

      const ct = r.headers.get("content-type") || "";
      if (r.ok && ct.startsWith("image/")) {
        const buf = await r.arrayBuffer();
        const b64 = Buffer.from(buf).toString("base64");
        return {
          statusCode: 200,
          headers: {
            ...HEADERS_OUT,
            "Content-Type": ct,
            "Cache-Control": "public, max-age=3600",
          },
          body: b64,
          isBase64Encoded: true,
        };
      }
      // Not an image yet — wait and retry
      await new Promise((r) => setTimeout(r, 3000));
    } catch (_) {
      if (attempt < 3) await new Promise((r) => setTimeout(r, 3000));
    }
  }

  // All attempts failed — return placeholder
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect width="512" height="512" fill="#1a0a2e"/>
    <text x="256" y="256" text-anchor="middle" fill="#a259ff" font-size="60">🎨</text>
  </svg>`;
  return {
    statusCode: 200,
    headers: { ...HEADERS_OUT, "Content-Type": "image/svg+xml" },
    body: svg,
  };
};
