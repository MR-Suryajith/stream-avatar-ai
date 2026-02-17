// netlify/functions/generate.js
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const NIGHTBOT_SECRET = process.env.NIGHTBOT_SECRET || "change-me";
const SITE_URL = process.env.URL || "https://stream-avatar.netlify.app";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "text/plain; charset=utf-8",
};

async function redisSet(key, value) {
  console.log("[redisSet] Setting key:", key);
  try {
    const res = await fetch(`${REDIS_URL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["SET", key, JSON.stringify(value), "EX", "300"]),
  });
  const data = await res.json();
  console.log("[redisSet] Result:", JSON.stringify(data));
  } catch (err) {
    console.error("[redisSet] Error:", err);
  }
}

exports.handler = async (event) => {
  console.log("[generate] Incoming request:", event.httpMethod, event.queryStringParameters);
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
      body: `@${user} Usage: !generate [prompt]`,
    };

  const cleanPrompt = prompt.trim().slice(0, 200);

  // Image proxy URL — uses HuggingFace to generate, no CORS issues
  const imageUrl = `${SITE_URL}/.netlify/functions/image-proxy?prompt=${encodeURIComponent(cleanPrompt)}`;

  await redisSet("img_latest", {
    id: `img-${Date.now()}`,
    username: user,
    prompt: cleanPrompt,
    imageUrl,
    ts: Date.now(),
  });

  return {
    statusCode: 200,
    headers: HEADERS,
    body: `@${user} Generating "${cleanPrompt}" - watch the stream!`,
  };
};
