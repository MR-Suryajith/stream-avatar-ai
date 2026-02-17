// netlify/functions/generate.js
// Called by Nightbot: !generate [prompt]
// Uses Pollinations.ai — FREE, no API key needed
// URL: https://YOUR-SITE.netlify.app/.netlify/functions/generate?user=USERNAME&prompt=a+glowing+sword&secret=TOKEN

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/plain",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const params = event.queryStringParameters || {};
  const { user, prompt, secret } = params;

  // ── Auth check ─────────────────────────────────
  const NIGHTBOT_SECRET = process.env.NIGHTBOT_SECRET || "change-me";
  if (secret !== NIGHTBOT_SECRET) {
    return { statusCode: 401, headers, body: "❌ Unauthorized" };
  }

  if (!user) {
    return { statusCode: 400, headers, body: "❌ Missing user parameter" };
  }

  if (!prompt || prompt.trim().length < 2) {
    return {
      statusCode: 400,
      headers,
      body: `@${user} ➜ Usage: !generate [your prompt] e.g. !generate a neon dragon`,
    };
  }

  // ── Build Pollinations image URL ──────────────
  // Pollinations.ai is a free AI image API — no key needed
  // Format: https://image.pollinations.ai/prompt/{prompt}?width=512&height=512&nologo=true
  const cleanPrompt = prompt.trim().slice(0, 200); // cap prompt length
  const encodedPrompt = encodeURIComponent(cleanPrompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true&seed=${Date.now()}`;

  // ── Store in Netlify Blobs so overlay can fetch it ──
  try {
    const store = getStore("overlay-queue");

    // Get existing queue
    let queue = [];
    try {
      const raw = await store.get("image-queue", { type: "json" });
      queue = Array.isArray(raw) ? raw : [];
    } catch (_) {
      queue = [];
    }

    // Add new item, cap queue at 10
    queue.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      username: user,
      prompt: cleanPrompt,
      imageUrl,
      ts: Date.now(),
      shown: false,
    });
    if (queue.length > 10) queue = queue.slice(-10);

    await store.setJSON("image-queue", queue);

    return {
      statusCode: 200,
      headers,
      body: `@${user} 🎨 Generating "${cleanPrompt}" — watch the stream! ✨`,
    };
  } catch (err) {
    console.error("Blob store error:", err);
    // Even if storage fails, return a useful message
    return {
      statusCode: 200,
      headers,
      body: `@${user} 🎨 Generating your image now — watch the stream!`,
    };
  }
};
