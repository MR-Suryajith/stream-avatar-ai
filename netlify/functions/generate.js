// netlify/functions/generate.js
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const NIGHTBOT_SECRET = process.env.NIGHTBOT_SECRET || "change-me";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "text/plain; charset=utf-8",
};

async function redisGet(key) {
  const r = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const d = await r.json();
  const val = d?.result;
  if (!val || val === "null") return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function redisSet(key, value) {
  const r = await fetch(`${REDIS_URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value: JSON.stringify(value) }),
  });
  const d = await r.json();
  console.log("[redisSet result]", JSON.stringify(d));
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
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=512&height=512&nologo=true&seed=${Date.now()}`;

  try {
    // Always start with empty array if get fails
    let queue = [];
    try {
      queue = await redisGet("img_queue");
    } catch (_) {
      queue = [];
    }
    if (!Array.isArray(queue)) queue = [];

    queue.push({
      id: `img-${Date.now()}`,
      username: user,
      prompt: cleanPrompt,
      imageUrl,
      ts: Date.now(),
      shown: false,
    });

    await redisSet("img_queue", queue.slice(-10));

    return {
      statusCode: 200,
      headers: HEADERS,
      body: `@${user} Generating "${cleanPrompt}" - watch the stream!`,
    };
  } catch (err) {
    console.error("[generate error]", err.message);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: `@${user} Error: ${err.message}`,
    };
  }
};
