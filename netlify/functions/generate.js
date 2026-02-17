// netlify/functions/generate.js
// Waits for Pollinations to finish BEFORE storing — so overlay gets a ready image
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

async function waitForImage(url, maxWaitMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const r = await fetch(url);
      const ct = r.headers.get("content-type") || "";
      if (r.ok && ct.includes("image")) {
        return true; // image is ready
      }
    } catch (_) {}
    // wait 4 seconds before retrying
    await new Promise((res) => setTimeout(res, 4000));
  }
  return false;
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
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=512&height=512&nologo=true&enhance=true&seed=${seed}`;

  // Tell Nightbot immediately so chat gets a response
  // Meanwhile wait for image to be ready (up to 60s)
  const ready = await waitForImage(imageUrl, 55000);

  if (!ready) {
    return {
      statusCode: 200,
      headers: HEADERS,
      body: `@${user} Image took too long - try again!`,
    };
  }

  // Image is confirmed ready — store it
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
    body: `@${user} Your image is on stream now! "${cleanPrompt}"`,
  };
};
