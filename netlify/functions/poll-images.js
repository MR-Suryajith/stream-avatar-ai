// netlify/functions/poll-images.js
// Overlay calls this every 3.5s to fetch newly generated AI images

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
  if (!d.result) return [];
  try {
    return JSON.parse(d.result);
  } catch {
    return [];
  }
}

async function redisSet(key, value) {
  await fetch(`${REDIS_URL}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value: JSON.stringify(value) }),
  });
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
    console.error("[poll-images]", err.message);
    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ items: [] }),
    };
  }
};
