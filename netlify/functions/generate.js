// netlify/functions/generate.js
// Step 1: Store prompt immediately, return to Nightbot fast
// The overlay itself fetches the image directly from Pollinations

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const NIGHTBOT_SECRET = process.env.NIGHTBOT_SECRET || "change-me";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "text/plain; charset=utf-8",
};

async function redisSet(key, value) {
  await fetch(`${REDIS_URL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["SET", key, JSON.stringify(value), "EX", "300"]),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: HEADERS, body: "" };

  const { user, prompt, secret } = event.queryStringParameters || {};

  if (secret !== NIGHTBOT_SECRET)
    return { statusCode: 401, headers: HEADERS, body: "Unauthorized" };
  if (!user) return { statusCode: 400, headers: HEADERS, body: "Missing user" };
  if (!prompt || prompt.trim().length < 2)
    return {
      statusCode: 400,
      headers: HEADERS,
      body: `@${user} Usage: !generate [prompt] e.g. !generate a neon dragon`,
    };

  const cleanPrompt = prompt.trim().slice(0, 200);
  const seed = Math.floor(Math.random() * 999999);

  // Build Pollinations URL
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=512&height=512&nologo=true&enhance=true&seed=${seed}`;

  // Store immediately — overlay will load the image directly
  await redisSet("img_latest", {
    id: `img-${Date.now()}`,
    username: user,
    prompt: cleanPrompt,
    imageUrl, // overlay fetches this URL directly — Pollinations serves when ready
    ts: Date.now(),
  });

  // Respond to Nightbot immediately (no waiting)
  return {
    statusCode: 200,
    headers: HEADERS,
    body: `@${user} Generating "${cleanPrompt}" - watch the stream!`,
  };
};
