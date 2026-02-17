// netlify/functions/generate.js
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const NIGHTBOT_SECRET = process.env.NIGHTBOT_SECRET || "change-me";
const POLLINATIONS_KEY = process.env.POLLINATIONS_KEY || "";
const SITE_URL = process.env.URL || "https://stream-avatar.netlify.app";

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
      body: `@${user} Usage: !generate [prompt]`,
    };

  const cleanPrompt = prompt.trim().slice(0, 200);
  const seed = Math.floor(Math.random() * 999999);

  // Direct Pollinations URL (turbo model = fast ~5-10s)
  let pollinationsUrl = `https://pollinations.ai/p/${encodeURIComponent(cleanPrompt)}?width=512&height=512&nologo=true&model=turbo&seed=${seed}`;
  if (POLLINATIONS_KEY) pollinationsUrl += `&key=${POLLINATIONS_KEY}`;

  // Proxy URL — served from same domain, no CORS issues
  const proxyUrl = `${SITE_URL}/.netlify/functions/image-proxy?url=${encodeURIComponent(pollinationsUrl)}`;

  await redisSet("img_latest", {
    id: `img-${Date.now()}`,
    username: user,
    prompt: cleanPrompt,
    imageUrl: proxyUrl,
    ts: Date.now(),
  });

  return {
    statusCode: 200,
    headers: HEADERS,
    body: `@${user} Generating "${cleanPrompt}" - watch the stream!`,
  };
};
