// netlify/functions/poll-images.js
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

async function redisPipeline(commands) {
  const r = await fetch(`${REDIS_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  return r.json();
}

async function redisGet(key) {
  const result = await redisPipeline([["GET", key]]);
  const val = result?.[0]?.result;
  if (!val) return [];
  try {
    return JSON.parse(val);
  } catch {
    return [];
  }
}

async function redisSet(key, value) {
  await redisPipeline([["SET", key, JSON.stringify(value)]]);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers: HEADERS, body: "" };

  try {
    const queue = await redisGet("img_queue");
    const newItems = queue.filter((i) => !i.shown);

    if (newItems.length > 0) {
      const updated = queue.map((i) =>
        newItems.find((n) => n.id === i.id) ? { ...i, shown: true } : i,
      );
      await redisSet("img_queue", updated.slice(-10));
    }

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ items: newItems }),
    };
  } catch (err) {
    console.error("[poll-images error]", err.message);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: err.message, items: [] }),
    };
  }
};
