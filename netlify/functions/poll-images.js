// netlify/functions/poll-images.js
// Overlay calls this every 3s — returns latest image if it's new

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

async function redisGet(key) {
  const r = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const d = await r.json();
  if (!d.result) return null;
  try {
    return JSON.parse(d.result);
  } catch {
    return null;
  }
}

async function redisDel(key) {
  await fetch(`${REDIS_URL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["DEL", key]),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: HEADERS, body: "" };

  try {
    const item = await redisGet("img_latest");
    if (!item) {
      return {
        statusCode: 200,
        headers: HEADERS,
        body: JSON.stringify({ item: null }),
      };
    }
    // Delete it so it only shows once
    await redisDel("img_latest");
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ item }),
    };
  } catch (err) {
    console.error("[poll-images]", err.message);
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ item: null }),
    };
  }
};
