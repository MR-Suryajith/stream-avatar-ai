// netlify/functions/generate.js
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
      body: `@${user} - Usage: !generate [prompt]  e.g. !generate a neon dragon`,
    };

  const cleanPrompt = prompt.trim().slice(0, 200);

  // Build Pollinations URL with quality params
  const seed = Math.floor(Math.random() * 999999);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=512&height=512&nologo=true&enhance=true&seed=${seed}`;

  // Pre-warm the image — tell Pollinations to start generating NOW
  // This runs in background while Nightbot shows the chat message
  fetch(imageUrl).catch(() => {});

  const item = {
    id: `img-${Date.now()}`,
    username: user,
    prompt: cleanPrompt,
    imageUrl,
    ts: Date.now(),
  };

  await redisSet("img_latest", item);

  return {
    statusCode: 200,
    headers: HEADERS,
    body: `@${user} Generating "${cleanPrompt}" - watch the stream!`,
  };
};
